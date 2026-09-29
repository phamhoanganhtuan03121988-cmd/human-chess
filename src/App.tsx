import { useState } from 'react';
import { INITIAL_POSITION } from './board/initialPosition.ts';
import { Board } from './components/Board.tsx';
import { PieceLayer } from './components/PieceLayer.tsx';
import { isBoardDebugEnabled } from './config/debug.ts';
import { PIECE_HEADROOM } from './config/pieceSprites.ts';

export function App() {
  const [debug, setDebug] = useState(isBoardDebugEnabled);

  return (
    <main className="app">
      <div className="dev-toolbar">
        <label>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Board debug
        </label>
      </div>
      <Board debug={debug} headroom={PIECE_HEADROOM}>
        <PieceLayer placements={INITIAL_POSITION} debug={debug} />
      </Board>
    </main>
  );
}
