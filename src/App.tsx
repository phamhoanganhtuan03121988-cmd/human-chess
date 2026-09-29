import { useEffect, useReducer, useState } from 'react';
import { initAudio, toggleSound } from './audio/index.ts';
import { CombatOverlay } from './components/combat/CombatOverlay.tsx';
import { SoundToggle } from './components/SoundToggle.tsx';
import { GameBoard } from './components/GameBoard.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { isBoardDebugEnabled } from './config/debug.ts';
import { createUiState, getActivity, getAiState, getStatusView, isPresenting, uiReducer } from './game/controller.ts';
import { useAiOpponent } from './game/useAiOpponent.ts';
import { useGameAudio } from './game/useGameAudio.ts';

/** V1: the human plays Red, the computer plays Blue. */
const AI_SIDE = 'blue' as const;

export function App() {
  const [debug, setDebug] = useState(isBoardDebugEnabled);
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(undefined, { aiSide: AI_SIDE }));
  const aiState = getAiState(ui);
  useAiOpponent(ui, dispatch);
  useGameAudio(ui);

  // Audio unlocks on the first interaction; mute drives master level + ambience.
  useEffect(() => initAudio(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'clearSelection' });
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        toggleSound();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="app">
      <div className="toolbar">
        <StatusPanel status={getStatusView(ui.game, aiState)} activity={getActivity(ui)} aiSide={ui.aiSide} />
        <button
          type="button"
          className="toolbar__button"
          disabled={isPresenting(ui) || aiState === 'thinking'}
          onClick={() => dispatch({ type: 'newGame' })}
        >
          New game
        </button>
        <SoundToggle />
        <label className="toolbar__debug">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Board debug
        </label>
      </div>
      <GameBoard ui={ui} dispatch={dispatch} debug={debug} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </main>
  );
}

/** True when the key event comes from a text-entry control (shortcuts are ignored there). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type);
  return false;
}
