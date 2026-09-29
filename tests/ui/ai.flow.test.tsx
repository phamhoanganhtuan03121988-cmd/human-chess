// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState } from '../../src/engine/index.ts';
import { createUiState, getAiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { AI_THINK_DELAY_MS, useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { position } from '../engine/helpers.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** App-like harness with the AI on Blue and an always-enabled reset button. */
function Harness({ game }: { game?: GameState }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide: 'blue' }));
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
  document.querySelector<HTMLImageElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] img`);
const pieceAt = (x: number, y: number) => {
  const i = img(x, y);
  return i ? `${i.dataset.side} ${i.dataset.type}` : null;
};
const status = () => screen.getByTestId('status').textContent;
/**
 * Advances fake time in small steps so timers scheduled by effects after a
 * state update (e.g. the combat timeline after an AI capture) also run.
 */
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 50) act(() => void vi.advanceTimersByTime(Math.min(50, ms - t)));
};
const overlay = () => screen.queryByTestId('combat-overlay');
const locked = () => document.querySelector('.board-frame--locked') !== null;
/** Red pawn forward, including its 240 ms movement animation. */
const humanPawnMove = () => {
  fireEvent.click(img(4, 6)!);
  fireEvent.click(screen.getByTestId('move-marker'));
  advance(300);
};

describe('AI game flow (UI)', () => {
  it('the AI does not move before the human', () => {
    render(<App />);
    advance(5000);
    expect(status()).toBe('RED TURN');
    expect(screen.getAllByTestId('piece')).toHaveLength(32);
    expect(pieceAt(4, 3)).toBe('blue pawn');
  });

  it('a human move triggers the AI; the board is locked while it thinks; control returns to Red', () => {
    render(<App />);
    humanPawnMove();
    expect(status()).toBe('BLUE THINKING...');
    expect(locked()).toBe(true);
    expect((screen.getByText('New game') as HTMLButtonElement).disabled).toBe(true);
    // Clicking during thinking does nothing.
    fireEvent.click(img(0, 9)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();

    // humanPawnMove already spent ~60 ms of the AI delay after the move committed.
    advance(AI_THINK_DELAY_MS - 150);
    expect(status()).toBe('BLUE THINKING...'); // still presenting the delay
    advance(200);
    if (overlay()) advance(1600); // an AI capture plays the combat first…
    else advance(300); // …a normal AI move animates first
    expect(status()).toBe('RED TURN');
    expect(locked()).toBe(false);
    expect((screen.getByText('New game') as HTMLButtonElement).disabled).toBe(false);
    const last = screen.getByTestId('ring-last-move');
    expect(pieceAt(Number(last.dataset.x), Number(last.dataset.y))).toMatch(/^blue /);
  });

  it('the AI moves exactly once per turn', () => {
    render(<Harness />);
    humanPawnMove();
    advance(10_000);
    expect(screen.getByTestId('ply').textContent).toBe('2');
    expect(status()).toBe('RED TURN');
  });

  it('an AI capture uses the existing CombatOverlay and changes the board only after it completes', () => {
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
    expect(status()).toBe('BLUE THINKING...');
    advance(AI_THINK_DELAY_MS + 50);
    expect(overlay()).not.toBeNull();
    const src = (id: string) => new URL((screen.getByTestId(id) as HTMLImageElement).src).pathname;
    expect(src('combat-attacker-portrait')).toBe('/assets/portraits/blue/rook.png');
    expect(src('combat-defender-portrait')).toBe('/assets/portraits/red/rook.png');
    expect(pieceAt(0, 6)).toBe('red rook'); // unchanged during combat
    expect(pieceAt(0, 2)).toBe('blue rook');
    advance(1600);
    expect(overlay()).toBeNull();
    expect(pieceAt(0, 6)).toBe('blue rook');
    expect(pieceAt(0, 2)).toBeNull();
    expect(status()).toBe('RED TURN');
    advance(5000);
    expect(screen.getByTestId('ply').textContent).toBe('1'); // no extra AI move
  });

  it('New Game cancels a pending AI move', () => {
    render(<Harness />);
    humanPawnMove();
    advance(300);
    fireEvent.click(screen.getByText('force-new-game'));
    advance(5000);
    expect(status()).toBe('RED TURN');
    expect(screen.getByTestId('ply').textContent).toBe('0');
    expect(pieceAt(4, 6)).toBe('red pawn');
    expect(pieceAt(4, 3)).toBe('blue pawn');
  });

  it('game over stops the AI', () => {
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
    expect(status()).toBe('CHECKMATE — RED WINS');
    advance(5000);
    expect(overlay()).toBeNull();
    expect(screen.getByTestId('ply').textContent).toBe('0');
  });

  it('the AI can deliver checkmate, which ends the game', () => {
    render(
      <Harness
        game={position(
          `
          .....k...
          .........
          .........
          .........
          .........
          r........
          .........
          .........
          ........r
          ...K.....`,
          'blue',
        )}
      />,
    );
    advance(AI_THINK_DELAY_MS + 50);
    if (overlay()) advance(1600);
    else advance(300); // mating move animates before it is applied
    expect(status()).toMatch(/— BLUE WINS$/);
    advance(5000);
    expect(screen.getByTestId('ply').textContent).toBe('1');
  });
});
