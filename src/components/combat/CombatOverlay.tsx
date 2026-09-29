import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { playCombatImpact } from '../../audio/index.ts';
import type { CombatState, UiAction } from '../../game/controller.ts';
import { CombatCard } from './CombatCard.tsx';
import { CombatImpact } from './CombatImpact.tsx';
import { getImpactProfile } from './combatFx.ts';
import { COMBAT_TIMELINE, STAGE_TIMES, reached } from './combatTimeline.ts';
import type { CombatStage } from './combatTimeline.ts';
import { useReducedMotion } from './useReducedMotion.ts';

interface CombatOverlayProps {
  combat: CombatState;
  dispatch: (action: UiAction) => void;
}

/**
 * The single combat presentation for every capture (human or AI). Runs the
 * fixed timeline, plays the impact FX, then dispatches combatComplete, which
 * is when the controller calls applyMove. Contains no Xiangqi rules. Covers
 * and blocks the game while active.
 */
export function CombatOverlay({ combat, dispatch }: CombatOverlayProps) {
  const [stage, setStage] = useState<CombatStage>('open');
  const reducedMotion = useReducedMotion();
  const { id, attacker, defender } = combat;

  useEffect(() => {
    setStage('open');
    const timers = STAGE_TIMES.map(([s, t]) => window.setTimeout(() => setStage(s), t));
    timers.push(
      window.setTimeout(() => {
        dispatch({ type: 'combatPhase', id, phase: 'impact' });
        playCombatImpact(attacker, defender);
      }, COMBAT_TIMELINE.impact),
      window.setTimeout(() => dispatch({ type: 'combatPhase', id, phase: 'complete' }), COMBAT_TIMELINE.end),
      window.setTimeout(() => dispatch({ type: 'combatComplete', id }), COMBAT_TIMELINE.close),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // attacker/defender are fixed for a given combat id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatch]);

  const impact = stage === 'impact';
  const profile = getImpactProfile(attacker.type, reducedMotion);
  const classes = [
    'combat-overlay',
    `combat-overlay--${attacker.side}`,
    `combat-overlay--${stage}`,
    reducedMotion && 'combat-overlay--reduced',
  ];

  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      style={{ '--fx-flash': profile.flash } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="Combat"
      data-testid="combat-overlay"
      data-phase={combat.phase}
      data-stage={stage}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      onClick={(e) => e.stopPropagation()}
    >
      {impact && <div className={`combat-flash combat-flash--${attacker.side}`} data-testid="combat-flash" />}
      <div className="combat-overlay__stage">
        <CombatCard
          role="attacker"
          piece={attacker}
          visible={reached(stage, 'attacker')}
          active={reached(stage, 'active') && !reached(stage, 'end')}
          impact={impact}
          defeated={false}
        />
        <div className="combat-clash">
          <div
            className={[
              'combat-vs',
              reached(stage, 'vs') && 'is-visible',
              impact && 'is-impact',
              reached(stage, 'end') && 'is-gone',
            ]
              .filter(Boolean)
              .join(' ')}
            data-testid="combat-vs"
          >
            VS
          </div>
          {impact && <CombatImpact attacker={attacker} defender={defender} reducedMotion={reducedMotion} />}
        </div>
        <CombatCard
          role="defender"
          piece={defender}
          visible={reached(stage, 'defender')}
          active={reached(stage, 'active') && !reached(stage, 'end')}
          impact={impact}
          defeated={reached(stage, 'end')}
        />
      </div>
    </div>
  );
}
