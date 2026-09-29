/**
 * Connects the AI to the game controller. When the controller reports that
 * the AI is thinking, runs the search once for that position and dispatches
 * the chosen move after a fixed presentation delay. The AI never touches
 * the UI: it receives a GameState and returns a Move.
 */
import { useEffect } from 'react';
import { createDifficultyPlayer } from '../ai/index.ts';
import type { UiAction, UiState } from './controller.ts';
import { getAiState } from './controller.ts';

/**
 * Minimum time from the AI's turn starting to its move being played, so the
 * "thinking" state is readable. Real search time counts toward it; the AI is
 * never held back beyond this short pacing.
 */
export const AI_THINK_DELAY_MS = 450;
/** Short pause so "THINKING..." renders before the (synchronous) search runs. */
const SEARCH_START_MS = 30;

export function useAiOpponent(ui: UiState, dispatch: (action: UiAction) => void, enabled = true): void {
  const thinking = enabled && getAiState(ui) === 'thinking';
  // One request per (game, position): re-renders or StrictMode re-runs do not start a second search.
  const requestKey = thinking ? `${ui.gameId}:${ui.game.history.length}:${ui.difficulty}` : null;
  const { game, gameId, aiSide, difficulty } = ui;

  useEffect(() => {
    if (!requestKey || !aiSide) return;
    const ply = game.history.length;
    const started = performance.now();
    let dispatchTimer: number | undefined;

    const searchTimer = window.setTimeout(() => {
      const result = createDifficultyPlayer(aiSide, difficulty).chooseMove(game);
      if (!result) return;
      const wait = Math.max(0, AI_THINK_DELAY_MS - (performance.now() - started));
      dispatchTimer = window.setTimeout(() => dispatch({ type: 'aiMove', gameId, ply, move: result.move }), wait);
    }, SEARCH_START_MS);

    return () => {
      window.clearTimeout(searchTimer);
      if (dispatchTimer !== undefined) window.clearTimeout(dispatchTimer);
    };
    // requestKey identifies game + position; the other values are fixed for a given key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
}
