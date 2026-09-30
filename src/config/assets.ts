/**
 * Typed access to the Human Chess asset manifest.
 *
 * `asset-manifest.json` is the single source of truth for which image
 * represents which piece. It maps two asset categories:
 *   - pieces:    the on-board game-piece images
 *   - portraits: the cinematic character portraits
 *
 * Never substitute emoji, Unicode symbols, SVG/CSS placeholders or any
 * other image for these assets.
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
export const ASSET_CATEGORIES = ['pieces', 'portraits'] as const;

export type PieceSide = (typeof PIECE_SIDES)[number];
export type PieceType = (typeof PIECE_TYPES)[number];
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type PieceAssetMap = Record<PieceSide, Record<PieceType, string>>;

export type AssetManifest = Record<AssetCategory, PieceAssetMap>;

export const assetManifest: AssetManifest = manifest satisfies AssetManifest;

/** On-board game-piece images. */
export const pieceAssets: PieceAssetMap = assetManifest.pieces;

/** Cinematic character portraits. */
export const portraitAssets: PieceAssetMap = assetManifest.portraits;

/** Returns the public URL of the official game-piece image for a piece. */
export function getPieceAsset(side: PieceSide, type: PieceType): string {
  return pieceAssets[side][type];
}

/** Returns the public URL of the official cinematic portrait for a piece. */
export function getPortraitAsset(side: PieceSide, type: PieceType): string {
  return portraitAssets[side][type];
}
