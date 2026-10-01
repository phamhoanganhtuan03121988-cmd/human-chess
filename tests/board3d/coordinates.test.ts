import { describe, expect, it } from 'vitest';
import { engineToWorld, worldToEngine, WORLD_CENTER_X, WORLD_CENTER_Z } from '../../src/board3d/coordinates.ts';
import type { Position } from '../../src/engine/types.ts';

describe('3D coordinates mapping', () => {
  it('maps center of the board to (0, 0) in world coordinates', () => {
    // Center intersection is at x=4, y=4.5 (river between ranks 4 and 5)
    const redWorld = engineToWorld({ x: 4, y: 4.5 } as Position, 'red');
    expect(redWorld.x).toBeCloseTo(0);
    expect(redWorld.z).toBeCloseTo(0);

    const blueWorld = engineToWorld({ x: 4, y: 4.5 } as Position, 'blue');
    expect(blueWorld.x).toBeCloseTo(0);
    expect(blueWorld.z).toBeCloseTo(0);
  });

  it('maps Red perspective corners correctly', () => {
    // Top-left (0, 0)
    const topLeft = engineToWorld({ x: 0, y: 0 }, 'red');
    expect(topLeft.x).toBeCloseTo(-WORLD_CENTER_X); // -4.0
    expect(topLeft.z).toBeCloseTo(-WORLD_CENTER_Z); // -4.5

    // Bottom-right (8, 9)
    const bottomRight = engineToWorld({ x: 8, y: 9 }, 'red');
    expect(bottomRight.x).toBeCloseTo(WORLD_CENTER_X); // 4.0
    expect(bottomRight.z).toBeCloseTo(WORLD_CENTER_Z); // 4.5

    // Red General (4, 9)
    const redGen = engineToWorld({ x: 4, y: 9 }, 'red');
    expect(redGen.x).toBeCloseTo(0);
    expect(redGen.z).toBeCloseTo(4.5); // Near the player in Red perspective

    // Blue General (4, 0)
    const blueGen = engineToWorld({ x: 4, y: 0 }, 'red');
    expect(blueGen.x).toBeCloseTo(0);
    expect(blueGen.z).toBeCloseTo(-4.5); // Far from the player in Red perspective
  });

  it('inverts coordinates 180 degrees under Blue perspective', () => {
    // In Blue perspective, Blue General (4, 0) sits at bottom near the camera
    const blueGen = engineToWorld({ x: 4, y: 0 }, 'blue');
    expect(blueGen.x).toBeCloseTo(0);
    expect(blueGen.z).toBeCloseTo(4.5); // Near the camera!

    // Red General (4, 9) sits at top far from camera
    const redGen = engineToWorld({ x: 4, y: 9 }, 'blue');
    expect(redGen.x).toBeCloseTo(0);
    expect(redGen.z).toBeCloseTo(-4.5); // Far from the camera!

    // Top-left engine (0, 0) becomes bottom-right in Blue view
    const topLeft = engineToWorld({ x: 0, y: 0 }, 'blue');
    expect(topLeft.x).toBeCloseTo(WORLD_CENTER_X);
    expect(topLeft.z).toBeCloseTo(WORLD_CENTER_Z);
  });

  it('round-trips all 90 valid intersections in both perspectives', () => {
    for (let x = 0; x <= 8; x++) {
      for (let y = 0; y <= 9; y++) {
        const pos: Position = { x, y };

        // Red perspective round-trip
        const redW = engineToWorld(pos, 'red');
        const redRecovered = worldToEngine(redW.x, redW.z, 'red');
        expect(redRecovered).toEqual(pos);

        // Blue perspective round-trip
        const blueW = engineToWorld(pos, 'blue');
        const blueRecovered = worldToEngine(blueW.x, blueW.z, 'blue');
        expect(blueRecovered).toEqual(pos);
      }
    }
  });

  it('rejects coordinates outside the playable board intersections', () => {
    // Far off the board
    expect(worldToEngine(10, 10, 'red')).toBeNull();
    expect(worldToEngine(-10, -10, 'red')).toBeNull();

    // In between intersections (exceeding hit tolerance)
    expect(worldToEngine(0.5, 0.5, 'red', 0.2)).toBeNull();
  });
});
