/**
 * Typed access to the Human Chess asset manifest.
 *
 * `asset-manifest.json` is the single source of truth for which image
 * represents which piece. Never substitute emoji, Unicode symbols, SVG/CSS
 * placeholders or any other image for these assets.
 */
import manifest from './asset-manifest.json';

export const PIECE_SIDES = ['red', 'blue'] as const;
export const PIECE_TYPES = [
  'general',
  'advisor',
  'elephant',
  'rook',
  'knight',
  'cannon',
  'pawn',
] as const;

export type PieceSide = (typeof PIECE_SIDES)[number];
export type PieceType = (typeof PIECE_TYPES)[number];

export type PieceAssetMap = Record<PieceSide, Record<PieceType, string>>;

export interface AssetManifest {
  pieces: PieceAssetMap;
}

export const assetManifest: AssetManifest = manifest satisfies AssetManifest;

export const pieceAssets: PieceAssetMap = assetManifest.pieces;

/** Returns the public URL of the official image for a piece. */
export function getPieceAsset(side: PieceSide, type: PieceType): string {
  return pieceAssets[side][type];
}
