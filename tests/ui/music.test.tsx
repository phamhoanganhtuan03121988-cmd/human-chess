// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, START_TRANSITION_MS } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { resetAudioContextForTests } from '../../src/audio/audioContext.ts';
import { MUSIC_TRACK_URL, getMusicStatus, requestMusic, resetMusicForTests, setMusicElementFactory } from '../../src/audio/music.ts';
import {
  DEFAULT_MUSIC_VOLUME,
  MUSIC_ENABLED_KEY,
  MUSIC_VOLUME_KEY,
  VOLUME,
  reloadMusicPreferences,
  reloadMutePreference,
  reloadVolumePreference,
} from '../../src/audio/volume.ts';

/** Minimal media element: records play/pause and fires the real events. */
class FakeAudio extends EventTarget {
  paused = true;
  loop = false;
  preload = '';
  volume = 1;
  src = '';
  plays = 0;
  playResult: Promise<void> = Promise.resolve();
  play() {
    this.plays++;
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return this.playResult;
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
}

let elements: FakeAudio[] = [];
let contexts: FakeCtx[] = [];
let musicGainTargets: number[] = [];

const param = (onTarget?: (v: number) => void) => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  linearRampToValueAtTime() {},
  setTargetAtTime: (v: number) => onTarget?.(v),
  cancelScheduledValues() {},
});
const node = (): Record<string, unknown> => ({ connect: (n: unknown) => n ?? node(), disconnect() {}, gain: param(), frequency: param(), Q: param() });

class FakeCtx {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  sources = 0;
  constructor() {
    contexts.push(this);
  }
  resume() {
    return Promise.resolve();
  }
  private nextGainIsMusic = false;
  createGain() {
    // The gain created right after the media source is the music gain: record its levels.
    if (!this.nextGainIsMusic) return node();
    this.nextGainIsMusic = false;
    return { ...node(), gain: param((v) => musicGainTargets.push(v)) };
  }
  createMediaElementSource() {
    this.sources++;
    this.nextGainIsMusic = true;
    return { connect: (n: unknown) => n, disconnect() {} };
  }
  createBiquadFilter = () => ({ ...node(), type: 'lowpass' });
  createOscillator = () => ({ ...node(), type: 'sine', start() {}, stop() {} });
  createBufferSource = () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} });
  createBuffer = (_c: number, len: number) => {
    const data = new Float32Array(len);
    return { getChannelData: () => data };
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  elements = [];
  contexts = [];
  musicGainTargets = [];
  reloadMutePreference();
  reloadVolumePreference();
  reloadMusicPreferences();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  resetAudioContextForTests();
  resetMusicForTests();
  setMusicElementFactory(() => {
    const el = new FakeAudio();
    elements.push(el);
    return el as unknown as HTMLAudioElement;
  });
  audio.setAudioBackend(null);
  audio.initAudio();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setMusicElementFactory(null);
  resetMusicForTests();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  resetAudioContextForTests();
  audio.setSoundMuted(false);
  audio.setMusicEnabled(true);
  audio.setMusicVolume(DEFAULT_MUSIC_VOLUME);
});

