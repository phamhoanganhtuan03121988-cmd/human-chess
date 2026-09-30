// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_CONTEXT } from '../../src/components/combat/combatTimeline.ts';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import type { AudioBackend } from '../../src/audio/index.ts';
import { resetAudioContextForTests } from '../../src/audio/audioContext.ts';
import { MUTE_STORAGE_KEY, reloadMutePreference } from '../../src/audio/volume.ts';
import { CombatOverlay } from '../../src/components/combat/CombatOverlay.tsx';
import { GameBoard } from '../../src/components/GameBoard.tsx';
import type { GameState, Side } from '../../src/engine/index.ts';
import { createUiState, uiReducer } from '../../src/game/controller.ts';
import { AI_THINK_DELAY_MS, useAiOpponent } from '../../src/game/useAiOpponent.ts';
import { useGameAudio } from '../../src/game/useGameAudio.ts';
import { position } from '../engine/helpers.ts';

let calls: string[] = [];
const spy: AudioBackend = {
  play(name, detail = {}) {
    const d = Object.values(detail);
    calls.push(d.length ? `${name}:${d.join(',')}` : name);
    return true;
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  localStorage.clear();
  reloadMutePreference();
  audio.setAudioBackend(spy);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  audio.setAudioBackend(null);
  audio.setSoundMuted(false);
});

function Harness({ game, aiSide = null }: { game?: GameState; aiSide?: Side | null }) {
  const [ui, dispatch] = useReducer(uiReducer, undefined, () => createUiState(game, { aiSide }));
  useAiOpponent(ui, dispatch);
  useGameAudio(ui);
  return (
    <>
      <span data-testid="ply">{ui.game.history.length}</span>
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
const count = (name: string) => calls.filter((c) => c === name || c.startsWith(`${name}:`)).length;

describe('audio API', () => {
  it('exposes the game sound functions and a volume hierarchy', () => {
    for (const fn of [
      audio.playMoveSound,
      audio.playLandSound,
      audio.playSelectSound,
      audio.playHoverSound,
      audio.playCaptureSound,
      audio.playImpactSound,
      audio.playCheckSound,
      audio.playGameOverSound,
      audio.playTurnSound,
      audio.playNewGameSound,
      audio.playCombatCue,
    ]) {
      expect(typeof fn).toBe('function');
    }
    const v = audio.VOLUME;
    expect(v.combatImpact).toBeGreaterThan(v.gameOver);
    expect(v.gameOver).toBeGreaterThan(v.check);
    expect(v.check).toBeGreaterThan(v.capture);
    expect(v.capture).toBeGreaterThan(v.move);
    expect(v.move).toBeGreaterThan(v.select);
    expect(v.select).toBeGreaterThan(v.hover);
    expect(v.turn).toBeGreaterThan(v.hover);
  });

  it('is safe before any interaction (silent, no errors)', () => {
    audio.setAudioBackend(null); // real Web Audio backend; jsdom has no AudioContext
    resetAudioContextForTests();
    const events: string[] = [];
    const on = (e: Event) => events.push((e as CustomEvent).detail.name);
    window.addEventListener('human-chess:sound', on);
    expect(() => {
      audio.playMoveSound();
      audio.playImpactSound('cannon');
      audio.playGameOverSound('checkmate');
    }).not.toThrow();
    expect(events).toEqual([]);
    window.removeEventListener('human-chess:sound', on);
  });

  it('muted state prevents every sound and event', () => {
    const events: string[] = [];
    const on = (e: Event) => events.push((e as CustomEvent).detail.name);
    window.addEventListener('human-chess:sound', on);
    audio.setSoundMuted(true);
    audio.playMoveSound();
    audio.playCheckSound();
    audio.playImpactSound('rook');
    expect(calls).toEqual([]);
    expect(events).toEqual([]);
    audio.setSoundMuted(false);
    audio.playMoveSound();
    expect(calls).toEqual(['move']);
    expect(events).toEqual(['move']);
    window.removeEventListener('human-chess:sound', on);
  });

  it('persists the mute preference in localStorage', () => {
    audio.setSoundMuted(true);
    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('1');
    reloadMutePreference(); // simulates a page reload
    expect(audio.isMuted()).toBe(true);
    audio.setSoundMuted(false);
    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('0');
    reloadMutePreference();
    expect(audio.isMuted()).toBe(false);
  });
});

describe('first interaction initializes Web Audio', () => {
  it('creates the AudioContext once, on the first pointer interaction', () => {
    const created: FakeCtx[] = [];
    const starts: number[] = [];
    const param = () => ({
      value: 0,
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      setTargetAtTime: () => {},
      cancelScheduledValues: () => {},
    });
    const node = () => ({ connect: (n: unknown) => n ?? node(), gain: param(), frequency: param(), Q: param() });
    class FakeCtx {
      state = 'suspended';
      currentTime = 0;
      sampleRate = 8000;
      destination = node();
      resumed = 0;
      constructor() {
        created.push(this);
      }
      resume() {
        this.resumed++;
        this.state = 'running';
        return Promise.resolve();
      }
      createGain() {
        return node();
      }
      createBiquadFilter() {
        return { ...node(), type: 'lowpass' };
      }
      createOscillator() {
        return { ...node(), type: 'sine', start: () => starts.push(1), stop: () => {} };
      }
      createBufferSource() {
        return { ...node(), buffer: null, loop: false, start: () => starts.push(1), stop: () => {} };
      }
      createBuffer(_c: number, len: number) {
        const data = new Float32Array(len);
        return { getChannelData: () => data };
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    resetAudioContextForTests();
    audio.setAudioBackend(null);
    render(<App initialScreen="game" />);
    expect(audio.isAudioUnlocked()).toBe(false);
    audio.playSelectSound();
    expect(starts).toHaveLength(0); // nothing before the first gesture
    fireEvent.pointerDown(window);
    expect(created).toHaveLength(1);
    expect(created[0]!.resumed).toBe(1);
    expect(audio.isAudioUnlocked()).toBe(true);
    fireEvent.pointerDown(window);
    expect(created).toHaveLength(1); // listener removed after unlock
    audio.playSelectSound();
    expect(starts.length).toBeGreaterThan(0); // real synthesis scheduled nodes
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    resetAudioContextForTests();
  });
});

describe('sound toggle and M shortcut', () => {
  it('toolbar button and M toggle sound; M is ignored while typing', () => {
    render(<App initialScreen="game" />);
    const btn = screen.getByTestId('sound-toggle');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(audio.isMuted()).toBe(true);
    expect(screen.getByTestId('sound-toggle').getAttribute('aria-pressed')).toBe('false');
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })));
    expect(audio.isMuted()).toBe(false);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M' })));
    expect(audio.isMuted()).toBe(true);
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => void input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true })));
    expect(audio.isMuted()).toBe(true); // unchanged while typing
    input.remove();
  });

  it('muting silences game sounds; unmuting brings them back', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(screen.getByTestId('sound-toggle')); // off
    fireEvent.click(img(4, 6)!);
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId('sound-toggle')); // on
    fireEvent.click(img(4, 6)!); // deselect
    fireEvent.click(img(4, 6)!); // select again
    expect(calls).toEqual(['select']);
  });
});

