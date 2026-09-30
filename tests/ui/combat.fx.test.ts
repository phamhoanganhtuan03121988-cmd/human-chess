import { describe, expect, it } from 'vitest';
import {
  IMPACT_PROFILES,
  MAX_PARTICLES,
  MIN_PARTICLES,
  REDUCED_PARTICLES,
  buildParticles,
  getImpactProfile,
} from '../../src/components/combat/combatFx.ts';
import { COMBAT_TIMELINE, STAGE_TIMES, reached } from '../../src/components/combat/combatTimeline.ts';
import { PIECE_TYPES } from '../../src/config/assets.ts';

describe('combat timeline', () => {
  it('follows the specified sequence', () => {
    expect(COMBAT_TIMELINE).toEqual({
      attackerEnter: 200, defenderEnter: 400, vsAppear: 700, active: 900, impact: 1000, end: 1400, close: 1600,
    });
    expect(STAGE_TIMES.map(([s]) => s)).toEqual(['attacker', 'defender', 'vs', 'active', 'impact', 'end']);
    expect(reached('impact', 'active')).toBe(true);
    expect(reached('vs', 'active')).toBe(false);
  });
});

describe('impact profiles', () => {
  it('gives each piece type a personality within the particle budget', () => {
    expect(Object.fromEntries(PIECE_TYPES.map((t) => [t, IMPACT_PROFILES[t].style]))).toEqual({
      general: 'regal', advisor: 'slash', elephant: 'heavy', rook: 'heavy', knight: 'streak', cannon: 'blast', pawn: 'light',
    });
    for (const t of PIECE_TYPES) {
      const p = IMPACT_PROFILES[t];
      expect(p.particles).toBeGreaterThanOrEqual(MIN_PARTICLES);
      expect(p.particles).toBeLessThanOrEqual(MAX_PARTICLES);
      expect(p.shakePx).toBeGreaterThanOrEqual(2);
      expect(p.shakePx).toBeLessThanOrEqual(4);
      expect(p.flash).toBeLessThanOrEqual(0.8);
    }
  });

  it('cannon is the strongest impact and pawn the smallest', () => {
    const all = PIECE_TYPES.map((t) => IMPACT_PROFILES[t]);
    expect(IMPACT_PROFILES.cannon.particles).toBe(Math.max(...all.map((p) => p.particles)));
    expect(IMPACT_PROFILES.cannon.flash).toBe(Math.max(...all.map((p) => p.flash)));
    expect(IMPACT_PROFILES.cannon.smoke).toBeGreaterThan(0);
    expect(IMPACT_PROFILES.pawn.particles).toBe(Math.min(...all.map((p) => p.particles)));
    expect(IMPACT_PROFILES.pawn.flash).toBe(Math.min(...all.map((p) => p.flash)));
  });

  it('reduced motion removes shake and smoke and cuts particles', () => {
    for (const t of PIECE_TYPES) {
      const r = getImpactProfile(t, true);
      expect(r.particles).toBe(REDUCED_PARTICLES);
      expect(r.shakePx).toBe(0);
      expect(r.smoke).toBe(0);
      expect(r.flash).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('particles', () => {
  it('builds exactly the profile count, deterministically', () => {
    for (const t of PIECE_TYPES) {
      const p = getImpactProfile(t);
      const a = buildParticles(p);
      expect(a).toHaveLength(p.particles);
      expect(buildParticles(p)).toEqual(a);
    }
  });

  it('flows from the attacker toward the defender', () => {
    for (const t of PIECE_TYPES) {
      const parts = buildParticles(getImpactProfile(t));
      const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
      const attacker = parts.filter((p) => p.owner === 'attacker');
      const defender = parts.filter((p) => p.owner === 'defender');
      expect(attacker.length).toBeGreaterThan(defender.length);
      expect(defender.length).toBeGreaterThanOrEqual(2);
      // Defender fragments travel further into the defender's side (+x).
      expect(mean(defender.map((p) => p.dx))).toBeGreaterThan(mean(attacker.map((p) => p.dx)));
      expect(defender.every((p) => p.dx > 0)).toBe(true); // never thrown back at the attacker
      if (IMPACT_PROFILES[t].spread <= 60) expect(parts.every((p) => p.dx > 0)).toBe(true);
    }
  });

  it('knight streak is narrow; cannon blast is all around', () => {
    const knight = buildParticles(getImpactProfile('knight'));
    const cannon = buildParticles(getImpactProfile('cannon'));
    expect(Math.max(...knight.map((p) => Math.abs(p.angle)))).toBeLessThanOrEqual(35);
    expect(cannon.some((p) => p.dx < 0)).toBe(true);
  });
});
