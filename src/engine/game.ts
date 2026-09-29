/**
 * Game-level API: legal moves, move validation, applying moves with turn
 * management, captures, check, checkmate / stalemate and game over.
 * All functions are pure; states are never mutated.
 */
import { isValidCoordinate } from '../board/geometry.ts';
import { INITIAL_POSITION } from '../board/initialPosition.ts';
import { boardFromPlacements, findGeneral, movePiece, opponent, pieceAt, piecesOf, samePosition } from './board.ts';
import { getPseudoLegalTargets, isInCheck } from './moves.ts';
import type { Board, GameState, GameStatus, Move, MoveRecord, MoveResult, Position, Side } from './types.ts';

/** Red moves first. */
export const FIRST_TURN: Side = 'red';

/** Builds a state for `board` with `turn` to move, evaluating check / game over. */
export function createGameState(board: Board, turn: Side = FIRST_TURN, history: readonly MoveRecord[] = []): GameState {
  const base: GameState = { board, turn, status: 'playing', winner: null, inCheck: false, history };
  return evaluate(base);
}

/** The standard starting position with Red to move. */
export function createInitialGameState(): GameState {
  return createGameState(boardFromPlacements(INITIAL_POSITION), FIRST_TURN);
}

function evaluate(state: GameState): GameState {
  const { board, turn } = state;
  const inCheck = isInCheck(board, turn);
  let status: GameStatus = 'playing';
  let winner: Side | null = null;

  if (!findGeneral(board, turn)) {
    status = 'general_captured';
    winner = opponent(turn);
  } else if (!findGeneral(board, opponent(turn))) {
    status = 'general_captured';
    winner = turn;
  } else if (!hasAnyLegalMove(board, turn)) {
    // In Xiangqi the side with no legal move loses, in check or not.
    status = inCheck ? 'checkmate' : 'stalemate';
    winner = opponent(turn);
  }
  return { ...state, inCheck, status, winner };
}

export function isGameOver(state: GameState): boolean {
  return state.status !== 'playing';
}

/** Moves for the piece at `from` that do not leave its own general in check. */
function legalTargets(board: Board, from: Position): Position[] {
  const piece = pieceAt(board, from);
  if (!piece) return [];
  return getPseudoLegalTargets(board, from).filter((to) => {
    const captured = pieceAt(board, to);
    // Capturing the enemy general ends the game and is always allowed.
    if (captured?.type === 'general') return true;
    return !isInCheck(movePiece(board, from, to), piece.side);
  });
}

function hasAnyLegalMove(board: Board, side: Side): boolean {
  return piecesOf(board, side).some((from) => legalTargets(board, from).length > 0);
}

/**
 * Legal destinations for the piece at `position`. Empty when the square is
 * empty, the piece is not on move, or the game is over.
 */
export function getLegalMoves(state: GameState, position: Position): Move[] {
  if (isGameOver(state) || !isValidCoordinate(position.x, position.y)) return [];
  const piece = pieceAt(state.board, position);
  if (!piece || piece.side !== state.turn) return [];
  return legalTargets(state.board, position).map((to) => ({ from: position, to }));
}

/** Every legal move for the side to move. */
export function getAllLegalMoves(state: GameState): Move[] {
  if (isGameOver(state)) return [];
  return piecesOf(state.board, state.turn).flatMap((from) => getLegalMoves(state, from));
}

function validate(state: GameState, move: Move): MoveResult | null {
  const reject = (reason: Extract<MoveResult, { ok: false }>['reason']): MoveResult => ({ ok: false, reason, state });
  if (isGameOver(state)) return reject('game_over');
  const { from, to } = move;
  if (!isValidCoordinate(from.x, from.y) || !isValidCoordinate(to.x, to.y)) return reject('invalid_coordinate');
  const piece = pieceAt(state.board, from);
  if (!piece) return reject('no_piece');
  if (piece.side !== state.turn) return reject('wrong_turn');
  if (!legalTargets(state.board, from).some((t) => samePosition(t, to))) return reject('illegal_move');
  return null;
}

export function isLegalMove(state: GameState, move: Move): boolean {
  return validate(state, move) === null;
}

/**
 * Applies a move. Illegal moves are rejected with a reason and the state is
 * returned unchanged; legal moves produce a new state with the turn passed
 * to the opponent and check / game-over status evaluated.
 */
export function applyMove(state: GameState, move: Move): MoveResult {
  const rejection = validate(state, move);
  if (rejection) return rejection;

  const piece = pieceAt(state.board, move.from)!;
  const captured = pieceAt(state.board, move.to);
  const record: MoveRecord = { from: move.from, to: move.to, piece, captured };
  const next = createGameState(movePiece(state.board, move.from, move.to), opponent(state.turn), [
    ...state.history,
    record,
  ]);
  return { ok: true, state: next, move: record, captured, check: next.inCheck };
}
