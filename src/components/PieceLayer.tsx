import { useEffect, useState } from 'react';
import type { PiecePlacement } from '../board/initialPosition.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { Piece } from './Piece.tsx';
import { PieceBadge } from './PieceBadge.tsx';
import { PieceRing } from './PieceRing.tsx';

interface PieceLayerProps {
  placements: readonly PiecePlacement[];
  /** Show sprite outlines and anchor points (debug mode). */
  debug?: boolean;
}

const keyOf = (p: PiecePlacement) => `${p.x},${p.y}`;

/**
 * Renders static pieces in stacked layers, all anchored to each piece's
 * intersection:
 *   ground (hover/selected ring) < characters < badges/tooltips < debug.
 * Hover and selection are purely visual; there is no movement yet.
 */
export function PieceLayer({ placements, debug = false }: PieceLayerProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const interaction = (p: PiecePlacement) => {
    const key = keyOf(p);
    return {
      hovered: hoveredKey === key,
      selected: selectedKey === key,
      onHoverChange: (on: boolean) => setHoveredKey((cur) => (on ? key : cur === key ? null : cur)),
      onSelect: () => setSelectedKey((cur) => (cur === key ? null : key)),
    };
  };

  const ringed = placements.filter((p) => keyOf(p) === hoveredKey || keyOf(p) === selectedKey);

  return (
    <>
      <div className="board__layer board__layer--ground">
        {ringed.map((p) => (
          <PieceRing key={keyOf(p)} side={p.side} x={p.x} y={p.y} selected={keyOf(p) === selectedKey} />
        ))}
      </div>
      <div className="board__layer board__layer--pieces">
        {placements.map((p) => (
          <Piece key={keyOf(p)} {...p} debug={debug} {...interaction(p)} />
        ))}
      </div>
      <div className="board__layer board__layer--badges">
        {placements.map((p) => (
          <PieceBadge key={keyOf(p)} {...p} {...interaction(p)} />
        ))}
      </div>
      {debug && (
        <div className="board__layer board__layer--debug">
          {placements.map((p) => (
            <BoardAnchor key={keyOf(p)} x={p.x} y={p.y}>
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
