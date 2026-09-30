import { describe, expect, it } from 'vitest';
import { INITIAL_POSITION } from '../src/board/initialPosition.ts';
import { BOARD_MARGIN, BOARD_WIDTH } from '../src/board/layout.ts';
import { PIECE_SIDES, PIECE_TYPES, getPieceAsset } from '../src/config/assets.ts';
import {
  MAX_PIECE_RISE,
  PIECE_HEADROOM,
  PIECE_HEIGHTS,
  getPieceSprite,
  getPieceZIndex,
} from '../src/config/pieceSprites.ts';

describe('piece assets', () => {
  it('resolves every side/type through the manifest to its own side folder', () => {
    for (const side of PIECE_SIDES) {
      for (const type of PIECE_TYPES) {
        expect(getPieceAsset(side, type)).toBe(`/assets/pieces/${side}/${type}.png`);
      }
    }
    expect(getPieceAsset('red', 'cannon')).toBe('/assets/pieces/red/cannon.png');
    expect(getPieceAsset('blue', 'knight')).toBe('/assets/pieces/blue/knight.png');
  });

  it('every starting piece resolves to an asset of its own side and type', () => {
    for (const p of INITIAL_POSITION) {
      expect(getPieceAsset(p.side, p.type)).toBe(`/assets/pieces/${p.side}/${p.type}.png`);
    }
  });
});

describe('piece sprites', () => {
  it('uses one shared bottom-center anchor for every piece type', () => {
    for (const type of PIECE_TYPES) {
      const s = getPieceSprite(type);
      expect(s.anchorX).toBe(0.5);
      expect(s.anchorY).toBeGreaterThan(0.9);
      expect(s.anchorY).toBeLessThanOrEqual(1);
    }
  });

  it('makes the General the largest piece and the Pawn the smallest', () => {
    const heights = Object.values(PIECE_HEIGHTS);
    expect(PIECE_HEIGHTS.general).toBe(Math.max(...heights));
    expect(PIECE_HEIGHTS.pawn).toBe(Math.min(...heights));
  });

  it('keeps top-rank pieces inside the board frame (margin + headroom)', () => {
    expect(MAX_PIECE_RISE).toBeLessThanOrEqual(BOARD_MARGIN + PIECE_HEADROOM);
  });

  it('keeps the part below the anchor inside the bottom margin', () => {
    for (const type of PIECE_TYPES) {
      const s = getPieceSprite(type);
      expect(s.height * (1 - s.anchorY)).toBeLessThanOrEqual(BOARD_MARGIN);
    }
  });

  it('layers pieces by rank with small z-index values', () => {
    expect(getPieceZIndex(0)).toBe(1);
    expect(getPieceZIndex(9)).toBe(10);
    for (let y = 0; y < 9; y++) expect(getPieceZIndex(y + 1)).toBeGreaterThan(getPieceZIndex(y));
    expect(BOARD_WIDTH).toBe(9);
  });
});
