// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import {
  createUiState,
  getActivity,
  getAiState,
  getStatusView,
  handleClick,
  uiReducer,
} from '../../src/game/controller.ts';
import { AI_THINK_DELAY_MS, useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { position } from '../engine/helpers.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ game, aiSide = 'blue' }: { game?: GameState; aiSide?: Side | null }) {
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
  document.querySelector<HTMLImageElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] img`);
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(Math.min(20, ms - t)));
};
const status = () => screen.getByTestId('status');
const hint = () => screen.getByTestId('status-hint').textContent;
const frame = () => screen.getByTestId('board-frame').className;

describe('getActivity', () => {
  it('reports idle, moving, thinking, combat and over from UI + engine state', () => {
    const s = createUiState(undefined, { aiSide: 'blue' });
    expect(getActivity(s)).toBe('idle');
    const moving = handleClick(handleClick(s, { x: 4, y: 6 }), { x: 4, y: 5 });
    expect(getActivity(moving)).toBe('moving');
    const thinking = uiReducer(moving, { type: 'movementComplete', id: moving.movement!.id });
    expect(getActivity(thinking)).toBe('thinking');
    const combat = handleClick(handleClick(createUiState(), { x: 1, y: 7 }), { x: 1, y: 0 });
    expect(getActivity(combat)).toBe('combat');
    const over = createUiState(
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
    );
    expect(getActivity(over)).toBe('over');
  });
});

describe('turn feedback', () => {
  it('walks through RED TURN → RED MOVING → BLUE THINKING → BLUE MOVING → RED TURN', () => {
    // No captures for Blue, so its reply is a normal (animated) move.
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
    expect(status().textContent).toBe('RED TURN');
    expect(status().dataset.activity).toBe('idle');
    expect(hint()).toBe('Your move');
    expect(frame()).toContain('board-frame--turn-red');
    expect(frame()).not.toContain('board-frame--waiting');

    fireEvent.click(img(0, 6)!);
    fireEvent.click(screen.getByTestId('move-marker'));
    expect(status().textContent).toBe('RED MOVING');
    expect(hint()).toBe('Moving…');
    expect(frame()).toContain('board-frame--waiting');
    expect(frame()).toContain('board-frame--locked');

    advance(300);
    expect(status().textContent).toBe('BLUE THINKING...');
    expect(status().className).toContain('status--blue');
    expect(hint()).toBe('Please wait — Blue is thinking');
    expect(screen.getByTestId('status-hint').className).toContain('status-hint--wait');
    expect(frame()).toContain('board-frame--turn-blue');
    expect(frame()).toContain('board-frame--waiting');
    // Input is ignored while waiting.
    fireEvent.click(img(0, 5)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();

    advance(AI_THINK_DELAY_MS + 40);
    expect(status().textContent).toBe('BLUE MOVING');
    expect(hint()).toBe('Please wait — Blue is moving');
    fireEvent.click(img(0, 5)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();

    advance(300);
    expect(status().textContent).toBe('RED TURN');
    expect(hint()).toBe('Your move');
    expect(frame()).toContain('board-frame--turn-red');
    expect(frame()).not.toContain('board-frame--waiting');
  });

  it('re-mounts the status pill on turn change (entry transition)', () => {
    render(<Harness aiSide={null} />);
    const before = status();
    fireEvent.click(img(4, 6)!);
    fireEvent.click(screen.getByTestId('move-marker'));
    expect(status()).toBe(before); // same turn while moving
    advance(300);
    expect(status()).not.toBe(before); // new element for Blue's turn
    expect(status().className).toContain('status--blue');
  });

  it('combat stays dominant: status says who attacks, input locked', () => {
    render(<App />);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);
    expect(status().textContent).toBe('RED ATTACKS');
    expect(status().dataset.activity).toBe('combat');
    expect(hint()).toBe('Battle in progress…');
    expect(screen.getByTestId('combat-overlay')).toBeTruthy();
    expect(frame()).toContain('board-frame--waiting');
    expect((screen.getByText('New game') as HTMLButtonElement).disabled).toBe(true);
  });

  it('check shows RED IN CHECK with an urgent hint', () => {
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
    expect(status().textContent).toBe('RED IN CHECK');
    expect(status().className).toContain('status--check');
    expect(hint()).toBe('Protect your General!');
  });

  it('game over: result text, no turn edge, and a game-over hint', () => {
    render(
      <Harness
        game={position(
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
        )}
      />,
    );
    expect(status().textContent).toBe('CHECKMATE — RED WINS');
    expect(hint()).toBe('Game over — start a new game');
    expect(frame()).not.toMatch(/board-frame--turn-/);
    expect(frame()).not.toContain('board-frame--waiting');
  });
});
