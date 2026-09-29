import { describe, expect, it } from 'vitest';
import { INITIAL_POSITION } from '../src/board/initialPosition.ts';
import { BOARD_MARGIN } from '../src/board/layout.ts';
import { PIECE_SIDES, PIECE_TYPES } from '../src/config/assets.ts';
import { PIECE_GLYPHS, PIECE_NAMES_VI, getPieceGlyph, getPieceLabel } from '../src/config/pieceIdentity.ts';
import { BADGE_OFFSET, BADGE_SIZE, PIECE_HEIGHTS, RAISED_PIECE_Z_INDEX, getPieceZIndex } from '../src/config/pieceSprites.ts';

describe('piece identity', () => {
  it('uses the traditional characters for each side', () => {
    expect(PIECE_GLYPHS.red).toEqual({
      general: '帥', advisor: '士', elephant: '相', rook: '車', knight: '馬', cannon: '炮', pawn: '兵',
    });
    expect(PIECE_GLYPHS.blue).toEqual({
      general: '將', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', pawn: '卒',
    });
  });

  it('has Vietnamese names for every piece type', () => {
    expect(PIECE_NAMES_VI).toEqual({
      general: 'TƯỚNG', advisor: 'SĨ', elephant: 'TƯỢNG', rook: 'XE', knight: 'MÃ', cannon: 'PHÁO', pawn: 'TỐT',
    });
  });

  it('builds tooltip labels', () => {
    expect(getPieceLabel('red', 'rook')).toBe('XE — 車');
    expect(getPieceLabel('blue', 'knight')).toBe('MÃ — 馬');
    expect(getPieceLabel('red', 'cannon')).toBe('PHÁO — 炮');
    expect(getPieceLabel('red', 'elephant')).toBe('TƯỢNG — 相');
    expect(getPieceLabel('blue', 'elephant')).toBe('TƯỢNG — 象');
    expect(getPieceLabel('blue', 'advisor')).toBe('SĨ — 士');
    expect(getPieceLabel('red', 'general')).toBe('TƯỚNG — 帥');
    expect(getPieceLabel('blue', 'general')).toBe('TƯỚNG — 將');
    expect(getPieceLabel('red', 'pawn')).toBe('TỐT — 兵');
    expect(getPieceLabel('blue', 'pawn')).toBe('TỐT — 卒');
  });

  it('every side/type and starting piece has a single-character glyph', () => {
    for (const side of PIECE_SIDES) for (const type of PIECE_TYPES) expect([...getPieceGlyph(side, type)]).toHaveLength(1);
    for (const p of INITIAL_POSITION) expect(getPieceGlyph(p.side, p.type)).toBeTruthy();
  });
});

describe('badge geometry', () => {
  it('is smaller than every character', () => {
    for (const h of Object.values(PIECE_HEIGHTS)) expect(BADGE_SIZE).toBeLessThan(h / 3);
  });

  it('hangs just below the intersection and stays inside the bottom margin', () => {
    expect(BADGE_OFFSET).toBeLessThanOrEqual(0);
    expect(BADGE_OFFSET).toBeGreaterThan(-BADGE_SIZE / 4);
    expect(BADGE_OFFSET + BADGE_SIZE).toBeLessThan(BOARD_MARGIN);
  });

  it('raises hovered/selected pieces above every rank', () => {
    for (let y = 0; y <= 9; y++) expect(RAISED_PIECE_Z_INDEX).toBeGreaterThan(getPieceZIndex(y));
  });
});
