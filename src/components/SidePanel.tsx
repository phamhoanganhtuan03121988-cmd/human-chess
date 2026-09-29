import { useEffect, useRef } from 'react';
import { getPieceAsset } from '../config/assets.ts';
import type { MoveRecord } from '../engine/index.ts';
import { capturedPieces, historyRows } from '../game/notation.ts';

interface SidePanelProps {
  history: readonly MoveRecord[];
  /** In replay: number of moves shown so far (highlights that move). */
  currentPly?: number | null;
}

/** Move history and captured pieces, derived from the engine's move records. */
export function SidePanel({ history, currentPly = null }: SidePanelProps) {
  const rows = historyRows(history);
  const captured = capturedPieces(history);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('.is-current');
    if (!active) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    // Keep the current replay move visible by scrolling the list only (never the page).
    const top = active.offsetTop;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + active.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + active.offsetHeight - el.clientHeight;
  }, [history.length, currentPly]);

  // Ply index (1-based) of each cell, to highlight the current replay move.
  let ply = 0;
  return (
    <aside className="side-panel" aria-label="Lịch sử ván cờ" data-testid="side-panel">
      <section className="captures" aria-label="Quân đã bắt">
        {(['red', 'blue'] as const).map((side) => (
          <div key={side} className={`captures__row captures__row--${side}`} data-testid={`captured-by-${side}`}>
            <span className="captures__label">{side === 'red' ? 'ĐỎ bắt' : 'XANH bắt'}</span>
            <span className="captures__icons">
              {captured[side].length === 0 && <span className="captures__none">—</span>}
              {captured[side].map((p, i) => (
                <img key={i} src={getPieceAsset(p.side, p.type)} alt={`${p.side} ${p.type}`} data-testid="captured-icon" />
              ))}
            </span>
          </div>
        ))}
      </section>
      <h2 className="side-panel__title">NƯỚC ĐI</h2>
      <ol className="history" ref={list} data-testid="move-history">
        {rows.length === 0 && <li className="history__empty">Chưa có nước đi</li>}
        {rows.map((r) => {
          const cells = [r.red, r.blue].map((text, i) => {
            if (text === null) return <span key={i} className="history__move history__move--empty" />;
            ply++;
            const current = currentPly !== null && ply === currentPly;
            return (
              <span key={i} className={`history__move history__move--${i === 0 ? 'red' : 'blue'}${current ? ' is-current' : ''}`}>
                {text}
              </span>
            );
          });
          return (
            <li key={r.number} className="history__row" data-testid="history-row">
              <span className="history__num">{r.number}.</span>
              {cells}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
