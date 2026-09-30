// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { CAPTURE_CONTEXT, CAPTURE_CONTEXT_REDUCED_MS, COMBAT_TIMELINE } from '../../src/components/combat/combatTimeline.ts';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { ReplayView } from '../../src/components/ReplayView.tsx';
import { applyMove, createInitialGameState } from '../../src/engine/index.ts';
import type { GameState } from '../../src/engine/index.ts';
import { createUiState, uiReducer } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce') && reducedMotion,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ game }: { game?: GameState }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game));
  return (
    <>
      <span data-testid="ply">{ui.game.history.length}</span>
      <GameBoard ui={ui} dispatch={dispatch} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </>
  );
}

const token = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 25) act(() => void vi.advanceTimersByTime(Math.min(25, ms - t)));
};
const context = () => screen.queryByTestId('capture-context');
const overlay = () => screen.queryByTestId('combat-overlay');
const flagged = (cls: string) => [...document.querySelectorAll<HTMLElement>(`[data-testid="piece"].${cls}`)];

// Red Knight (4,6) takes Blue Pawn (3,4).
const KNIGHT_TAKES_PAWN = `
  ...k.....
  .........
  .........
  .........
  ...p.....
  .........
  ....H....
  .........
  .........
  .....K...`;

describe('capture context (before the combat overlay)', () => {
  it('shows WHO attacks WHOM and WHERE, then hands off to the unchanged overlay', () => {
    render(<Harness game={position(KNIGHT_TAKES_PAWN)} />);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(token(3, 4)!);

    // Phase A: attacker (gold) and defender (crimson) marked on the board; the rest dims.
    expect(overlay()).toBeNull();
    expect(context()).not.toBeNull();
    expect(flagged('is-attacking').map((t) => t.dataset.type)).toEqual(['knight']);
    expect(flagged('is-targeted').map((t) => t.dataset.type)).toEqual(['pawn']);
    expect(token(4, 6)!.className).toContain('is-attacking');
    expect(token(3, 4)!.className).toContain('is-targeted');
    expect(screen.getByTestId('board-frame').className).toContain('board-frame--context');
    // Phase B: trajectory from the attacker's intersection towards the defender's.
    expect([context()!.dataset.from, context()!.dataset.to]).toEqual(['4,6', '3,4']);
    const line = screen.getByTestId('capture-trajectory');
    expect(Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'))).toBeLessThan(0); // leftwards
    expect(Number(line.getAttribute('y2')) - Number(line.getAttribute('y1'))).toBeLessThan(0); // upwards
    expect(screen.getByTestId('capture-impact').getAttribute('cx')).toBe(String(0.5 + 3));
    // Phase C: "MÃ ĐỎ ⚔ TỐT XANH".
    expect(screen.getByTestId('capture-label').textContent).toBe('MÃ ĐỎ⚔TỐT XANH');
    // Nothing is applied yet and the board is locked.
    expect(token(3, 4)!.dataset.side).toBe('blue');
    expect(document.querySelector('.board-frame--locked')).not.toBeNull();

    advance(CAPTURE_CONTEXT.end - 25);
    expect(overlay()).toBeNull();
    advance(25);
    // Phase D: the existing overlay, with its own timeline from 0.
    expect(overlay()).not.toBeNull();
    expect(overlay()!.dataset.stage).toBe('open');
    expect(context()).toBeNull(); // cleaned up
    expect(flagged('is-attacking')).toHaveLength(0);
    expect(flagged('is-targeted')).toHaveLength(0);
    expect(screen.getByTestId('board-frame').className).not.toContain('board-frame--context');

    advance(COMBAT_TIMELINE.close);
    // After combat: defender gone, attacker on the destination, last move marked.
    expect(overlay()).toBeNull();
    expect(token(3, 4)!.dataset).toMatchObject({ side: 'red', type: 'knight' });
    expect(token(4, 6)).toBeNull();
    expect(screen.getAllByTestId('piece')).toHaveLength(3);
    const last = screen.getByTestId('ring-last-move');
    expect(`${last.dataset.x},${last.dataset.y}`).toBe('3,4');
    expect(screen.getByTestId('ply').textContent).toBe('1');
    expect(context()).toBeNull();
  });

  it('is shorter and static with reduced motion', () => {
    reducedMotion = true;
    render(<Harness game={position(KNIGHT_TAKES_PAWN)} />);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(token(3, 4)!);
    expect(context()!.className).toContain('is-reduced');
    advance(CAPTURE_CONTEXT_REDUCED_MS);
    expect(context()).toBeNull();
    expect(overlay()).not.toBeNull();
  });

  it('non-capturing moves never show a capture context', () => {
    render(<Harness />);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(screen.getAllByTestId('move-marker')[0]!);
    expect(context()).toBeNull();
    expect(flagged('is-attacking')).toHaveLength(0);
  });

  it('replay keeps its short capture but still marks the target while the attacker slides in', () => {
    const first = applyMove(createInitialGameState(), { from: { x: 1, y: 7 }, to: { x: 1, y: 0 } });
    if (!first.ok) throw new Error('illegal');
    render(<ReplayView records={first.state.history} onExit={() => {}} showPanel={false} />);
    advance(425); // auto-play starts the first (capturing) move
    expect(token(1, 7)!.dataset.moving).toBe('true');
    expect(token(1, 7)!.className).toContain('is-attacking');
    expect(token(1, 0)!.className).toContain('is-targeted');
    expect(context()).toBeNull(); // no full board context in replay
    expect(overlay()).toBeNull(); // and no combat scene
    advance(400);
    expect(token(1, 0)!.dataset).toMatchObject({ side: 'red', type: 'cannon' });
    expect(flagged('is-targeted')).toHaveLength(0);
  });
});
