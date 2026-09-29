import { useEffect, useState } from 'react';
import type { CombatState, UiAction } from '../../game/controller.ts';
import { CombatCard } from './CombatCard.tsx';
import { COMBAT_TIMELINE, STAGE_TIMES, reached } from './combatTimeline.ts';
import type { CombatStage } from './combatTimeline.ts';

interface CombatOverlayProps {
  combat: CombatState;
  dispatch: (action: UiAction) => void;
}

/**
 * Combat presentation for a capture (V1). Runs the fixed timeline, then
 * dispatches combatComplete, which is when the controller calls applyMove.
 * Contains no Xiangqi rules. Covers and blocks the game while active.
 */
export function CombatOverlay({ combat, dispatch }: CombatOverlayProps) {
  const [stage, setStage] = useState<CombatStage>('open');
  const { id } = combat;

  useEffect(() => {
    setStage('open');
    const timers = STAGE_TIMES.map(([s, t]) => window.setTimeout(() => setStage(s), t));
    timers.push(
      window.setTimeout(() => dispatch({ type: 'combatPhase', id, phase: 'impact' }), COMBAT_TIMELINE.impact),
      window.setTimeout(() => dispatch({ type: 'combatPhase', id, phase: 'complete' }), COMBAT_TIMELINE.end),
      window.setTimeout(() => dispatch({ type: 'combatComplete', id }), COMBAT_TIMELINE.close),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [id, dispatch]);

  const attackerSide = combat.attacker.side;
  return (
    <div
      className={`combat-overlay combat-overlay--${attackerSide} combat-overlay--${stage}`}
      role="dialog"
      aria-modal="true"
      aria-label="Combat"
      data-testid="combat-overlay"
      data-phase={combat.phase}
      data-stage={stage}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="combat-overlay__stage">
        <CombatCard
          role="attacker"
          piece={combat.attacker}
          visible={reached(stage, 'attacker')}
          impact={stage === 'impact'}
          defeated={false}
        />
        <div className={reached(stage, 'vs') ? 'combat-vs is-visible' : 'combat-vs'} data-testid="combat-vs">
          VS
        </div>
        <CombatCard
          role="defender"
          piece={combat.defender}
          visible={reached(stage, 'defender')}
          impact={stage === 'impact'}
          defeated={reached(stage, 'end')}
        />
      </div>
    </div>
  );
}
