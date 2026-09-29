// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIntersectionPosition } from '../../src/board/layout.ts';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { LANDING_PULSE_MS } from '../../src/components/LandingPulse.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import { createUiState, getActivity, getAiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { useAiOpponent } from '../../src/game/useAiOpponent.ts';
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

function Harness({ game, aiSide = null }: { game?: GameState; aiSide?: Side | null }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide }));
  useAiOpponent(ui, dispatch);
  return (
    <>
      <StatusPanel status={getStatusView(ui.game, getAiState(ui))} activity={getActivity(ui)} aiSide={ui.aiSide} />
      <GameBoard ui={ui} dispatch={dispatch} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </>
  );
}

const img = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(Math.min(20, ms - t)));
};
const marker = (x: number, y: number) =>
  screen.getAllByTestId('move-marker').find((m) => m.dataset.x === `${x}` && m.dataset.y === `${y}`)!;
function expectCentered(el: HTMLElement, x: number, y: number) {
  const anchor = el.closest<HTMLElement>('.board-anchor')!;
  const { left, top } = getIntersectionPosition(x, y);
  expect(anchor.style.left).toBe(`${left}%`);
  expect(anchor.style.top).toBe(`${top}%`);
}

describe('move landing pulse', () => {
  it('appears on the destination when the move commits, then removes itself', () => {
    render(<Harness />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    expect(screen.queryByTestId('landing-pulse')).toBeNull(); // not before arrival
    advance(260);
    const pulse = screen.getByTestId('landing-pulse');
    expectCentered(pulse, 4, 5);
    advance(LANDING_PULSE_MS + 40);
    expect(screen.queryByTestId('landing-pulse')).toBeNull(); // cleaned up
  });

  it('also plays after a capture lands', () => {
    render(<Harness />);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);
    advance(1620);
    expectCentered(screen.getByTestId('landing-pulse'), 1, 0);
  });
});

describe('selection, legal moves and capture targets', () => {
  it('selected ring, pulsing legal dots and crosshair are rendered and centered', () => {
    render(<Harness />);
    fireEvent.click(img(1, 7)!);
    const ring = screen.getByTestId('ring-selected');
    expect(ring.className).toContain('piece-ring--selected');
    expectCentered(ring, 1, 7);
    for (const m of screen.getAllByTestId('move-marker')) {
      expect(m.querySelector('.move-marker__dot')).not.toBeNull();
      expectCentered(m, Number(m.dataset.x), Number(m.dataset.y));
    }
    expectCentered(screen.getByTestId('capture-reticle'), 1, 0);
  });
});

describe('capture impact', () => {
  it('adds a tinted edge vignette at the impact, removed afterwards', () => {
    render(<Harness />);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);
    advance(980);
    expect(screen.queryByTestId('combat-vignette')).toBeNull();
    advance(40);
    expect(screen.getByTestId('combat-vignette').className).toContain('combat-vignette--red');
    expect(screen.getByTestId('combat-impact')).toBeTruthy();
    expect(screen.getByTestId('board-frame').className).toContain('board-frame--impact');
    advance(420);
    expect(screen.queryByTestId('combat-vignette')).toBeNull();
    expect(screen.queryAllByTestId('fx-particle')).toHaveLength(0);
  });
});

describe('check', () => {
  it('highlights the General, pulses its badge and marks the attacker', () => {
    render(
      <Harness
        game={position(`
          ...k.....
          .........
          .........
          .........
          .........
          ....r....
          .........
          .........
          .........
          ....K....`)}
      />,
    );
    expectCentered(screen.getByTestId('ring-check'), 4, 9);
    expectCentered(screen.getByTestId('ring-checker'), 4, 5);
    const badge = document.querySelector('[data-testid="piece"][data-side="red"][data-type="general"]')!;
    expect(badge.className).toContain('is-alert');
  });
});

describe('AI thinking indicator', () => {
  it('shows breathing dots while Blue thinks, keeping the status text', () => {
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
    expect(screen.queryByTestId('thinking-dots')).toBeNull();
    fireEvent.click(img(0, 6)!);
    fireEvent.click(marker(0, 5));
    advance(300);
    expect(screen.getByTestId('status').textContent).toBe('XANH ĐANG NGHĨ...');
    expect(screen.getByTestId('thinking-dots').querySelectorAll('i')).toHaveLength(3);
    advance(1400);
    expect(screen.queryByTestId('thinking-dots')).toBeNull();
  });
});

describe('game over', () => {
  it('compact banner, gold highlight on the winner and defeat glow on the loser', () => {
    render(
      <Harness
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
    fireEvent.click(marker(0, 0));
    advance(300);
    expect(screen.getByTestId('game-over').textContent).toContain('CHIẾU BÍ');
    expectCentered(screen.getByTestId('ring-victor'), 5, 9);
    expectCentered(screen.getByTestId('ring-defeated'), 3, 0);
    expect(screen.getByTestId('board-frame').className).toContain('board-frame--over');
    expect(img(0, 0)!.dataset.side).toBe('red'); // final position stays visible
  });
});

describe('reduced motion', () => {
  it('drops the landing pulse and combat flash motion but keeps gameplay working', () => {
    reducedMotion = true;
    render(<Harness />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    advance(60);
    expect(img(4, 5)!.dataset.side).toBe('red'); // move still applied
    expect(screen.queryByTestId('landing-pulse')).toBeNull();
    fireEvent.click(img(4, 3)!);
    fireEvent.click(marker(4, 4));
    advance(60);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);
    expect(screen.getByTestId('combat-overlay').className).toContain('combat-overlay--reduced');
    advance(1020);
    expect(screen.getByTestId('board-frame').className).not.toContain('board-frame--impact');
    expect(screen.queryAllByTestId('fx-particle')).toHaveLength(6);
    advance(700);
    expect(img(1, 0)!.dataset.type).toBe('cannon'); // capture completes
  });
});
