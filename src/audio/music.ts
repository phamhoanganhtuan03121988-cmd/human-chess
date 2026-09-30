/**
 * Background layers under the sound effects:
 *
 * - Ambience: an extremely quiet, dark "room tone" (filtered brown noise with
 *   a very slow swell). Starts only after audio is unlocked and sound is on.
 * - Music: a real looping track (MUSIC_TRACK_URL), streamed by one media
 *   element routed through the shared AudioContext's master bus, so the
 *   master mute/volume apply to it as well. It starts only when the player
 *   starts a game (a user gesture), follows its own on/off and volume
 *   settings, pauses while the page is hidden, and is disabled for the rest
 *   of the session if the file is missing or unplayable.
 */
import { getAudio, unlockAudio } from './audioContext.ts';
import { VOLUME, getMusicVolume, getVolume, isMusicEnabled, isMuted } from './volume.ts';

interface Ambience {
  src: AudioBufferSourceNode;
  lfo: OscillatorNode;
  gain: GainNode;
}

let current: Ambience | null = null;

function brownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  // Crossfade the tail into the head so the loop point is inaudible.
  const fade = Math.floor(ctx.sampleRate * 0.5);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[len - fade + i] = d[len - fade + i]! * (1 - k) + d[i]! * k;
  }
  return buf;
}

export function startAmbience(ctx: AudioContext, destination: AudioNode): void {
  if (current) return;
  const src = ctx.createBufferSource();
  src.buffer = brownNoise(ctx, 8);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(VOLUME.ambience, t + 3); // slow fade-in
  // Very slow, shallow swell (≈ 14 s period) — "wind in the hall".
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = VOLUME.ambience * 0.35;
  lfo.connect(depth).connect(gain.gain);
  src.connect(lp).connect(gain).connect(destination);
  src.start();
  lfo.start();
  current = { src, lfo, gain };
}

export function stopAmbience(ctx: AudioContext | null): void {
  if (!current) return;
  const { src, lfo, gain } = current;
  current = null;
  const t = ctx?.currentTime ?? 0;
  try {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.2);
    src.stop(t + 1);
    lfo.stop(t + 1);
  } catch {
    /* already stopped */
  }
}

export function isAmbienceRunning(): boolean {
  return current !== null;
}

// ---- Background music --------------------------------------------------

/**
 * The soundtrack (public/assets/audio/xiangqi-theme.mp3): an instrumental
 * wuxia-style loop (~3 min 13 s, 48 kHz stereo MP3). If it ever fails to
 * load, the music layer reports 'unavailable' and stays silent.
 */
export const MUSIC_TRACK_URL = '/assets/audio/xiangqi-theme.mp3';

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

interface MusicPlayer {
  readonly el: HTMLAudioElement;
  /** Gain inside the shared AudioContext (null if the element could not be routed). */
  readonly gain: GainNode | null;
}

let player: MusicPlayer | null = null;
let musicStatus: MusicStatus = 'idle';
/** The player asked for music (started a game); music never starts on its own. */
let wanted = false;
const statusListeners = new Set<() => void>();
let createElement: () => HTMLAudioElement = () => new Audio();

function setStatus(next: MusicStatus): void {
  if (next === musicStatus) return;
  musicStatus = next;
  statusListeners.forEach((l) => l());
}

export function getMusicStatus(): MusicStatus {
  return musicStatus;
}

export function subscribeMusicStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function markUnavailable(): void {
  if (player) {
    try {
      player.el.pause();
      player.el.removeAttribute('src');
      player.gain?.disconnect();
    } catch {
      /* ignore */
    }
  }
  player = null;
  setStatus('unavailable');
}

/** Creates the single music player (needs the unlocked AudioContext). */
function ensurePlayer(): MusicPlayer | null {
  if (musicStatus === 'unavailable') return null;
  if (player) return player;
  const audio = getAudio();
  if (!audio) return null;
  const el = createElement();
  el.loop = true;
  el.preload = 'auto';
  el.addEventListener('error', markUnavailable);
  el.addEventListener('playing', () => setStatus('playing'));
  el.addEventListener('pause', () => {
    if (musicStatus !== 'unavailable') setStatus('paused');
  });
  let gain: GainNode | null = null;
  try {
    const source = audio.ctx.createMediaElementSource(el);
    gain = audio.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(audio.master);
  } catch {
    gain = null; // fall back to the element's own volume
  }
  el.src = MUSIC_TRACK_URL;
  player = { el, gain };
  setStatus('loading');
  return player;
}

function shouldPlay(): boolean {
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  return wanted && isMusicEnabled() && !isMuted() && getVolume() > 0 && getMusicVolume() > 0 && !hidden;
}

/** Brings the music in line with the settings; safe to call any time. */
export function applyMusic(): void {
  if (!shouldPlay()) {
    if (player && !player.el.paused) player.el.pause();
    return;
  }
  const p = ensurePlayer();
  if (!p) return;
  const level = VOLUME.music * getMusicVolume();
  const audio = getAudio();
  if (p.gain && audio) {
    const t = audio.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setTargetAtTime(level, t, 0.4); // gentle fade in / level change
  } else {
    p.el.volume = Math.min(1, level * getVolume());
  }
  if (p.el.paused) {
    const started = p.el.play();
    if (started && typeof started.catch === 'function') {
      started.catch((err: unknown) => {
        // Autoplay refusal: wait for the next gesture. Anything else: no usable track.
        if (err instanceof Error && err.name === 'NotAllowedError') setStatus('paused');
        else if (!(err instanceof Error && err.name === 'AbortError')) markUnavailable();
      });
    }
  }
}

/** Call from a user gesture (e.g. "CHƠI NGAY"): allows the music to start. */
export function requestMusic(): void {
  wanted = true;
  unlockAudio();
  applyMusic();
}

/** Test helpers. */
export function setMusicElementFactory(factory: (() => HTMLAudioElement) | null): void {
  createElement = factory ?? (() => new Audio());
}
export function resetMusicForTests(): void {
  if (player) {
    try {
      player.el.pause();
    } catch {
      /* ignore */
    }
  }
  player = null;
  wanted = false;
  musicStatus = 'idle';
  statusListeners.clear();
}
