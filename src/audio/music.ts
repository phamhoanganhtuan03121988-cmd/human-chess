/**
 * Ambience: an extremely quiet, dark "room tone" (filtered brown noise with a
 * very slow swell). No music. Starts only after audio is unlocked and sound
 * is on; stops when muted.
 */
import { VOLUME } from './volume.ts';

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
