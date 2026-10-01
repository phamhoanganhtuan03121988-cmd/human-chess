import { MAX_X, MAX_Y } from '../board/geometry.ts';
import { fromViewCoordinate, toViewCoordinate } from '../board/perspective.ts';
import type { BoardPerspective } from '../board/perspective.ts';
import type { Position } from '../engine/types.ts';

export const BOARD_FILES = 9;
export const BOARD_RANKS = 10;
export const INTERSECTION_SPACING = 1.0;

export const WORLD_CENTER_X = (BOARD_FILES - 1) / 2; // 4.0
export const WORLD_CENTER_Z = (BOARD_RANKS - 1) / 2; // 4.5

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Maps engine board coordinate (x: 0..8, y: 0..9) to 3D world coordinates (X, Z).
 * Integrates directly with board perspective (Red vs Blue).
 */
export function engineToWorld(pos: Position, perspective: BoardPerspective = 'red'): WorldPoint {
  const view = toViewCoordinate(pos.x, pos.y, perspective);
  return {
    x: (view.x - WORLD_CENTER_X) * INTERSECTION_SPACING,
    z: (view.y - WORLD_CENTER_Z) * INTERSECTION_SPACING,
  };
}

/**
 * Maps 3D world coordinates (X, Z) back to engine board coordinate (x: 0..8, y: 0..9).
 * Returns null if the point is outside the playable board intersections.
 */
export function worldToEngine(
  worldX: number,
  worldZ: number,
  perspective: BoardPerspective = 'red',
  hitTolerance = 0.48,
): Position | null {
  const viewX = Math.round(worldX / INTERSECTION_SPACING + WORLD_CENTER_X);
  const viewY = Math.round(worldZ / INTERSECTION_SPACING + WORLD_CENTER_Z);

  if (viewX < 0 || viewX > MAX_X || viewY < 0 || viewY > MAX_Y) {
    return null;
  }

  const expectedWorldX = (viewX - WORLD_CENTER_X) * INTERSECTION_SPACING;
  const expectedWorldZ = (viewY - WORLD_CENTER_Z) * INTERSECTION_SPACING;
  const dist = Math.hypot(worldX - expectedWorldX, worldZ - expectedWorldZ);

  if (dist > hitTolerance) {
    return null;
  }

  return fromViewCoordinate(viewX, viewY, perspective);
}
