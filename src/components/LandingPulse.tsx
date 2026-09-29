import { useEffect, useState } from 'react';
import type { Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

/** Pulse lifetime; the element is removed afterwards (no leftovers). */
export const LANDING_PULSE_MS = 260;
const SIZE = 0.9;

/**
 * Small radial pulse on the intersection where a piece just landed.
 * Mount with a fresh key per move; it removes itself after the animation.
 * The crimson capture variant marks a capture played without the combat scene (replay).
 */
export function LandingPulse({ at, capture = false }: { at: Position; capture?: boolean }) {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setAlive(false), LANDING_PULSE_MS);
    return () => window.clearTimeout(t);
  }, []);
  if (!alive) return null;
  return (
    <BoardAnchor x={at.x} y={at.y}>
      <span
        className={capture ? 'landing-pulse landing-pulse--capture' : 'landing-pulse'}
        data-testid="landing-pulse"
        data-x={at.x}
        data-y={at.y}
        style={{ width: boardUnits(SIZE), height: boardUnits(SIZE) }}
      />
    </BoardAnchor>
  );
}
