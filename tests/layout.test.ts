import { describe, expect, it } from 'vitest';
import {
  BOARD_ASPECT_RATIO,
  BOARD_HEIGHT,
  BOARD_MARGIN,
  BOARD_WIDTH,
  getBoardCenter,
  getBoardPoint,
  getIntersectionPixelPosition,
  getIntersectionPosition,
} from '../src/board/layout.ts';

// With a 0.5-unit margin on a 9 × 10 unit board:
//   left(x) = (0.5 + x) / 9 * 100,  top(y) = (0.5 + y) / 10 * 100
const left = (x: number) => ((0.5 + x) / 9) * 100;
const top = (y: number) => ((0.5 + y) / 10) * 100;

describe('board layout', () => {
  it('has a 9:10 board with lines inset by the margin', () => {
    expect(BOARD_WIDTH).toBe(9);
    expect(BOARD_HEIGHT).toBe(10);
    expect(BOARD_ASPECT_RATIO).toBeCloseTo(0.9);
    expect(BOARD_MARGIN).toBe(0.5);
  });

  it('maps the four corner intersections to the four grid corners', () => {
    expect(getIntersectionPosition(0, 0)).toEqual({ left: left(0), top: top(0) });
    expect(getIntersectionPosition(8, 0)).toEqual({ left: left(8), top: top(0) });
    expect(getIntersectionPosition(0, 9)).toEqual({ left: left(0), top: top(9) });
    expect(getIntersectionPosition(8, 9)).toEqual({ left: left(8), top: top(9) });

    expect(getBoardPoint(0, 0)).toEqual({ x: 0.5, y: 0.5 });
    expect(getBoardPoint(8, 0)).toEqual({ x: 8.5, y: 0.5 });
    expect(getBoardPoint(0, 9)).toEqual({ x: 0.5, y: 9.5 });
    expect(getBoardPoint(8, 9)).toEqual({ x: 8.5, y: 9.5 });
  });

  it('corners are symmetric about the board center', () => {
    const tl = getIntersectionPosition(0, 0);
    const br = getIntersectionPosition(8, 9);
    expect(tl.left + br.left).toBeCloseTo(100);
    expect(tl.top + br.top).toBeCloseTo(100);
    expect(getBoardCenter()).toEqual({ x: 4.5, y: 5 });
  });

  it('spaces intersections evenly (positions are on lines, not cell centers)', () => {
    for (let x = 0; x < 8; x++) {
      expect(getBoardPoint(x + 1, 0).x - getBoardPoint(x, 0).x).toBe(1);
    }
    for (let y = 0; y < 9; y++) {
      expect(getBoardPoint(0, y + 1).y - getBoardPoint(0, y).y).toBe(1);
    }
    // Every intersection is an integer offset from the first line: never a half-cell offset.
    for (let x = 0; x <= 8; x++) {
      for (let y = 0; y <= 9; y++) {
        const p = getBoardPoint(x, y);
        expect(p.x - BOARD_MARGIN).toBe(x);
        expect(p.y - BOARD_MARGIN).toBe(y);
      }
    }
  });

  it('pawn (0,6) and cannon (1,7) sit exactly on their file/rank lines', () => {
    expect(getBoardPoint(0, 6)).toEqual({ x: getBoardPoint(0, 0).x, y: getBoardPoint(8, 6).y });
    expect(getBoardPoint(1, 7)).toEqual({ x: getBoardPoint(1, 0).x, y: getBoardPoint(8, 7).y });
  });

  it('is resolution independent', () => {
    for (const size of [
      { width: 360, height: 400 },
      { width: 900, height: 1000 },
      { width: 1800, height: 2000 },
    ]) {
      const p = getIntersectionPixelPosition(1, 7, size);
      expect(p.x / size.width).toBeCloseTo(left(1) / 100);
      expect(p.y / size.height).toBeCloseTo(top(7) / 100);
    }
  });

  it('rejects invalid coordinates', () => {
    expect(() => getIntersectionPosition(9, 0)).toThrow(RangeError);
    expect(() => getIntersectionPosition(0, 10)).toThrow(RangeError);
    expect(() => getBoardPoint(-1, 0)).toThrow(RangeError);
    expect(() => getBoardPoint(0.5, 0)).toThrow(RangeError);
  });
});
