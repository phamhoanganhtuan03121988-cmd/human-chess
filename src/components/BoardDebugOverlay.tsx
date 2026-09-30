import {
  MAX_X,
  RIVER_BOTTOM_Y,
  RIVER_TOP_Y,
  getAllIntersections,
  getPalaceDiagonals,
  isInPalace,
  type Side,
} from '../board/geometry.ts';
import { getBoardCenter, getBoardPoint } from '../board/layout.ts';
import { toViewCoordinate } from '../board/perspective.ts';
import type { BoardPerspective } from '../board/perspective.ts';

/**
 * Development overlay drawn inside the board SVG: all 90 intersections with
 * (x,y) labels, highlighted palace diagonals, river band and board center.
 * Toggle via the `debug` prop on <Board> (see src/config/debug.ts).
 */
export function BoardDebugOverlay({ perspective = 'red' }: { perspective?: BoardPerspective }) {
  const riverTopLeft = getBoardPoint(0, RIVER_TOP_Y);
  const riverBottomRight = getBoardPoint(MAX_X, RIVER_BOTTOM_Y);
  const center = getBoardCenter();

  return (
    <g className="debug" data-testid="board-debug">
      <rect
        className="debug__river"
        x={riverTopLeft.x}
        y={riverTopLeft.y}
        width={riverBottomRight.x - riverTopLeft.x}
        height={riverBottomRight.y - riverTopLeft.y}
      />
      <text className="debug__river-label" x={riverTopLeft.x + 0.05} y={riverTopLeft.y + 0.15}>
        RIVER (y {RIVER_TOP_Y} | {RIVER_BOTTOM_Y})
      </text>

      {(['blue', 'red'] as Side[]).flatMap((side) =>
        getPalaceDiagonals(side).map(([a, b], i) => {
          const p1 = getBoardPoint(a.x, a.y);
          const p2 = getBoardPoint(b.x, b.y);
          return <line key={`${side}${i}`} className="debug__palace" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        }),
      )}

      {getAllIntersections().map(({ x, y }) => {
        const view = toViewCoordinate(x, y, perspective);
        const p = getBoardPoint(view.x, view.y);
        return (
          <g key={`${x},${y}`} data-testid="debug-intersection">
            <circle
              className={isInPalace(x, y) ? 'debug__point debug__point--palace' : 'debug__point'}
              cx={p.x}
              cy={p.y}
              r={0.05}
            />
            <text className="debug__coord" x={p.x + 0.07} y={p.y - 0.07}>
              {x},{y}
            </text>
          </g>
        );
      })}

      <g className="debug__center">
        <line x1={center.x - 0.2} y1={center.y} x2={center.x + 0.2} y2={center.y} />
        <line x1={center.x} y1={center.y - 0.2} x2={center.x} y2={center.y + 0.2} />
        <circle cx={center.x} cy={center.y} r={0.04} />
        <text className="debug__coord" x={center.x + 0.08} y={center.y + 0.18}>
          center ({center.x}, {center.y})
        </text>
      </g>
    </g>
  );
}
