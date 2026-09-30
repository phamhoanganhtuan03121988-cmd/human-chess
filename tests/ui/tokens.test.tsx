// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { TOKEN_RING_SIZE, TOKEN_SIZE } from '../../src/config/pieceSprites.ts';
import { PIECE_GLYPHS } from '../../src/config/pieceIdentity.ts';
import type { PieceType } from '../../src/config/assets.ts';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  audio.setAudioBackend({ play: () => true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  audio.setAudioBackend(null);
});

const token = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`)!;
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(20));
};
const card = () => screen.queryByTestId('character-card');

describe('board tokens', () => {
  it('are compact: well under one intersection spacing, rings just around them', () => {
    expect(TOKEN_SIZE).toBeGreaterThanOrEqual(0.65);
    expect(TOKEN_SIZE).toBeLessThanOrEqual(0.75);
    expect(TOKEN_RING_SIZE).toBeGreaterThan(TOKEN_SIZE);
    expect(TOKEN_RING_SIZE).toBeLessThan(1);
  });

  it('are real buttons with a meaningful label; selection is announced', () => {
    render(<App initialScreen="game" />);
    const knight = token(1, 9);
    expect(knight.getAttribute('aria-label')).toBe('MÃ ĐỎ 馬');
    expect(knight.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(knight);
    expect(token(1, 9).getAttribute('aria-pressed')).toBe('true');
    expect(token(1, 9).getAttribute('aria-label')).toBe('MÃ ĐỎ 馬, đang chọn');
    expect(token(1, 9).className).toContain('is-selected');
  });
});

describe('character action card', () => {
  const RED_ROW: [number, number, PieceType][] = [
    [4, 9, 'general'],
    [3, 9, 'advisor'],
    [2, 9, 'elephant'],
    [1, 9, 'knight'],
    [0, 9, 'rook'],
    [1, 7, 'cannon'],
    [0, 6, 'pawn'],
  ];

  it('is hidden until a piece is selected', () => {
    render(<App initialScreen="game" />);
    expect(card()).toBeNull();
  });

  for (const [x, y, type] of RED_ROW) {
    it(`shows the ${type} portrait, name, glyph and movement when selected`, () => {
      render(<App initialScreen="game" />);
      fireEvent.click(token(x, y));
      const c = card()!;
      expect(c).not.toBeNull();
      expect(c.dataset.side).toBe('red');
      expect(c.dataset.type).toBe(type);
      expect(c.textContent).toContain(PIECE_GLYPHS.red[type]);
      expect(c.textContent).toContain('ĐỎ');
      const img = within(c).getByRole('img') as HTMLImageElement;
      expect(new URL(img.src).pathname).toBe(`/assets/portraits/red/${type}.png`);
      const moves = screen.getAllByTestId('move-marker').length + screen.queryAllByTestId('capture-reticle').length;
      expect(screen.getByTestId('character-card-moves').textContent).toBe(`${moves} nước đi`);
      expect(c.querySelector('.move-diagram')).not.toBeNull();
    });
  }

  it('follows the selection, hides on Escape and after a move', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(token(1, 9));
    expect(card()!.dataset.type).toBe('knight');
    fireEvent.click(token(0, 6));
    expect(card()!.dataset.type).toBe('pawn');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(card()).toBeNull();
    fireEvent.click(token(0, 6));
    fireEvent.click(screen.getAllByTestId('move-marker')[0]!);
    expect(card()).toBeNull(); // selection ends when the move starts
    advance(400);
    expect(card()).toBeNull();
  });

  it('opponent pieces cannot be selected, so they open no card', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(token(1, 0)); // Blue horse
    expect(card()).toBeNull();
  });

  it('never blocks the board: board clicks still work while it is shown', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(token(4, 6));
    expect(card()).not.toBeNull();
    fireEvent.click(screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '4' && m.dataset.y === '5')!);
    expect(token(4, 6).dataset.moving).toBe('true');
  });
});
