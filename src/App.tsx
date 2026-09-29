import { useEffect, useReducer, useState } from 'react';
import { CombatOverlay } from './components/combat/CombatOverlay.tsx';
import { GameBoard } from './components/GameBoard.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { isBoardDebugEnabled } from './config/debug.ts';
import { createUiState, getStatusView, uiReducer } from './game/controller.ts';

export function App() {
  const [debug, setDebug] = useState(isBoardDebugEnabled);
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState());

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
        <StatusPanel status={getStatusView(ui.game)} />
        <button
          type="button"
          className="toolbar__button"
          disabled={ui.combat !== null}
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
