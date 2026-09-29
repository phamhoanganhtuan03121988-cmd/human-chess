import type { PiecePlacement } from '../board/initialPosition.ts';
import { BoardAnchor } from './BoardAnchor.tsx';

/**
 * TEMPORARY debug markers used only to verify that placements land on
 * intersections. These are NOT game pieces; real piece images come from
 * src/config/assets.ts in a later step.
 */
export function DebugPieceMarkers({ placements }: { placements: readonly PiecePlacement[] }) {
  return (
    <>
      {placements.map((p) => (
        <BoardAnchor key={`${p.side}-${p.type}-${p.x}-${p.y}`} x={p.x} y={p.y}>
          <div
            className={`debug-marker debug-marker--${p.side}`}
            data-testid="debug-marker"
            title={`${p.side} ${p.type} (${p.x},${p.y})`}
          >
            <span className="debug-marker__dot" />
            <span className="debug-marker__label">
              {p.side.toUpperCase()}
              <br />
              {p.type.toUpperCase()}
            </span>
          </div>
        </BoardAnchor>
      ))}
    </>
  );
}
