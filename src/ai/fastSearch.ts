/**
 * Fast alpha-beta search used by the difficulty levels.
 *
 * Legality always comes from the engine: moves are generated with the
 * engine's getPseudoLegalTargets and a move is only searched if the
 * engine's isInCheck (which includes the flying-general rule) says it does
 * not leave the mover's General in check. Root moves are the engine's own
 * getAllLegalMoves. The speed-up comes from make/unmake on one scratch board
 * instead of building a full GameState (with status evaluation) per node.
 *
 * Stopping is deterministic: an optional node budget ends iterative
 * deepening at the same point on every machine. A wall-clock deadline is
 * only an emergency guard so the UI can never freeze.
 */
import { FILES, RANKS } from '../board/geometry.ts';
import { getAllLegalMoves, getPseudoLegalTargets, isInCheck, opponent } from '../engine/index.ts';
import type { Board, GameState, Move, Piece, Side } from '../engine/index.ts';
import { PIECE_VALUES, evaluateBoard } from './evaluate.ts';
import type { EvalStyle } from './evaluate.ts';
import { WIN_SCORE } from './search.ts';

type MutableBoard = (Piece | null)[][];

const PLY_PENALTY = 10;
const CHECKMATE_BONUS = 5;

class SearchAborted extends Error {}

interface Ctx {
  nodes: number;
  nodeLimit: number;
  deadline: number;
  style: EvalStyle;
}

export interface FastSearchOptions {
  /** Maximum depth (iterative deepening stops here). */
  readonly depth: number;
  /** Stop deepening once this many nodes were searched (deterministic). */
  readonly nodeLimit?: number;
  /** Emergency wall-clock limit in ms (non-deterministic safety net). */
  readonly timeLimitMs?: number;
  readonly style?: EvalStyle;
  /** Search every root move with a full window so all root scores are exact. */
  readonly exactRoot?: boolean;
  /** Root moves to skip when any other legal move exists (e.g. repetitions). */
  readonly avoidRoot?: (move: Move) => boolean;
}

export interface RootScore {
  readonly move: Move;
  readonly score: number;
}

export interface FastSearchResult {
  readonly move: Move;
  readonly score: number;
  /** Deepest fully completed iteration. */
  readonly depth: number;
  readonly nodes: number;
  readonly timeMs: number;
  /** Scores of all root moves at `depth` (exact only with exactRoot). */
  readonly rootScores: readonly RootScore[];
}

function generate(board: Board, side: Side): Move[] {
  const moves: Move[] = [];
  for (let x = 0; x < FILES; x++) {
    for (let y = 0; y < RANKS; y++) {
      if (board[x]![y]?.side !== side) continue;
      for (const to of getPseudoLegalTargets(board, { x, y })) moves.push({ from: { x, y }, to });
    }
  }
  return moves;
}

