/**
 * Fixed combat presentation timeline (ms from the capture click).
 * The move is applied to the engine at CLOSE.
 */
export const COMBAT_TIMELINE = {
  attackerEnter: 200,
  defenderEnter: 400,
  vsAppear: 700,
  /** Both portraits become visually active. */
  active: 900,
  impact: 1000,
  end: 1400,
  close: 1600,
} as const;

/** Visual stages of the overlay, in order. */
export type CombatStage = 'open' | 'attacker' | 'defender' | 'vs' | 'active' | 'impact' | 'end';

export const STAGE_TIMES: ReadonlyArray<readonly [CombatStage, number]> = [
  ['attacker', COMBAT_TIMELINE.attackerEnter],
  ['defender', COMBAT_TIMELINE.defenderEnter],
  ['vs', COMBAT_TIMELINE.vsAppear],
  ['active', COMBAT_TIMELINE.active],
  ['impact', COMBAT_TIMELINE.impact],
  ['end', COMBAT_TIMELINE.end],
];

const ORDER: readonly CombatStage[] = ['open', 'attacker', 'defender', 'vs', 'active', 'impact', 'end'];

/** True once `stage` has reached `target` in the timeline. */
export function reached(stage: CombatStage, target: CombatStage): boolean {
  return ORDER.indexOf(stage) >= ORDER.indexOf(target);
}

/**
 * Capture context shown on the board before the combat overlay (ms):
 * attacker/defender highlight → trajectory → label, then the overlay opens.
 */
export const CAPTURE_CONTEXT = {
  /** Phase A: attacker and defender highlighted, other pieces dimmed. */
  highlight: 0,
  /** Phase B: the trajectory draws from attacker to defender. */
  trajectory: 300,
  /** Phase C: "MÃ ĐỎ ⚔ TỐT XANH" label + impact marker on the defender. */
  label: 600,
  /** Hand-off to the combat overlay. */
  end: 950,
} as const;
/** Reduced motion: same information, shown at once and shorter. */
export const CAPTURE_CONTEXT_REDUCED_MS = 500;
