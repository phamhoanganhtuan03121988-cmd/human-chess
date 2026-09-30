/**
 * Standard Xiangqi starting position. Red starts at the bottom (y = 9),
 * Blue at the top (y = 0). Coordinates are intersections, not cells.
 */
import type { Coordinate, Side } from './geometry.ts';
import type { PieceType } from '../config/assets.ts';

export interface PiecePlacement {
  readonly side: Side;
  readonly type: PieceType;
  readonly x: number;
  readonly y: number;
}

type SideLayout = Readonly<Record<PieceType, readonly Coordinate[]>>;

const RED_LAYOUT: SideLayout = {
  general: [{ x: 4, y: 9 }],
  advisor: [{ x: 3, y: 9 }, { x: 5, y: 9 }],
  elephant: [{ x: 2, y: 9 }, { x: 6, y: 9 }],
  knight: [{ x: 1, y: 9 }, { x: 7, y: 9 }],
  rook: [{ x: 0, y: 9 }, { x: 8, y: 9 }],
  cannon: [{ x: 1, y: 7 }, { x: 7, y: 7 }],
  pawn: [
    { x: 0, y: 6 },
    { x: 2, y: 6 },
    { x: 4, y: 6 },
    { x: 6, y: 6 },
    { x: 8, y: 6 },
  ],
};

const BLUE_LAYOUT: SideLayout = {
  general: [{ x: 4, y: 0 }],
  advisor: [{ x: 3, y: 0 }, { x: 5, y: 0 }],
  elephant: [{ x: 2, y: 0 }, { x: 6, y: 0 }],
  knight: [{ x: 1, y: 0 }, { x: 7, y: 0 }],
  rook: [{ x: 0, y: 0 }, { x: 8, y: 0 }],
  cannon: [{ x: 1, y: 2 }, { x: 7, y: 2 }],
  pawn: [
    { x: 0, y: 3 },
    { x: 2, y: 3 },
    { x: 4, y: 3 },
    { x: 6, y: 3 },
    { x: 8, y: 3 },
  ],
};

function expand(side: Side, layout: SideLayout): PiecePlacement[] {
  return (Object.keys(layout) as PieceType[]).flatMap((type) =>
    layout[type].map(({ x, y }) => ({ side, type, x, y })),
  );
}

/** The 32 pieces of the standard starting position. */
export const INITIAL_POSITION: readonly PiecePlacement[] = Object.freeze([
  ...expand('red', RED_LAYOUT),
  ...expand('blue', BLUE_LAYOUT),
]);
