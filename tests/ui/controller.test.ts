import { describe, expect, it } from 'vitest';
import { createInitialGameState, getLegalMoves, isInCheck } from '../../src/engine/index.ts';
import {
  createUiState,
  getPlacements,
  getStatusView,
  handleClick,
  uiReducer,
} from '../../src/game/controller.ts';
import type { UiState } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

const click = (s: UiState, x: number, y: number) => handleClick(s, { x, y });
const dests = (s: UiState) => s.legalMoves.map((m) => `${m.to.x},${m.to.y}`).sort();

describe('game controller', () => {
  it('starts from the engine initial state: 32 pieces, Red to move', () => {
    const s = createUiState();
    expect(getPlacements(s.game)).toHaveLength(32);
    expect(s.game.turn).toBe('red');
    expect(getStatusView(s.game)).toEqual({ kind: 'turn', side: 'red', check: false });
    expect(s.selected).toBeNull();
  });

  it('selects a piece of the side to move and shows exactly the engine legal moves', () => {
    const s = click(createUiState(), 1, 7); // red cannon
    expect(s.selected).toEqual({ x: 1, y: 7 });
    expect(s.legalMoves).toEqual(getLegalMoves(s.game, { x: 1, y: 7 }));
    expect(dests(s)).toContain('1,0'); // capture over the screen
  });

  it('does not select an opponent piece', () => {
    const s = click(createUiState(), 1, 0); // blue knight on Red's turn
    expect(s.selected).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it('shows only legal moves (pawn, knight with horse-leg block, blocked rook)', () => {
    const start = createUiState();
    expect(dests(click(start, 4, 6))).toEqual(['4,5']);
    const knight = click(start, 1, 9);
    expect(dests(knight)).toEqual(['0,7', '2,7']);
    expect(dests(knight)).not.toContain('3,8'); // leg (2,9) blocked by the elephant
    expect(dests(click(start, 0, 9))).toEqual(['0,7', '0,8']); // rook blocked by its pawn
  });

  it('an illegal destination does not move the piece and clears selection', () => {
    const start = createUiState();
    const selected = click(start, 4, 6);
    const after = click(selected, 4, 4);
    expect(after.game).toBe(start.game);
    expect(after.selected).toBeNull();
    expect(after.game.board[4]![6]).toEqual({ side: 'red', type: 'pawn' });
  });

  it('a legal destination moves the piece, changes turn and records the last move', () => {
    const s = click(click(createUiState(), 4, 6), 4, 5);
    expect(s.game.board[4]![5]).toEqual({ side: 'red', type: 'pawn' });
    expect(s.game.board[4]![6]).toBeNull();
    expect(s.game.turn).toBe('blue');
    expect(s.selected).toBeNull();
    expect(s.legalMoves).toEqual([]);
    expect(s.lastMove).toEqual({ from: { x: 4, y: 6 }, to: { x: 4, y: 5 } });
    expect(getPlacements(s.game)).toHaveLength(32);
  });

  it('blue moves on its turn and the last move updates', () => {
    const red = click(click(createUiState(), 4, 6), 4, 5);
    expect(click(red, 4, 6).selected).toBeNull(); // red cannot move twice
    const blue = click(click(red, 4, 3), 4, 4);
    expect(blue.game.turn).toBe('red');
    expect(blue.lastMove).toEqual({ from: { x: 4, y: 3 }, to: { x: 4, y: 4 } });
  });

  it('capturing removes the captured piece', () => {
    const s = click(click(createUiState(), 1, 7), 1, 0); // cannon takes knight
    expect(s.game.board[1]![0]).toEqual({ side: 'red', type: 'cannon' });
    expect(getPlacements(s.game)).toHaveLength(31);
    expect(getPlacements(s.game).filter((p) => p.side === 'blue' && p.type === 'knight')).toHaveLength(1);
  });

  it('clicking the selected piece again clears the selection', () => {
    const s = click(click(createUiState(), 4, 6), 4, 6);
    expect(s.selected).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it('clicking another own piece switches the selection', () => {
    const s = click(click(createUiState(), 4, 6), 0, 9);
    expect(s.selected).toEqual({ x: 0, y: 9 });
  });

  it('Escape (clearSelection) clears the selection', () => {
    const s = uiReducer(click(createUiState(), 4, 6), { type: 'clearSelection' });
    expect(s.selected).toBeNull();
  });

  it('reports check from the engine status', () => {
    const s = createUiState(
      position(`
        ....k....
        .........
        .........
        .........
        .........
        R........
        .........
        .........
        .........
        ...K.....
      `),
    );
    const after = click(click(s, 0, 5), 4, 5);
    expect(after.game.inCheck).toBe(true);
    expect(isInCheck(after.game.board, 'blue')).toBe(true);
    expect(getStatusView(after.game)).toEqual({ kind: 'turn', side: 'blue', check: true });
  });

  it('checkmate ends the game, shows the winner and blocks further moves', () => {
    const s = createUiState(
      position(`
        ...k.....
        ........R
        .........
        .........
        .........
        R........
        .........
        .........
        .........
        .....K...
      `),
    );
    const mated = click(click(s, 0, 5), 0, 0);
    expect(mated.game.status).toBe('checkmate');
    expect(getStatusView(mated.game)).toEqual({ kind: 'over', winner: 'red', reason: 'checkmate' });
    const tryBlue = click(mated, 3, 0);
    expect(tryBlue.selected).toBeNull();
    expect(tryBlue.game).toBe(mated.game);
    const tryRed = click(mated, 8, 1);
    expect(tryRed.selected).toBeNull();
  });

  it('reports the winner for a general capture', () => {
    const s = createUiState(
      position(
        `
        ...k.....
        .........
        .........
        .........
        .........
        ....r....
        .........
        .........
        .........
        ....K....
      `,
        'blue',
      ),
    );
    const over = click(click(s, 4, 5), 4, 9);
    expect(getStatusView(over.game)).toEqual({ kind: 'over', winner: 'blue', reason: 'general_captured' });
  });

  it('newGame restores the initial position', () => {
    const moved = click(click(createUiState(), 4, 6), 4, 5);
    const reset = uiReducer(moved, { type: 'newGame' });
    expect(reset.game.board).toEqual(createInitialGameState().board);
    expect(reset.lastMove).toBeNull();
  });
});
