import { describe, expect, it } from 'vitest';
import { isInPalace, isOnOwnSide, isValidCoordinate } from '../src/board/geometry.ts';
import { INITIAL_POSITION } from '../src/board/initialPosition.ts';

const coords = (side: string, type: string) =>
  INITIAL_POSITION.filter((p) => p.side === side && p.type === type)
    .map((p) => `${p.x},${p.y}`)
    .sort();

describe('initial position', () => {
  it('has 32 pieces, 16 per side', () => {
    expect(INITIAL_POSITION).toHaveLength(32);
    expect(INITIAL_POSITION.filter((p) => p.side === 'red')).toHaveLength(16);
    expect(INITIAL_POSITION.filter((p) => p.side === 'blue')).toHaveLength(16);
  });

  it('places every piece on a valid, unique intersection', () => {
    for (const p of INITIAL_POSITION) expect(isValidCoordinate(p.x, p.y)).toBe(true);
    expect(new Set(INITIAL_POSITION.map((p) => `${p.x},${p.y}`)).size).toBe(32);
  });

  it('keeps each side on its own half, generals in their palaces', () => {
    for (const p of INITIAL_POSITION) expect(isOnOwnSide(p.y, p.side)).toBe(true);
    for (const p of INITIAL_POSITION.filter((p) => p.type === 'general' || p.type === 'advisor')) {
      expect(isInPalace(p.x, p.y, p.side)).toBe(true);
    }
  });

  it('matches the mandated red coordinates', () => {
    expect(coords('red', 'general')).toEqual(['4,9']);
    expect(coords('red', 'advisor')).toEqual(['3,9', '5,9']);
    expect(coords('red', 'elephant')).toEqual(['2,9', '6,9']);
    expect(coords('red', 'knight')).toEqual(['1,9', '7,9']);
    expect(coords('red', 'rook')).toEqual(['0,9', '8,9']);
    expect(coords('red', 'cannon')).toEqual(['1,7', '7,7']);
    expect(coords('red', 'pawn')).toEqual(['0,6', '2,6', '4,6', '6,6', '8,6']);
  });

  it('matches the mandated blue coordinates', () => {
    expect(coords('blue', 'general')).toEqual(['4,0']);
    expect(coords('blue', 'advisor')).toEqual(['3,0', '5,0']);
    expect(coords('blue', 'elephant')).toEqual(['2,0', '6,0']);
    expect(coords('blue', 'knight')).toEqual(['1,0', '7,0']);
    expect(coords('blue', 'rook')).toEqual(['0,0', '8,0']);
    expect(coords('blue', 'cannon')).toEqual(['1,2', '7,2']);
    expect(coords('blue', 'pawn')).toEqual(['0,3', '2,3', '4,3', '6,3', '8,3']);
  });

  it('is mirror-symmetric between red and blue (y ↔ 9 - y)', () => {
    const red = INITIAL_POSITION.filter((p) => p.side === 'red').map((p) => `${p.type}@${p.x},${9 - p.y}`).sort();
    const blue = INITIAL_POSITION.filter((p) => p.side === 'blue').map((p) => `${p.type}@${p.x},${p.y}`).sort();
    expect(red).toEqual(blue);
  });
});
