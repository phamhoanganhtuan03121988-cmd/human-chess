/**
 * Move notation for the history panel (WXF style, from each side's own view):
 *   <glyph><from file><op><arg>   e.g. 炮2=5, 馬8+7, 兵3+1, 車1-2
 * - files are numbered 1–9 from each player's right-hand side
 * - op: '=' sideways, '+' forward, '-' backward
 * - arg: the destination file for sideways and diagonal pieces
 *   (Horse, Elephant, Advisor), otherwise the number of ranks moved
 * - '×' marks a capture
 * Derived only from the engine's recorded moves.
 */
import { getPieceGlyph } from '../config/pieceIdentity.ts';
import type { MoveRecord, Side } from '../engine/index.ts';

function fileNumber(side: Side, x: number): number {
  return side === 'red' ? 9 - x : x + 1;
}

/** Positive when the move goes toward the opponent. */
function forwardDelta(side: Side, fromY: number, toY: number): number {
  return side === 'red' ? fromY - toY : toY - fromY;
}

export function formatMove(record: MoveRecord): string {
  const { piece, from, to, captured } = record;
  const side = piece.side;
  const glyph = getPieceGlyph(side, piece.type);
  const f = fileNumber(side, from.x);
  const delta = forwardDelta(side, from.y, to.y);
  let op: string;
  let arg: number;
  if (delta === 0) {
    op = '=';
    arg = fileNumber(side, to.x);
  } else {
    op = delta > 0 ? '+' : '-';
    const diagonal = piece.type === 'knight' || piece.type === 'elephant' || piece.type === 'advisor';
    arg = diagonal ? fileNumber(side, to.x) : Math.abs(delta);
  }
  return `${glyph}${f}${op}${arg}${captured ? '×' : ''}`;
}

export interface HistoryRow {
  readonly number: number;
  readonly red: string | null;
  readonly blue: string | null;
}

/** Groups the move list into numbered rows (Red then Blue). */
export function historyRows(history: readonly MoveRecord[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const rec of history) {
    const text = formatMove(rec);
    const last = rows[rows.length - 1];
    if (rec.piece.side === 'red' || !last || last.blue !== null) {
      rows.push({ number: rows.length + 1, red: rec.piece.side === 'red' ? text : null, blue: rec.piece.side === 'blue' ? text : null });
    } else {
      rows[rows.length - 1] = { ...last, blue: text };
    }
  }
  return rows;
}

/** Pieces captured by each side, in order, from the recorded moves. */
export function capturedPieces(history: readonly MoveRecord[]) {
  const bySide: Record<Side, MoveRecord['piece'][]> = { red: [], blue: [] };
  for (const rec of history) if (rec.captured) bySide[rec.piece.side].push(rec.captured);
  return bySide;
}
