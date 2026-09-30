/**
 * Replay helpers: build the UI state after the first `n` recorded moves.
 * Positions are rebuilt by applying the real recorded moves through the
 * engine — nothing is invented and the AI is never involved.
 */
import { applyMove, createInitialGameState } from '../engine/index.ts';
import type { GameState, Move, MoveRecord } from '../engine/index.ts';
import { createUiState } from './controller.ts';
import type { UiState } from './controller.ts';

export function gameAfter(moves: readonly Move[], n: number): GameState {
  let game = createInitialGameState();
  for (const m of moves.slice(0, n)) {
    const r = applyMove(game, m);
    if (!r.ok) break; // recorded moves are legal; stop safely if not
    game = r.state;
  }
  return game;
}

export function replayStateAt(records: readonly MoveRecord[], n: number): UiState {
  const moves = records.map((r) => ({ from: r.from, to: r.to }));
  const game = gameAfter(moves, n);
  const last = n > 0 ? moves[n - 1]! : null;
  return createUiState(game, { replay: true, lastMove: last });
}
