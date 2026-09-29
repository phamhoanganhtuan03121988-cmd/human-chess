/**
 * Game audio API. V1 ships without sounds: the default backend does nothing.
 * A real backend (Web Audio, <audio> elements, …) can be installed later with
 * setAudioBackend() without touching game code.
 */
import type { PieceType, Side } from '../engine/index.ts';

export interface AudioBackend {
  playMove(): void;
  playCapture(): void;
  playCombatImpact(attacker: { side: Side; type: PieceType }, defender: { side: Side; type: PieceType }): void;
  playCheck(): void;
  playGameOver(winner: Side | null): void;
}

const noop = () => {};
export const SILENT_AUDIO: AudioBackend = {
  playMove: noop,
  playCapture: noop,
  playCombatImpact: noop,
  playCheck: noop,
  playGameOver: noop,
};

let backend: AudioBackend = SILENT_AUDIO;

/** Installs an audio backend; pass null to restore silence. */
export function setAudioBackend(next: AudioBackend | null): void {
  backend = next ?? SILENT_AUDIO;
}

export const playMove = () => backend.playMove();
export const playCapture = () => backend.playCapture();
export const playCombatImpact: AudioBackend['playCombatImpact'] = (attacker, defender) =>
  backend.playCombatImpact(attacker, defender);
export const playCheck = () => backend.playCheck();
export const playGameOver = (winner: Side | null) => backend.playGameOver(winner);
