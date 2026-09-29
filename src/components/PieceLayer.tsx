import type { PiecePlacement } from '../board/initialPosition.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { Piece } from './Piece.tsx';

interface PieceLayerProps {
  placements: readonly PiecePlacement[];
  /** Show sprite outlines and anchor points (debug mode). */
  debug?: boolean;
}

/** Renders static pieces; in debug mode also draws each piece's anchor on top. */
export function PieceLayer({ placements, debug = false }: PieceLayerProps) {
  return (
    <>
      <div className="board__layer board__layer--pieces">
        {placements.map((p) => (
          <Piece key={`${p.x},${p.y}`} {...p} debug={debug} />
        ))}
      </div>
      {debug && (
        <div className="board__layer board__layer--debug">
          {placements.map((p) => (
            <BoardAnchor key={`${p.x},${p.y}`} x={p.x} y={p.y}>
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
