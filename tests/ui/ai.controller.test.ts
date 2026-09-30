import { describe, expect, it } from 'vitest';
import { chooseMove } from '../../src/ai/index.ts';
import { createUiState, getAiState, getStatusView, handleClick, uiReducer } from '../../src/game/controller.ts';
import type { UiState } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

/** Normal moves animate first; finish the animation so the engine applies them. */
const settle = (s: UiState) => (s.movement ? uiReducer(s, { type: 'movementComplete', id: s.movement.id }) : s);
const click = (s: UiState, x: number, y: number) => settle(handleClick(s, { x, y }));
const vsAi = () => createUiState(undefined, { aiSide: 'blue' });
const aiMove = (s: UiState, move = chooseMove(s.game)!.move) =>
  settle(uiReducer(s, { type: 'aiMove', gameId: s.gameId, ply: s.game.history.length, move }));

describe('AI game flow (controller)', () => {
  it('Red starts; the AI is idle until the human moves', () => {
    const s = vsAi();
    expect(s.game.turn).toBe('red');
    expect(getAiState(s)).toBe('idle');
  });

  it('a human move puts the AI in the thinking state and locks the board', () => {
    const s = click(click(vsAi(), 4, 6), 4, 5);
    expect(s.game.turn).toBe('blue');
    expect(getAiState(s)).toBe('thinking');
    expect(getStatusView(s.game, getAiState(s))).toEqual({ kind: 'turn', side: 'blue', check: false, thinking: true });
    expect(click(s, 4, 3)).toBe(s); // cannot click blue pieces
    expect(click(s, 4, 5)).toBe(s); // cannot click red pieces
  });

  it('an AI move is applied and returns control to Red', () => {
    const thinking = click(click(vsAi(), 4, 6), 4, 5);
    const move = chooseMove(thinking.game)!.move;
    let after = aiMove(thinking, move);
    // Here the AI's best reply is Cannon x Knight, so it goes through combat first.
    if (after.combat) after = uiReducer(after, { type: 'combatComplete', id: after.combat.id });
    expect(after.game.turn).toBe('red');
    expect(after.game.history).toHaveLength(2);
    expect(after.lastMove).toEqual(move);
    expect(getAiState(after)).toBe('idle');
  });

  it('an AI capture opens combat and applies only when combat completes', () => {
    const s = createUiState(
      position(
        `
        ....k....
        .........
        r........
        .........
        .........
        .........
        R........
        .........
        .........
        ...K.....`,
        'blue',
      ),
      { aiSide: 'blue' },
    );
    expect(getAiState(s)).toBe('thinking');
    const fighting = aiMove(s);
    expect(fighting.combat?.attacker).toEqual({ side: 'blue', type: 'rook' });
    expect(fighting.combat?.defender).toEqual({ side: 'red', type: 'rook' });
    expect(fighting.game).toBe(s.game); // nothing applied yet
    expect(getAiState(fighting)).toBe('idle'); // no second search during combat
    const done = uiReducer(fighting, { type: 'combatComplete', id: fighting.combat!.id });
    expect(done.game.board[0]![6]).toEqual({ side: 'blue', type: 'rook' });
    expect(done.game.turn).toBe('red');
    expect(getAiState(done)).toBe('idle');
  });

  it('ignores stale AI results (old ply, repeated result, old game)', () => {
    const thinking = click(click(vsAi(), 4, 6), 4, 5);
    const move = chooseMove(thinking.game)!.move;
    const stalePly = uiReducer(thinking, { type: 'aiMove', gameId: thinking.gameId, ply: 0, move });
    expect(stalePly).toBe(thinking);
    const once = aiMove(thinking, move);
    const twice = uiReducer(once, { type: 'aiMove', gameId: thinking.gameId, ply: 1, move });
    expect(twice).toBe(once); // AI does not move twice
    const reset = uiReducer(thinking, { type: 'newGame' });
    const late = uiReducer(reset, { type: 'aiMove', gameId: thinking.gameId, ply: 1, move });
    expect(late).toBe(reset); // result from before New Game is dropped
  });

  it('rejects an AI move that is not legal', () => {
    const thinking = click(click(vsAi(), 4, 6), 4, 5);
    const bogus = { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
    expect(aiMove(thinking, bogus)).toBe(thinking);
  });

  it('New Game resets to Red to move, keeps the AI side and does not start the AI', () => {
    const thinking = click(click(vsAi(), 4, 6), 4, 5);
    const reset = uiReducer(thinking, { type: 'newGame' });
    expect(reset.aiSide).toBe('blue');
    expect(reset.gameId).not.toBe(thinking.gameId);
    expect(reset.game.turn).toBe('red');
    expect(reset.game.history).toHaveLength(0);
    expect(reset.combat).toBeNull();
    expect(getAiState(reset)).toBe('idle');
  });

  it('game over stops the AI', () => {
    const mated = createUiState(
      position(
        `
        R..k.....
        ........R
        .........
        .........
        .........
        .........
        .........
        .........
        .........
        .....K...`,
        'blue',
      ),
      { aiSide: 'blue' },
    );
    expect(mated.game.status).toBe('checkmate');
    expect(getAiState(mated)).toBe('idle');
    expect(getStatusView(mated.game, getAiState(mated))).toEqual({ kind: 'over', winner: 'red', reason: 'checkmate' });
  });
});
