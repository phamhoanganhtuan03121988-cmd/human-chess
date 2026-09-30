/**
 * Local persistence (localStorage): the current unfinished game and the
 * difficulty preference. Sound settings persist in src/audio/volume.ts.
 *
 * Only completed engine states are saved, and only as the list of real
 * moves. Loading replays those moves through the engine (applyMove), so a
 * corrupted, tampered or incompatible save can never produce an illegal
 * position — it is discarded instead. Storage failures never throw.
 */
import { DEFAULT_DIFFICULTY, isDifficulty } from '../ai/difficulty.ts';
import type { Difficulty } from '../ai/difficulty.ts';
import { isValidCoordinate } from '../board/geometry.ts';
import { applyMove, createInitialGameState } from '../engine/index.ts';
import type { GameState, Move } from '../engine/index.ts';
import type { UiState } from './controller.ts';
import { isPresenting } from './controller.ts';

export const SAVE_KEY = 'human-chess:save';
export const DIFFICULTY_KEY = 'human-chess:difficulty';
export const SAVE_VERSION = 1;

type SavedMove = readonly [number, number, number, number];

/** A saved move must be four integers on the board. */
function isValidCoordinateMove(m: unknown): m is SavedMove {
  return (
    Array.isArray(m) &&
    m.length === 4 &&
    isValidCoordinate(m[0] as number, m[1] as number) &&
    isValidCoordinate(m[2] as number, m[3] as number)
  );
}

export interface SavedGameV1 {
  readonly version: 1;
  readonly difficulty: Difficulty;
  readonly moves: readonly SavedMove[];
  readonly savedAt: number;
}

export interface LoadedGame {
  readonly game: GameState;
  readonly difficulty: Difficulty;
  readonly lastMove: Move | null;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    /* quota / privacy mode: persistence silently unavailable */
  }
}

function safeGet(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Saves the game if it is a completed, unfinished engine state with at least
 * one move; clears the save when the game is over or empty. Never saves
 * while a move or combat is being presented.
 */
export function saveGame(ui: UiState): void {
  if (ui.replay || isPresenting(ui)) return;
  const { game } = ui;
  if (game.status !== 'playing' || game.history.length === 0) {
    clearSavedGame();
    return;
  }
  const data: SavedGameV1 = {
    version: SAVE_VERSION,
    difficulty: ui.difficulty,
    moves: game.history.map((m) => [m.from.x, m.from.y, m.to.x, m.to.y] as const),
    savedAt: Date.now(),
  };
  safeSet(SAVE_KEY, JSON.stringify(data));
}

/** Rebuilds a game from a move list via the engine; null if any move is invalid. */
export function rebuildGame(moves: readonly unknown[]): GameState | null {
  let game = createInitialGameState();
  for (const m of moves) {
    if (!isValidCoordinateMove(m)) return null;
    const result = applyMove(game, { from: { x: m[0], y: m[1] }, to: { x: m[2], y: m[3] } });
    if (!result.ok) return null;
    game = result.state;
  }
  return game;
}

/**
 * The saved unfinished game, or null. Invalid, incompatible or finished
 * saves are removed.
 */
export function loadSavedGame(): LoadedGame | null {
  const raw = safeGet(SAVE_KEY);
  if (raw === null) return null;
  const discard = () => {
    clearSavedGame();
    return null;
  };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return discard();
  }
  if (!data || typeof data !== 'object') return discard();
  const d = data as Partial<SavedGameV1>;
  if (d.version !== SAVE_VERSION || !Array.isArray(d.moves) || d.moves.length === 0) return discard();
  const game = rebuildGame(d.moves);
  if (!game || game.status !== 'playing') return discard();
  const last = game.history[game.history.length - 1] ?? null;
  return {
    game,
    difficulty: isDifficulty(d.difficulty) ? d.difficulty : DEFAULT_DIFFICULTY,
    lastMove: last ? { from: last.from, to: last.to } : null,
  };
}

export function loadDifficulty(): Difficulty {
  const v = safeGet(DIFFICULTY_KEY);
  return isDifficulty(v) ? v : DEFAULT_DIFFICULTY;
}

export function saveDifficulty(d: Difficulty): void {
  safeSet(DIFFICULTY_KEY, d);
}
