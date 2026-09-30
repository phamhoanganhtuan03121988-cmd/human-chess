/**
 * Pseudo-legal move generation per piece type (movement rules, blocking,
 * palace and river limits, captures) plus attack / check detection.
 * Moves that would leave the mover's own general in check are filtered out
 * in game.ts.
 */
import { isInPalace, isOnOwnSide, isValidCoordinate } from '../board/geometry.ts';
import { findGeneral, opponent, pieceAt, piecesOf } from './board.ts';
import type { Board, Piece, Position, Side } from './types.ts';

const ORTHOGONAL: readonly Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const DIAGONAL: readonly Position[] = [
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** Direction a side's pawns advance: Red starts at the bottom and moves up. */
export function forwardDirection(side: Side): number {
  return side === 'red' ? -1 : 1;
}

function add(p: Position, d: Position, k = 1): Position {
  return { x: p.x + d.x * k, y: p.y + d.y * k };
}

/** Empty or enemy-occupied target on the board. */
function canLand(board: Board, to: Position, side: Side): boolean {
  if (!isValidCoordinate(to.x, to.y)) return false;
  const target = pieceAt(board, to);
  return !target || target.side !== side;
}

function rookMoves(board: Board, from: Position, side: Side): Position[] {
  const out: Position[] = [];
  for (const d of ORTHOGONAL) {
    for (let to = add(from, d); isValidCoordinate(to.x, to.y); to = add(to, d)) {
      const target = pieceAt(board, to);
      if (!target) {
        out.push(to);
        continue;
      }
      if (target.side !== side) out.push(to);
      break;
    }
  }
  return out;
}

function cannonMoves(board: Board, from: Position, side: Side): Position[] {
  const out: Position[] = [];
  for (const d of ORTHOGONAL) {
    let screened = false;
    for (let to = add(from, d); isValidCoordinate(to.x, to.y); to = add(to, d)) {
      const target = pieceAt(board, to);
      if (!screened) {
        if (!target) out.push(to);
        else screened = true; // first piece becomes the screen
      } else if (target) {
        if (target.side !== side) out.push(to); // exactly one screen
        break;
      }
    }
  }
  return out;
}

function knightMoves(board: Board, from: Position, side: Side): Position[] {
  const out: Position[] = [];
  for (const leg of ORTHOGONAL) {
    const legPos = add(from, leg);
    if (!isValidCoordinate(legPos.x, legPos.y) || pieceAt(board, legPos)) continue; // horse leg blocked
    // Two targets per leg: one more step along the leg, one step sideways.
    const sideways = leg.x === 0 ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] : [{ x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const s of sideways) {
      const to = { x: legPos.x + leg.x + s.x, y: legPos.y + leg.y + s.y };
      if (canLand(board, to, side)) out.push(to);
    }
  }
  return out;
}

function elephantMoves(board: Board, from: Position, side: Side): Position[] {
  const out: Position[] = [];
  for (const d of DIAGONAL) {
    const eye = add(from, d);
    const to = add(from, d, 2);
    if (!isValidCoordinate(to.x, to.y) || !isOnOwnSide(to.y, side)) continue; // cannot cross river
    if (pieceAt(board, eye)) continue; // elephant eye blocked
    if (canLand(board, to, side)) out.push(to);
  }
  return out;
}

function advisorMoves(board: Board, from: Position, side: Side): Position[] {
  return DIAGONAL.map((d) => add(from, d)).filter(
    (to) => isInPalace(to.x, to.y, side) && canLand(board, to, side),
  );
}

function generalMoves(board: Board, from: Position, side: Side): Position[] {
  return ORTHOGONAL.map((d) => add(from, d)).filter(
    (to) => isInPalace(to.x, to.y, side) && canLand(board, to, side),
  );
}

function pawnMoves(board: Board, from: Position, side: Side): Position[] {
  const steps: Position[] = [{ x: 0, y: forwardDirection(side) }];
  if (!isOnOwnSide(from.y, side)) steps.push({ x: 1, y: 0 }, { x: -1, y: 0 }); // crossed the river
  return steps.map((d) => add(from, d)).filter((to) => canLand(board, to, side));
}

/**
 * Destinations the piece at `from` can reach by its movement rules,
 * ignoring whether the move would leave its own general in check.
 */
export function getPseudoLegalTargets(board: Board, from: Position): Position[] {
  const piece = pieceAt(board, from);
  if (!piece) return [];
  return targetsFor(board, from, piece);
}

function targetsFor(board: Board, from: Position, piece: Piece): Position[] {
  switch (piece.type) {
    case 'rook':
      return rookMoves(board, from, piece.side);
    case 'cannon':
      return cannonMoves(board, from, piece.side);
    case 'knight':
      return knightMoves(board, from, piece.side);
    case 'elephant':
      return elephantMoves(board, from, piece.side);
    case 'advisor':
      return advisorMoves(board, from, piece.side);
    case 'general':
      return generalMoves(board, from, piece.side);
    case 'pawn':
      return pawnMoves(board, from, piece.side);
  }
}

/**
 * Flying-general rule: true when both generals stand on the same file with
 * no piece between them (an illegal position for the side that caused it).
 */
export function generalsFacing(board: Board): boolean {
  const red = findGeneral(board, 'red');
  const blue = findGeneral(board, 'blue');
  if (!red || !blue || red.x !== blue.x) return false;
  const [top, bottom] = red.y < blue.y ? [red.y, blue.y] : [blue.y, red.y];
  for (let y = top + 1; y < bottom; y++) {
    if (pieceAt(board, { x: red.x, y })) return false;
  }
  return true;
}

/** True when any piece of `by` could capture on `target`. */
export function isAttacked(board: Board, target: Position, by: Side): boolean {
  return piecesOf(board, by).some((from) =>
    getPseudoLegalTargets(board, from).some((to) => to.x === target.x && to.y === target.y),
  );
}

/**
 * True when `side`'s general is attacked, or the two generals face each
 * other along an open file. A side with no general counts as in check.
 */
export function isInCheck(board: Board, side: Side): boolean {
  const general = findGeneral(board, side);
  if (!general) return true;
  return generalsFacing(board) || isAttacked(board, general, opponent(side));
}
