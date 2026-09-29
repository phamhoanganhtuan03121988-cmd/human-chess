import type { GameState, Side } from '../engine/index.ts';
import { DEFAULT_DEPTH, searchBestMove } from './search.ts';
import type { AiPlayer, SearchOptions, SearchResult } from './types.ts';

/** Picks a move for the side to move. Returns null if the game is over. */
export function chooseMove(state: GameState, options: SearchOptions = {}): SearchResult | null {
  return searchBestMove(state, options.depth ?? DEFAULT_DEPTH);
}

/** An AI opponent for one side, e.g. createAiPlayer('blue'). */
export function createAiPlayer(side: Side, options: SearchOptions = {}): AiPlayer {
  return {
    side,
    chooseMove(state: GameState) {
      if (state.turn !== side) return null;
      return chooseMove(state, options);
    },
  };
}
