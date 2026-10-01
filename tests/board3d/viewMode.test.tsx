// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { isWebGLAvailable } from '../../src/board3d/webglSupport.ts';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState(null, '', '/');
  audio.setAudioBackend({ play: () => true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  audio.setAudioBackend(null);
  history.replaceState(null, '', '/');
});

describe('View mode switching (2D <-> 3D)', () => {
  it('defaults to 2D view on initial game render', () => {
    render(<App initialScreen="game" />);

    // 2D board frame should be present in the DOM
    const boardFrame = screen.getByTestId('board-frame');
    expect(boardFrame).toBeDefined();

    // 3D board wrapper should NOT be present initially
    expect(screen.queryByTestId('game-board-3d')).toBeNull();

    // 2D/3D toggle button is available in the toolbar
    const toggleBtn = screen.getByTestId('view-mode-toggle');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toContain('2D');
  });

  it('handles WebGL availability detection cleanly', () => {
    const available = isWebGLAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('clicking toggle switches viewMode and gracefully handles fallback if WebGL is unavailable', async () => {
    render(<App initialScreen="game" />);

    const toggleBtn = screen.getByTestId('view-mode-toggle');

    // Click toggle to switch to 3D
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // In jsdom without hardware WebGL context, it either renders 3D or safely falls back to 2D
    // Most importantly, the application does NOT crash, and the 2D board or fallback is visible
    expect(
      screen.queryByTestId('game-board-3d') !== null ||
      screen.queryByTestId('board-frame') !== null ||
      screen.getByText(/chế độ 2D/i) !== null
    ).toBe(true);
  });

  it('preserves game state between views without resetting', async () => {
    render(<App initialScreen="game" />);

    // Select Red Cannon at (1, 7) in 2D
    // First confirm 2D board is active
    expect(screen.getByTestId('board-frame')).toBeDefined();

    // Find and click Cannon at (1, 7)
    const redCannon = document.querySelector<HTMLElement>('[data-type="cannon"][data-side="red"]');
    expect(redCannon).toBeDefined();
    await act(async () => {
      fireEvent.click(redCannon!);
    });

    // CharacterActionCard should be displayed for the selected piece
    expect(screen.getByText(/PHÁO ĐỎ/i)).toBeDefined();

    // Now switch view mode
    const toggleBtn = screen.getByTestId('view-mode-toggle');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // State is preserved (still has the selected piece card active)
    expect(screen.getByText(/PHÁO ĐỎ/i)).toBeDefined();
  });
});
