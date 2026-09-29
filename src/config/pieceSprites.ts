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
 * Identification badge, in board units. Its top edge sits BADGE_OFFSET
 * below the intersection (negative = tucked slightly under the feet), so it
 * hangs on the file line directly beneath the piece, never in a cell.
 */
export const BADGE_SIZE = 0.3;
export const BADGE_OFFSET = -0.03;
/** Minimum on-screen badge size (px) so glyphs stay legible on small screens. */
export const BADGE_MIN_PX = 15;

/** Ground ring (hover / selected) under the feet, in board units. */
export const RING_WIDTH = 0.82;
export const RING_HEIGHT = 0.3;

/**
 * Stacking order within the piece layer: pieces lower on screen (larger y)
 * are drawn in front of pieces behind them. Values are 1..10.
 */
export function getPieceZIndex(y: number): number {
  return y + 1;
}

/** z-index for a hovered or selected piece: above every rank. */
export const RAISED_PIECE_Z_INDEX = 11;

/* ------------------------------------------------------------------ */
/* Board tokens (Step 13). The board now shows compact Xiangqi tokens   */
/* centered on each intersection; the character PNG sprites above are   */
/* kept (unused on the board) so the previous presentation can return. */
/* ------------------------------------------------------------------ */

/** Token diameter in board units (1 = distance between intersections). */
export const TOKEN_SIZE = 0.72;
/** Minimum on-screen token diameter (px) so glyphs stay legible. */
export const TOKEN_MIN_PX = 18;
/** Ground rings (hover, selected, last move, check…) around a token. */
export const TOKEN_RING_SIZE = 0.92;
/** Tokens never rise above their intersection: no extra board headroom. */
export const TOKEN_HEADROOM = 0;
