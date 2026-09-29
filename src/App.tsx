import { useState } from 'react';
import { INITIAL_POSITION } from './board/initialPosition.ts';
import { Board } from './components/Board.tsx';
import { DebugPieceMarkers } from './components/DebugPieceMarkers.tsx';
import { arePieceMarkersEnabled, isBoardDebugEnabled } from './config/debug.ts';

export function App() {
  const [debug, setDebug] = useState(isBoardDebugEnabled);
  const [markers, setMarkers] = useState(arePieceMarkersEnabled);

  return (
    <main className="app">
      <div className="dev-toolbar">
        <label>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Board debug
        </label>
        <label>
          <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} /> Start markers
        </label>
      </div>
      <Board debug={debug}>{markers && <DebugPieceMarkers placements={INITIAL_POSITION} />}</Board>
    </main>
  );
}