describe('background music', () => {
  it('never starts on its own: no AudioContext or player before the game is started', () => {
    render(<App />);
    expect(contexts).toHaveLength(0);
    expect(elements).toHaveLength(0);
    expect(getMusicStatus()).toBe('idle');
  });

  it('CHƠI NGAY (a user gesture) starts one looping track through the shared AudioContext', () => {
    render(<App />);
    fireEvent.pointerDown(window);
    fireEvent.click(screen.getByText('CHƠI NGAY'));
    act(() => void vi.advanceTimersByTime(START_TRANSITION_MS + 20));
    expect(contexts).toHaveLength(1);
    expect(elements).toHaveLength(1);
    const el = elements[0]!;
    expect(el.src).toBe(MUSIC_TRACK_URL);
    expect(el.loop).toBe(true);
    expect(el.plays).toBe(1);
    expect(contexts[0]!.sources).toBe(1); // routed into the master bus (master mute/volume apply)
    expect(getMusicStatus()).toBe('playing');
    // Quiet under the effects: 20% of the SFX scale at the default music volume.
    expect(musicGainTargets.at(-1)).toBeCloseTo(VOLUME.music * DEFAULT_MUSIC_VOLUME);
  });

  it('keeps exactly one player and one context however often it is requested', () => {
    requestMusic();
    requestMusic();
    requestMusic();
    expect(contexts).toHaveLength(1);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.plays).toBe(1);
  });

  it('master mute and master volume 0 pause the music; unmuting resumes it', () => {
    requestMusic();
    const el = elements[0]!;
    audio.setSoundMuted(true);
    expect(el.paused).toBe(true);
    audio.setSoundMuted(false);
    expect(el.paused).toBe(false);
    audio.setVolume(0);
    expect(el.paused).toBe(true);
    audio.setVolume(0.8);
    expect(el.paused).toBe(false);
    expect(elements).toHaveLength(1);
  });

  it('music on/off and music volume are separate from the effects and persisted', () => {
    requestMusic();
    const el = elements[0]!;
    audio.setMusicVolume(0.5);
    expect(musicGainTargets.at(-1)).toBeCloseTo(VOLUME.music * 0.5);
    expect(localStorage.getItem(MUSIC_VOLUME_KEY)).toBe('0.5');
    audio.setMusicEnabled(false);
    expect(el.paused).toBe(true);
    expect(localStorage.getItem(MUSIC_ENABLED_KEY)).toBe('0');
    expect(audio.isMuted()).toBe(false); // effects stay on
    // Reload: preferences come back.
    reloadMusicPreferences();
    expect(audio.isMusicEnabled()).toBe(false);
    expect(audio.getMusicVolume()).toBe(0.5);
    audio.setMusicEnabled(true);
    expect(el.paused).toBe(false);
  });

  it('pauses while the page is hidden and resumes when visible', () => {
    requestMusic();
    const el = elements[0]!;
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.paused).toBe(true);
    vis.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.paused).toBe(false);
    vis.mockRestore();
  });

  it('a missing or unplayable track is handled gracefully: silent, no retries, effects still work', () => {
    requestMusic();
    const el = elements[0]!;
    expect(() => el.dispatchEvent(new Event('error'))).not.toThrow();
    expect(getMusicStatus()).toBe('unavailable');
    expect(el.src).toBe('');
    requestMusic();
    audio.setSoundMuted(true);
    audio.setSoundMuted(false);
    expect(elements).toHaveLength(1); // never re-created
    const events: string[] = [];
    const on = (e: Event) => events.push((e as CustomEvent).detail.name);
    window.addEventListener('human-chess:sound', on);
    audio.playSelectSound();
    window.removeEventListener('human-chess:sound', on);
    expect(events).toEqual(['select']); // SFX unaffected
  });

  it('an autoplay refusal waits for the next gesture instead of giving up', async () => {
    setMusicElementFactory(() => {
      const el = new FakeAudio();
      el.play = function () {
        this.plays++;
        return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
      };
      elements.push(el);
      return el as unknown as HTMLAudioElement;
    });
    requestMusic();
    await act(async () => {
      await Promise.resolve();
    });
    expect(getMusicStatus()).toBe('paused');
    requestMusic();
    expect(elements[0]!.plays).toBe(2);
  });

  it('the ♪ control shows the state, toggles music and disables itself when no track exists', () => {
    render(<App initialScreen="game" />);
    const toggle = () => screen.getAllByTestId('music-toggle')[0] as HTMLButtonElement;
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle());
    expect(audio.isMusicEnabled()).toBe(false);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    fireEvent.change(screen.getAllByTestId('music-volume')[0]!, { target: { value: '30' } });
    expect(audio.getMusicVolume()).toBeCloseTo(0.3);
    act(() => requestMusic());
    act(() => void elements[0]!.dispatchEvent(new Event('error')));
    expect(toggle().disabled).toBe(true);
    expect(toggle().getAttribute('aria-label')).toBe('Nhạc nền chưa có');
  });
});
