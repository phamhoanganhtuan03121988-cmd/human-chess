/**
 * Traditional Xiangqi identity for each piece: the character shown on its
 * badge and its Vietnamese name. Presentation only.
 */
import type { PieceSide, PieceType } from './assets.ts';

/** Traditional characters. General, Elephant and Pawn differ by side. */
export const PIECE_GLYPHS: Readonly<Record<PieceSide, Readonly<Record<PieceType, string>>>> = {
  red: {
    general: '帥',
    advisor: '士',
    elephant: '相',
    rook: '車',
    knight: '馬',
    cannon: '炮',
    pawn: '兵',
  },
  blue: {
    general: '將',
    advisor: '士',
    elephant: '象',
    rook: '車',
    knight: '馬',
    cannon: '炮',
    pawn: '卒',
  },
};

/** Vietnamese piece names (cờ tướng). */
export const PIECE_NAMES_VI: Readonly<Record<PieceType, string>> = {
  general: 'TƯỚNG',
  advisor: 'SĨ',
  elephant: 'TƯỢNG',
  rook: 'XE',
  knight: 'MÃ',
  cannon: 'PHÁO',
  pawn: 'TỐT',
};

export function getPieceGlyph(side: PieceSide, type: PieceType): string {
  return PIECE_GLYPHS[side][type];
}

/** Tooltip label, e.g. "PHÁO — 炮". */
export function getPieceLabel(side: PieceSide, type: PieceType): string {
  return `${PIECE_NAMES_VI[type]} — ${getPieceGlyph(side, type)}`;
}
