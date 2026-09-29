import type { CSSProperties } from 'react';
import type { PiecePlacement } from '../board/initialPosition.ts';
import type { Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { Piece } from './Piece.tsx';
import { PieceBadge } from './PieceBadge.tsx';

interface PieceLayerProps {
  /** Pieces derived from the engine GameState. */
  placements: readonly PiecePlacement[];
  hovered: Position | null;
  selected: Position | null;
  /** Enemy pieces the selected piece can capture. */
  captureTargets: readonly Position[];
  onHoverChange: (position: Position | null) => void;
  onClickPiece: (position: Position) => void;
  /** Piece currently travelling (at its source) and its movement style. */
  moving?: { from: Position; style: CSSProperties } | null;
  /** Destination of the move that just committed (brief landing settle). */
  landedAt?: Position | null;
  /** Side whose pieces the player may select now; null when input is locked. */
  actingSide?: 'red' | 'blue' | null;
  /** General currently in check. */
  alertAt?: Position | null;
  /** Show sprite outlines and anchor points (debug mode). */
  debug?: boolean;
}

const at = (list: readonly Position[], p: Position) => list.some((q) => q.x === p.x && q.y === p.y);
const eq = (a: Position | null, b: Position) => a !== null && a.x === b.x && a.y === b.y;

/**
 * Renders the pieces (characters, then badges above them), all anchored to
 * each piece's intersection. Purely presentational: clicks are reported
 * with the board position and handled by the game controller.
 */
export function PieceLayer({
  placements,
  hovered,
  selected,
  captureTargets,
  onHoverChange,
  onClickPiece,
  moving = null,
  landedAt = null,
  actingSide = null,
  alertAt = null,
  debug = false,
}: PieceLayerProps) {
  const interaction = (p: PiecePlacement) => ({
    hovered: eq(hovered, p),
    selected: eq(selected, p),
    capturable: at(captureTargets, p),
    onHoverChange: (on: boolean) => onHoverChange(on ? { x: p.x, y: p.y } : null),
    onSelect: () => onClickPiece({ x: p.x, y: p.y }),
    motion: moving && eq(moving.from, p) ? moving.style : null,
    landing: eq(landedAt, p),
    actionable: actingSide !== null && (p.side === actingSide || at(captureTargets, p)),
    alert: eq(alertAt, p),
  });
  const key = (p: PiecePlacement) => `${p.side}-${p.type}-${p.x},${p.y}`;

  return (
    <>
      <div className="board__layer board__layer--pieces">
        {placements.map((p) => (
          <Piece key={key(p)} {...p} debug={debug} {...interaction(p)} />
        ))}
      </div>
      <div className="board__layer board__layer--badges">
        {placements.map((p) => (
          <PieceBadge key={key(p)} {...p} {...interaction(p)} />
        ))}
      </div>
      {debug && (
        <div className="board__layer board__layer--debug">
          {placements.map((p) => (
            <BoardAnchor key={key(p)} x={p.x} y={p.y}>
              <span
                className={`debug-anchor debug-anchor--${p.side}`}
                data-testid="debug-anchor"
                title={`${p.side} ${p.type} (${p.x},${p.y})`}
              />
            </BoardAnchor>
          ))}
        </div>
      )}
    </>
  );
}
