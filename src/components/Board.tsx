import type { CSSProperties, ReactNode } from 'react';
import {
  FILES,
  MAX_X,
  MAX_Y,
  RANKS,
  RIVER_BOTTOM_Y,
  RIVER_TOP_Y,
  getPalaceDiagonals,
  type Side,
} from '../board/geometry.ts';
import { BOARD_HEIGHT, BOARD_WIDTH, getBoardPoint } from '../board/layout.ts';
import { BoardDebugOverlay } from './BoardDebugOverlay.tsx';

/** Intersections that carry the traditional position marks (cannons and pawns). */
const POSITION_MARKS: [number, number][] = [
  [1, 2], [7, 2], [1, 7], [7, 7],
  [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
  [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
];

interface BoardProps {
  /** Show the development debug overlay. */
  debug?: boolean;
  /**
   * Extra board surface above the grid, in board units, so tall pieces on
   * the top rank stay inside the board frame. Does not affect coordinates.
   */
  headroom?: number;
  /** Layers positioned on intersections (see BoardAnchor / PieceLayer). */
  children?: ReactNode;
}

/**
 * Renders the Xiangqi board. Lines are drawn in an SVG whose viewBox is the
 * board-unit coordinate space from layout.ts, so every intersection is at
 * getBoardPoint(x, y) regardless of rendered size.
 */
export function Board({ debug = false, headroom = 0, children }: BoardProps) {
  const frameHeight = BOARD_HEIGHT + headroom;
  const frameStyle = {
    aspectRatio: `${BOARD_WIDTH} / ${frameHeight}`,
    '--frame-aspect': BOARD_WIDTH / frameHeight,
  } as CSSProperties;

  return (
    <div className="board-frame" style={frameStyle}>
      <div className="board" data-testid="board">
        <svg
          className="board__svg"
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Xiangqi board"
          role="img"
        >
          <BoardLines />
          {debug && <BoardDebugOverlay />}
        </svg>
        {children}
      </div>
    </div>
  );
}

function Segment({ from, to, className }: { from: [number, number]; to: [number, number]; className: string }) {
  const a = getBoardPoint(from[0], from[1]);
  const b = getBoardPoint(to[0], to[1]);
  return <line className={className} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
}

function BoardLines() {
  const topLeft = getBoardPoint(0, 0);
  const bottomRight = getBoardPoint(MAX_X, MAX_Y);
  const riverTop = getBoardPoint(0, RIVER_TOP_Y).y;
  const riverBottom = getBoardPoint(0, RIVER_BOTTOM_Y).y;
  const riverTextY = (riverTop + riverBottom) / 2;

  return (
    <g className="board__lines">
      {/* 10 ranks */}
      {Array.from({ length: RANKS }, (_, y) => (
        <Segment key={`r${y}`} className="board__line" from={[0, y]} to={[MAX_X, y]} />
      ))}
      {/* 9 files: edge files are continuous, inner files stop at the river */}
      {Array.from({ length: FILES }, (_, x) =>
        x === 0 || x === MAX_X ? (
          <Segment key={`f${x}`} className="board__line" from={[x, 0]} to={[x, MAX_Y]} />
        ) : (
          <g key={`f${x}`}>
            <Segment className="board__line" from={[x, 0]} to={[x, RIVER_TOP_Y]} />
            <Segment className="board__line" from={[x, RIVER_BOTTOM_Y]} to={[x, MAX_Y]} />
          </g>
        ),
      )}
      {/* Palace diagonals */}
      {(['blue', 'red'] as Side[]).flatMap((side) =>
        getPalaceDiagonals(side).map(([a, b], i) => (
          <Segment key={`${side}-d${i}`} className="board__line board__palace" from={[a.x, a.y]} to={[b.x, b.y]} />
        )),
      )}
      {/* Outer frame */}
      <rect
        className="board__frame"
        x={topLeft.x}
        y={topLeft.y}
        width={bottomRight.x - topLeft.x}
        height={bottomRight.y - topLeft.y}
      />
      {POSITION_MARKS.map(([x, y]) => (
        <PositionMark key={`m${x},${y}`} x={x} y={y} />
      ))}
      <text className="board__river-text" x={BOARD_WIDTH * 0.3} y={riverTextY}>
        楚 河
      </text>
      <text className="board__river-text" x={BOARD_WIDTH * 0.7} y={riverTextY}>
        漢 界
      </text>
    </g>
  );
}

/** Small L-shaped corner marks around an intersection (omitted past the board edge). */
function PositionMark({ x, y }: { x: number; y: number }) {
  const c = getBoardPoint(x, y);
  const gap = 0.08;
  const len = 0.2;
  const paths: string[] = [];
  for (const dx of [-1, 1]) {
    if ((dx < 0 && x === 0) || (dx > 0 && x === MAX_X)) continue;
    for (const dy of [-1, 1]) {
      const px = c.x + dx * gap;
      const py = c.y + dy * gap;
      paths.push(`M ${px + dx * len} ${py} L ${px} ${py} L ${px} ${py + dy * len}`);
    }
  }
  return <path className="board__mark" d={paths.join(' ')} />;
}
