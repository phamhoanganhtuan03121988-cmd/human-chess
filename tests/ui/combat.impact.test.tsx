// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { setAudioBackend } from '../../src/audio/index.ts';
import type { AudioBackend } from '../../src/audio/index.ts';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import { createUiState, getAiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { useGameAudio } from '../../src/game/useGameAudio.ts';
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
  setAudioBackend(null);
});

function Harness({ game, aiSide = null }: { game: GameState; aiSide?: Side | null }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide }));
  useAiOpponent(ui, dispatch);
  useGameAudio(ui);
  return (
    <>
      <StatusPanel status={getStatusView(ui.game, getAiState(ui))} />
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
/** Small steps so timers scheduled by effects after state updates also run. */
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 50) act(() => void vi.advanceTimersByTime(Math.min(50, ms - t)));
};
const overlay = () => screen.queryByTestId('combat-overlay');
const impact = () => screen.queryByTestId('combat-impact');
const cls = (id: string) => screen.getByTestId(id).className;
const boardFrame = () => screen.getByTestId('board-frame');
const particles = () => screen.queryAllByTestId('fx-particle');

function captureWith(diagram: string, turn: Side, from: [number, number], to: [number, number]) {
  render(<Harness game={position(diagram, turn)} />);
  fireEvent.click(img(...from)!);
  fireEvent.click(img(...to)!);
}

describe('combat impact: human Red Cannon captures Blue Knight', () => {
  it('plays the full sequence with impact FX, then applies the move exactly once', () => {
    render(<App />);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);

    expect(overlay()).not.toBeNull(); // 0 ms
    expect(overlay()!.dataset.stage).toBe('open');
    advance(200);
    expect(cls('combat-attacker')).toContain('is-visible');
    expect(cls('combat-defender')).not.toContain('is-visible');
    advance(200);
    expect(cls('combat-defender')).toContain('is-visible');
    advance(300);
    expect(cls('combat-vs')).toContain('is-visible');
    advance(200); // 900
    expect(overlay()!.dataset.stage).toBe('active');
    expect(cls('combat-attacker')).toContain('is-active');
    expect(cls('combat-defender')).toContain('is-active');
    expect(impact()).toBeNull();
    expect(boardFrame().className).toContain('board-frame--combat');

    advance(100); // 1000: impact
    expect(overlay()!.dataset.stage).toBe('impact');
    const fx = impact()!;
    expect(fx.dataset).toMatchObject({
      attackerSide: 'red', defenderSide: 'blue', attackerType: 'cannon', defenderType: 'knight', effect: 'blast',
    });
    expect(fx.className).toContain('fx-from-red');
    expect(fx.className).toContain('fx-to-blue');
    expect(particles()).toHaveLength(24);
    expect(screen.getAllByTestId('fx-smoke')).toHaveLength(4);
    expect(screen.getByTestId('combat-flash').className).toContain('combat-flash--red');
    expect(cls('combat-attacker')).toContain('is-impact');
    expect(cls('combat-defender')).toContain('is-impact');
    expect(cls('combat-vs')).toContain('is-impact');
    expect(boardFrame().className).toContain('board-frame--impact');
    expect(boardFrame().style.getPropertyValue('--shake')).toBe('4px');
    // Not applied yet.
    expect(pieceAt(1, 0)).toBe('blue knight');
    expect(screen.getAllByTestId('piece')).toHaveLength(32);

    advance(400); // 1400: defender defeated, FX cleaned up
    expect(cls('combat-defender')).toContain('is-defeated');
    expect(cls('combat-vs')).toContain('is-gone');
    expect(impact()).toBeNull();
    expect(particles()).toHaveLength(0);
    expect(screen.queryByTestId('combat-flash')).toBeNull();
    expect(boardFrame().className).not.toContain('board-frame--impact');
    expect(pieceAt(1, 0)).toBe('blue knight');

    advance(200); // 1600: close + applyMove
    expect(overlay()).toBeNull();
    expect(pieceAt(1, 0)).toBe('red cannon');
    expect(pieceAt(1, 7)).toBeNull();
    expect(screen.getAllByTestId('piece')).toHaveLength(31);
    expect(boardFrame().className).not.toContain('board-frame--combat');
    expect(screen.getByTestId('status').textContent).toBe('BLUE THINKING...');
  });
});

