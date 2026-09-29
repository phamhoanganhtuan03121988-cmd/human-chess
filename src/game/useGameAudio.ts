/**
 * Plays game sounds on state *transitions* (never per render):
 * selection, move start, landing, check (only when entering check), game
 * over (once), turn cues and new game. Combat sounds are driven by the
 * CombatOverlay timeline; hover by the board.
 *
 * Each effect run compares the current values with the previous ones kept
 * in a ref, so React re-renders (and StrictMode re-runs) never repeat a sound.
 */
import { useEffect, useRef } from 'react';
import {
  playCheckSound,
  playGameOverSound,
  playLandSound,
  playMoveSound,
  playNewGameSound,
  playSelectSound,
  playTurnSound,
} from '../audio/index.ts';
import type { Activity, UiState } from './controller.ts';
import { getActivity } from './controller.ts';

interface Seen {
  gameId: number;
  ply: number;
  selectedKey: string | null;
  movementId: number | null;
  inCheck: boolean;
  over: boolean;
  activity: Activity;
}

function snapshot(ui: UiState): Seen {
  return {
    gameId: ui.gameId,
    ply: ui.game.history.length,
    selectedKey: ui.selected ? `${ui.selected.x},${ui.selected.y}` : null,
    movementId: ui.movement?.id ?? null,
    inCheck: ui.game.inCheck,
    over: ui.game.status !== 'playing',
    activity: getActivity(ui),
  };
}

export interface GameAudioOptions {
  /** Play the new-game cue when the game id changes (off for replays). */
  readonly newGameSound?: boolean;
}

export function useGameAudio(ui: UiState, options: GameAudioOptions = {}): void {
  const newGameSound = options.newGameSound ?? true;
  const seen = useRef<Seen | null>(null);
  const now = snapshot(ui);

  useEffect(() => {
    const prev = seen.current;
    seen.current = now;
    if (!prev) return; // first render: nothing happened yet

    if (now.gameId !== prev.gameId) {
      if (newGameSound) playNewGameSound();
      return;
    }
    if (now.selectedKey && now.selectedKey !== prev.selectedKey) playSelectSound();
    if (now.movementId !== null && now.movementId !== prev.movementId) playMoveSound();

    let important = false;
    if (now.ply > prev.ply) {
      const last = ui.game.history[now.ply - 1]!;
      // Captures already had their impact inside the combat; normal moves land.
      if (!last.captured) playLandSound();
      if (now.over && !prev.over) {
        playGameOverSound(ui.game.status as 'checkmate' | 'stalemate' | 'general_captured');
        important = true;
      } else if (now.inCheck && !prev.inCheck) {
        playCheckSound(); // only on the transition into check
        important = true;
      }
    }

    // Turn cues (vs AI only), skipped when a check / game-over sound just played.
    if (!important && ui.aiSide !== null && now.activity !== prev.activity) {
      if (now.activity === 'thinking') playTurnSound(ui.aiSide, 'ai');
      else if (now.activity === 'idle' && ui.game.turn !== ui.aiSide && now.ply > 0) {
        playTurnSound(ui.game.turn, 'human');
      }
    }
    // `now` is derived from ui; comparing against the ref makes this idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.gameId, now.ply, now.selectedKey, now.movementId, now.inCheck, now.over, now.activity]);
}
