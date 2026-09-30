/**
 * Coordinate conversion: maps intersection coordinates (x, y) to positions
 * on the rendered board.
 *
 * The board is drawn in abstract "board units" where adjacent intersections
 * are exactly 1 unit apart, with a margin around the outermost lines so
 * pieces on edge intersections are not clipped. The whole drawing is then
 * scaled uniformly, so positions are resolution independent: the same
 * percentages hold at every screen size.
 */
import { FILES, RANKS, assertValidCoordinate } from './geometry.ts';

/** Distance between adjacent intersections, in board units. */
export const INTERSECTION_SPACING = 1;
/** Space between the outermost lines and the board edge, in board units. */
export const BOARD_MARGIN = 0.5;

/** Width/height of the grid of lines (outermost line to outermost line). */
export const GRID_WIDTH = (FILES - 1) * INTERSECTION_SPACING; // 8
export const GRID_HEIGHT = (RANKS - 1) * INTERSECTION_SPACING; // 9

/** Full board size including margins, in board units (9 × 10). */
export const BOARD_WIDTH = GRID_WIDTH + 2 * BOARD_MARGIN;
export const BOARD_HEIGHT = GRID_HEIGHT + 2 * BOARD_MARGIN;
export const BOARD_ASPECT_RATIO = BOARD_WIDTH / BOARD_HEIGHT; // 9 / 10

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PercentPosition {
  /** Horizontal offset from the board's left edge, 0..100. */
  readonly left: number;
  /** Vertical offset from the board's top edge, 0..100. */
  readonly top: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Intersection position in board units (used as SVG user coordinates). */
export function getBoardPoint(x: number, y: number): Point {
  assertValidCoordinate(x, y);
  return {
    x: BOARD_MARGIN + x * INTERSECTION_SPACING,
    y: BOARD_MARGIN + y * INTERSECTION_SPACING,
  };
}

/**
 * Where a piece at (x, y) must be anchored, as percentages of the board's
 * width and height. Anchor the piece's CENTER here
 * (e.g. `left: …%; top: …%; transform: translate(-50%, -50%)`).
 */
export function getIntersectionPosition(x: number, y: number): PercentPosition {
  const p = getBoardPoint(x, y);
  return {
    left: (p.x / BOARD_WIDTH) * 100,
    top: (p.y / BOARD_HEIGHT) * 100,
  };
}

/** Intersection position in pixels for a board rendered at `size`. */
export function getIntersectionPixelPosition(x: number, y: number, size: Size): Point {
  const { left, top } = getIntersectionPosition(x, y);
  return { x: (left / 100) * size.width, y: (top / 100) * size.height };
}

/** Center of the board (midpoint of the grid, in the middle of the river). */
export function getBoardCenter(): Point {
  return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
}
