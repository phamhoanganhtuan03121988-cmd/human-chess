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
import {
  applyMove,
  createInitialGameState,
  findGeneral,
  generalsFacing,
  getLegalMoves,
  getPseudoLegalTargets,
  isGameOver,
  isLegalMove,
  opponent,
  pieceAt,
} from '../engine/index.ts';
import type { GameState, Move, Piece, Position, Side } from '../engine/index.ts';
import { DEFAULT_DIFFICULTY } from '../ai/difficulty.ts';
import type { Difficulty } from '../ai/difficulty.ts';

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

/**
 * Movement animation for a normal (non-capture) move (UI only). While it
 * runs the engine GameState is untouched; the move is applied with
 * applyMove only when the animation completes.
 */
export interface MovementState {
  /** Increments per movement; stale completions carry an old id. */
  readonly id: number;
  readonly piece: Piece;
  readonly move: Move;
  /** Replay only: this movement captures (replays use a short capture instead of the full combat). */
  readonly capture?: boolean;
}

export interface UiState {
  readonly game: GameState;
  readonly selected: Position | null;
  /** Legal moves of the selected piece (from the engine). */
  readonly legalMoves: readonly Move[];
  readonly lastMove: Move | null;
  /** Active capture presentation; null when idle. Locks all board input. */
  readonly combat: CombatState | null;
  /** Active normal-move animation; null when idle. Locks all board input. */
  readonly movement: MovementState | null;
  /** Increments on every new game; stale AI results carry an old id. */
  readonly gameId: number;
  /** Side played by the computer, or null for two local players. */
  readonly aiSide: Side | null;
  /** AI strength (used when aiSide is set). */
  readonly difficulty: Difficulty;
  /** Read-only replay of recorded moves: no input, no AI, short captures. */
  readonly replay: boolean;
}

/** Whether the computer is currently choosing a move. */
export type AiState = 'idle' | 'thinking';

export interface UiOptions {
  readonly aiSide?: Side | null;
  readonly difficulty?: Difficulty;
  readonly replay?: boolean;
  /** Last move to highlight (e.g. when restoring a saved game). */
  readonly lastMove?: Move | null;
}

export type UiAction =
  | { readonly type: 'click'; readonly position: Position }
  | { readonly type: 'clearSelection' }
  | { readonly type: 'newGame' }
  | { readonly type: 'combatPhase'; readonly id: number; readonly phase: 'impact' | 'complete' }
  | { readonly type: 'combatComplete'; readonly id: number }
  /** The movement animation with this id reached its destination. */
  | { readonly type: 'movementComplete'; readonly id: number }
  /**
   * A move chosen by the AI for the position identified by gameId + ply
   * (history length). Ignored if that position is no longer current.
   */
  | { readonly type: 'aiMove'; readonly gameId: number; readonly ply: number; readonly move: Move }
  /** Replay: play the next recorded move (validated like any move). */
  | { readonly type: 'replayMove'; readonly gameId: number; readonly ply: number; readonly move: Move }
  /** Replace the whole UI state (resume a saved game, jump within a replay). Ignored while presenting. */
  | { readonly type: 'load'; readonly state: UiState }
  | { readonly type: 'setDifficulty'; readonly difficulty: Difficulty };

let nextGameId = 1;

export function createUiState(game: GameState = createInitialGameState(), options: UiOptions = {}): UiState {
  return {
    game,
    selected: null,
    legalMoves: [],
    lastMove: options.lastMove ?? null,
    combat: null,
    movement: null,
    gameId: nextGameId++,
    aiSide: options.replay ? null : (options.aiSide ?? null),
    difficulty: options.difficulty ?? DEFAULT_DIFFICULTY,
    replay: options.replay ?? false,
  };
}

/**
 * The AI is thinking when it is the AI side's turn, the game is running and
 * no combat or movement is being presented. Derived, so it can never get out of sync.
 */
export function getAiState(state: UiState): AiState {
  const { game, aiSide } = state;
  return aiSide !== null && game.turn === aiSide && !isPresenting(state) && !isGameOver(game) ? 'thinking' : 'idle';
}

