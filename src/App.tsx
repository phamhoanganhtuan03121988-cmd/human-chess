import { useEffect, useReducer, useState } from 'react';
import { CombatOverlay } from './components/combat/CombatOverlay.tsx';
import { GameBoard } from './components/GameBoard.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { isBoardDebugEnabled } from './config/debug.ts';
import { createUiState, getAiState, getStatusView, isPresenting, uiReducer } from './game/controller.ts';
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'clearSelection' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="app">
      <div className="toolbar">
        <StatusPanel status={getStatusView(ui.game, aiState)} />
        <button
          type="button"
          className="toolbar__button"
          disabled={isPresenting(ui) || aiState === 'thinking'}
          onClick={() => dispatch({ type: 'newGame' })}
        >
          New game
        </button>
        <label className="toolbar__debug">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Board debug
        </label>
      </div>
      <GameBoard ui={ui} dispatch={dispatch} debug={debug} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </main>
  );
}
