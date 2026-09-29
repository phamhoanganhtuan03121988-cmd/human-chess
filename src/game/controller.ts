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
import type { GameState, Move, Piece, Position } from '../engine/index.ts';

/**
 * Combat presentation for a capture (UI only, not part of the engine).
 * While a combat is active the engine GameState is untouched; the capture is
 * applied with applyMove only when the combat completes.
 */
export type CombatPhase = 'idle' | 'entering' | 'impact' | 'complete';

export interface CombatState {
  /** Increments per combat, so the presentation can key its timeline. */
  readonly id: number;
  readonly phase: Exclude<CombatPhase, 'idle'>;
  readonly attacker: Piece;
  readonly defender: Piece;
  readonly move: Move;
}

export interface UiState {
  readonly game: GameState;
  readonly selected: Position | null;
  /** Legal moves of the selected piece (from the engine). */
  readonly legalMoves: readonly Move[];
  readonly lastMove: Move | null;
  /** Active capture presentation; null when idle. Locks all board input. */
  readonly combat: CombatState | null;
}

export type UiAction =
  | { readonly type: 'click'; readonly position: Position }
  | { readonly type: 'clearSelection' }
  | { readonly type: 'newGame' }
  | { readonly type: 'combatPhase'; readonly id: number; readonly phase: 'impact' | 'complete' }
  | { readonly type: 'combatComplete'; readonly id: number };

export function createUiState(game: GameState = createInitialGameState()): UiState {
  return { game, selected: null, legalMoves: [], lastMove: null, combat: null };
}

let nextCombatId = 1;

/** The phase of the current combat, or 'idle'. */
export function getCombatPhase(state: UiState): CombatPhase {
  return state.combat?.phase ?? 'idle';
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
  if (state.combat) return state; // board is frozen during combat
  if (isGameOver(state.game)) return clearSelection(state);

  if (state.selected) {
    if (same(state.selected, position)) return clearSelection(state);
    const move = state.legalMoves.find((m) => same(m.to, position));
    if (move) {
      const attacker = pieceAt(state.game.board, move.from);
      const defender = pieceAt(state.game.board, move.to);
      if (attacker && defender) {
        // Capture: present the combat first; the engine applies it on completion.
        const combat: CombatState = { id: nextCombatId++, phase: 'entering', attacker, defender, move };
        return { ...state, selected: null, legalMoves: [], combat };
      }
      return commitMove(state, move);
    }
  }

  const piece = pieceAt(state.game.board, position);
  if (piece && piece.side === state.game.turn) return select(state, position);
  return clearSelection(state);
}

function commitMove(state: UiState, move: Move): UiState {
  const result = applyMove(state.game, move);
  if (!result.ok) return { ...clearSelection(state), combat: null };
  return {
    game: result.state,
    selected: null,
    legalMoves: [],
    lastMove: { from: move.from, to: move.to },
    combat: null,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'click':
      return handleClick(state, action.position);
    case 'clearSelection':
      // Escape etc. never cancel an active combat.
      return state.combat ? state : clearSelection(state);
    case 'newGame':
      return state.combat ? state : createUiState();
    case 'combatPhase':
      if (!state.combat || state.combat.id !== action.id) return state;
      return { ...state, combat: { ...state.combat, phase: action.phase } };
    case 'combatComplete':
      // Only now does the capture reach the engine. Stale or repeated completions are ignored.
      if (!state.combat || state.combat.id !== action.id) return state;
      return commitMove(state, state.combat.move);
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
