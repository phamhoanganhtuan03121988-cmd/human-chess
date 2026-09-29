/**
 * Minimax search (negamax form with alpha-beta pruning) over engine states.
 * Legality, check, checkmate and stalemate all come from the engine; the
 * search only calls getAllLegalMoves / applyMove, which never mutate state.
 */
import { applyMove, getAllLegalMoves, pieceAt } from '../engine/index.ts';
import type { GameState, Move } from '../engine/index.ts';
import { PIECE_VALUES, evaluate } from './evaluate.ts';
import type { SearchResult } from './types.ts';

/** Score for a won game; reduced by ply so faster wins are preferred. */
export const WIN_SCORE = 1_000_000;
/** Per-ply reduction of a win score (faster wins first). */
const PLY_PENALTY = 10;
/** Among equally fast wins, prefer checkmate over stalemate / general capture. */
const CHECKMATE_BONUS = 5;

export const DEFAULT_DEPTH = 2;

/** Captures first (most valuable victim, least valuable attacker), others in engine order. */
function orderMoves(state: GameState, moves: Move[]): Move[] {
  const key = (m: Move) => {
    const victim = pieceAt(state.board, m.to);
    if (!victim) return 0;
    const attacker = pieceAt(state.board, m.from)!;
    return PIECE_VALUES[victim.type] * 10 - PIECE_VALUES[attacker.type] / 100;
  };
  return moves
    .map((m, i) => ({ m, i, k: key(m) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((e) => e.m);
}

interface Counter {
  nodes: number;
}

/** Terminal score from the side-to-move's point of view. */
function terminalScore(state: GameState, ply: number): number {
  const win = WIN_SCORE - ply * PLY_PENALTY + (state.status === 'checkmate' ? CHECKMATE_BONUS : 0);
  return state.winner === state.turn ? win : -win;
}

function negamax(state: GameState, depth: number, alpha: number, beta: number, ply: number, c: Counter): number {
  c.nodes++;
  if (state.status !== 'playing') return terminalScore(state, ply);
  if (depth === 0) return evaluate(state, state.turn);

  let best = -Infinity;
  for (const move of orderMoves(state, getAllLegalMoves(state))) {
    const result = applyMove(state, move);
    if (!result.ok) continue; // cannot happen for engine-generated moves
    const score = -negamax(result.state, depth - 1, -beta, -alpha, ply + 1, c);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Best move for the side to move, or null if the game is over / no legal
 * move exists. Deterministic: ties keep the first move in search order.
 */
export function searchBestMove(state: GameState, depth: number = DEFAULT_DEPTH): SearchResult | null {
  if (state.status !== 'playing') return null;
  const start = performance.now();
  const counter: Counter = { nodes: 1 };
  const moves = orderMoves(state, getAllLegalMoves(state));
  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    const result = applyMove(state, move);
    if (!result.ok) continue;
    const score = -negamax(result.state, depth - 1, -beta, -alpha, 1, counter);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }

  if (!bestMove) return null;
  return { move: bestMove, score: bestScore, depth, nodes: counter.nodes, timeMs: performance.now() - start };
}
