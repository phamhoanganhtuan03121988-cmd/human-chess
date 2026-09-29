import { describe, expect, it } from 'vitest';
import {
  FILES,
  INTERSECTION_COUNT,
  RANKS,
  createEmptyBoard,
  crossesRiver,
  getAllIntersections,
  getBoardHalf,
  getPalaceDiagonals,
  getPalaceIntersections,
  isInPalace,
  isOnOwnSide,
  isValidCoordinate,
} from '../src/board/geometry.ts';

describe('board dimensions', () => {
  it('has 9 files, 10 ranks and 90 intersections', () => {
    expect(FILES).toBe(9);
    expect(RANKS).toBe(10);
    expect(INTERSECTION_COUNT).toBe(90);
  });

  it('generates exactly 90 unique, valid intersections', () => {
    const points = getAllIntersections();
    expect(points).toHaveLength(90);
    expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(90);
    expect(points.every((p) => isValidCoordinate(p.x, p.y))).toBe(true);
    expect(new Set(points.map((p) => p.x))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(new Set(points.map((p) => p.y))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it('creates a board indexed as board[x][y]', () => {
    const board = createEmptyBoard<null>(null);
    expect(board).toHaveLength(9);
    for (const file of board) expect(file).toHaveLength(10);
    board[8]![9] = null; // last intersection is addressable
  });
});

describe('isValidCoordinate', () => {
  it('accepts every in-range integer coordinate, including corners', () => {
    for (let x = 0; x <= 8; x++) for (let y = 0; y <= 9; y++) expect(isValidCoordinate(x, y)).toBe(true);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [9, 0],
    [0, 10],
    [9, 10],
    [4.5, 3],
    [3, 4.5],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
  ])('rejects (%s, %s)', (x, y) => {
    expect(isValidCoordinate(x, y)).toBe(false);
  });
});

describe('palaces', () => {
  it('blue palace is files 3..5, ranks 0..2', () => {
    const pts = getPalaceIntersections('blue').map((p) => `${p.x},${p.y}`);
    expect(pts).toHaveLength(9);
    expect(pts).toEqual(['3,0', '4,0', '5,0', '3,1', '4,1', '5,1', '3,2', '4,2', '5,2']);
  });

  it('red palace is files 3..5, ranks 7..9', () => {
    const pts = getPalaceIntersections('red').map((p) => `${p.x},${p.y}`);
    expect(pts).toEqual(['3,7', '4,7', '5,7', '3,8', '4,8', '5,8', '3,9', '4,9', '5,9']);
  });

  it('classifies palace membership', () => {
    expect(isInPalace(4, 1, 'blue')).toBe(true);
    expect(isInPalace(4, 8, 'red')).toBe(true);
    expect(isInPalace(4, 8, 'blue')).toBe(false);
    expect(isInPalace(2, 0)).toBe(false);
    expect(isInPalace(6, 9)).toBe(false);
    expect(isInPalace(4, 3)).toBe(false);
    expect(isInPalace(4, 6)).toBe(false);
    expect(getAllIntersections().filter((p) => isInPalace(p.x, p.y))).toHaveLength(18);
  });

  it('has diagonals crossing at the palace center', () => {
    expect(getPalaceDiagonals('blue')).toEqual([
      [{ x: 3, y: 0 }, { x: 5, y: 2 }],
      [{ x: 5, y: 0 }, { x: 3, y: 2 }],
    ]);
    expect(getPalaceDiagonals('red')).toEqual([
      [{ x: 3, y: 7 }, { x: 5, y: 9 }],
      [{ x: 5, y: 7 }, { x: 3, y: 9 }],
    ]);
  });
});

describe('river', () => {
  it('splits the board between y=4 and y=5', () => {
    for (let y = 0; y <= 4; y++) expect(getBoardHalf(y)).toBe('blue');
    for (let y = 5; y <= 9; y++) expect(getBoardHalf(y)).toBe('red');
  });

  it('detects crossing the river', () => {
    expect(crossesRiver(4, 5)).toBe(true);
    expect(crossesRiver(5, 4)).toBe(true);
    expect(crossesRiver(3, 4)).toBe(false);
    expect(crossesRiver(5, 6)).toBe(false);
    expect(crossesRiver(0, 9)).toBe(true);
  });

  it('knows each side’s home half', () => {
    expect(isOnOwnSide(6, 'red')).toBe(true);
    expect(isOnOwnSide(4, 'red')).toBe(false);
    expect(isOnOwnSide(3, 'blue')).toBe(true);
    expect(isOnOwnSide(5, 'blue')).toBe(false);
  });

  it('rejects ranks outside the board', () => {
    expect(() => getBoardHalf(-1)).toThrow(RangeError);
    expect(() => getBoardHalf(10)).toThrow(RangeError);
  });
});
