/**
 * Readable fixtures for engine tests.
 *
 * Boards are drawn as 10 rows (y = 0 at top) × 9 columns (x = 0..8).
 * Uppercase = Red, lowercase = Blue, '.' = empty.
 *   K general  A advisor  E elephant  R rook  H knight  C cannon  P pawn
 */
import { createGameState, getLegalMoves, parseBoard } from '../../src/engine/index.ts';
import type { GameState, Move, Side } from '../../src/engine/index.ts';

export function position(diagram: string, turn: Side = 'red'): GameState {
  return createGameState(parseBoard(diagram), turn);
}

/** Legal destinations of the piece at (x, y) as sorted "x,y" strings. */
export function targets(state: GameState, x: number, y: number): string[] {
  return getLegalMoves(state, { x, y })
    .map((m) => `${m.to.x},${m.to.y}`)
    .sort();
}

export function sq(...coords: [number, number][]): string[] {
  return coords.map(([x, y]) => `${x},${y}`).sort();
}

export function move(fx: number, fy: number, tx: number, ty: number): Move {
  return { from: { x: fx, y: fy }, to: { x: tx, y: ty } };
}
