/**
 * Xiangqi board geometry: the single source of truth for board dimensions
 * and the intersection coordinate system.
 *
 * Pieces live ON INTERSECTIONS, never inside cells. A coordinate (x, y)
 * names one of the 90 intersections directly:
 *
 *   x = 0..8  files (columns), left → right
 *   y = 0..9  ranks (rows),    top  → bottom
 *
 * The river lies between y = 4 and y = 5. Blue occupies the top half
 * (y = 0..4) and Red the bottom half (y = 5..9).
 *
 * This module contains no rendering or styling concerns so the future
 * rules engine can share it.
 */

export const FILES = 9;
export const RANKS = 10;
export const INTERSECTION_COUNT = FILES * RANKS;

export const MIN_X = 0;
export const MAX_X = FILES - 1;
export const MIN_Y = 0;
export const MAX_Y = RANKS - 1;

/** Last rank of the top half; the river lies between this and the next. */
export const RIVER_TOP_Y = 4;
/** First rank of the bottom half. */
export const RIVER_BOTTOM_Y = 5;

export type Side = 'red' | 'blue';

export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

export interface PalaceBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Palaces: files 3..5, three ranks at each end of the board. */
export const PALACES: Readonly<Record<Side, PalaceBounds>> = {
  blue: { minX: 3, maxX: 5, minY: 0, maxY: 2 },
  red: { minX: 3, maxX: 5, minY: 7, maxY: 9 },
};

/** Home half of each side: Blue on top, Red at the bottom. */
export const HOME_RANKS: Readonly<Record<Side, { minY: number; maxY: number }>> = {
  blue: { minY: MIN_Y, maxY: RIVER_TOP_Y },
  red: { minY: RIVER_BOTTOM_Y, maxY: MAX_Y },
};

export function isValidCoordinate(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= MIN_X &&
    x <= MAX_X &&
    y >= MIN_Y &&
    y <= MAX_Y
  );
}

export function assertValidCoordinate(x: number, y: number): void {
  if (!isValidCoordinate(x, y)) {
    throw new RangeError(`Invalid board coordinate (${x}, ${y})`);
  }
}

/** All 90 intersections, ordered by rank (y) then file (x). */
export function getAllIntersections(): Coordinate[] {
  const points: Coordinate[] = [];
  for (let y = MIN_Y; y <= MAX_Y; y++) {
    for (let x = MIN_X; x <= MAX_X; x++) {
      points.push({ x, y });
    }
  }
  return points;
}

/** Creates an empty board indexed as board[x][y] (9 files × 10 ranks). */
export function createEmptyBoard<T>(fill: T): T[][] {
  return Array.from({ length: FILES }, () => Array.from({ length: RANKS }, () => fill));
}

export function isInPalace(x: number, y: number, side?: Side): boolean {
  if (!isValidCoordinate(x, y)) return false;
  const sides: Side[] = side ? [side] : ['red', 'blue'];
  return sides.some((s) => {
    const p = PALACES[s];
    return x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY;
  });
}

/** Palace intersections of a side (9 points each). */
export function getPalaceIntersections(side: Side): Coordinate[] {
  const p = PALACES[side];
  const points: Coordinate[] = [];
  for (let y = p.minY; y <= p.maxY; y++) {
    for (let x = p.minX; x <= p.maxX; x++) points.push({ x, y });
  }
  return points;
}

/** The two diagonal line segments of a palace, as intersection endpoints. */
export function getPalaceDiagonals(side: Side): [Coordinate, Coordinate][] {
  const p = PALACES[side];
  return [
    [{ x: p.minX, y: p.minY }, { x: p.maxX, y: p.maxY }],
    [{ x: p.maxX, y: p.minY }, { x: p.minX, y: p.maxY }],
  ];
}

/** Which half of the board (by home side) a rank belongs to. */
export function getBoardHalf(y: number): Side {
  if (!Number.isInteger(y) || y < MIN_Y || y > MAX_Y) {
    throw new RangeError(`Invalid rank ${y}`);
  }
  return y <= RIVER_TOP_Y ? 'blue' : 'red';
}

/** True when a point on rank y lies on `side`'s own half of the river. */
export function isOnOwnSide(y: number, side: Side): boolean {
  return getBoardHalf(y) === side;
}

/**
 * True when a vertical line segment between ranks y1 and y2 crosses the
 * river (i.e. one end is on each half).
 */
export function crossesRiver(y1: number, y2: number): boolean {
  return getBoardHalf(y1) !== getBoardHalf(y2);
}