let nextCombatId = 1;
let nextMovementId = 1;

/**
 * What the game is doing right now, for presentation (status panel, board
 * feedback). Derived from UI + engine state; never stored.
 * - over:     the engine reports the game finished
 * - combat:   a capture is being presented
 * - moving:   a normal move is animating
 * - thinking: the AI is choosing a move
 * - idle:     waiting for the side to move to act
 */
export type Activity = 'idle' | 'thinking' | 'moving' | 'combat' | 'over';

export function getActivity(state: UiState): Activity {
  if (isGameOver(state.game)) return 'over';
  if (state.combat) return 'combat';
  if (state.movement) return 'moving';
  if (getAiState(state) === 'thinking') return 'thinking';
  return 'idle';
}

/** True while a capture combat or a movement animation is being presented. */
export function isPresenting(state: UiState): boolean {
  return state.combat !== null || state.movement !== null;
}

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
  if (state.replay) return state; // replays are watched, not played
  if (isPresenting(state)) return state; // board is frozen during combat / movement
  if (state.aiSide !== null && state.game.turn === state.aiSide) return state; // AI's turn
  if (isGameOver(state.game)) return clearSelection(state);

  if (state.selected) {
    if (same(state.selected, position)) return clearSelection(state);
    const move = state.legalMoves.find((m) => same(m.to, position));
    if (move) return playMove(state, move);
  }

  const piece = pieceAt(state.game.board, position);
  if (piece && piece.side === state.game.turn) return select(state, position);
  return clearSelection(state);
}

/**
 * Plays a legal move for whoever is on turn (human or AI): captures open the
 * combat presentation, other moves start the movement animation. Either way
 * the engine applies the move only when the presentation completes.
 */
function playMove(state: UiState, move: Move): UiState {
  const attacker = pieceAt(state.game.board, move.from);
  const defender = pieceAt(state.game.board, move.to);
  if (!attacker) return clearSelection(state);
  if (defender && state.replay) {
    // Replay: a short capture (slide + impact pulse) instead of the full combat.
    const movement: MovementState = { id: nextMovementId++, piece: attacker, move, capture: true };
    return { ...state, selected: null, legalMoves: [], movement };
  }
  if (defender) {
    // Capture: present the combat first; the engine applies it on completion.
    const combat: CombatState = { id: nextCombatId++, phase: 'entering', attacker, defender, move };
    return { ...state, selected: null, legalMoves: [], combat };
  }
  // Normal move: animate first; the engine applies it on completion.
  const movement: MovementState = { id: nextMovementId++, piece: attacker, move };
  return { ...state, selected: null, legalMoves: [], movement };
}

function commitMove(state: UiState, move: Move): UiState {
  const result = applyMove(state.game, move);
  if (!result.ok) return { ...clearSelection(state), combat: null, movement: null };
  return {
    ...state,
    game: result.state,
    selected: null,
    legalMoves: [],
    lastMove: { from: move.from, to: move.to },
    combat: null,
    movement: null,
  };
}

