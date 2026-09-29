// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOLUME, VOLUME_STORAGE_KEY, getVolume, reloadVolumePreference, setVolume } from '../../src/audio/volume.ts';
import { applyMove, createInitialGameState } from '../../src/engine/index.ts';
import type { GameState, Move } from '../../src/engine/index.ts';
import { createUiState, getGameOverView, uiReducer } from '../../src/game/controller.ts';
import type { UiState } from '../../src/game/controller.ts';
import { capturedPieces, formatMove, historyRows } from '../../src/game/notation.ts';
import {
  DIFFICULTY_KEY,
  SAVE_KEY,
  clearSavedGame,
  loadDifficulty,
  loadSavedGame,
  rebuildGame,
  saveDifficulty,
  saveGame,
} from '../../src/game/persistence.ts';
import { gameAfter, replayStateAt } from '../../src/game/replay.ts';
import { move, position } from '../engine/helpers.ts';

function play(...moves: Move[]): GameState {
  let s = createInitialGameState();
  for (const m of moves) {
    const r = applyMove(s, m);
    if (!r.ok) throw new Error(`illegal ${JSON.stringify(m)}`);
    s = r.state;
  }
  return s;
}

// Central cannon opening, horse reply, cannon takes the pawn (a real capture).
const OPENING = [move(7, 7, 4, 7), move(7, 0, 6, 2), move(4, 7, 4, 3)];

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('move notation', () => {
  it('formats moves from each side’s own view', () => {
    const s = play(...OPENING);
    const [a, b, c] = s.history;
    expect(formatMove(a!)).toBe('炮2=5'); // Red cannon file 2 → file 5
    expect(formatMove(b!)).toBe('馬8+7'); // Blue horse file 8 forward to file 7
    expect(formatMove(c!)).toBe('炮5+4×'); // Red cannon forward 4, capture
  });

  it('groups moves into numbered rows and lists captured pieces', () => {
    const s = play(...OPENING);
    expect(historyRows(s.history)).toEqual([
      { number: 1, red: '炮2=5', blue: '馬8+7' },
      { number: 2, red: '炮5+4×', blue: null },
    ]);
    const cap = capturedPieces(s.history);
    expect(cap.red).toEqual([{ side: 'blue', type: 'pawn' }]);
    expect(cap.blue).toEqual([]);
    expect(historyRows([])).toEqual([]);
  });

  it('uses "-" for backward moves', () => {
    const s = play(move(0, 9, 0, 7), move(0, 0, 0, 1), move(0, 7, 0, 8));
    expect(formatMove(s.history[2]!)).toBe('車9-1');
    expect(formatMove(s.history[1]!)).toBe('車1+1');
  });
});

describe('game-over view (Vietnamese)', () => {
  it('names checkmate, stalemate and captured general; stalemate is a loss', () => {
    const mate = position(
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
    );
    expect(getGameOverView(mate)).toMatchObject({ title: 'CHIẾU BÍ', winnerText: 'ĐỎ THẮNG', reason: 'checkmate' });
    const stale = position(
      `
      ....k....
      ........R
      .........
      .........
      .........
      ...R.R...
      .........
      .........
      .........
      ...K.....`,
      'blue',
    );
    const v = getGameOverView(stale)!;
    expect(v.title).toBe('BẾ TẮC');
    expect(v.winner).toBe('red'); // not a draw
    expect(v.detail).toContain('bên bế tắc thua');
  });
});

describe('persistence', () => {
  const uiWith = (game: GameState, extra: Partial<UiState> = {}): UiState => ({
    ...createUiState(game, { aiSide: 'blue', difficulty: 'hard' }),
    ...extra,
  });

  it('saves the move list of an unfinished game and restores it through the engine', () => {
    const game = play(...OPENING);
    saveGame(uiWith(game));
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(raw).toMatchObject({ version: 1, difficulty: 'hard', moves: [[7, 7, 4, 7], [7, 0, 6, 2], [4, 7, 4, 3]] });
    const loaded = loadSavedGame()!;
    expect(loaded.difficulty).toBe('hard');
    expect(loaded.game.board).toEqual(game.board);
    expect(loaded.game.turn).toBe('blue');
    expect(loaded.game.history).toEqual(game.history);
    expect(loaded.lastMove).toEqual(move(4, 7, 4, 3));
  });

  it('never saves mid-presentation, in replay, empty or finished games', () => {
    const game = play(...OPENING);
    const ui = uiWith(game);
    saveGame({ ...ui, movement: { id: 1, move: move(0, 0, 0, 1) } as UiState['movement'] });
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    saveGame({ ...ui, replay: true });
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    saveGame(ui);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    saveGame(uiWith(createInitialGameState())); // empty game clears
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    saveGame(ui);
    const over = position(
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
    );
    saveGame(uiWith(over)); // finished game clears
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('discards corrupted, incompatible, illegal or finished saves safely', () => {
    const bad = [
      '{not json',
      'null',
      '42',
      JSON.stringify({ version: 2, moves: [[7, 7, 4, 7]] }),
      JSON.stringify({ version: 1, moves: 'x' }),
      JSON.stringify({ version: 1, moves: [] }),
      JSON.stringify({ version: 1, moves: [[0, 0, 0, 5]] }), // Blue piece on Red's turn
      JSON.stringify({ version: 1, moves: [[4, 9, 4, 7]] }), // illegal general move
      JSON.stringify({ version: 1, moves: [[9, 9, 9, 9]] }), // off-board
      JSON.stringify({ version: 1, moves: [['a', 1, 2, 3]] }),
      JSON.stringify({ version: 1, moves: [[7, 7, 4, 7, 1]] }),
    ];
    for (const raw of bad) {
      localStorage.setItem(SAVE_KEY, raw);
      expect(loadSavedGame()).toBeNull();
      expect(localStorage.getItem(SAVE_KEY)).toBeNull(); // removed
    }
    expect(loadSavedGame()).toBeNull(); // missing
  });

  it('falls back to the default difficulty for an unknown saved level', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, difficulty: 'godlike', moves: [[7, 7, 4, 7]] }));
    expect(loadSavedGame()!.difficulty).toBe('normal');
  });

  it('rebuildGame validates every move with the engine', () => {
    expect(rebuildGame([[7, 7, 4, 7]])!.history).toHaveLength(1);
    expect(rebuildGame([[7, 7, 4, 7], [7, 7, 4, 7]])).toBeNull();
  });

  it('persists the difficulty preference and survives storage failures', () => {
    expect(loadDifficulty()).toBe('normal');
    saveDifficulty('easy');
    expect(localStorage.getItem(DIFFICULTY_KEY)).toBe('easy');
    expect(loadDifficulty()).toBe('easy');
    localStorage.setItem(DIFFICULTY_KEY, 'bogus');
    expect(loadDifficulty()).toBe('normal');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveGame(uiWith(play(...OPENING)))).not.toThrow();
    expect(() => saveDifficulty('hard')).not.toThrow();
    expect(() => clearSavedGame()).not.toThrow();
    expect(loadSavedGame()).toBeNull();
    expect(loadDifficulty()).toBe('normal');
  });
});

