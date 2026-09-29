import { describe, expect, it } from 'vitest';
import { chooseMove } from '../../src/ai/index.ts';
import {
  MOVE_DURATION_MS,
  MOVE_EASING,
  REDUCED_MOVE_DURATION_MS,
  getMoveDuration,
  getMoveOffset,
  getMovementStyle,
} from '../../src/components/animation/movement.ts';
import { createUiState, getAiState, handleClick, isPresenting, uiReducer } from '../../src/game/controller.ts';
import type { UiState } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

const click = (s: UiState, x: number, y: number) => handleClick(s, { x, y });
const complete = (s: UiState, id = s.movement!.id) => uiReducer(s, { type: 'movementComplete', id });
const start = () => click(click(createUiState(), 4, 6), 4, 5); // red pawn forward, animating

describe('movement animation settings', () => {
  it('uses a short ease-out movement', () => {
    expect(MOVE_DURATION_MS).toBe(240);
    expect(MOVE_EASING).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(getMoveDuration(false)).toBe(240);
    expect(getMoveDuration(true)).toBe(REDUCED_MOVE_DURATION_MS);
    expect(REDUCED_MOVE_DURATION_MS).toBeLessThanOrEqual(50);
  });

  it('computes offsets from the board layout in resolution-independent units', () => {
    const move = { from: { x: 4, y: 6 }, to: { x: 4, y: 5 } };
    expect(getMoveOffset(move)).toEqual({ x: 0, y: -1 });
    expect(getMoveOffset({ from: { x: 0, y: 9 }, to: { x: 8, y: 0 } })).toEqual({ x: 8, y: -9 });
    const style = getMovementStyle({ from: { x: 1, y: 9 }, to: { x: 2, y: 7 } }, 240) as Record<string, string>;
    expect(style['--move-x']).toBe(`${100 / 9}cqw`);
    expect(style['--move-y']).toBe(`${(-2 * 100) / 9}cqw`);
    expect(style['--move-duration']).toBe('240ms');
  });
});

describe('normal move flow (controller)', () => {
  it('a legal move starts the animation without touching the engine state', () => {
    const before = click(createUiState(), 4, 6);
    const s = click(before, 4, 5);
    expect(s.movement).not.toBeNull();
    expect(s.movement!.piece).toEqual({ side: 'red', type: 'pawn' });
    expect(s.movement!.move).toEqual({ from: { x: 4, y: 6 }, to: { x: 4, y: 5 } });
    expect(s.game).toBe(before.game);
    expect(s.game.turn).toBe('red');
    expect(s.lastMove).toBeNull(); // not before the piece arrives
    expect(s.selected).toBeNull();
    expect(s.legalMoves).toEqual([]);
    expect(s.combat).toBeNull();
    expect(isPresenting(s)).toBe(true);
  });

  it('an illegal destination does not start an animation', () => {
    const s = click(click(createUiState(), 4, 6), 4, 4);
    expect(s.movement).toBeNull();
    expect(s.game.history).toHaveLength(0);
  });

  it('completion applies the engine move exactly once, then updates last move and turn', () => {
    const s = start();
    const done = complete(s);
    expect(done.movement).toBeNull();
    expect(done.game.board[4]![5]).toEqual({ side: 'red', type: 'pawn' });
    expect(done.game.board[4]![6]).toBeNull();
    expect(done.game.history).toHaveLength(1);
    expect(done.lastMove).toEqual({ from: { x: 4, y: 6 }, to: { x: 4, y: 5 } });
    expect(done.game.turn).toBe('blue');
    expect(done.selected).toBeNull();
  });

  it('ignores all input during the animation', () => {
    const s = start();
    expect(click(s, 0, 9)).toBe(s); // select another piece
    expect(click(s, 4, 5)).toBe(s); // destination again (double click)
    expect(click(s, 4, 6)).toBe(s);
    expect(uiReducer(s, { type: 'clearSelection' })).toBe(s); // Escape
    expect(uiReducer(s, { type: 'newGame' })).toBe(s); // New Game blocked
  });

  it('ignores duplicate and stale completions', () => {
    const s = start();
    const id = s.movement!.id;
    expect(complete(s, id + 999)).toBe(s);
    const once = complete(s);
    expect(complete(once, id)).toBe(once);
    expect(once.game.history).toHaveLength(1);
    // A completion from an earlier game never applies to a new game.
    const fresh = uiReducer(once, { type: 'newGame' });
    expect(uiReducer(fresh, { type: 'movementComplete', id })).toBe(fresh);
    expect(fresh.game.history).toHaveLength(0);
  });

  it('captures still use combat, not movement', () => {
    const s = click(click(createUiState(), 1, 7), 1, 0);
    expect(s.combat).not.toBeNull();
    expect(s.movement).toBeNull();
  });

  it('check and game over are evaluated only after the move commits', () => {
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
        .....K...`),
    );
    const moving = click(click(s, 0, 5), 0, 0);
    expect(moving.game.status).toBe('playing');
    const done = complete(moving);
    expect(done.game.status).toBe('checkmate');
    expect(click(done, 8, 1).movement).toBeNull(); // game over: nothing more animates
  });
});

describe('AI and movement (controller)', () => {
  const vsAi = () => createUiState(undefined, { aiSide: 'blue' });

  it('the AI does not think while the human move is animating', () => {
    const s = click(click(vsAi(), 4, 6), 4, 5);
    expect(getAiState(s)).toBe('idle');
    expect(getAiState(complete(s))).toBe('thinking');
  });

  it('an AI result arriving during an animation is ignored', () => {
    const s = click(click(vsAi(), 4, 6), 4, 5);
    const done = complete(s);
    const move = chooseMove(done.game)!.move;
    // Result for the pre-commit position (ply 0) or during animation is dropped.
    expect(uiReducer(s, { type: 'aiMove', gameId: s.gameId, ply: 0, move })).toBe(s);
    expect(uiReducer(s, { type: 'aiMove', gameId: s.gameId, ply: 1, move })).toBe(s);
  });

  it('an AI normal move animates, then returns control to Red; the AI cannot move twice', () => {
    const thinking = complete(click(click(vsAi(), 4, 6), 4, 5));
    // Pick a non-capture AI move explicitly.
    const move = { from: { x: 4, y: 3 }, to: { x: 4, y: 4 } };
    const moving = uiReducer(thinking, { type: 'aiMove', gameId: thinking.gameId, ply: 1, move });
    expect(moving.movement?.piece).toEqual({ side: 'blue', type: 'pawn' });
    expect(moving.game).toBe(thinking.game);
    expect(getAiState(moving)).toBe('idle');
    expect(uiReducer(moving, { type: 'aiMove', gameId: thinking.gameId, ply: 1, move })).toBe(moving);
    const done = complete(moving);
    expect(done.game.turn).toBe('red');
    expect(done.game.history).toHaveLength(2);
    expect(getAiState(done)).toBe('idle');
  });
});