describe('game sounds fire on transitions only', () => {
  it('check sound plays only when entering check, not on re-renders', () => {
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
          ...K.....`)}
      />,
    );
    fireEvent.click(img(0, 5)!);
    fireEvent.click(marker(4, 5));
    advance(300);
    expect(count('check')).toBe(1);
    // Re-render repeatedly while Blue stays in check.
    for (let i = 0; i < 5; i++) {
      fireEvent.pointerEnter(img(4, 0)!);
      fireEvent.pointerLeave(img(4, 0)!);
    }
    advance(1000);
    expect(count('check')).toBe(1);
    // Blue escapes, Red checks again: a new transition, a new sound.
    fireEvent.click(img(4, 0)!);
    fireEvent.click(marker(5, 0));
    advance(300);
    fireEvent.click(img(4, 5)!);
    fireEvent.click(marker(5, 5));
    advance(300);
    expect(count('check')).toBe(2);
  });

  it('capture and game-over sounds fire exactly once', () => {
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
          ....K....`,
          'blue',
        )}
      />,
    );
    fireEvent.click(img(4, 5)!);
    fireEvent.click(img(4, 9)!);
    advance(4000);
    expect(count('capture')).toBe(1);
    expect(count('impact')).toBe(1);
    expect(count('gameOver')).toBe(1);
    expect(count('land')).toBe(0); // captures land silently after the impact
  });

  it('no duplicate sounds under StrictMode re-runs', () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    advance(300);
    expect(calls).toEqual(['select', 'move', 'land']);
  });

  it('turn cues: soft AI-thinking cue, then "your turn" when control returns', () => {
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
    fireEvent.click(img(0, 6)!);
    fireEvent.click(marker(0, 5));
    advance(300);
    expect(calls).toEqual(['select', 'move', 'land', 'turn:blue,ai']);
    advance(AI_THINK_DELAY_MS + 40 + 300);
    expect(calls.slice(4)).toEqual(['move', 'land', 'turn:red,human']);
  });

  it('hover ticks once when entering a new actionable piece, never for locked/opponent pieces', () => {
    render(<Harness />);
    fireEvent.pointerEnter(img(0, 9)!);
    fireEvent.pointerEnter(img(0, 9)!); // still the same piece
    expect(count('hover')).toBe(1);
    fireEvent.pointerLeave(img(0, 9)!);
    fireEvent.pointerEnter(img(0, 0)!); // opponent: not actionable
    expect(count('hover')).toBe(1);
    fireEvent.pointerEnter(img(8, 9)!);
    expect(count('hover')).toBe(2);
  });

  it('New Game plays the reset sound', () => {
    render(<App initialScreen="game" />);
    fireEvent.click(img(4, 6)!);
    fireEvent.click(marker(4, 5));
    advance(300 + AI_THINK_DELAY_MS + 40);
    advance(CAPTURE_CONTEXT.end + 2000); // AI reply (possibly context + combat) finishes
    calls = [];
    fireEvent.click(screen.getByTestId('new-game'));
    expect(calls).toEqual([]); // mid-game: asks for confirmation first
    fireEvent.click(screen.getByText('HỦY'));
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.click(screen.getByText('VÁN MỚI'));
    expect(calls).toEqual(['newGame']);
  });
});
