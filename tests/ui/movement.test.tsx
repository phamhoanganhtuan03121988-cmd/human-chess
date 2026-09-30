// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_CONTEXT } from '../../src/components/combat/combatTimeline.ts';
import { App } from '../../src/App.tsx';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import { createUiState, getAiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { AI_THINK_DELAY_MS, useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { position } from '../engine/helpers.ts';

let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce') && reducedMotion,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ game, aiSide = 'blue' }: { game?: GameState; aiSide?: Side | null }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide }));
  useAiOpponent(ui, dispatch);
  return (
    <>
      <StatusPanel status={getStatusView(ui.game, getAiState(ui))} />
      <button type="button" onClick={() => dispatch({ type: 'newGame' })}>
        force-new-game
      </button>
      <span data-testid="ply">{ui.game.history.length}</span>
      <GameBoard ui={ui} dispatch={dispatch} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </>
  );
}

const img = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const pieceAt = (x: number, y: number) => {
  const i = img(x, y);
  return i ? `${i.dataset.side} ${i.dataset.type}` : null;
};
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(Math.min(20, ms - t)));
};
const status = () => screen.getByTestId('status').textContent;
const ply = () => screen.getByTestId('ply').textContent;
const moving = () => document.querySelectorAll('[data-moving="true"]');
const locked = () => document.querySelector('.board-frame--locked') !== null;
const clickMarker = (x: number, y: number) =>
  fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === `${x}` && m.dataset.y === `${y}`)!);

describe('movement animation (UI)', () => {
  it('animates the piece from its source to its destination, then commits', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(img(4, 6)!);
    clickMarker(4, 5);

    // In transit: still at the source in the engine state, animated by transform.
    const piece = img(4, 6)!;
    expect(piece.dataset.moving).toBe('true');
    expect(piece.className).toContain('is-moving');
    expect(piece.style.getPropertyValue('--move-x')).toBe('0cqw');
    expect(piece.style.getPropertyValue('--move-y')).toBe(`${-100 / 9}cqw`);
    expect(piece.style.getPropertyValue('--move-duration')).toBe('240ms');
    expect(piece.style.getPropertyValue('--move-easing')).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(piece.tagName).toBe('BUTTON'); // the token itself travels (glyph included)
    expect(pieceAt(4, 5)).toBeNull();
    expect(screen.queryByTestId('ring-last-move')).toBeNull(); // not before arrival
    expect(screen.queryAllByTestId('move-marker')).toHaveLength(0);
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(status()).toBe('ĐỎ ĐANG ĐI'); // in transit, turn not passed yet
    expect(locked()).toBe(true);
    expect((screen.getByTestId('new-game') as HTMLButtonElement).disabled).toBe(true);

    advance(220);
    expect(pieceAt(4, 6)).toBe('red pawn'); // still travelling
    advance(40);
    expect(pieceAt(4, 6)).toBeNull();
    expect(pieceAt(4, 5)).toBe('red pawn');
    expect(img(4, 5)!.className).toContain('is-landing');
    expect(moving()).toHaveLength(0);
    const to = screen.getByTestId('ring-last-move');
    expect(`${to.dataset.x},${to.dataset.y}`).toBe('4,5');
    expect(status()).toBe('XANH ĐANG NGHĨ...');
  });

  it('ignores clicks, double clicks and Escape during the animation', () => {
    render(<Harness aiSide={null} />);
    fireEvent.click(img(4, 6)!);
    const marker = screen.getByTestId('move-marker');
    fireEvent.click(marker);
    fireEvent.click(marker); // rapid double click on the same marker
    fireEvent.click(img(0, 9)!); // try to select another piece
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    fireEvent.click(screen.getByText('force-new-game'));
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(moving()).toHaveLength(1);
    advance(300);
    expect(ply()).toBe('1');
    expect(pieceAt(4, 5)).toBe('red pawn');
    expect(status()).toBe('LƯỢT XANH');
  });

  it('the AI waits for the animation, then its own normal move animates before committing', () => {
    // No captures are available to Blue here, so the AI's reply must be a normal move.
    render(
      <Harness
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
    clickMarker(0, 5);
    advance(200);
    expect(status()).toBe('LƯỢT ĐỎ'); // AI not thinking yet
    advance(100);
    expect(status()).toBe('XANH ĐANG NGHĨ...');
    advance(AI_THINK_DELAY_MS + 40);
    expect(screen.queryByTestId('combat-overlay')).toBeNull();
    // The AI move is in transit: board unchanged, piece marked as moving.
    const m = moving();
    expect(m).toHaveLength(1);
    expect((m[0] as HTMLElement).dataset.side).toBe('blue');
    expect(ply()).toBe('1');
    advance(300);
    expect(moving()).toHaveLength(0);
    expect(ply()).toBe('2');
    expect(status()).toBe('LƯỢT ĐỎ');
    advance(5000);
    expect(ply()).toBe('2'); // AI does not move twice
  });

  it('AI captures still use the CombatOverlay, with no movement animation', () => {
    render(
      <Harness
        game={position(
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
        )}
      />,
    );
    advance(AI_THINK_DELAY_MS + 40);
    expect(screen.getByTestId('capture-context')).toBeTruthy(); // board context first
    advance(CAPTURE_CONTEXT.end);
    expect(screen.getByTestId('combat-overlay')).toBeTruthy();
    expect(moving()).toHaveLength(0);
    advance(1700);
    expect(pieceAt(0, 6)).toBe('blue rook');
    expect(img(0, 6)!.className).toContain('is-landing'); // short settle after combat
    expect(ply()).toBe('1');
  });

  it('game over stops further animation', () => {
    render(
      <Harness
        aiSide={null}
        game={position(`
          ...k.....
          ........R
          .........
          .........
          .........
          R........
          .........
          .........
          .........
          .....K...`)}
      />,
    );
    fireEvent.click(img(0, 5)!);
    clickMarker(0, 0);
    expect(status()).toBe('LƯỢT ĐỎ'); // not over until the move commits
    advance(300);
    expect(status()).toBe('CHIẾU BÍ — ĐỎ THẮNG');
    fireEvent.click(img(3, 0)!);
    fireEvent.click(img(8, 1)!);
    expect(moving()).toHaveLength(0);
    expect(screen.queryAllByTestId('move-marker')).toHaveLength(0);
  });

  it('reduced motion still moves correctly, almost instantly', () => {
    reducedMotion = true;
    render(<Harness aiSide={null} />);
    fireEvent.click(img(4, 6)!);
    clickMarker(4, 5);
    expect(img(4, 6)!.style.getPropertyValue('--move-duration')).toBe('30ms');
    advance(40);
    expect(pieceAt(4, 5)).toBe('red pawn');
    expect(ply()).toBe('1');
  });

  it('clears its timer when unmounted mid-animation', () => {
    const { unmount } = render(<Harness aiSide={null} />);
    fireEvent.click(img(4, 6)!);
    clickMarker(4, 5);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
