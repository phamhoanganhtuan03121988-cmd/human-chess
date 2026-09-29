/**
 * Piece movement animation (presentation only). The engine decides legality;
 * this module only turns a source → destination pair into a transform in
 * board units, so it stays aligned to the intersections at every size.
 */
import type { CSSProperties } from 'react';
import { BOARD_WIDTH, getBoardPoint } from '../../board/layout.ts';
import type { Move, Position } from '../../engine/index.ts';

/** Default movement duration (ms). */
export const MOVE_DURATION_MS = 240;
/** Duration when the user prefers reduced motion (ms): effectively instant. */
export const REDUCED_MOVE_DURATION_MS = 30;
/** Landing settle after a move commits (ms). */
export const LANDING_DURATION_MS = 80;
/** Ease-out: starts quickly, slows down and settles on the destination. */
export const MOVE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function getMoveDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_MOVE_DURATION_MS : MOVE_DURATION_MS;
}

/**
 * Offset from the source to the destination intersection in board units
 * (1 unit = intersection spacing), from the existing board layout.
 */
export function getMoveOffset(move: Move): Position {
  const from = getBoardPoint(move.from.x, move.from.y);
  const to = getBoardPoint(move.to.x, move.to.y);
  return { x: to.x - from.x, y: to.y - from.y };
}

/**
 * CSS custom properties for the moving piece and its badge. Offsets are in
 * container-query width units of the board (the board is the size
 * container), so the same values are exact at any resolution. Only
 * transform-family properties are animated.
 */
export function getMovementStyle(move: Move, durationMs: number): CSSProperties {
  const { x, y } = getMoveOffset(move);
  const unit = 100 / BOARD_WIDTH; // cqw per board unit
  return {
    '--move-x': `${x * unit}cqw`,
    '--move-y': `${y * unit}cqw`,
    '--move-duration': `${durationMs}ms`,
    '--move-easing': MOVE_EASING,
  } as CSSProperties;
}
