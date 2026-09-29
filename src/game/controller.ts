/**
 * UI interaction controller: turns board clicks into engine calls.
 *
 * The engine's GameState is the single source of truth for the board. This
 * module only adds UI state (selection, legal-move markers, last move) and
 * decides what a click means. It contains no Xiangqi rules: legality comes
 * from getLegalMoves / applyMove.
 */
import { FILES, RANKS } from '../board/geometry.ts';
import type { PiecePlacement } from '../board/initialPosition.ts';
import { applyMove, createInitialGameState, getLegalMoves, isGameOver, pieceAt } from '../engine/index.ts';
import type { GameState, Move, Position } from '../engine/index.ts';

export interface UiState {
  readonly game: GameState;
  readonly selected: Position | null;
  /** Legal moves of the selected piece (from the engine). */
  readonly legalMoves: readonly Move[];
  readonly lastMove: Move | null;
}

export type UiAction =
  | { readonly type: 'click'; readonly position: Position }
  | { readonly type: 'clearSelection' }
  | { readonly type: 'newGame' };

export function createUiState(game: GameState = createInitialGameState()): UiState {
  return { game, selected: null, legalMoves: [], lastMove: null };
}

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

function clearSelection(state: UiState): UiState {
  return state.selected ? { ...state, selected: null, legalMoves: [] } : state;
}

function select(state: UiState, position: Position): UiState {
  return { ...state, selected: position, legalMoves: getLegalMoves(state.game, position) };
}

/**
 * What a click on intersection `position` does:
 * - game over → nothing (selection cleared)
 * - on the selected piece → deselect
 * - on a legal destination of the selected piece → applyMove
 * - on a piece of the side to move → select it
 * - anything else → clear selection
 */
export function handleClick(state: UiState, position: Position): UiState {
  if (isGameOver(state.game)) return clearSelection(state);

  if (state.selected) {
    if (same(state.selected, position)) return clearSelection(state);
    const move = state.legalMoves.find((m) => same(m.to, position));
    if (move) {
      const result = applyMove(state.game, move);
      if (result.ok) {
        return { game: result.state, selected: null, legalMoves: [], lastMove: { from: move.from, to: move.to } };
      }
      return clearSelection(state);
    }
  }

  const piece = pieceAt(state.game.board, position);
  if (piece && piece.side === state.game.turn) return select(state, position);
  return clearSelection(state);
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'click':
      return handleClick(state, action.position);
    case 'clearSelection':
      return clearSelection(state);
    case 'newGame':
      return createUiState();
  }
}

/** Pieces to render, derived from the engine board (never stored separately). */
export function getPlacements(game: GameState): PiecePlacement[] {
  const out: PiecePlacement[] = [];
  for (let y = 0; y < RANKS; y++) {
    for (let x = 0; x < FILES; x++) {
      const p = game.board[x]![y];
      if (p) out.push({ side: p.side, type: p.type, x, y });
    }
  }
  return out;
}

/** Whether the legal move to `position` captures a piece. */
export function isCaptureTarget(state: UiState, position: Position): boolean {
  return state.legalMoves.some((m) => same(m.to, position)) && pieceAt(state.game.board, position) !== null;
}

export type StatusView =
  | { readonly kind: 'turn'; readonly side: 'red' | 'blue'; readonly check: boolean }
  | { readonly kind: 'over'; readonly winner: 'red' | 'blue'; readonly reason: 'checkmate' | 'stalemate' | 'general_captured' };

/** Status panel content, read straight from the engine's GameStatus. */
export function getStatusView(game: GameState): StatusView {
  if (game.status !== 'playing' && game.winner) {
    return { kind: 'over', winner: game.winner, reason: game.status };
  }
  return { kind: 'turn', side: game.turn, check: game.inCheck };
}
