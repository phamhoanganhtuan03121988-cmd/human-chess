import { useEffect, useReducer, useState } from 'react';
import type { MoveRecord } from '../engine/index.ts';
import { isPresenting, uiReducer } from '../game/controller.ts';
import { replayStateAt } from '../game/replay.ts';
import { useGameAudio } from '../game/useGameAudio.ts';
import { GameBoard } from './GameBoard.tsx';
import { SidePanel } from './SidePanel.tsx';

/** Pause between auto-played moves (after each move finishes). */
export const REPLAY_STEP_MS = 550;

interface ReplayViewProps {
  records: readonly MoveRecord[];
  onExit: () => void;
  showPanel: boolean;
  debug?: boolean;
}

/**
 * Replays the recorded game from the initial position with the normal
 * movement animation (captures use a short capture pulse). Uses its own
 * controller instance; the real game state is untouched.
 */
export function ReplayView({ records, onExit, showPanel, debug = false }: ReplayViewProps) {
  const [ui, dispatch] = useReducer(uiReducer, records, (r) => replayStateAt(r, 0));
  const [playing, setPlaying] = useState(true);
  useGameAudio(ui, { newGameSound: false });

  const ply = ui.game.history.length;
  const total = records.length;
  const busy = isPresenting(ui);
  const atEnd = ply >= total;

  const next = () => {
    const rec = records[ply];
    if (!rec || busy) return;
    dispatch({ type: 'replayMove', gameId: ui.gameId, ply, move: { from: rec.from, to: rec.to } });
  };
  const jump = (n: number) => {
    if (busy) return;
    setPlaying(false);
    dispatch({ type: 'load', state: replayStateAt(records, Math.max(0, Math.min(total, n))) });
  };

  // Auto-play: one move after another, waiting for each animation to finish.
  useEffect(() => {
    if (!playing || busy || atEnd) return;
    const t = window.setTimeout(next, ply === 0 ? 400 : REPLAY_STEP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, busy, atEnd, ply, ui.gameId]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  return (
    <>
      <div className="toolbar toolbar--replay" role="toolbar" aria-label="Điều khiển xem lại">
        <span className="replay__title">XEM LẠI</span>
        <span className="replay__count" data-testid="replay-count">
          Nước {ply}/{total}
        </span>
        <button type="button" className="toolbar__button" aria-label="Về đầu" disabled={busy || ply === 0} onClick={() => jump(0)}>
          ⏮
        </button>
        <button type="button" className="toolbar__button" aria-label="Nước trước" disabled={busy || ply === 0} onClick={() => jump(ply - 1)}>
          ◀
        </button>
        <button
          type="button"
          className="toolbar__button"
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
          data-testid="replay-play"
          disabled={atEnd}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="toolbar__button"
          aria-label="Nước sau"
          disabled={busy || atEnd}
          onClick={() => {
            setPlaying(false);
            next();
          }}
        >
          ▶|
        </button>
        <button type="button" className="toolbar__button toolbar__button--accent" data-testid="replay-exit" onClick={onExit}>
          THOÁT XEM LẠI
        </button>
      </div>
      <div className="game-layout">
        <GameBoard ui={ui} dispatch={dispatch} debug={debug} showResult={false} />
        {showPanel && <SidePanel history={records} currentPly={ply} />}
      </div>
    </>
  );
}
