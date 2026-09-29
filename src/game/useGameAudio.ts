/**
 * Plays game sounds (through the audio abstraction) when the engine state
 * changes: one call per applied move, keyed by game id + ply.
 */
import { useEffect } from 'react';
import { playCapture, playCheck, playGameOver, playMove } from '../audio/index.ts';
import type { UiState } from './controller.ts';

export function useGameAudio(ui: UiState): void {
  const { game, gameId } = ui;
  const ply = game.history.length;
  useEffect(() => {
    if (ply === 0) return;
    const last = game.history[ply - 1]!;
    if (last.captured) playCapture();
    else playMove();
    if (game.status !== 'playing') playGameOver(game.winner);
    else if (game.inCheck) playCheck();
    // One call per (game, ply); `game` is fixed for a given key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, ply]);
}
