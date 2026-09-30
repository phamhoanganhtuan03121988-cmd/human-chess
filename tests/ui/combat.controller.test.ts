import { describe, expect, it } from 'vitest';
import { formatBoard } from '../../src/engine/index.ts';
import { createUiState, getCombatPhase, getPlacements, handleClick, uiReducer } from '../../src/game/controller.ts';
import type { UiState } from '../../src/game/controller.ts';
import { getPieceDisplayName } from '../../src/config/pieceIdentity.ts';

/** Normal moves animate first; finish the animation so the engine applies them. */
const settle = (s: UiState) => (s.movement ? uiReducer(s, { type: 'movementComplete', id: s.movement.id }) : s);
const click = (s: UiState, x: number, y: number) => settle(handleClick(s, { x, y }));
const capture = () => click(click(createUiState(), 1, 7), 1, 0); // red cannon x blue knight

describe('combat state (controller)', () => {
  it('a capture opens combat without changing the engine state', () => {
    const start = createUiState();
    const s = click(click(start, 1, 7), 1, 0);
    expect(s.combat).not.toBeNull();
    expect(getCombatPhase(s)).toBe('context'); // the board shows the capture first
    expect(s.combat!.attacker).toEqual({ side: 'red', type: 'cannon' });
    expect(s.combat!.defender).toEqual({ side: 'blue', type: 'knight' });
    expect(s.combat!.move).toEqual({ from: { x: 1, y: 7 }, to: { x: 1, y: 0 } });
    expect(s.game).toBe(start.game); // same GameState object: nothing applied
    expect(s.selected).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it('a normal move does not open combat', () => {
    const s = click(click(createUiState(), 4, 6), 4, 5);
    expect(s.combat).toBeNull();
    expect(getCombatPhase(s)).toBe('idle');
    expect(s.game.turn).toBe('blue');
  });

  it('context hands off to the overlay once; stale or repeated hand-offs are ignored', () => {
    const s = capture();
    const entering = uiReducer(s, { type: 'combatPhase', id: s.combat!.id, phase: 'entering' });
    expect(getCombatPhase(entering)).toBe('entering');
    expect(uiReducer(s, { type: 'combatPhase', id: s.combat!.id + 99, phase: 'entering' })).toBe(s);
    const impact = uiReducer(entering, { type: 'combatPhase', id: s.combat!.id, phase: 'impact' });
    expect(uiReducer(impact, { type: 'combatPhase', id: s.combat!.id, phase: 'entering' })).toBe(impact);
    expect(entering.game).toBe(s.game);
  });

  it('phases advance without touching the engine state', () => {
    const s = capture();
    const impact = uiReducer(s, { type: 'combatPhase', id: s.combat!.id, phase: 'impact' });
    const complete = uiReducer(impact, { type: 'combatPhase', id: s.combat!.id, phase: 'complete' });
    expect(getCombatPhase(impact)).toBe('impact');
    expect(getCombatPhase(complete)).toBe('complete');
    expect(complete.game).toBe(s.game);
  });

  it('applies the capture only when combat completes', () => {
    const s = capture();
    const done = uiReducer(s, { type: 'combatComplete', id: s.combat!.id });
    expect(done.combat).toBeNull();
    expect(done.game.board[1]![0]).toEqual({ side: 'red', type: 'cannon' });
    expect(done.game.board[1]![7]).toBeNull();
    expect(getPlacements(done.game)).toHaveLength(31);
    expect(done.game.turn).toBe('blue');
    expect(done.lastMove).toEqual({ from: { x: 1, y: 7 }, to: { x: 1, y: 0 } });
  });

  it('locks all interaction during combat', () => {
    const s = capture();
    expect(click(s, 0, 9)).toBe(s); // select another red piece
    expect(click(s, 4, 6)).toBe(s);
    expect(click(s, 1, 2)).toBe(s); // blue piece
    expect(uiReducer(s, { type: 'newGame' })).toBe(s);
  });

  it('Escape (clearSelection) does not cancel combat or corrupt state', () => {
    const s = capture();
    const after = uiReducer(s, { type: 'clearSelection' });
    expect(after).toBe(s);
    const done = uiReducer(after, { type: 'combatComplete', id: s.combat!.id });
    expect(done.game.board[1]![0]).toEqual({ side: 'red', type: 'cannon' });
  });

  it('ignores stale or repeated completion events', () => {
    const s = capture();
    const id = s.combat!.id;
    expect(uiReducer(s, { type: 'combatComplete', id: id + 999 })).toBe(s);
    const done = uiReducer(s, { type: 'combatComplete', id });
    const again = uiReducer(done, { type: 'combatComplete', id });
    expect(again).toBe(done);
    expect(formatBoard(again.game.board)).toBe(formatBoard(done.game.board));
    expect(again.game.history).toHaveLength(1);
  });

  it('display names come from the central mapping with side-specific glyphs', () => {
    expect(getPieceDisplayName('red', 'cannon')).toEqual({ name: 'PHÁO', glyph: '炮' });
    expect(getPieceDisplayName('blue', 'knight')).toEqual({ name: 'MÃ', glyph: '馬' });
    expect(getPieceDisplayName('red', 'general')).toEqual({ name: 'TƯỚNG', glyph: '帥' });
    expect(getPieceDisplayName('blue', 'general')).toEqual({ name: 'TƯỚNG', glyph: '將' });
    expect(getPieceDisplayName('red', 'pawn')).toEqual({ name: 'TỐT', glyph: '兵' });
    expect(getPieceDisplayName('blue', 'pawn')).toEqual({ name: 'TỐT', glyph: '卒' });
    expect(getPieceDisplayName('blue', 'elephant')).toEqual({ name: 'TƯỢNG', glyph: '象' });
  });
});

describe('combat completion safety', () => {
  it('a stale completion from an earlier combat is ignored while a new combat runs', () => {
    // Red cannon takes knight; complete it.
    const first = capture();
    const firstId = first.combat!.id;
    const afterFirst = uiReducer(first, { type: 'combatComplete', id: firstId });
    // Blue rook recaptures on (1,0) → second combat.
    const second = click(click(afterFirst, 0, 0), 1, 0);
    expect(second.combat).not.toBeNull();
    expect(second.combat!.id).not.toBe(firstId);
    // A late callback from the first combat must not apply anything.
    expect(uiReducer(second, { type: 'combatComplete', id: firstId })).toBe(second);
    expect(uiReducer(second, { type: 'combatPhase', id: firstId, phase: 'impact' })).toBe(second);
    const done = uiReducer(second, { type: 'combatComplete', id: second.combat!.id });
    expect(done.game.history).toHaveLength(2);
    expect(done.game.board[1]![0]).toEqual({ side: 'blue', type: 'rook' });
  });

  it('a duplicate completion applies the move only once', () => {
    const s = capture();
    const id = s.combat!.id;
    const once = uiReducer(s, { type: 'combatComplete', id });
    const twice = uiReducer(once, { type: 'combatComplete', id });
    expect(twice).toBe(once);
    expect(twice.game.history).toHaveLength(1);
  });
});
