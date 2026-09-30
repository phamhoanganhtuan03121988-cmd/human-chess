// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, START_TRANSITION_MS } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import type { AudioBackend } from '../../src/audio/index.ts';
import { resetAudioContextForTests } from '../../src/audio/audioContext.ts';
import { reloadMutePreference, reloadVolumePreference } from '../../src/audio/volume.ts';
import { REPLAY_STEP_MS } from '../../src/components/ReplayView.tsx';
import { DIFFICULTY_KEY, SAVE_KEY } from '../../src/game/persistence.ts';
import { AI_THINK_DELAY_MS } from '../../src/game/useAiOpponent.ts';

/**
 * A real, legal 47-ply game (Red mates). The first 46 moves are stored as a
 * save; the test resumes it and plays the mating move through the UI.
 */
const LINE: [number, number, number, number][] = [
  [1, 7, 1, 0], [6, 0, 4, 2], [1, 0, 3, 0], [7, 2, 8, 2], [3, 0, 0, 0], [4, 0, 4, 1], [0, 0, 5, 0], [4, 1, 4, 0],
  [5, 0, 8, 0], [4, 0, 4, 1], [8, 0, 8, 3], [8, 2, 7, 2], [7, 7, 7, 0], [1, 2, 1, 0], [7, 0, 1, 0], [7, 2, 7, 0],
  [1, 0, 7, 0], [4, 2, 6, 0], [7, 0, 2, 0], [4, 1, 4, 0], [2, 0, 6, 0], [4, 0, 3, 0], [8, 3, 4, 3], [3, 0, 3, 1],
  [4, 3, 0, 3], [3, 1, 3, 2], [0, 3, 6, 3], [2, 3, 2, 4], [4, 6, 4, 5], [2, 4, 2, 5], [2, 6, 2, 5], [3, 2, 3, 1],
  [4, 5, 4, 4], [3, 1, 3, 2], [2, 5, 2, 4], [3, 2, 3, 1], [0, 6, 0, 5], [3, 1, 3, 2], [0, 5, 0, 4], [3, 2, 3, 1],
  [0, 4, 1, 4], [3, 1, 3, 2], [8, 9, 8, 8], [3, 2, 3, 1], [4, 4, 5, 4], [3, 1, 3, 0], [8, 8, 3, 8],
];
const saveBeforeMate = (difficulty = 'easy') =>
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, difficulty, moves: LINE.slice(0, 46), savedAt: 1 }));

let calls: string[] = [];
const spy: AudioBackend = {
  play(name) {
    calls.push(name);
    return true;
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  localStorage.clear();
  reloadMutePreference();
  reloadVolumePreference();
  audio.setAudioBackend(spy);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  audio.setAudioBackend(null);
  audio.setSoundMuted(false);
});

const img = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const marker = (x: number, y: number) =>
  screen.getAllByTestId('move-marker').find((m) => m.dataset.x === `${x}` && m.dataset.y === `${y}`)!;
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 20) act(() => void vi.advanceTimersByTime(Math.min(20, ms - t)));
};
const status = () => screen.getByTestId('status').textContent;
const main = () => document.querySelector('main.app')!;
const enterGame = (label = 'CHƠI NGAY') => {
  fireEvent.click(screen.getByText(label));
  advance(START_TRANSITION_MS + 20);
};
/** Red pawn forward, then the AI (Blue) replies. */
const playOpeningExchange = () => {
  fireEvent.click(img(4, 6)!);
  fireEvent.click(marker(4, 5));
  advance(300 + AI_THINK_DELAY_MS + 60);
  advance(2500);
};

