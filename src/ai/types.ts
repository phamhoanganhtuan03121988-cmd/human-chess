/** Types for the single-player AI. The AI only reads GameState and returns a Move. */
import type { GameState, Move, Side } from '../engine/index.ts';

export interface SearchOptions {
  /** Search depth in plies (1 = own move only, 2 = own move + reply). */
  readonly depth?: number;
}

export interface SearchResult {
  /** Best move found, from the engine's legal moves. */
  readonly move: Move;
  /** Score from the searching side's point of view (higher is better). */
  readonly score: number;
  readonly depth: number;
  /** Positions visited. */
  readonly nodes: number;
  /** Wall-clock search time in ms. */
  readonly timeMs: number;
}

export interface AiPlayer {
  readonly side: Side;
  /** Best move for `state`, or null when it is not this side's turn or there is no legal move. */
  chooseMove(state: GameState): SearchResult | null;
}
