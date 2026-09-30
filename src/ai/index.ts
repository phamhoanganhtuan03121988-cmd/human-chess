/** Single-player AI (V1): alpha-beta minimax over the engine. */
export type * from './types.ts';
export { PIECE_VALUES, POSITIONAL, evaluate } from './evaluate.ts';
export { DEFAULT_DEPTH, WIN_SCORE, searchBestMove } from './search.ts';
export { chooseMove, createAiPlayer } from './chooseMove.ts';
export { CASUAL_PIECE_VALUES, evaluateBoard } from './evaluate.ts';
export type { EvalStyle } from './evaluate.ts';
export { fastSearch } from './fastSearch.ts';
export type { FastSearchOptions, FastSearchResult, RootScore } from './fastSearch.ts';
export {
  AI_SAFETY_TIME_LIMIT_MS,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_SETTINGS,
  chooseMoveForDifficulty,
  createDifficultyPlayer,
  isDifficulty,
  repetitionGuard,
} from './difficulty.ts';
export type { Difficulty } from './difficulty.ts';