function handleAiMove(state: UiState, action: Extract<UiAction, { type: 'aiMove' }>): UiState {
  // Drop results for an old game, an old position, or when it is not the AI's turn.
  if (action.gameId !== state.gameId) return state;
  if (action.ply !== state.game.history.length) return state;
  if (getAiState(state) !== 'thinking') return state;
  if (!isLegalMove(state.game, action.move)) return state; // the engine has the final word
  return playMove(state, action.move);
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'click':
      return handleClick(state, action.position);
    case 'clearSelection':
      // Escape etc. never cancel an active combat or movement.
      return isPresenting(state) ? state : clearSelection(state);
    case 'newGame':
      // Blocked while presenting; a new game id makes any pending AI result stale.
      return isPresenting(state)
        ? state
        : createUiState(undefined, { aiSide: state.aiSide, difficulty: state.difficulty, replay: state.replay });
    case 'replayMove':
      if (!state.replay || isPresenting(state)) return state;
      if (action.gameId !== state.gameId || action.ply !== state.game.history.length) return state;
      if (!isLegalMove(state.game, action.move)) return state;
      return playMove(state, action.move);
    case 'load':
      return isPresenting(state) ? state : action.state;
    case 'setDifficulty':
      return state.difficulty === action.difficulty ? state : { ...state, difficulty: action.difficulty };
    case 'aiMove':
      return handleAiMove(state, action);
    case 'combatPhase':
      if (!state.combat || state.combat.id !== action.id) return state;
      return { ...state, combat: { ...state.combat, phase: action.phase } };
    case 'combatComplete':
      // Only now does the capture reach the engine. Stale or repeated completions are ignored.
      if (!state.combat || state.combat.id !== action.id) return state;
      return commitMove(state, state.combat.move);
    case 'movementComplete':
      // Only now does a normal move reach the engine. Stale or repeated completions are ignored.
      if (!state.movement || state.movement.id !== action.id) return state;
      return commitMove(state, state.movement.move);
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
  | { readonly kind: 'turn'; readonly side: Side; readonly check: boolean; readonly thinking: boolean }
  | { readonly kind: 'over'; readonly winner: Side; readonly reason: 'checkmate' | 'stalemate' | 'general_captured' };

/** Status panel content, read straight from the engine's GameStatus plus the AI state. */
export function getStatusView(game: GameState, aiState: AiState = 'idle'): StatusView {
  if (game.status !== 'playing' && game.winner) {
    return { kind: 'over', winner: game.winner, reason: game.status };
  }
  return { kind: 'turn', side: game.turn, check: game.inCheck, thinking: aiState === 'thinking' };
}

/**
 * Enemy pieces currently giving check to the side to move (for highlighting).
 * Uses the engine's own move generation; adds no rules. Empty when not in check.
 */
export function getCheckingPieces(game: GameState): Position[] {
  if (!game.inCheck) return [];
  const general = findGeneral(game.board, game.turn);
  if (!general) return [];
  const out: Position[] = [];
  for (let x = 0; x < FILES; x++) {
    for (let y = 0; y < RANKS; y++) {
      const p = game.board[x]![y];
      if (!p || p.side === game.turn) continue;
      if (getPseudoLegalTargets(game.board, { x, y }).some((t) => t.x === general.x && t.y === general.y)) {
        out.push({ x, y });
      }
    }
  }
  if (generalsFacing(game.board)) {
    const other = findGeneral(game.board, opponent(game.turn));
    if (other) out.push(other);
  }
  return out;
}

export interface GameOverView {
  /** Result headline, e.g. "CHIẾU BÍ". */
  readonly title: string;
  readonly winner: Side;
  readonly loser: Side;
  /** e.g. "ĐỎ THẮNG". */
  readonly winnerText: string;
  /** One-sentence explanation of what happened. */
  readonly detail: string;
  readonly reason: 'checkmate' | 'stalemate' | 'general_captured';
  /** The losing side's General, if still on the board. */
  readonly defeatedGeneral: Position | null;
}

const SIDE_VI: Record<Side, string> = { red: 'Đỏ', blue: 'Xanh' };

/** Presentation of a finished game, read from the engine status. Null while playing. */
export function getGameOverView(game: GameState): GameOverView | null {
  if (game.status === 'playing' || !game.winner) return null;
  const winner = game.winner;
  const loser = opponent(winner);
  const titles = { checkmate: 'CHIẾU BÍ', stalemate: 'BẾ TẮC', general_captured: 'TƯỚNG BỊ BẮT' } as const;
  const details = {
    checkmate: `Tướng ${SIDE_VI[loser]} bị chiếu và không còn đường thoát.`,
    // Xiangqi: the side left without a legal move loses (it is not a draw).
    stalemate: `${SIDE_VI[loser]} không còn nước đi hợp lệ — theo luật cờ tướng, bên bế tắc thua.`,
    general_captured: `Tướng ${SIDE_VI[loser]} đã bị bắt.`,
  } as const;
  return {
    title: titles[game.status],
    winner,
    loser,
    winnerText: `${SIDE_VI[winner].toUpperCase()} THẮNG`,
    detail: details[game.status],
    reason: game.status,
    defeatedGeneral: findGeneral(game.board, loser),
  };
}
