/**
 * Game audio API. The rest of the game calls these functions and never
 * touches the AudioContext directly.
 *
 * - Safe before the first user interaction (silent until audio is unlocked).
 * - Respects the persisted sound on/off preference (see volume.ts).
 * - Each sound that actually plays dispatches a `human-chess:sound` DOM
 *   event ({ name, detail }) — useful for captions, tests and debugging.
 * - The synthesis backend can be replaced (setAudioBackend) for tests.
 */
import type { PieceType, Side } from '../engine/index.ts';
import { getAudio, installAudioUnlock, onAudioUnlocked, setMasterLevel, unlockAudio } from './audioContext.ts';
import { startAmbience, stopAmbience } from './music.ts';
import * as S from './sounds.ts';
import type { CombatCue, GameResult } from './sounds.ts';
import { VOLUME, isMuted, setMuted, subscribeMute, toggleMuted } from './volume.ts';

export type { CombatCue, GameResult } from './sounds.ts';
export { VOLUME, isMuted, setMuted, subscribeMute, toggleMuted } from './volume.ts';
export { installAudioUnlock, isAudioUnlocked, unlockAudio } from './audioContext.ts';

export type SoundName =
  | 'select'
  | 'hover'
  | 'move'
  | 'land'
  | 'capture'
  | 'impact'
  | 'combatCue'
  | 'check'
  | 'gameOver'
  | 'turn'
  | 'newGame';

/** Plays one named sound; returns true if it was scheduled. */
export interface AudioBackend {
  play(name: SoundName, detail?: Record<string, string>): boolean;
}

type Recipe = (o: S.Out, detail: Record<string, string>) => void;

const RECIPES: Record<SoundName, { level: number; play: Recipe }> = {
  select: { level: VOLUME.select, play: (o) => S.selectSound(o) },
  hover: { level: VOLUME.hover, play: (o) => S.hoverSound(o) },
  move: { level: VOLUME.move, play: (o) => S.moveStartSound(o) },
  land: { level: VOLUME.move, play: (o) => S.landSound(o) },
  capture: { level: VOLUME.capture, play: (o, d) => S.captureSound(o, d.piece as PieceType) },
  impact: { level: VOLUME.combatImpact, play: (o, d) => S.impactSound(o, d.piece as PieceType) },
  combatCue: { level: VOLUME.combatCue, play: (o, d) => S.combatCueSound(o, d.cue as CombatCue) },
  check: { level: VOLUME.check, play: (o) => S.checkSound(o) },
  gameOver: { level: VOLUME.gameOver, play: (o, d) => S.gameOverSound(o, d.result as GameResult) },
  turn: { level: VOLUME.turn, play: (o, d) => S.turnSound(o, d.role === 'ai' ? 'ai' : 'human') },
  newGame: { level: VOLUME.turn, play: (o) => S.newGameSound(o) },
};

/** Real synthesis through the shared AudioContext. */
export const webAudioBackend: AudioBackend = {
  play(name, detail = {}) {
    const a = getAudio();
    if (!a) return false; // not unlocked yet (or unsupported): silent
    const bus = a.ctx.createGain();
    bus.gain.value = RECIPES[name].level;
    bus.connect(a.master);
    RECIPES[name].play({ ctx: a.ctx, out: bus, t: a.ctx.currentTime + 0.005 }, detail);
    return true;
  },
};

let backend: AudioBackend = webAudioBackend;

/** Replaces the synthesis backend (tests); null restores Web Audio. */
export function setAudioBackend(next: AudioBackend | null): void {
  backend = next ?? webAudioBackend;
}

function play(name: SoundName, detail: Record<string, string> = {}): void {
  if (isMuted()) return;
  if (!backend.play(name, detail)) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('human-chess:sound', { detail: { name, ...detail } }));
  }
}

export const playSelectSound = () => play('select');
export const playHoverSound = () => play('hover');
/** Piece starts moving. */
export const playMoveSound = () => play('move');
/** Piece lands on its destination. */
export const playLandSound = () => play('land');
export const playCaptureSound = (defender: PieceType) => play('capture', { piece: defender });
export const playImpactSound = (attacker: PieceType) => play('impact', { piece: attacker });
export const playCombatCue = (cue: CombatCue) => play('combatCue', { cue });
export const playCheckSound = () => play('check');
export const playGameOverSound = (result: GameResult) => play('gameOver', { result });
/** Turn cue: `role` says whether the side to act is the human or the AI. */
export const playTurnSound = (side: Side, role: 'human' | 'ai' = 'human') => play('turn', { side, role });
export const playNewGameSound = () => play('newGame');

// Mute controls the master level and the ambience.
let wired = false;
/** Connects mute state to the master bus and ambience; idempotent. */
export function initAudio(): () => void {
  const removeUnlock = installAudioUnlock();
  if (wired) return removeUnlock;
  wired = true;
  const apply = (muted: boolean) => {
    const a = getAudio();
    if (!a) return;
    setMasterLevel(muted ? 0 : 1);
    if (muted) stopAmbience(a.ctx);
    else startAmbience(a.ctx, a.master);
  };
  onAudioUnlocked(() => apply(isMuted()));
  subscribeMute(apply);
  return removeUnlock;
}

/** Toggles sound; turning it on counts as a gesture that unlocks audio. */
export function toggleSound(): boolean {
  const muted = toggleMuted();
  if (!muted) unlockAudio();
  return muted;
}

export { setMuted as setSoundMuted };
