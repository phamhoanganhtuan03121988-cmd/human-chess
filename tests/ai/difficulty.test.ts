import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_SETTINGS,
  chooseMoveForDifficulty,
  createDifficultyPlayer,
  fastSearch,
  isDifficulty,
  repetitionGuard,
  searchBestMove,
} from '../../src/ai/index.ts';
import { applyMove, createInitialGameState, getAllLegalMoves, isLegalMove } from '../../src/engine/index.ts';
import type { GameState } from '../../src/engine/index.ts';
import { position } from '../engine/helpers.ts';

/** Plays n plies of self-play at a level, checking every move is legal. */
function selfPlay(level: (typeof DIFFICULTIES)[number], plies: number): GameState {
  let s = createInitialGameState();
  for (let i = 0; i < plies && s.status === 'playing'; i++) {
    const r = chooseMoveForDifficulty(s, level);
    expect(r).not.toBeNull();
    expect(isLegalMove(s, r!.move)).toBe(true);
    const next = applyMove(s, r!.move);
    expect(next.ok).toBe(true);
    if (next.ok) s = next.state;
  }
  return s;
}

const MATE_IN_ONE_FOR_BLUE = () =>
  position(
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
  );

describe('difficulty levels', () => {
  it('has three Vietnamese-labelled levels with the planned search settings', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
    expect(DIFFICULTY_LABELS).toEqual({ easy: 'DỄ', normal: 'BÌNH THƯỜNG', hard: 'KHÓ' });
    expect(DIFFICULTY_SETTINGS.easy.depth).toBe(2);
    expect(DIFFICULTY_SETTINGS.normal.depth).toBe(3);
    expect(DIFFICULTY_SETTINGS.hard.depth).toBeGreaterThanOrEqual(4);
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('insane')).toBe(false);
    expect(isDifficulty(null)).toBe(false);
  });

  for (const level of DIFFICULTIES) {
    describe(level, () => {
      it('always returns a legal move (self-play)', () => {
        selfPlay(level, level === 'hard' ? 6 : 16);
      }, 30_000);

      it('is deterministic: same position → same move', () => {
        const s = createInitialGameState();
        const a = chooseMoveForDifficulty(s, level)!;
        const b = chooseMoveForDifficulty(s, level)!;
        expect(a.move).toEqual(b.move);
        expect(a.score).toBe(b.score);
        expect(a.nodes).toBe(b.nodes);
      });

      it('finds an immediate win', () => {
        const s = MATE_IN_ONE_FOR_BLUE();
        const r = applyMove(s, chooseMoveForDifficulty(s, level)!.move);
        expect(r.ok && r.state.winner).toBe('blue');
      });

      it('escapes check with a legal move', () => {
        // Red general in check from a Blue rook on its file.
        const s = position(`
          ....k....
          .........
          .........
          .........
          .........
          .........
          .........
          .........
          .........
          ...K..r..`);
        expect(s.inCheck).toBe(true);
        const r = chooseMoveForDifficulty(s, level)!;
        expect(isLegalMove(s, r.move)).toBe(true);
        const next = applyMove(s, r.move);
        expect(next.ok && next.state.status).not.toBe('general_captured');
      });

      it('returns null on checkmate and stalemate', () => {
        const mated = position(
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
        expect(mated.status).toBe('checkmate');
        expect(chooseMoveForDifficulty(mated, level)).toBeNull();
        const stalemate = position(
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
        expect(stalemate.status).toBe('stalemate');
        expect(chooseMoveForDifficulty(stalemate, level)).toBeNull();
      });

      it('responds within the time budget from the opening and a middlegame', () => {
        const opening = chooseMoveForDifficulty(createInitialGameState(), level)!;
        expect(opening.timeMs).toBeLessThan(1500);
        const mid = selfPlay('normal', 10);
        const r = chooseMoveForDifficulty(mid, level)!;
        expect(r.timeMs).toBeLessThan(1500);
      }, 30_000);
    });
  }

  it('hard searches deeper than normal, normal deeper than easy', () => {
    const s = createInitialGameState();
    const e = chooseMoveForDifficulty(s, 'easy')!;
    const n = chooseMoveForDifficulty(s, 'normal')!;
    const h = chooseMoveForDifficulty(s, 'hard')!;
    expect(e.depth).toBe(2);
    expect(n.depth).toBe(3);
    expect(h.depth).toBeGreaterThanOrEqual(3);
    expect(h.nodes).toBeGreaterThan(e.nodes);
  });

  it('a player only moves its own side', () => {
    const p = createDifficultyPlayer('blue', 'easy');
    expect(p.chooseMove(createInitialGameState())).toBeNull(); // Red to move
  });
});

describe('repetition guard (no perpetual check / endless shuffling)', () => {
  // Both rooks shuffle; after 7 plies Blue's (0,1)→(0,0) would recreate the
  // initial position for the third time.
  const shuffle = () => {
    let s = createInitialGameState();
    const seq = [[0, 9, 0, 8], [0, 0, 0, 1], [0, 8, 0, 9], [0, 1, 0, 0], [0, 9, 0, 8], [0, 0, 0, 1], [0, 8, 0, 9]];
    for (const [fx, fy, tx, ty] of seq) {
      const r = applyMove(s, { from: { x: fx!, y: fy! }, to: { x: tx!, y: ty! } });
      if (!r.ok) throw new Error('illegal');
      s = r.state;
    }
    return s;
  };
  const back = { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } };

  it('flags only the move that repeats a position a third time', () => {
    const s = shuffle();
    const guard = repetitionGuard(s)!;
    expect(guard(back)).toBe(true);
    expect(getAllLegalMoves(s).filter((m) => guard(m))).toHaveLength(1);
    expect(repetitionGuard(createInitialGameState())).toBeUndefined();
    // The guard does not change the position it inspects.
    expect(guard(back)).toBe(true);
  });

  for (const level of DIFFICULTIES) {
    it(`${level} never plays the third repetition`, () => {
      const s = shuffle();
      const r = chooseMoveForDifficulty(s, level)!;
      expect(r.move).not.toEqual(back);
      expect(r.rootScores.some((x) => x.move.from.x === 0 && x.move.from.y === 1 && x.move.to.y === 0)).toBe(false);
    }, 30_000);
  }

  it('still moves when the repetition is the only legal move', () => {
    const s = position(
      `
      ...k.....
      .........
      .........
      .........
      .........
      .........
      .........
      .........
      .........
      ....K....`,
      'blue',
    );
    const r = fastSearch(s, { depth: 2, avoidRoot: () => true })!;
    expect(isLegalMove(s, r.move)).toBe(true);
  });
});

describe('fastSearch', () => {
  it('agrees with the reference search on legality and finds the same forced win', () => {
    const s = MATE_IN_ONE_FOR_BLUE();
    const fast = fastSearch(s, { depth: 2 })!;
    const ref = searchBestMove(s, 2)!;
    const a = applyMove(s, fast.move);
    const b = applyMove(s, ref.move);
    expect(a.ok && a.state.winner).toBe('blue');
    expect(b.ok && b.state.winner).toBe('blue');
  });

  it('reports a score for every legal root move when exactRoot is set', () => {
    const s = createInitialGameState();
    const r = fastSearch(s, { depth: 1, exactRoot: true })!;
    expect(r.rootScores.length).toBe(getAllLegalMoves(s).length);
  });

  it('always completes depth 1 even with a tiny node budget', () => {
    const r = fastSearch(createInitialGameState(), { depth: 4, nodeLimit: 1 })!;
    expect(r.depth).toBe(1);
    expect(isLegalMove(createInitialGameState(), r.move)).toBe(true);
  });
});
