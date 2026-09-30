/**
 * Input rules shared by the client (early feedback) and the room server
 * (authoritative). Move legality is always decided by the engine.
 */
import { applyMove, createInitialGameState, isLegalMove } from '../engine/index.ts';
import type { GameState, Move } from '../engine/index.ts';
import { NICKNAME_MAX, ROOM_ID_PATTERN } from './protocol.ts';

/** Trimmed nickname without control characters, or null if empty / too long. */
export function normalizeNickname(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > NICKNAME_MAX) return null;
  return name;
}

/** Upper-cased room code if it has the right format, else null. */
export function normalizeRoomId(raw: string): string | null {
  const id = raw.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(id) ? id : null;
}

/** Engine check: is `move` legal for the side to move in `game`? */
export function isValidMove(game: GameState, move: Move): boolean {
  return game.status === 'playing' && isLegalMove(game, move);
}

/** Rebuilds a position from a move list with the engine; null if any move is illegal. */
export function replayMoves(moves: readonly Move[]): GameState | null {
  let game = createInitialGameState();
  for (const move of moves) {
    const r = applyMove(game, move);
    if (!r.ok) return null;
    game = r.state;
  }
  return game;
}
