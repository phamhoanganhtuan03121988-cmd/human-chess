import type { CSSProperties } from 'react';
import type { Piece } from '../../engine/index.ts';
import { buildParticles, getImpactProfile } from './combatFx.ts';

interface CombatImpactProps {
  attacker: Piece;
  defender: Piece;
  reducedMotion: boolean;
}

/**
 * The clash at the impact moment: shockwave, attack streak / slash, sparks
 * from the attacker, fragments off the defender, and smoke for heavy hits.
 * Pure CSS animations (no loops); mounted only for the impact stage, so no
 * particle elements outlive it. Oriented along the attack axis by CSS.
 */
export function CombatImpact({ attacker, defender, reducedMotion }: CombatImpactProps) {
  const profile = getImpactProfile(attacker.type, reducedMotion);
  const particles = buildParticles(profile);
  const style = { '--fx-flash': profile.flash, '--fx-size': profile.size } as CSSProperties;

  return (
    <div
      className={`combat-impact combat-impact--${profile.style} fx-from-${attacker.side} fx-to-${defender.side}`}
      style={style}
      data-testid="combat-impact"
      data-attacker-side={attacker.side}
      data-defender-side={defender.side}
      data-attacker-type={attacker.type}
      data-defender-type={defender.type}
      data-effect={profile.style}
      aria-hidden="true"
    >
      <span className="fx-core" />
      <span className="fx-ring" />
      {(profile.style === 'streak' || profile.style === 'heavy' || profile.style === 'blast') && (
        <span className="fx-streak" data-testid="fx-streak" />
      )}
      {(profile.style === 'slash' || profile.style === 'regal') && <span className="fx-slash" data-testid="fx-slash" />}
      {particles.map((p, i) => (
        <span
          key={i}
          className={`fx-particle fx-particle--${p.owner}`}
          data-testid="fx-particle"
          style={
            {
              '--dx': p.dx,
              '--dy': p.dy,
              '--s': p.size,
              '--a': `${p.angle}deg`,
              animationDelay: `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: profile.smoke }, (_, i) => (
        <span
          key={`s${i}`}
          className="fx-smoke"
          data-testid="fx-smoke"
          style={{ '--i': i, '--n': profile.smoke } as CSSProperties}
        />
      ))}
    </div>
  );
}
