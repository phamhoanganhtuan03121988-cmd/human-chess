/**
 * Difficulty levels. Each is deterministic: the same position and level
 * always produce the same move (no randomness, deterministic node budgets).
 *
 * - easy:   depth 2, casual evaluation; picks deterministically among the
 *           near-best moves, so it makes human-like inaccuracies — but never
 *           ignores a forced win or walks into an immediate loss.
 * - normal: depth 3, full evaluation.
 * - hard:   iterative deepening up to depth 5 within a deterministic node
 *           budget (≈ 0.5 s on a normal desktop), full evaluation.
 *
 * No level repeats a position a third time (no perpetual check / endless
 * shuffling) while another legal move exists.
 */
import { formatBoard, opponent } from '../engine/index.ts';
import type { GameState, Move, Piece, Side } from '../engine/index.ts';
import { fastSearch } from './fastSearch.ts';
import type { FastSearchResult } from './fastSearch.ts';
import { WIN_SCORE } from './search.ts';
import type { AiPlayer } from './types.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'DỄ',
  normal: 'BÌNH THƯỜNG',
  hard: 'KHÓ',
};

/** Search settings per level. */
export const DIFFICULTY_SETTINGS = {
  easy: { depth: 2, style: 'casual', exactRoot: true, tolerance: 90 },
  normal: { depth: 3 },
  hard: { depth: 5, nodeLimit: 20_000 },
} as const;

/** Emergency wall-clock guard (the node budget normally stops first). */
export const AI_SAFETY_TIME_LIMIT_MS = 1500;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** Deterministic hash of a position (for Easy's choice among near-best moves). */
function positionHash(state: GameState): number {
  const s = formatBoard(state.board) + state.turn;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A position occurring this many times already is not recreated by the AI. */
const REPETITION_LIMIT = 2;

/**
 * Repetition guard (AI-side; the engine has no repetition rule). Rebuilds the
 * earlier positions by undoing the recorded moves, and returns a predicate
 * that flags root moves recreating a position already seen twice — so the AI
 * never plays a perpetual check or shuffles forever. Undefined without history.
 */
export function repetitionGuard(state: GameState): ((move: Move) => boolean) | undefined {
  if (state.history.length < 4) return undefined;
  const board = state.board.map((file) => file.slice()) as (Piece | null)[][];
  const counts = new Map<string, number>();
  const bump = (turn: Side) => {
    const key = formatBoard(board) + turn;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  bump(state.turn);
  for (let i = state.history.length - 1; i >= 0; i--) {
    const rec = state.history[i]!;
    board[rec.from.x]![rec.from.y] = rec.piece;
    board[rec.to.x]![rec.to.y] = rec.captured ?? null;
    bump(rec.piece.side);
  }
  // Back to the current position.
  const current = state.board.map((file) => file.slice()) as (Piece | null)[][];
  const next = opponent(state.turn);
  return (move: Move) => {
    const moved = current[move.from.x]![move.from.y]!;
    const captured = current[move.to.x]![move.to.y]!;
    current[move.to.x]![move.to.y] = moved;
    current[move.from.x]![move.from.y] = null;
    const seen = counts.get(formatBoard(current) + next) ?? 0;
    current[move.from.x]![move.from.y] = moved;
    current[move.to.x]![move.to.y] = captured;
    return seen >= REPETITION_LIMIT;
  };
}

export function chooseMoveForDifficulty(state: GameState, difficulty: Difficulty): FastSearchResult | null {
  const avoidRoot = repetitionGuard(state);
  if (difficulty === 'easy') {
    const s = DIFFICULTY_SETTINGS.easy;
    const r = fastSearch(state, {
      depth: s.depth,
      style: s.style,
      exactRoot: s.exactRoot,
      timeLimitMs: AI_SAFETY_TIME_LIMIT_MS,
      avoidRoot,
    });
    if (!r) return null;
    // Forced wins and losses are never "mistaken".
    if (Math.abs(r.score) > WIN_SCORE / 2) return r;
    const candidates = r.rootScores.filter((m) => m.score >= r.score - s.tolerance && Math.abs(m.score) < WIN_SCORE / 2);
    const pick = candidates[positionHash(state) % candidates.length] ?? { move: r.move, score: r.score };
    return { ...r, move: pick.move, score: pick.score };
  }
  if (difficulty === 'normal') {
    return fastSearch(state, { depth: DIFFICULTY_SETTINGS.normal.depth, timeLimitMs: AI_SAFETY_TIME_LIMIT_MS, avoidRoot });
  }
  const h = DIFFICULTY_SETTINGS.hard;
  return fastSearch(state, { depth: h.depth, nodeLimit: h.nodeLimit, timeLimitMs: AI_SAFETY_TIME_LIMIT_MS, avoidRoot });
}

/** An AI opponent for one side at a difficulty, e.g. createDifficultyPlayer('blue', 'hard'). */
export function createDifficultyPlayer(side: Side, difficulty: Difficulty): AiPlayer {
  return {
    side,
    chooseMove(state: GameState) {
      if (state.turn !== side) return null;
      return chooseMoveForDifficulty(state, difficulty);
    },
  };
}
