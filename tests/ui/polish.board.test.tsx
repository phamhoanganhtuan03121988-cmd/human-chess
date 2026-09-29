// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIntersectionPosition } from '../../src/board/layout.ts';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import {
  createUiState,
  getActivity,
  getAiState,
  getCheckingPieces,
  getGameOverView,
  getStatusView,
  uiReducer,
} from '../../src/game/controller.ts';
import { AI_THINK_DELAY_MS, useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { position } from '../engine/helpers.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ game, aiSide = null }: { game?: GameState; aiSide?: Side | null }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide }));
  useAiOpponent(ui, dispatch);
  return (
    <>
      <StatusPanel status={getStatusView(ui.game, getAiState(ui))} activity={getActivity(ui)} aiSide={ui.aiSide} />
      <span data-testid="ply">{ui.game.history.length}</span>
      <GameBoard ui={ui} dispatch={dispatch} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </>
  );
}

const img = (x: number, y: number) =>
  document.querySelector<HTMLImageElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] img`);
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(Math.min(20, ms - t)));
};
/** The element's BoardAnchor is centered exactly on intersection (x, y). */
function expectCentered(el: HTMLElement, x: number, y: number) {
  const anchor = el.closest<HTMLElement>('.board-anchor')!;
  const { left, top } = getIntersectionPosition(x, y);
  expect(anchor.style.left).toBe(`${left}%`);
  expect(anchor.style.top).toBe(`${top}%`);
  expect(anchor.style.transform).toBe('translate(-50%, -50%)');
}

const MATE_IN_ONE = `
  ...k.....
  ........R
  .........
  .........
  .........
  R........
  .........
  .........
  .........
  .....K...`;

describe('10.2 selection polish', () => {
  it('selected ring, legal dots and capture reticles are centered on intersections', () => {
    render(<Harness />);
    fireEvent.click(img(1, 7)!); // red cannon
    const ring = screen.getByTestId('ring-selected');
    expectCentered(ring, 1, 7);
    expect(ring.dataset.side).toBe('red');
    const dots = screen.getAllByTestId('move-marker');
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) expectCentered(d, Number(d.dataset.x), Number(d.dataset.y));
    const reticles = screen.getAllByTestId('capture-reticle');
    expect(reticles.map((r) => `${r.dataset.x},${r.dataset.y}`)).toEqual(['1,0']);
    expectCentered(reticles[0]!, 1, 0);
    // The reticle is visual only: clicking the enemy piece still captures.
    fireEvent.click(img(1, 0)!);
    expect(screen.getByTestId('combat-overlay')).toBeTruthy();
  });

  it('hovering a capture target emphasises its reticle', () => {
    render(<Harness />);
    fireEvent.click(img(1, 7)!);
    fireEvent.pointerEnter(img(1, 0)!);
    expect(screen.getByTestId('capture-reticle').className).toContain('is-hovered');
    fireEvent.pointerLeave(img(1, 0)!);
    expect(screen.getByTestId('capture-reticle').className).not.toContain('is-hovered');
  });

  it('hover shows a ring; only actionable pieces are marked clickable', () => {
    render(<Harness />);
    fireEvent.pointerEnter(img(0, 9)!);
    expectCentered(screen.getByTestId('ring-hover'), 0, 9);
    expect(img(0, 9)!.dataset.actionable).toBe('true'); // own piece on turn
    expect(img(0, 0)!.dataset.actionable).toBeUndefined(); // opponent, not capturable
    fireEvent.click(img(1, 7)!);
    expect(img(1, 0)!.dataset.actionable).toBe('true'); // capture target
  });

  it('nothing is actionable while input is locked', () => {
    render(<Harness />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(screen.getByTestId('move-marker'));
    expect(document.querySelectorAll('[data-actionable="true"]')).toHaveLength(0);
    advance(300);
    expect(document.querySelectorAll('[data-actionable="true"]').length).toBeGreaterThan(0);
  });
});

describe('10.3 last move feedback', () => {
  it('marks source and destination, tinted by the side that moved (human and AI)', () => {
    render(
      <Harness
        aiSide="blue"
        game={position(`
          ....k....
          .........
          .........
          ........p
          .........
          .........
          P........
          .........
          .........
          ...K.....`)}
      />,
    );
    fireEvent.click(img(0, 6)!);
    fireEvent.click(screen.getByTestId('move-marker'));
    expect(screen.queryByTestId('ring-last-move')).toBeNull(); // not before arrival
    advance(300);
    let from = screen.getByTestId('last-move-from');
    let to = screen.getByTestId('ring-last-move');
    expect([from.dataset.x, from.dataset.y, to.dataset.x, to.dataset.y]).toEqual(['0', '6', '0', '5']);
    expect(from.dataset.side).toBe('red');
    expect(to.dataset.side).toBe('red');
    expectCentered(from, 0, 6);
    expectCentered(to, 0, 5);

    advance(AI_THINK_DELAY_MS + 40 + 300); // AI normal move animates and commits
    from = screen.getByTestId('last-move-from');
    to = screen.getByTestId('ring-last-move');
    expect(from.dataset.side).toBe('blue');
    expect(to.dataset.side).toBe('blue');
    expect(screen.getByTestId('ply').textContent).toBe('2');
  });
});

describe('10.4 check / game over presentation', () => {
  it('highlights the checked General, its badge and the checking piece', () => {
    const game = position(`
      ...k.....
      .........
      .........
      .........
      .........
      ....r....
      .........
      .........
      .........
      ....K....`);
    expect(getCheckingPieces(game)).toEqual([{ x: 4, y: 5 }]);
    render(<Harness game={game} />);
    expectCentered(screen.getByTestId('ring-check'), 4, 9);
    expectCentered(screen.getByTestId('ring-checker'), 4, 5);
    const badge = document.querySelector('[data-testid="piece-badge"][data-side="red"][data-type="general"]')!;
    expect(badge.className).toContain('is-alert');
  });

  it('checkmate shows the result banner over the preserved final position; New game resets', () => {
    render(<Harness game={position(MATE_IN_ONE)} />);
    fireEvent.click(img(0, 5)!);
    fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '0' && m.dataset.y === '0')!);
    expect(screen.queryByTestId('game-over')).toBeNull(); // not before the move commits
    advance(300);
    const banner = screen.getByTestId('game-over');
    expect(banner.dataset.winner).toBe('red');
    expect(banner.textContent).toContain('CHECKMATE');
    expect(banner.textContent).toContain('RED WINS');
    expect(banner.textContent).toContain("Blue's General cannot escape");
    expect(screen.getByTestId('board-frame').className).toContain('board-frame--over');
    expectCentered(screen.getByTestId('ring-defeated'), 3, 0);
    expect(img(0, 0)!.dataset.side).toBe('red'); // final position still visible
    // Input stays locked except the banner button.
    fireEvent.click(img(8, 1)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    fireEvent.click(screen.getByText('New game', { selector: '.game-over__button' }));
    expect(screen.queryByTestId('game-over')).toBeNull();
    expect(screen.getByTestId('ply').textContent).toBe('0');
    expect(screen.getByTestId('status').textContent).toBe('RED TURN');
  });

  it('stalemate and general capture have their own wording', () => {
    const stalemate = position(
      `
      ....k....
      ........R
      .........
      .........
      .........
      ...R.R...
      .........
      .........
      .........
      ...K.....`,
      'blue',
    );
    expect(getGameOverView(stalemate)).toMatchObject({
      title: 'STALEMATE',
      winner: 'red',
      loser: 'blue',
      detail: 'Blue has no legal moves',
      defeatedGeneral: { x: 4, y: 0 },
    });
    render(<Harness game={stalemate} />);
    expect(screen.getByTestId('game-over').textContent).toContain('STALEMATE');
    expect(screen.getByTestId('status').textContent).toBe('STALEMATE — RED WINS');

    const captured = position(
      `
      ...k.....
      .........
      .........
      .........
      .........
      .........
      .........
      .........
      .........
      ....R....`,
    );
    expect(getGameOverView(captured)).toMatchObject({ title: 'GENERAL CAPTURED', winner: 'blue', defeatedGeneral: null });
    expect(getGameOverView(createUiState().game)).toBeNull();
  });
});
