import { describe, expect, it } from 'vitest';
import { applyMove, createInitialGameState, getAllLegalMoves } from '../../src/engine/index.ts';
import type { GameState } from '../../src/engine/index.ts';

/** Counts leaf positions reachable in `depth` plies (standard perft). */
function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;
  let total = 0;
  for (const m of getAllLegalMoves(state)) {
    const r = applyMove(state, m);
    if (r.ok) total += perft(r.state, depth - 1);
  }
  return total;
}

// Published perft values for the Xiangqi starting position.
describe('perft from the starting position', () => {
  it('depth 1 = 44', () => expect(perft(createInitialGameState(), 1)).toBe(44));
  it('depth 2 = 1,920', () => expect(perft(createInitialGameState(), 2)).toBe(1920));
  it('depth 3 = 79,666', { timeout: 120_000 }, () => expect(perft(createInitialGameState(), 3)).toBe(79666));
});
