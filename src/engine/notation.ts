/**
 * Text diagrams of positions, for tests and debugging.
 *
 * A diagram is 10 rows (y = 0 at the top) of 9 characters (x = 0..8).
 * Uppercase = Red, lowercase = Blue, '.' = empty. Spaces are ignored.
 *
 *   K general   A advisor   E elephant   R rook
 *   H knight    C cannon    P pawn
 */
import { FILES, RANKS } from '../board/geometry.ts';
import { emptyBoard } from './board.ts';
import type { Board, Piece, PieceType } from './types.ts';

const LETTER_TO_TYPE: Readonly<Record<string, PieceType>> = {
  k: 'general',
  a: 'advisor',
  e: 'elephant',
  r: 'rook',
  h: 'knight',
  c: 'cannon',
  p: 'pawn',
};
const TYPE_TO_LETTER = Object.fromEntries(Object.entries(LETTER_TO_TYPE).map(([l, t]) => [t, l])) as Record<
  PieceType,
  string
>;

export function parseBoard(diagram: string): Board {
  const rows = diagram
    .split('\n')
    .map((r) => r.replace(/\s+/g, ''))
    .filter((r) => r.length > 0);
  if (rows.length !== RANKS) throw new Error(`Diagram needs ${RANKS} rows, got ${rows.length}`);
  const board = emptyBoard().map((f) => f.slice());
  rows.forEach((row, y) => {
    if (row.length !== FILES) throw new Error(`Row ${y} needs ${FILES} columns, got "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const type = LETTER_TO_TYPE[ch.toLowerCase()];
      if (!type) throw new Error(`Unknown piece letter "${ch}" at (${x}, ${y})`);
      const piece: Piece = { side: ch === ch.toUpperCase() ? 'red' : 'blue', type };
      board[x]![y] = piece;
    });
  });
  return board;
}

export function formatBoard(board: Board): string {
  const rows: string[] = [];
  for (let y = 0; y < RANKS; y++) {
    let row = '';
    for (let x = 0; x < FILES; x++) {
      const p = board[x]![y];
      const letter = p ? TYPE_TO_LETTER[p.type] : '.';
      row += p?.side === 'red' ? letter.toUpperCase() : letter;
    }
    rows.push(row);
  }
  return rows.join('\n');
}
