/**
 * Traditional Xiangqi identity for each piece: the character shown on its
 * badge and its Vietnamese name. Presentation only.
 */
import type { PieceSide, PieceType } from './assets.ts';

/** Traditional characters. General, Elephant and Pawn differ by side. */
export const PIECE_GLYPHS: Readonly<Record<PieceSide, Readonly<Record<PieceType, string>>>> = {
  red: {
    general: '帥',
    advisor: '仕',
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

/** Side names shown with a piece, e.g. "MÃ ĐỎ". */
export const SIDE_NAMES_VI: Readonly<Record<PieceSide, string>> = { red: 'ĐỎ', blue: 'XANH' };

/** How each piece moves (help dialog, character card). */
export const PIECE_MOVES_VI: Readonly<Record<PieceType, string>> = {
  general: 'Đi 1 ô ngang hoặc dọc, chỉ trong Cửu cung.',
  advisor: 'Đi 1 ô chéo, chỉ trong Cửu cung.',
  elephant: 'Đi chéo đúng 2 ô; không qua sông; bị chặn nếu ô giữa có quân ("mắt tượng").',
  knight: 'Đi hình chữ L; bị chặn nếu ô liền kề theo hướng đi có quân ("cản chân mã").',
  rook: 'Đi ngang/dọc bao xa cũng được, không nhảy qua quân.',
  cannon: 'Đi như Xe; khi ăn quân phải nhảy qua đúng 1 quân (ngòi).',
  pawn: 'Đi thẳng 1 ô; qua sông được đi ngang; không bao giờ lùi.',
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

export interface PieceDisplayName {
  /** Vietnamese name, e.g. "PHÁO". */
  readonly name: string;
  /** Traditional character for this side, e.g. "炮". */
  readonly glyph: string;
}

/** Central display name for a piece (badges, tooltips, combat cards). */
export function getPieceDisplayName(side: PieceSide, type: PieceType): PieceDisplayName {
  return { name: PIECE_NAMES_VI[type], glyph: getPieceGlyph(side, type) };
}
