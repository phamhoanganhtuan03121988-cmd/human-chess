/**
 * Core types for the Xiangqi rule engine. The engine is pure TypeScript and
 * works only with board coordinates (x = 0..8 left→right, y = 0..9
 * top→bottom); it has no knowledge of rendering.
 */
import type { Side } from '../board/geometry.ts';
import type { PieceType } from '../config/assets.ts';

export type { Side, PieceType };

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface Piece {
  readonly side: Side;
  readonly type: PieceType;
}

/** board[x][y]: one entry per intersection, null when empty. */
export type Board = ReadonlyArray<ReadonlyArray<Piece | null>>;

export interface Move {
  readonly from: Position;
  readonly to: Position;
}

export type GameStatus =
  /** Game in progress. */
  | 'playing'
  /** Side to move is in check and has no legal move. */
  | 'checkmate'
  /** Side to move is not in check but has no legal move (a loss in Xiangqi). */
  | 'stalemate'
  /** A general was captured (only reachable from non-standard positions). */
  | 'general_captured';

export interface MoveRecord extends Move {
  readonly piece: Piece;
  readonly captured: Piece | null;
}

export interface GameState {
  readonly board: Board;
  /** Side whose turn it is. */
  readonly turn: Side;
  readonly status: GameStatus;
  /** Winner once the game is over, otherwise null. */
  readonly winner: Side | null;
  /** True when the side to move is in check. */
  readonly inCheck: boolean;
  readonly history: readonly MoveRecord[];
}

export type MoveRejection =
  | 'game_over'
  | 'invalid_coordinate'
  | 'no_piece'
  | 'wrong_turn'
  | 'illegal_move';

export type MoveResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly move: MoveRecord;
      readonly captured: Piece | null;
      /** True when the move puts the opponent in check. */
      readonly check: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: MoveRejection;
      readonly state: GameState;
    };