describe('start screen', () => {
  it('shows the title, CHƠI NGAY, difficulty and sound; the game behind is inert', () => {
    render(<App />);
    const start = screen.getByTestId('start-screen');
    expect(within(start).getByRole('heading', { name: 'CỜ TƯỚNG' })).toBeTruthy();
    expect(start.textContent).toContain('CINEMATIC XIANGQI');
    // Compact dropdown (not a wide segmented control) with all three levels.
    const select = within(start).getByTestId('difficulty-select') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((o) => o.textContent)).toEqual(['DỄ', 'BÌNH THƯỜNG', 'KHÓ']);
    expect(select.value).toBe('normal');
    expect(within(start).queryByRole('radiogroup')).toBeNull();
    expect(within(start).getByTestId('sound-toggle')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('CHƠI NGAY');
    expect(main().hasAttribute('inert')).toBe(true);
    expect(screen.queryByTestId('resume-prompt')).toBeNull();
  });

  it('difficulty chosen on the start screen persists and reaches the HUD', () => {
    render(<App />);
    const select = within(screen.getByTestId('start-screen')).getByLabelText('Độ khó') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'hard' } });
    expect(select.value).toBe('hard');
    expect(localStorage.getItem(DIFFICULTY_KEY)).toBe('hard');
    enterGame();
    expect((screen.getAllByTestId('difficulty-select')[0] as HTMLSelectElement).value).toBe('hard');
  });

  it('CHƠI NGAY fades the start screen out, then the board is interactive', () => {
    render(<App />);
    fireEvent.click(screen.getByText('CHƠI NGAY'));
    expect(screen.getByTestId('start-screen').closest('.start-screen')!.className).toContain('is-leaving');
    advance(START_TRANSITION_MS + 20);
    expect(screen.queryByTestId('start-screen')).toBeNull();
    expect(main().hasAttribute('inert')).toBe(false);
    expect(status()).toBe('LƯỢT ĐỎ');
    fireEvent.click(img(4, 6)!);
    expect(screen.getByTestId('ring-selected')).toBeTruthy();
  });

  it('remembers the difficulty across reloads', () => {
    localStorage.setItem(DIFFICULTY_KEY, 'easy');
    render(<App />);
    expect((within(screen.getByTestId('start-screen')).getByTestId('difficulty-select') as HTMLSelectElement).value).toBe('easy');
  });
});

describe('save and resume', () => {
  it('offers to resume an unfinished game and restores it exactly', () => {
    saveBeforeMate('easy');
    render(<App />);
    const prompt = screen.getByTestId('resume-prompt');
    expect(prompt.textContent).toContain('TIẾP TỤC VÁN CŨ?');
    enterGame('TIẾP TỤC');
    expect(screen.getAllByTestId('history-row')).toHaveLength(23);
    expect(screen.getAllByTestId('captured-icon').length).toBeGreaterThan(0);
    expect((screen.getAllByTestId('difficulty-select')[0] as HTMLSelectElement).value).toBe('easy');
    expect(status()).toBe('LƯỢT ĐỎ');
    expect(screen.getByTestId('ring-last-move').dataset.x).toBe('3');
  });

  it('VÁN MỚI on the resume prompt discards the save', () => {
    saveBeforeMate();
    render(<App />);
    enterGame('VÁN MỚI');
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByTestId('move-history').textContent).toContain('Chưa có nước đi');
  });

  it('a corrupted save is discarded silently', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1,"moves":[[4,9,4,7]]}');
    render(<App />);
    expect(screen.queryByTestId('resume-prompt')).toBeNull();
    expect(screen.getByText('CHƠI NGAY')).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('saves after each completed move, never mid-animation', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull(); // still moving
    advance(300);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).moves).toEqual([[4, 6, 4, 5]]);
  });
});

