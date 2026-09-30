/**
 * Board perspective (presentation only): which side sits at the bottom of the
 * screen. The engine, moves, notation and the server always use the same
 * coordinates; a perspective only changes where an intersection is DRAWN.
 *
 * 'red'  — the engine layout as is: Red at the bottom (y = 9), Blue on top.
 * 'blue' — the whole board rotated 180° about its centre: Blue at the bottom.
 */
import { MAX_X, MAX_Y } from './geometry.ts';
import type { Coordinate, Side } from './geometry.ts';

export type BoardPerspective = 'red' | 'blue';

/**
 * The perspective of the local player: an online Blue seat sees the board from
 * Blue's side; everyone else (online Red, the local game against the AI, where
 * the player is Red) keeps the Red perspective.
 */
export function getBoardPerspective(localSide: Side | null): BoardPerspective {
  return localSide === 'blue' ? 'blue' : 'red';
}

/**
 * Engine intersection → the intersection it is drawn on. A 180° rotation of the
 * 9×10 grid maps (x, y) to (8 − x, 9 − y); the rotation is its own inverse, so
 * the same function maps a drawn (tapped) intersection back to the engine one.
 */
export function toViewCoordinate(x: number, y: number, perspective: BoardPerspective): Coordinate {
  return perspective === 'blue' ? { x: MAX_X - x, y: MAX_Y - y } : { x, y };
}

/** Drawn intersection → engine intersection (the inverse of toViewCoordinate). */
export const fromViewCoordinate = toViewCoordinate;
