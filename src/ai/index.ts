/** Single-player AI (V1): alpha-beta minimax over the engine. */
export type * from './types.ts';
export { PIECE_VALUES, POSITIONAL, evaluate } from './evaluate.ts';
export { DEFAULT_DEPTH, WIN_SCORE, searchBestMove } from './search.ts';
export { chooseMove, createAiPlayer } from './chooseMove.ts';
