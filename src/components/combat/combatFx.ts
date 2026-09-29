/**
 * Combat impact FX profiles and particle layout (pure, deterministic).
 *
 * One effect system for every capture. The attacking piece type picks a
 * small "personality" modifier; colours come from the attacker and defender
 * sides, so Blue attacking Red works exactly like Red attacking Blue.
 *
 * Geometry is in "fx units" along the attack axis: +x points from the
 * attacker toward the defender, 1 unit ≈ 100 px at full card size. The CSS
 * rotates the axis to match the card layout (stacked or side by side).
 */
import type { PieceType } from '../../engine/index.ts';

export type ImpactStyle = 'blast' | 'heavy' | 'streak' | 'slash' | 'regal' | 'light';

export interface ImpactProfile {
  readonly style: ImpactStyle;
  /** Spark / fragment count (12–24). */
  readonly particles: number;
  /** Half-angle of the forward spark cone, degrees (180 = all around). */
  readonly spread: number;
  /** Typical travel distance, fx units. */
  readonly distance: number;
  /** Particle size multiplier. */
  readonly size: number;
  /** Peak flash opacity (0–1). */
  readonly flash: number;
  /** Smoke / dust puffs. */
  readonly smoke: number;
  /** Board shake amplitude in px (2–4). */
  readonly shakePx: number;
}

export const IMPACT_PROFILES: Readonly<Record<PieceType, ImpactProfile>> = {
  // Strongest: explosive sparks all around, flash and smoke.
  cannon: { style: 'blast', particles: 24, spread: 180, distance: 1.0, size: 1.2, flash: 0.75, smoke: 4, shakePx: 4 },
  // Heavy, driving force along the attack line.
  rook: { style: 'heavy', particles: 20, spread: 40, distance: 1.05, size: 1.15, flash: 0.55, smoke: 0, shakePx: 3 },
  // Heavy stomp: wide fragments and dust.
  elephant: { style: 'heavy', particles: 18, spread: 80, distance: 0.8, size: 1.25, flash: 0.5, smoke: 2, shakePx: 3 },
  // Fast slash: narrow, long streak.
  knight: { style: 'streak', particles: 16, spread: 22, distance: 1.2, size: 0.8, flash: 0.45, smoke: 0, shakePx: 2 },
  // Elegant slash arc, few sparks.
  advisor: { style: 'slash', particles: 14, spread: 45, distance: 0.7, size: 0.8, flash: 0.4, smoke: 0, shakePx: 2 },
  // Dramatic but restrained, gilded.
  general: { style: 'regal', particles: 18, spread: 70, distance: 0.85, size: 1.0, flash: 0.55, smoke: 0, shakePx: 3 },
  // Smallest impact.
  pawn: { style: 'light', particles: 12, spread: 50, distance: 0.6, size: 0.7, flash: 0.3, smoke: 0, shakePx: 2 },
};

export const MIN_PARTICLES = 12;
export const MAX_PARTICLES = 24;
/** Particles kept when the user prefers reduced motion. */
export const REDUCED_PARTICLES = 6;

/** Profile for a capture by `attackerType`, optionally reduced for prefers-reduced-motion. */
export function getImpactProfile(attackerType: PieceType, reducedMotion = false): ImpactProfile {
  const p = IMPACT_PROFILES[attackerType];
  if (!reducedMotion) return p;
  return { ...p, particles: REDUCED_PARTICLES, smoke: 0, shakePx: 0, flash: Math.min(p.flash, 0.3) };
}

export interface Particle {
  /** Final offset along / across the attack axis, fx units. */
  readonly dx: number;
  readonly dy: number;
  /** Size multiplier. */
  readonly size: number;
  /** Start delay, ms. */
  readonly delay: number;
  /** Whose colour: sparks from the attacker, fragments knocked off the defender. */
  readonly owner: 'attacker' | 'defender';
  /** Rotation of the (elongated) particle, degrees, pointing along its path. */
  readonly angle: number;
}

/** Deterministic pseudo-random in [0, 1) from an index and salt. */
function hash(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Particle layout for a profile. Two thirds are attacker sparks thrown
 * forward from the clash point; one third are defender fragments that fly
 * further into the defender's side.
 */
export function buildParticles(profile: ImpactProfile): Particle[] {
  const out: Particle[] = [];
  const n = profile.particles;
  const defenderCount = Math.max(2, Math.round(n / 3));
  const attackerCount = n - defenderCount;
  /** Defender fragments always scatter forward, into the defender's side. */
  const DEFENDER_SPREAD = Math.min(profile.spread, 45);
  for (let i = 0; i < n; i++) {
    const owner = i < attackerCount ? 'attacker' : 'defender';
    const j = owner === 'attacker' ? i : i - attackerCount;
    const m = owner === 'attacker' ? attackerCount : defenderCount;
    const spread = owner === 'attacker' ? profile.spread : DEFENDER_SPREAD;
    // Spread evenly across the cone, jittered deterministically.
    const t = m === 1 ? 0.5 : j / (m - 1);
    const jitter = (hash(i, 1) - 0.5) * 0.35;
    const angleDeg = (t * 2 - 1 + jitter) * spread;
    const rad = (angleDeg * Math.PI) / 180;
    const reach = profile.distance * (owner === 'defender' ? 1.15 : 0.7 + hash(i, 2) * 0.45);
    const dx = Math.cos(rad) * reach + (owner === 'defender' ? 0.25 : 0);
    const dy = Math.sin(rad) * reach;
    out.push({
      dx: round(dx),
      dy: round(dy),
      size: round(profile.size * (0.6 + hash(i, 3) * 0.8)),
      delay: Math.round(hash(i, 4) * 60),
      owner,
      angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
    });
  }
  return out;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
