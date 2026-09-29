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
  ambience: 0.035,
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
