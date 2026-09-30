/**
 * The only module that touches the Web Audio AudioContext.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * (or resumed) on the first pointer / keyboard interaction. Until then every
 * sound request is a silent no-op.
 */
type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const unlockListeners = new Set<() => void>();

function contextClass(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Creates / resumes the context. Call only from a user-gesture handler. */
export function unlockAudio(): boolean {
  const Ctor = contextClass();
  if (!Ctor) return false;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    for (const l of unlockListeners) l();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return true;
}

/** The live context and master bus, or null before the first interaction. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (!ctx || !master || ctx.state === 'closed') return null;
  return { ctx, master };
}

export function isAudioUnlocked(): boolean {
  return getAudio() !== null;
}

/** Runs `listener` once the context exists (immediately if it already does). */
export function onAudioUnlocked(listener: () => void): () => void {
  unlockListeners.add(listener);
  if (ctx) listener();
  return () => unlockListeners.delete(listener);
}

/** Smoothly sets the master level (mute / unmute). */
export function setMasterLevel(level: number): void {
  const a = getAudio();
  if (!a) return;
  const t = a.ctx.currentTime;
  a.master.gain.cancelScheduledValues(t);
  a.master.gain.setTargetAtTime(level, t, 0.03);
}

/**
 * Unlocks audio on the first pointer / key / touch interaction. Returns a
 * cleanup function that removes the listeners.
 */
export function installAudioUnlock(target: Window = window): () => void {
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const handler = () => {
    if (unlockAudio()) cleanup();
  };
  const cleanup = () => events.forEach((e) => target.removeEventListener(e, handler, true));
  events.forEach((e) => target.addEventListener(e, handler, true));
  return cleanup;
}

/** Test helper: forget the current context. */
export function resetAudioContextForTests(): void {
  ctx = null;
  master = null;
  unlockListeners.clear();
}
