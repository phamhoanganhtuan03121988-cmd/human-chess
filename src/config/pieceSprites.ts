/**
 * Visual configuration for rendering the official piece PNGs on the board.
 * This is presentation only; board geometry lives in src/board/.
 *
 * Anchoring: each sprite is positioned so that the point
 * (anchorX × width, anchorY × height) of the image sits exactly on the
 * piece's intersection. All 14 official PNGs share the same framing — the
 * character's feet / ground line is at ~93–96% of the image height with
 * transparent padding below — so a single shared anchor is used and no
 * per-piece pixel corrections are needed.
 */
import type { PieceType } from './assets.ts';

export interface PieceSprite {
  /** Horizontal anchor as a fraction of image width (0 = left, 1 = right). */
  readonly anchorX: number;
  /** Vertical anchor as a fraction of image height (0 = top, 1 = bottom). */
  readonly anchorY: number;
  /** Rendered image height in board units (1 unit = intersection spacing). */
  readonly height: number;
}

/** Bottom-center anchor at the characters' ground line. */
export const PIECE_ANCHOR_X = 0.5;
export const PIECE_ANCHOR_Y = 0.95;

/**
 * Rendered heights in board units. The General is the most prominent,
 * Pawns the smallest. With the PNGs' ~0.65–0.8 width:height ratio every
 * piece stays under one intersection spacing wide.
 */
export const PIECE_HEIGHTS: Readonly<Record<PieceType, number>> = {
  general: 1.35,
  advisor: 1.2,
  elephant: 1.2,
  rook: 1.2,
  knight: 1.2,
  cannon: 1.15,
  pawn: 1.05,
};

export function getPieceSprite(type: PieceType): PieceSprite {
  return { anchorX: PIECE_ANCHOR_X, anchorY: PIECE_ANCHOR_Y, height: PIECE_HEIGHTS[type] };
}

/** How far the tallest piece rises above its anchor, in board units. */
export const MAX_PIECE_RISE = Math.max(...Object.values(PIECE_HEIGHTS)) * PIECE_ANCHOR_Y;

/**
 * Pieces on the top rank rise above the grid. Extra board surface above the
 * top margin (in board units) keeps them inside the board frame.
 */
export const PIECE_HEADROOM = 0.8;

/**
 * Stacking order within the piece layer: pieces lower on screen (larger y)
 * are drawn in front of pieces behind them. Values are 1..10.
 */
export function getPieceZIndex(y: number): number {
  return y + 1;
}