/** Captures first: most valuable victim, least valuable attacker. Stable otherwise. */
function order(board: Board, moves: Move[], first?: Move | null): Move[] {
  const key = (m: Move) => {
    if (first && same(m, first)) return Infinity;
    const victim = board[m.to.x]![m.to.y];
    if (!victim) return 0;
    return PIECE_VALUES[victim.type] * 10 - PIECE_VALUES[board[m.from.x]![m.from.y]!.type] / 100;
  };
  return moves
    .map((m, i) => ({ m, i, k: key(m) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((e) => e.m);
}

const same = (a: Move, b: Move) =>
  a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;

function make(board: MutableBoard, m: Move): Piece | null {
  const captured = board[m.to.x]![m.to.y]!;
  board[m.to.x]![m.to.y] = board[m.from.x]![m.from.y]!;
  board[m.from.x]![m.from.y] = null;
  return captured;
}

function unmake(board: MutableBoard, m: Move, captured: Piece | null): void {
  board[m.from.x]![m.from.y] = board[m.to.x]![m.to.y]!;
  board[m.to.x]![m.to.y] = captured;
}

function hasLegalMove(board: MutableBoard, side: Side): boolean {
  for (const m of generate(board, side)) {
    const cap = make(board, m);
    const ok = !isInCheck(board, side);
    unmake(board, m, cap);
    if (ok) return true;
  }
  return false;
}

/** Score of a lost position for the side to move (faster losses score lower). */
function lossScore(ply: number, mated: boolean): number {
  return -(WIN_SCORE - ply * PLY_PENALTY + (mated ? CHECKMATE_BONUS : 0));
}

function negamax(board: MutableBoard, side: Side, depth: number, alpha: number, beta: number, ply: number, c: Ctx): number {
  c.nodes++;
  if (c.nodes > c.nodeLimit) throw new SearchAborted();
  if ((c.nodes & 127) === 0 && performance.now() > c.deadline) throw new SearchAborted();

  if (depth === 0) {
    const inCheck = isInCheck(board, side);
    if (inCheck && !hasLegalMove(board, side)) return lossScore(ply, true);
    return evaluateBoard(board, side, inCheck ? side : null, c.style);
  }

  let best = -Infinity;
  let any = false;
  const enemy = opponent(side);
  for (const m of order(board, generate(board, side))) {
    const cap = make(board, m);
    if (isInCheck(board, side)) {
      unmake(board, m, cap); // illegal: leaves own General in check
      continue;
    }
    any = true;
    const score = cap?.type === 'general' ? WIN_SCORE - ply * PLY_PENALTY : -negamax(board, enemy, depth - 1, -beta, -alpha, ply + 1, c);
    unmake(board, m, cap);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (!any) return lossScore(ply, isInCheck(board, side)); // checkmate or stalemate: a loss in Xiangqi
  return best;
}

function searchRoot(
  state: GameState,
  rootMoves: Move[],
  depth: number,
  c: Ctx,
  exact: boolean,
  first: Move | null,
): { best: RootScore; all: RootScore[] } {
  const board = state.board.map((f) => f.slice()) as MutableBoard;
  const side = state.turn;
  const enemy = opponent(side);
  let alpha = -Infinity;
  let best: RootScore | null = null;
  const all: RootScore[] = [];
  for (const move of order(board, rootMoves, first)) {
    const cap = make(board, move);
    const score =
      cap?.type === 'general' ? WIN_SCORE : -negamax(board, enemy, depth - 1, -Infinity, exact ? Infinity : -alpha, 1, c);
    unmake(board, move, cap);
    all.push({ move, score });
    if (!best || score > best.score) best = { move, score };
    if (score > alpha) alpha = score;
  }
  return { best: best!, all };
}

/**
 * Best move for the side to move, or null when the game is over. Runs
 * iterative deepening from depth 1; the deepest completed iteration wins.
 * Depth 1 always completes, so a legal move is always returned.
 */
export function fastSearch(state: GameState, options: FastSearchOptions): FastSearchResult | null {
  if (state.status !== 'playing' || getAllLegalMoves(state).length === 0) return null;
  const started = performance.now();
  const c: Ctx = {
    nodes: 0,
    nodeLimit: Infinity,
    deadline: Infinity,
    style: options.style ?? 'standard',
  };
  const legal = getAllLegalMoves(state);
  const avoid = options.avoidRoot;
  const preferred = avoid ? legal.filter((m) => !avoid(m)) : legal;
  const rootMoves = preferred.length > 0 ? preferred : legal;
  let result: { best: RootScore; all: RootScore[] } | null = null;
  let completed = 0;
  for (let d = 1; d <= options.depth; d++) {
    // Budgets apply from depth 2 on: the depth-1 answer is always available.
    if (d > 1) {
      c.nodeLimit = options.nodeLimit ?? Infinity;
      c.deadline = options.timeLimitMs !== undefined ? started + options.timeLimitMs : Infinity;
    }
    try {
      result = searchRoot(state, rootMoves, d, c, options.exactRoot ?? false, result?.best.move ?? null);
      completed = d;
    } catch (e) {
      if (e instanceof SearchAborted) break;
      throw e;
    }
  }
  return {
    move: result!.best.move,
    score: result!.best.score,
    depth: completed,
    nodes: c.nodes,
    timeMs: performance.now() - started,
    rootScores: result!.all,
  };
}