describe('game over, result and replay', () => {
  function mate() {
    saveBeforeMate();
    render(<App />);
    enterGame('TIẾP TỤC');
    fireEvent.click(img(8, 8)!);
    fireEvent.click(marker(3, 8));
    advance(400);
  }

  it('checkmate shows the Vietnamese result with VÁN MỚI and XEM LẠI; the save is cleared', () => {
    mate();
    const banner = screen.getByTestId('game-over');
    expect(banner.textContent).toContain('CHIẾU BÍ');
    expect(banner.textContent).toContain('ĐỎ THẮNG');
    expect(status()).toBe('CHIẾU BÍ — ĐỎ THẮNG');
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(within(banner).getByText('VÁN MỚI')).toBeTruthy();
    expect(within(banner).getByText('XEM LẠI')).toBeTruthy();
    // After game over, "Ván mới" needs no confirmation.
    fireEvent.click(screen.getByTestId('new-game'));
    expect(screen.queryByTestId('confirm-new-game')).toBeNull();
    expect(screen.queryByTestId('game-over')).toBeNull();
  });

  it('replays the real game: play, pause, next, previous, restart and exit', () => {
    mate();
    calls = [];
    fireEvent.click(screen.getByText('XEM LẠI'));
    const count = () => screen.getByTestId('replay-count').textContent;
    expect(count()).toBe('Nước 0/47');
    expect(screen.queryByTestId('game-over')).toBeNull();
    // Auto-play: the first recorded move animates, then commits.
    advance(400 + 20);
    expect(document.querySelector('[data-testid="piece"][data-moving="true"]')).not.toBeNull();
    advance(400);
    expect(count()).toBe('Nước 1/47');
    expect(img(1, 0)!.dataset.side).toBe('red'); // [1,7 → 1,0]: Red cannon took the Blue horse
    advance(REPLAY_STEP_MS + 400);
    expect(count()).toBe('Nước 2/47');
    // Pause stops auto-play.
    fireEvent.click(screen.getByTestId('replay-play'));
    advance(3000);
    expect(count()).toBe('Nước 2/47');
    // Next / previous / restart.
    fireEvent.click(screen.getByLabelText('Nước sau'));
    advance(400);
    expect(count()).toBe('Nước 3/47');
    fireEvent.click(screen.getByLabelText('Nước trước'));
    expect(count()).toBe('Nước 2/47');
    expect(document.querySelector('.history__move.is-current')!.textContent).toBe(
      screen.getAllByTestId('history-row')[0]!.querySelectorAll('.history__move')[1]!.textContent,
    );
    fireEvent.click(screen.getByLabelText('Về đầu'));
    expect(count()).toBe('Nước 0/47');
    expect(img(1, 0)!.dataset.side).toBe('blue');
    // No combat scene or AI during replay.
    fireEvent.click(screen.getByTestId('replay-play'));
    advance(8000);
    expect(screen.queryByTestId('combat-overlay')).toBeNull();
    expect(calls).not.toContain('newGame');
    // Exit returns to the finished game.
    fireEvent.click(screen.getByTestId('replay-exit'));
    expect(screen.getByTestId('game-over').textContent).toContain('CHIẾU BÍ');
    expect(screen.getAllByTestId('history-row')).toHaveLength(24);
  });
});

