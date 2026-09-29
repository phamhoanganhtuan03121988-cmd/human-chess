// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PIECE_GLYPHS } from '../../src/config/pieceIdentity.ts';
import { App } from '../../src/App.tsx';
import { getIntersectionPosition } from '../../src/board/layout.ts';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import { StatusPanel } from '../../src/components/StatusPanel.tsx';
import type { GameState } from '../../src/engine/index.ts';
import { createUiState, getStatusView, uiReducer } from '../../src/game/controller.ts';
import { position } from '../engine/helpers.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Runs the combat presentation to completion (captures apply after it). */
const finishCombat = () => act(() => void vi.advanceTimersByTime(1600));
/** Normal moves animate (240 ms) before the engine applies them. */
const finishMove = () => act(() => void vi.advanceTimersByTime(300));

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

const pieceImg = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const markers = () => screen.queryAllByTestId('move-marker');
const status = () => screen.getByTestId('status').textContent;

describe('GameBoard UI', () => {
  it('renders 32 compact tokens, each with its side/type and Xiangqi character', () => {
    render(<App initialScreen="game" />);
    const tokens = screen.getAllByTestId('piece');
    expect(tokens).toHaveLength(32);
    for (const t of tokens) {
      expect(t.tagName).toBe('BUTTON');
      expect(t.className).toContain(`piece-token--${t.dataset.side}`);
      expect(t.querySelector('img')).toBeNull(); // no character artwork on the board
      const glyph = PIECE_GLYPHS[t.dataset.side as 'red' | 'blue'][t.dataset.type as keyof typeof PIECE_GLYPHS.red];
      expect(t.textContent).toBe(glyph);
    }
    expect(document.querySelector('[data-type="advisor"][data-side="red"]')!.textContent).toBe('仕');
    expect(document.querySelector('[data-type="general"][data-side="blue"]')!.textContent).toBe('將');
    // Tokens sit centered on their intersection (not bottom-anchored like the old sprites).
    const anchor = tokens[0]!.closest<HTMLElement>('.board-anchor')!;
    expect(anchor.style.transform).toBe('translate(-50%, -50%)');
  });

  it('shows RED TURN at the start', () => {
    render(<App initialScreen="game" />);
    expect(status()).toBe('LƯỢT ĐỎ');
  });

  it('clicking a red piece selects it and shows its legal move markers', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(4, 6)!);
    expect(screen.getByTestId('ring-selected')).toBeTruthy();
    expect(markers().map((m) => `${m.dataset.x},${m.dataset.y}`)).toEqual(['4,5']);
  });

  it('clicking a blue piece on red’s turn does not select it', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(1, 0)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(markers()).toHaveLength(0);
  });

  it('clicking a legal marker moves the piece, switches turn and marks the last move', () => {
    vi.useFakeTimers();
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(4, 6)!);
    fireEvent.click(markers()[0]!);
    finishMove();
    expect(pieceImg(4, 6)).toBeNull();
    expect(pieceImg(4, 5)?.dataset).toMatchObject({ side: 'red', type: 'pawn' });
    expect(status()).toBe('XANH ĐANG NGHĨ...'); // App plays Blue with the AI
    expect(markers()).toHaveLength(0);
    const from = screen.getByTestId('last-move-from');
    const to = screen.getByTestId('ring-last-move');
    expect([from.dataset.x, from.dataset.y, to.dataset.x, to.dataset.y]).toEqual(['4', '6', '4', '5']);
  });

  it('an illegal click (empty non-destination) does not move and clears selection', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(4, 6)!);
    fireEvent.click(document.querySelector('.board-frame')!); // board background
    expect(pieceImg(4, 6)).not.toBeNull();
    expect(markers()).toHaveLength(0);
    expect(status()).toBe('LƯỢT ĐỎ');
  });

  it('marks captures with a ring and removes the captured piece', () => {
    vi.useFakeTimers();
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(1, 7)!); // red cannon
    const captureRings = screen.getAllByTestId('ring-capture');
    expect(captureRings.map((r) => `${r.dataset.x},${r.dataset.y}`)).toEqual(['1,0']);
    expect(markers().some((m) => m.dataset.x === '1' && m.dataset.y === '0')).toBe(false);
    fireEvent.click(pieceImg(1, 0)!); // click the blue knight to capture it
    finishCombat();
    expect(pieceImg(1, 0)?.dataset).toMatchObject({ side: 'red', type: 'cannon' });
    expect(screen.getAllByTestId('piece')).toHaveLength(31);
  });

  it('clicking the selected piece again clears the selection', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(4, 6)!);
    fireEvent.click(pieceImg(4, 6)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(markers()).toHaveLength(0);
  });

  it('Escape clears the selection', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(4, 6)!);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(markers()).toHaveLength(0);
  });

  it('centers every marker on its intersection with resolution-independent positions', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(pieceImg(1, 9)!); // red knight
    const ms = markers();
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      const anchor = m.closest<HTMLElement>('.board-anchor')!;
      const { left, top } = getIntersectionPosition(Number(m.dataset.x), Number(m.dataset.y));
      expect(anchor.style.left).toBe(`${left}%`);
      expect(anchor.style.top).toBe(`${top}%`);
      expect(anchor.style.transform).toBe('translate(-50%, -50%)');
    }
  });

  it('shows CHECK and a glow on the checked general', () => {
    vi.useFakeTimers();
    render(
      <Harness
        game={position(`
          ....k....
          .........
          .........
          .........
          .........
          R........
          .........
          .........
          .........
          ...K.....
        `)}
      />,
    );
    fireEvent.click(pieceImg(0, 5)!);
    fireEvent.click(markers().find((m) => m.dataset.x === '4' && m.dataset.y === '5')!);
    finishMove();
    expect(status()).toBe('XANH BỊ CHIẾU');
    const ring = screen.getByTestId('ring-check');
    expect([ring.dataset.x, ring.dataset.y]).toEqual(['4', '0']);
  });

  it('checkmate shows the winner and blocks further interaction', () => {
    vi.useFakeTimers();
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
          .....K...
        `)}
      />,
    );
    fireEvent.click(pieceImg(0, 5)!);
    fireEvent.click(markers().find((m) => m.dataset.x === '0' && m.dataset.y === '0')!);
    finishMove();
    expect(status()).toBe('CHIẾU BÍ — ĐỎ THẮNG');
    fireEvent.click(pieceImg(3, 0)!);
    fireEvent.click(pieceImg(8, 1)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();
    expect(markers()).toHaveLength(0);
    expect(pieceImg(0, 0)?.dataset).toMatchObject({ side: 'red', type: 'rook' }); // final position kept
  });

  it('displays the correct winner when a general is captured', () => {
    vi.useFakeTimers();
    render(
      <Harness
        game={position(
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
          ....K....
        `,
          'blue',
        )}
      />,
    );
    fireEvent.click(pieceImg(4, 5)!);
    fireEvent.click(pieceImg(4, 9)!);
    finishCombat();
    expect(status()).toBe('TƯỚNG BỊ BẮT — XANH THẮNG');
  });

  it('keeps debug mode working', () => {
    window.history.replaceState(null, '', '/?debug=1');
    render(<App initialScreen="game" />);
    expect(screen.getAllByTestId('debug-intersection')).toHaveLength(90);
    expect(screen.getAllByTestId('debug-anchor')).toHaveLength(32);
    window.history.replaceState(null, '', '/');
  });
});