describe('combat impact: AI Blue captures Red with the same system', () => {
  it('orients the effect from Blue to Red', () => {
    render(
      <Harness
        aiSide="blue"
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
    advance(750); // AI thinks, then captures
    expect(overlay()).not.toBeNull();
    advance(1000);
    const fx = impact()!;
    expect(fx.dataset).toMatchObject({ attackerSide: 'blue', defenderSide: 'red', attackerType: 'rook', effect: 'heavy' });
    expect(fx.className).toContain('fx-from-blue');
    expect(fx.className).toContain('fx-to-red');
    expect(screen.getByTestId('combat-flash').className).toContain('combat-flash--blue');
    expect(particles()).toHaveLength(20);
    expect(boardFrame().style.getPropertyValue('--shake')).toBe('3px');
    expect(pieceAt(0, 6)).toBe('red rook');
    advance(700);
    expect(overlay()).toBeNull();
    expect(pieceAt(0, 6)).toBe('blue rook');
    expect(screen.getByTestId('ply').textContent).toBe('1');
    expect(screen.getByTestId('status').textContent).toBe('RED TURN');
  });
});

describe('piece-specific effects', () => {
  const cases: { name: string; diagram: string; turn: Side; from: [number, number]; to: [number, number]; effect: string; count: number; extra?: string }[] = [
    {
      name: 'Knight captures Pawn → streak',
      diagram: `
        ...k.....
        .........
        .........
        .........
        ...p.....
        .........
        ....H....
        .........
        .........
        .....K...`,
      turn: 'red', from: [4, 6], to: [3, 4], effect: 'streak', count: 16, extra: 'fx-streak',
    },
    {
      name: 'Pawn captures Pawn → light',
      diagram: `
        ...k.....
        .........
        .........
        ....p....
        ....P....
        .........
        .........
        .........
        .........
        .....K...`,
      turn: 'blue', from: [4, 3], to: [4, 4], effect: 'light', count: 12,
    },
    {
      name: 'Advisor captures → slash',
      diagram: `
        ...k.....
        .........
        .........
        .........
        .........
        .........
        .........
        ...p.....
        ....A....
        .....K...`,
      turn: 'red', from: [4, 8], to: [3, 7], effect: 'slash', count: 14, extra: 'fx-slash',
    },
    {
      name: 'General captures → regal',
      diagram: `
        ...k.....
        .........
        .........
        .........
        .........
        .........
        .........
        .........
        .....p...
        .....K...`,
      turn: 'red', from: [5, 9], to: [5, 8], effect: 'regal', count: 18, extra: 'fx-slash',
    },
  ];
  for (const c of cases) {
    it(c.name, () => {
      captureWith(c.diagram, c.turn, c.from, c.to);
      advance(1000);
      expect(impact()!.dataset.effect).toBe(c.effect);
      expect(particles()).toHaveLength(c.count);
      if (c.extra) expect(screen.getByTestId(c.extra)).toBeTruthy();
      advance(600);
      expect(overlay()).toBeNull();
    });
  }
});

describe('reduced motion', () => {
  it('keeps combat working with fewer particles and no shake', () => {
    reducedMotion = true;
    render(<App />);
    fireEvent.click(img(1, 7)!);
    fireEvent.click(img(1, 0)!);
    expect(overlay()!.className).toContain('combat-overlay--reduced');
    expect(overlay()!.dataset.reducedMotion).toBe('true');
    advance(1000);
    expect(impact()).not.toBeNull();
    expect(particles()).toHaveLength(6);
    expect(screen.queryAllByTestId('fx-smoke')).toHaveLength(0);
    expect(boardFrame().className).not.toContain('board-frame--impact');
    advance(600);
    expect(overlay()).toBeNull();
    expect(pieceAt(1, 0)).toBe('red cannon');
  });
});

describe('audio hooks (no-op by default)', () => {
  it('calls move, impact, capture, check and game-over hooks at the right moments', () => {
    const calls: string[] = [];
    const spy: AudioBackend = {
      playMove: () => calls.push('move'),
      playCapture: () => calls.push('capture'),
      playCombatImpact: (a, d) => calls.push(`impact:${a.side}-${a.type}>${d.side}-${d.type}`),
      playCheck: () => calls.push('check'),
      playGameOver: (w) => calls.push(`gameover:${w}`),
    };
    setAudioBackend(spy);
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
    // Rook to (0,4): normal move.
    fireEvent.click(img(0, 5)!);
    fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '0' && m.dataset.y === '4')!);
    expect(calls).toEqual([]); // still animating: nothing applied yet
    advance(300);
    expect(calls).toEqual(['move']);
    // Blue general steps aside, then Red mates with a capture-free move.
    fireEvent.click(img(3, 0)!);
    fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '4' && m.dataset.y === '0')!);
    advance(300);
    expect(calls).toEqual(['move', 'move']);
    fireEvent.click(img(8, 1)!);
    fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '8' && m.dataset.y === '0')!);
    advance(300);
    expect(calls.slice(2)).toEqual(['move', 'check']);
  });

  it('plays impact during combat and capture/game-over when it resolves', () => {
    const calls: string[] = [];
    setAudioBackend({
      playMove: () => calls.push('move'),
      playCapture: () => calls.push('capture'),
      playCombatImpact: (a, d) => calls.push(`impact:${a.side}-${a.type}>${d.side}-${d.type}`),
      playCheck: () => calls.push('check'),
      playGameOver: (w) => calls.push(`gameover:${w}`),
    });
    captureWith(
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
      ....K....`,
      'blue',
      [4, 5],
      [4, 9],
    );
    advance(999);
    expect(calls).toEqual([]);
    advance(1);
    expect(calls).toEqual(['impact:blue-rook>red-general']);
    advance(600);
    expect(calls).toEqual(['impact:blue-rook>red-general', 'capture', 'gameover:blue']);
  });
});