describe('new game confirmation', () => {
  it('starts immediately with no moves; asks mid-game; HỦY / Escape keep the game', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(screen.getByTestId('new-game'));
    expect(screen.queryByTestId('confirm-new-game')).toBeNull();
    playOpeningExchange();
    expect(screen.getAllByTestId('history-row')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('new-game'));
    const dialog = screen.getByTestId('confirm-new-game');
    expect(dialog.textContent).toContain('BẮT ĐẦU VÁN MỚI?');
    expect(dialog.textContent).toContain('Ván hiện tại sẽ bị mất.');
    expect(document.activeElement?.textContent).toBe('HỦY');
    expect(main().hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByText('HỦY'));
    expect(screen.queryByTestId('confirm-new-game')).toBeNull();
    expect(screen.getAllByTestId('history-row')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.keyDown(screen.getByTestId('confirm-new-game'), { key: 'Escape' });
    expect(screen.queryByTestId('confirm-new-game')).toBeNull();
    expect(screen.getAllByTestId('history-row')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.click(within(screen.getByTestId('confirm-new-game')).getByText('VÁN MỚI'));
    expect(screen.queryByTestId('history-row')).toBeNull();
    expect(status()).toBe('LƯỢT ĐỎ');
  });

  it('is disabled while a move animates or the AI thinks', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    expect((screen.getByTestId('new-game') as HTMLButtonElement).disabled).toBe(true);
    advance(300);
    expect(status()).toBe('XANH ĐANG NGHĨ...');
    expect((screen.getByTestId('new-game') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByTestId('difficulty-select')[0] as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('help dialog', () => {
  it('explains goal, pieces and special rules; Escape closes; focus is trapped and restored', () => {
    render(<App initialScreen="game" />);
    const helpButton = screen.getAllByLabelText('Cách chơi')[0]!;
    helpButton.focus();
    fireEvent.click(helpButton);
    const dialog = screen.getByTestId('help-dialog');
    for (const text of ['Mục tiêu', 'Các quân cờ', 'Luật đặc biệt', 'cản chân mã', 'sông', 'ngòi', 'Cửu cung']) {
      expect(dialog.textContent).toContain(text);
    }
    expect(dialog.textContent).toMatch(/Tướng.*đối mặt|lộ mặt tướng/i);
    expect(dialog.querySelectorAll('.help__pieces .piece-token')).toHaveLength(7);
    const close = screen.getByLabelText('Đóng hướng dẫn');
    expect(document.activeElement).toBe(close);
    // Focus trap: Shift+Tab from the first control wraps to the last one inside the dialog.
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByTestId('help-dialog')).toBeNull();
    expect(document.activeElement).toBe(helpButton);
  });

  it('does not change the game', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(screen.getAllByLabelText('Cách chơi')[0]!);
    fireEvent.click(screen.getByLabelText('Đóng hướng dẫn'));
    expect(screen.getByTestId('ring-selected')).toBeTruthy();
    expect(status()).toBe('LƯỢT ĐỎ');
  });
});

describe('HUD', () => {
  it('history toggle shows and hides the move panel; ⋮ menu repeats secondary controls', () => {
    render(<App initialScreen="game" />);
    const panelShown = () => screen.queryByTestId('side-panel') !== null;
    const before = panelShown();
    fireEvent.click(screen.getAllByTestId('history-toggle')[0]!);
    expect(panelShown()).toBe(!before);
    fireEvent.click(screen.getByTestId('more-menu'));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByTestId('difficulty-select')).toBeTruthy();
    expect(within(menu).getByTestId('volume-slider')).toBeTruthy();
    expect(within(menu).getByTestId('history-toggle')).toBeTruthy();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('difficulty changes apply to the running game and persist', () => {
    render(<App initialScreen="game" />);
    fireEvent.change(screen.getAllByTestId('difficulty-select')[0]!, { target: { value: 'easy' } });
    expect(localStorage.getItem(DIFFICULTY_KEY)).toBe('easy');
    expect((screen.getAllByTestId('difficulty-select')[0] as HTMLSelectElement).value).toBe('easy');
  });

  it('volume slider changes and persists the master volume; M still toggles mute', () => {
    render(<App initialScreen="game" />);
    const slider = screen.getAllByTestId('volume-slider')[0]!;
    fireEvent.change(slider, { target: { value: '40' } });
    expect(audio.getVolume()).toBeCloseTo(0.4);
    expect(localStorage.getItem('human-chess:sound-volume')).toBe('0.4');
    fireEvent.keyDown(slider, { key: 'm' }); // range input is not text entry
    expect(audio.isMuted()).toBe(true);
    fireEvent.keyDown(window, { key: 'm' });
    expect(audio.isMuted()).toBe(false);
    audio.setVolume(0.8);
  });

  it('volume 0 silences sounds', () => {
    render(<App initialScreen="game" />);
    audio.setVolume(0);
    fireEvent.click(img(4, 6)!);
    expect(calls).toEqual([]);
    audio.setVolume(0.8);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(img(4, 6)!);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('hides the board debug switch unless ?debug=1', () => {
    render(<App initialScreen="game" />);
    expect(screen.queryByText('Debug')).toBeNull();
  });

  it('never asks to rotate the phone: portrait is a playable layout', () => {
    render(<App />);
    expect(document.querySelector('.rotate-hint')).toBeNull();
    expect(document.body.textContent).not.toContain('Xoay điện thoại');
  });
});

describe('stability', () => {
  it('10 consecutive new games: one AudioContext, stable DOM, no leftover timers or listeners', () => {
    const created: unknown[] = [];
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
    const node = (): Record<string, unknown> => ({ connect: (n: unknown) => n ?? node(), disconnect() {}, gain: param(), frequency: param(), Q: param() });
    class FakeCtx {
      state = 'suspended';
      currentTime = 0;
      sampleRate = 8000;
      destination = node();
      constructor() {
        created.push(this);
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createGain = node;
      createBiquadFilter = () => ({ ...node(), type: 'lowpass' });
      createOscillator = () => ({ ...node(), type: 'sine', start() {}, stop() {} });
      createBufferSource = () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} });
      createBuffer = (_c: number, len: number) => {
        const data = new Float32Array(len);
        return { getChannelData: () => data };
      };
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    resetAudioContextForTests();
    audio.setAudioBackend(null);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    render(<App initialScreen="game" />);
    fireEvent.pointerDown(window);
    const nodes = () => document.body.querySelectorAll('*').length;
    let baseline = 0;
    for (let i = 0; i < 10; i++) {
      playOpeningExchange();
      fireEvent.click(screen.getByTestId('new-game'));
      fireEvent.click(within(screen.getByTestId('confirm-new-game')).getByText('VÁN MỚI'));
      advance(500);
      if (i === 0) baseline = nodes();
      else expect(nodes()).toBe(baseline);
      expect(status()).toBe('LƯỢT ĐỎ');
    }
    expect(created).toHaveLength(1);
    const keydownAdds = add.mock.calls.filter(([t]) => t === 'keydown').length;
    const keydownRemoves = remove.mock.calls.filter(([t]) => t === 'keydown').length;
    expect(keydownAdds - keydownRemoves).toBeLessThanOrEqual(1);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    resetAudioContextForTests();
  });
});
