/** Board helpers for the rule engine: creation, lookup and immutable updates. */
import { FILES, RANKS, createEmptyBoard, isValidCoordinate } from '../board/geometry.ts';
import type { PiecePlacement } from '../board/initialPosition.ts';
import type { Board, Piece, Position, Side } from './types.ts';

export function emptyBoard(): Board {
  return createEmptyBoard<Piece | null>(null);
}

export function boardFromPlacements(placements: readonly PiecePlacement[]): Board {
  const board = createEmptyBoard<Piece | null>(null);
  for (const { side, type, x, y } of placements) {
    if (!isValidCoordinate(x, y)) throw new RangeError(`Invalid placement (${x}, ${y})`);
    if (board[x]![y]) throw new Error(`Two pieces placed at (${x}, ${y})`);
    board[x]![y] = { side, type };
  }
  return board;
}

export function pieceAt(board: Board, pos: Position): Piece | null {
  return isValidCoordinate(pos.x, pos.y) ? board[pos.x]![pos.y]! : null;
}

/** Returns a new board with the piece at `from` moved to `to` (capturing anything there). */
export function movePiece(board: Board, from: Position, to: Position): Board {
  const next = board.map((file) => file.slice());
  next[to.x]![to.y] = next[from.x]![from.y]!;
  next[from.x]![from.y] = null;
  return next;
}

export function findGeneral(board: Board, side: Side): Position | null {
  for (let x = 0; x < FILES; x++) {
    for (let y = 0; y < RANKS; y++) {
      const p = board[x]![y];
      if (p && p.side === side && p.type === 'general') return { x, y };
    }
  }
  return null;
}

export function piecesOf(board: Board, side: Side): Position[] {
  const out: Position[] = [];
  for (let x = 0; x < FILES; x++) {
    for (let y = 0; y < RANKS; y++) {
      if (board[x]![y]?.side === side) out.push({ x, y });
    }
  }
  return out;
}

export function opponent(side: Side): Side {
  return side === 'red' ? 'blue' : 'red';
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
