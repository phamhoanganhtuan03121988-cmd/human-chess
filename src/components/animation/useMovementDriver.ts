import { useEffect } from 'react';
import type { MovementState, UiAction } from '../../game/controller.ts';
import { getMoveDuration } from './movement.ts';

/**
 * Completes the current movement animation after its duration by
 * dispatching movementComplete with the movement id. One timer per
 * movement; cleared on unmount, and stale ids are ignored by the controller.
 */
export function useMovementDriver(
  movement: MovementState | null,
  dispatch: (action: UiAction) => void,
  reducedMotion: boolean,
): void {
  const id = movement?.id ?? null;
  useEffect(() => {
    if (id === null) return;
    const timer = window.setTimeout(() => dispatch({ type: 'movementComplete', id }), getMoveDuration(reducedMotion));
    return () => window.clearTimeout(timer);
    // Duration is fixed when the movement starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatch]);
}
