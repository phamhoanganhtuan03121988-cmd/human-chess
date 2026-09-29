// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState } from '../../src/engine/index.ts';
import { createUiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ game }: { game: GameState }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game));
  return (
    <>
      <StatusPanel status={getStatusView(ui.game)} />
      <GameBoard ui={ui} dispatch={dispatch} />
      {ui.combat && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
    </>
  );
}

const pieceAt = (x: number, y: number) => {
  const img = document.querySelector<HTMLImageElement>(
    `.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] img`,
  );
  return img ? `${img.dataset.side} ${img.dataset.type}` : null;
};
const clickPiece = (x: number, y: number) =>
  fireEvent.click(document.querySelector(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] img`)!);
const overlay = () => screen.queryByTestId('combat-overlay');
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const status = () => screen.getByTestId('status').textContent;
const portrait = (role: 'attacker' | 'defender') =>
  new URL((screen.getByTestId(`combat-${role}-portrait`) as HTMLImageElement).src).pathname;

describe('combat overlay: Red Cannon captures Blue Knight', () => {
  it('runs the full capture flow', () => {
    render(<App initialScreen="game" />);
    clickPiece(1, 7); // 1. select red cannon
    expect(screen.getAllByTestId('ring-capture').map((r) => `${r.dataset.x},${r.dataset.y}`)).toEqual(['1,0']); // 2.
    clickPiece(1, 0); // 3. click blue knight

    // 4-5. board frozen, overlay open, nothing applied yet
    expect(overlay()).not.toBeNull();
    expect(document.querySelector('.board-frame--locked')).not.toBeNull();
    expect(pieceAt(1, 0)).toBe('blue knight');
    expect(pieceAt(1, 7)).toBe('red cannon');
    expect(status()).toBe('ĐỎ TẤN CÔNG'); // combat in progress, nothing applied yet
    expect(screen.getByTestId('status-hint').textContent).toBe('Đang giao chiến…');

    // 6-7. portraits from the manifest for the actual pieces
    expect(portrait('attacker')).toBe('/assets/portraits/red/cannon.png');
    expect(portrait('defender')).toBe('/assets/portraits/blue/knight.png');
    expect(screen.getByTestId('combat-attacker-name').textContent).toBe('PHÁO');
    expect(screen.getByTestId('combat-attacker-glyph').textContent).toBe('炮');
    expect(screen.getByTestId('combat-defender-name').textContent).toBe('MÃ');
    expect(screen.getByTestId('combat-defender-glyph').textContent).toBe('馬');

    // 8. timeline
    expect(overlay()!.dataset.stage).toBe('open');
    advance(200);
    expect(overlay()!.dataset.stage).toBe('attacker');
    advance(200);
    expect(overlay()!.dataset.stage).toBe('defender');
    advance(300);
    expect(overlay()!.dataset.stage).toBe('vs');
    advance(300);
    expect(overlay()!.dataset.stage).toBe('impact');
    expect(overlay()!.dataset.phase).toBe('impact');
    advance(400);
    expect(overlay()!.dataset.stage).toBe('end');
    expect(overlay()!.dataset.phase).toBe('complete');
    // still unchanged just before close
    advance(199);
    expect(overlay()).not.toBeNull();
    expect(pieceAt(1, 0)).toBe('blue knight');

    // 9-13. overlay closes, engine applies the capture, turn changes
    advance(1);
    expect(overlay()).toBeNull();
    expect(pieceAt(1, 0)).toBe('red cannon');
    expect(pieceAt(1, 7)).toBeNull();
    expect(screen.getAllByTestId('piece')).toHaveLength(31);
    expect(status()).toBe('XANH ĐANG NGHĨ...'); // App: AI plays Blue
    expect(document.querySelector('.board-frame--locked')).not.toBeNull(); // locked while AI thinks
    const to = screen.getByTestId('ring-last-move');
    expect(`${to.dataset.x},${to.dataset.y}`).toBe('1,0');

    // The AI replies (possibly with its own combat), then control returns to Red.
    advance(800);
    if (overlay()) advance(1600);
    expect(overlay()).toBeNull();
    expect(status()).toBe('LƯỢT ĐỎ');
    expect(document.querySelector('.board-frame--locked')).toBeNull();
  });

  it('locks board interaction and ignores Escape during combat', () => {
    render(<App initialScreen="game" />);
    clickPiece(1, 7);
    clickPiece(1, 0);
    advance(500);
    clickPiece(0, 9); // another red piece
    clickPiece(4, 6);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    fireEvent.click(screen.getByTestId('new-game'));
    expect(overlay()).not.toBeNull();
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(screen.queryAllByTestId('move-marker')).toHaveLength(0);
    expect(pieceAt(1, 0)).toBe('blue knight');
    advance(1100);
    expect(overlay()).toBeNull();
    expect(pieceAt(1, 0)).toBe('red cannon');
    expect(status()).toBe('XANH ĐANG NGHĨ...'); // App: AI plays Blue
  });
});

describe('combat overlay: normal movement', () => {
  it('moving to an empty point never shows portraits', () => {
    render(<App initialScreen="game" />);
    clickPiece(4, 6);
    fireEvent.click(screen.getByTestId('move-marker'));
    expect(overlay()).toBeNull();
    advance(300); // movement animation, then the engine applies the move
    expect(overlay()).toBeNull();
    expect(document.querySelector('[data-testid$="-portrait"]')).toBeNull();
    expect(pieceAt(4, 5)).toBe('red pawn');
    expect(status()).toBe('XANH ĐANG NGHĨ...'); // App: AI plays Blue
  });
});

describe('combat overlay: other captures', () => {
  const cases: {
    name: string;
    diagram: string;
    turn: 'red' | 'blue';
    from: [number, number];
    to: [number, number];
    attacker: string;
    defender: string;
    names: [string, string, string, string];
  }[] = [
    {
      name: 'Knight captures Pawn',
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
      turn: 'red',
      from: [4, 6],
      to: [3, 4],
      attacker: 'red/knight',
      defender: 'blue/pawn',
      names: ['MÃ', '馬', 'TỐT', '卒'],
    },
    {
      name: 'Rook captures Pawn',
      diagram: `
        ...k.....
        .........
        .........
        .........
        .........
        .........
        r...P....
        .........
        .........
        .....K...`,
      turn: 'blue',
      from: [0, 6],
      to: [4, 6],
      attacker: 'blue/rook',
      defender: 'red/pawn',
      names: ['XE', '車', 'TỐT', '兵'],
    },
    {
      name: 'Pawn captures Pawn',
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
      turn: 'blue',
      from: [4, 3],
      to: [4, 4],
      attacker: 'blue/pawn',
      defender: 'red/pawn',
      names: ['TỐT', '卒', 'TỐT', '兵'],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      render(<Harness game={position(c.diagram, c.turn)} />);
      const [aSide, aType] = c.attacker.split('/');
      const [dSide, dType] = c.defender.split('/');
      clickPiece(...c.from);
      clickPiece(...c.to);
      expect(overlay()).not.toBeNull();
      expect(portrait('attacker')).toBe(`/assets/portraits/${c.attacker}.png`);
      expect(portrait('defender')).toBe(`/assets/portraits/${c.defender}.png`);
      expect(screen.getByTestId('combat-attacker').dataset.side).toBe(aSide);
      expect(screen.getByTestId('combat-defender').dataset.side).toBe(dSide);
      expect([
        screen.getByTestId('combat-attacker-name').textContent,
        screen.getByTestId('combat-attacker-glyph').textContent,
        screen.getByTestId('combat-defender-name').textContent,
        screen.getByTestId('combat-defender-glyph').textContent,
      ]).toEqual(c.names);
      expect(pieceAt(...c.to)).toBe(`${dSide} ${dType}`); // unchanged during combat
      advance(1600);
      expect(overlay()).toBeNull();
      expect(pieceAt(...c.to)).toBe(`${aSide} ${aType}`);
      expect(pieceAt(...c.from)).toBeNull();
      expect(status()).toBe(`LƯỢT ${dSide === 'red' ? 'ĐỎ' : 'XANH'}`);
    });
  }
});