describe('volume preference', () => {
  it('defaults, clamps and persists the master volume', () => {
    reloadVolumePreference();
    expect(getVolume()).toBe(DEFAULT_VOLUME);
    setVolume(0.35);
    expect(getVolume()).toBeCloseTo(0.35);
    expect(localStorage.getItem(VOLUME_STORAGE_KEY)).toBe('0.35');
    setVolume(4);
    expect(getVolume()).toBe(1);
    setVolume(-1);
    expect(getVolume()).toBe(0);
    localStorage.setItem(VOLUME_STORAGE_KEY, '0.5');
    reloadVolumePreference();
    expect(getVolume()).toBe(0.5);
    localStorage.setItem(VOLUME_STORAGE_KEY, 'garbage');
    reloadVolumePreference();
    expect(getVolume()).toBe(DEFAULT_VOLUME);
    setVolume(DEFAULT_VOLUME);
  });
});

describe('replay', () => {
  const game = play(...OPENING);

  it('rebuilds the exact recorded positions', () => {
    const moves = game.history.map((r) => ({ from: r.from, to: r.to }));
    expect(gameAfter(moves, 0).board).toEqual(createInitialGameState().board);
    expect(gameAfter(moves, 3).board).toEqual(game.board);
    const mid = replayStateAt(game.history, 2);
    expect(mid.replay).toBe(true);
    expect(mid.aiSide).toBeNull();
    expect(mid.game.history).toHaveLength(2);
    expect(mid.lastMove).toEqual(move(7, 0, 6, 2));
    expect(replayStateAt(game.history, 0).lastMove).toBeNull();
  });

  it('replayMove plays only the expected recorded move, with the movement animation', () => {
    let ui = replayStateAt(game.history, 0);
    const rec = game.history[0]!;
    // Wrong ply / wrong game / illegal move are ignored.
    expect(uiReducer(ui, { type: 'replayMove', gameId: ui.gameId, ply: 1, move: rec })).toBe(ui);
    expect(uiReducer(ui, { type: 'replayMove', gameId: ui.gameId + 99, ply: 0, move: rec })).toBe(ui);
    expect(uiReducer(ui, { type: 'replayMove', gameId: ui.gameId, ply: 0, move: move(4, 9, 4, 7) })).toBe(ui);
    ui = uiReducer(ui, { type: 'replayMove', gameId: ui.gameId, ply: 0, move: { from: rec.from, to: rec.to } });
    expect(ui.movement).not.toBeNull();
    // A second request while presenting is ignored.
    expect(uiReducer(ui, { type: 'replayMove', gameId: ui.gameId, ply: 0, move: rec })).toBe(ui);
    // Board clicks never act in replay.
    const idle = replayStateAt(game.history, 0);
    expect(uiReducer(idle, { type: 'click', position: { x: 7, y: 7 } })).toBe(idle);
  });

  it('a replayed capture uses a short capture movement, not the combat scene', () => {
    let ui = replayStateAt(game.history, 2);
    const rec = game.history[2]!;
    ui = uiReducer(ui, { type: 'replayMove', gameId: ui.gameId, ply: 2, move: { from: rec.from, to: rec.to } });
    expect(ui.combat).toBeNull();
    expect(ui.movement?.capture).toBe(true);
  });

  it('newGame keeps the difficulty and AI side; setDifficulty changes it', () => {
    let ui = createUiState(undefined, { aiSide: 'blue', difficulty: 'easy' });
    ui = uiReducer(ui, { type: 'setDifficulty', difficulty: 'hard' });
    expect(ui.difficulty).toBe('hard');
    const next = uiReducer(ui, { type: 'newGame' });
    expect(next.difficulty).toBe('hard');
    expect(next.aiSide).toBe('blue');
    expect(next.gameId).not.toBe(ui.gameId);
  });
});
