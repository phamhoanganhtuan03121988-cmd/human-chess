/**
 * Central audio levels and the persisted sound on/off preference.
 * Levels are linear gains (0–1) relative to the master output.
 */
export const VOLUME = {
  combatImpact: 0.65,
  gameOver: 0.55,
  check: 0.45,
  capture: 0.4,
  move: 0.25,
  select: 0.2,
  turn: 0.15,
  /** Card / VS / tension cues inside the combat timeline. */
  combatCue: 0.18,
  hover: 0.08,
  /** Room tone; barely audible. */
  ambience: 0.022,
  /** Background music at full music volume: well below the effects (~20%). */
  music: 0.2,
} as const;

export const MUTE_STORAGE_KEY = 'human-chess:sound-muted';

function readStored(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readStored();
const listeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* storage unavailable: preference lasts for this page only */
  }
  for (const l of listeners) l(muted);
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Subscribe to mute changes; returns an unsubscribe function. */
export function subscribeMute(listener: (muted: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-reads the stored preference (tests / page reload simulation). */
export function reloadMutePreference(): void {
  muted = readStored();
  for (const l of listeners) l(muted);
}

// ---- Master volume (0–1), persisted -------------------------------------

export const VOLUME_STORAGE_KEY = 'human-chess:sound-volume';
export const DEFAULT_VOLUME = 0.8;

function readVolume(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOLUME_STORAGE_KEY) : null;
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

let volume = readVolume();
const volumeListeners = new Set<(v: number) => void>();

export function getVolume(): number {
  return volume;
}

export function setVolume(next: number): void {
  const v = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_VOLUME));
  if (v === volume) return;
  volume = v;
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  for (const l of volumeListeners) l(volume);
}

export function subscribeVolume(listener: (v: number) => void): () => void {
  volumeListeners.add(listener);
  return () => volumeListeners.delete(listener);
}

/** Re-reads the stored volume (tests / reload simulation). */
export function reloadVolumePreference(): void {
  volume = readVolume();
  for (const l of volumeListeners) l(volume);
}

// ---- Background music: on/off and its own volume (0–1), persisted ---------

export const MUSIC_ENABLED_KEY = 'human-chess:music-enabled';
export const MUSIC_VOLUME_KEY = 'human-chess:music-volume';
export const DEFAULT_MUSIC_VOLUME = 0.7;

function readMusicEnabled(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(MUSIC_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

function readMusicVolume(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MUSIC_VOLUME_KEY) : null;
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_MUSIC_VOLUME;
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
}

let musicEnabled = readMusicEnabled();
let musicVolume = readMusicVolume();
const musicListeners = new Set<() => void>();
const notifyMusic = () => musicListeners.forEach((l) => l());

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function setMusicEnabled(next: boolean): void {
  if (next === musicEnabled) return;
  musicEnabled = next;
  try {
    localStorage.setItem(MUSIC_ENABLED_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  notifyMusic();
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function setMusicVolume(next: number): void {
  const v = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_MUSIC_VOLUME));
  if (v === musicVolume) return;
  musicVolume = v;
  try {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(v));
  } catch {
    /* ignore */
  }
  notifyMusic();
}

/** Subscribe to music on/off or music volume changes. */
export function subscribeMusicSettings(listener: () => void): () => void {
  musicListeners.add(listener);
  return () => musicListeners.delete(listener);
}

/** Re-reads the stored music preferences (tests / reload simulation). */
export function reloadMusicPreferences(): void {
  musicEnabled = readMusicEnabled();
  musicVolume = readMusicVolume();
  notifyMusic();
}
