/**
 * Synthesized sound recipes (Web Audio, no audio files).
 *
 * Aesthetic: restrained wuxia / historical strategy — wooden and stone
 * clicks, low drums, bronze pings. Every recipe schedules a few short-lived
 * nodes that stop themselves; nothing loops.
 */
import type { PieceType } from '../engine/index.ts';

export interface Out {
  readonly ctx: AudioContext;
  /** Destination bus for this sound (already level-scaled). */
  readonly out: AudioNode;
  /** Start time (AudioContext seconds). */
  readonly t: number;
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function whiteNoise(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
}

/** A pitched partial with a fast attack and exponential decay. */
export function tone(o: Out, opts: ToneOpts): void {
  const { ctx, out } = o;
  const start = o.t + (opts.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, start + opts.dur);
  const attack = opts.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(opts.gain, 0.0002), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + opts.dur + 0.02);
}

interface NoiseOpts {
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
}

/** A filtered noise burst (clicks, cracks, whooshes, thumps' body). */
export function noise(o: Out, opts: NoiseOpts): void {
  const { ctx, out } = o;
  const start = o.t + (opts.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = opts.filter;
  f.frequency.setValueAtTime(opts.freq, start);
  if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, start + opts.dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  const attack = opts.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(opts.gain, 0.0002), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  src.connect(f).connect(g).connect(out);
  src.start(start, Math.random() * 0.5);
  src.stop(start + opts.dur + 0.02);
}

// ---- Board interaction -------------------------------------------------

/** Soft wooden/metal click when a piece is picked up (~50 ms). */
export function selectSound(o: Out): void {
  noise(o, { filter: 'bandpass', freq: 3200, q: 3, dur: 0.035, gain: 0.7 });
  tone(o, { type: 'triangle', freq: 1500, freqEnd: 1150, dur: 0.05, gain: 0.25 });
}

/** Barely-there tick when hovering a new interactive piece. */
export function hoverSound(o: Out): void {
  tone(o, { freq: 3400, dur: 0.018, gain: 0.5 });
}

/** Short wooden/stone click as the piece leaves (~70 ms). */
export function moveStartSound(o: Out): void {
  noise(o, { filter: 'bandpass', freq: 1900, q: 2.5, dur: 0.05, gain: 0.8 });
  tone(o, { type: 'triangle', freq: 640, freqEnd: 470, dur: 0.07, gain: 0.35 });
}

/** Deeper "tok" as the piece lands on the wooden board (~110 ms). */
export function landSound(o: Out): void {
  tone(o, { freq: 230, freqEnd: 140, dur: 0.11, gain: 0.9 });
  noise(o, { filter: 'lowpass', freq: 1100, dur: 0.06, gain: 0.5 });
  tone(o, { type: 'triangle', freq: 470, dur: 0.035, gain: 0.25 });
}

// ---- Capture / combat --------------------------------------------------

interface ImpactProfile {
  thump: [number, number];
  thumpDur: number;
  body: number; // lowpass cutoff of the noise body
  bodyDur: number;
  crack: number; // bandpass centre of the transient
  crackGain: number;
  bronze?: number; // optional low resonant ping (general)
}

/** Per piece: cannon deepest/strongest … pawn smallest. */
export const IMPACT_SOUND: Readonly<Record<PieceType, ImpactProfile>> = {
  cannon: { thump: [72, 34], thumpDur: 0.42, body: 1400, bodyDur: 0.34, crack: 2400, crackGain: 0.8 },
  rook: { thump: [88, 44], thumpDur: 0.32, body: 900, bodyDur: 0.24, crack: 2000, crackGain: 0.55 },
  elephant: { thump: [62, 36], thumpDur: 0.36, body: 520, bodyDur: 0.3, crack: 1200, crackGain: 0.35 },
  knight: { thump: [140, 80], thumpDur: 0.16, body: 2600, bodyDur: 0.09, crack: 4200, crackGain: 0.7 },
  advisor: { thump: [180, 120], thumpDur: 0.12, body: 3200, bodyDur: 0.12, crack: 5200, crackGain: 0.5 },
  general: { thump: [82, 46], thumpDur: 0.45, body: 800, bodyDur: 0.25, crack: 1800, crackGain: 0.4, bronze: 110 },
  pawn: { thump: [130, 82], thumpDur: 0.12, body: 1200, bodyDur: 0.08, crack: 2600, crackGain: 0.35 },
};

/** Main impact at 1000 ms: low thump + noise body + sharp transient. */
export function impactSound(o: Out, attacker: PieceType): void {
  const p = IMPACT_SOUND[attacker];
  tone(o, { freq: p.thump[0], freqEnd: p.thump[1], dur: p.thumpDur, gain: 1, attack: 0.003 });
  noise(o, { filter: 'lowpass', freq: p.body, dur: p.bodyDur, gain: 0.7 });
  noise(o, { filter: 'bandpass', freq: p.crack, q: 4, dur: 0.04, gain: p.crackGain });
  if (attacker === 'advisor') noise(o, { filter: 'bandpass', freq: 6000, freqEnd: 2500, q: 6, dur: 0.12, gain: 0.35 });
  if (p.bronze) tone(o, { freq: p.bronze, dur: 0.7, gain: 0.3, at: 0.01 });
}

/** Wooden/metal crack of the captured piece breaking (layered with the impact). */
export function captureSound(o: Out, defender: PieceType): void {
  const pitch = defender === 'pawn' ? 1.2 : defender === 'general' ? 0.8 : 1;
  noise(o, { filter: 'bandpass', freq: 1700 * pitch, q: 8, dur: 0.09, gain: 0.8, at: 0.012 });
  tone(o, { type: 'triangle', freq: 920 * pitch, freqEnd: 560 * pitch, dur: 0.06, gain: 0.3, at: 0.012 });
}

export type CombatCue = 'open' | 'attacker' | 'defender' | 'vs' | 'tension' | 'decay';

/** Quiet cues along the combat timeline (the impact itself is separate). */
export function combatCueSound(o: Out, cue: CombatCue): void {
  switch (cue) {
    case 'open': // atmospheric transition
      noise(o, { filter: 'bandpass', freq: 400, freqEnd: 1300, q: 1.2, dur: 0.32, gain: 0.5, attack: 0.08 });
      break;
    case 'attacker': // soft war-drum tap
      tone(o, { type: 'triangle', freq: 190, freqEnd: 120, dur: 0.1, gain: 0.8 });
      break;
    case 'defender':
      tone(o, { type: 'triangle', freq: 160, freqEnd: 100, dur: 0.1, gain: 0.8 });
      break;
    case 'vs': // bronze sting
      tone(o, { freq: 1320, dur: 0.35, gain: 0.35 });
      tone(o, { freq: 1985, dur: 0.22, gain: 0.15 });
      break;
    case 'tension': // short rising breath before the hit
      noise(o, { filter: 'bandpass', freq: 500, freqEnd: 1600, q: 2, dur: 0.1, gain: 0.5, attack: 0.07 });
      tone(o, { freq: 150, freqEnd: 240, dur: 0.1, gain: 0.3, attack: 0.07 });
      break;
    case 'decay': // very subtle tail
      tone(o, { freq: 90, dur: 0.4, gain: 0.25, attack: 0.02 });
      break;
  }
}

// ---- Game state ----------------------------------------------------------

/** Check warning: low note, then a short higher note. */
export function checkSound(o: Out): void {
  tone(o, { type: 'triangle', freq: 220, dur: 0.16, gain: 0.8 });
  tone(o, { type: 'triangle', freq: 330, dur: 0.22, gain: 0.7, at: 0.16 });
  tone(o, { freq: 660, dur: 0.18, gain: 0.12, at: 0.16 });
}

export type GameResult = 'checkmate' | 'stalemate' | 'general_captured';

export function gameOverSound(o: Out, result: GameResult): void {
  if (result === 'checkmate') {
    // Two war-drum hits and a dark minor swell (~1.5 s).
    tone(o, { freq: 70, freqEnd: 40, dur: 0.4, gain: 1 });
    tone(o, { freq: 70, freqEnd: 40, dur: 0.5, gain: 1, at: 0.26 });
    for (const [f, g] of [[110, 0.3], [130.8, 0.22], [164.8, 0.2]] as const) {
      tone(o, { type: 'triangle', freq: f, dur: 1.4, gain: g, attack: 0.15, at: 0.3 });
    }
  } else if (result === 'stalemate') {
    // Calm, unresolved open fifth with a suspended fourth (~1.2 s).
    for (const [f, g, at] of [[146.8, 0.3, 0], [220, 0.22, 0.05], [196, 0.18, 0.1]] as const) {
      tone(o, { freq: f, dur: 1.2, gain: g, attack: 0.2, at });
    }
  } else {
    // Strong final impact.
    tone(o, { freq: 60, freqEnd: 30, dur: 0.7, gain: 1 });
    noise(o, { filter: 'lowpass', freq: 900, dur: 0.5, gain: 0.8 });
    noise(o, { filter: 'bandpass', freq: 2000, q: 4, dur: 0.06, gain: 0.6 });
    tone(o, { freq: 98, dur: 1.2, gain: 0.25, attack: 0.05, at: 0.05 });
  }
}

/** Human turn: gentle two-note woodblock. AI turn: a soft low breath. */
export function turnSound(o: Out, role: 'human' | 'ai'): void {
  if (role === 'human') {
    tone(o, { type: 'triangle', freq: 660, dur: 0.06, gain: 0.6 });
    tone(o, { type: 'triangle', freq: 880, dur: 0.08, gain: 0.5, at: 0.07 });
  } else {
    tone(o, { freq: 330, freqEnd: 294, dur: 0.22, gain: 0.35, attack: 0.05 });
  }
}

/** New game: wooden clap and a rising pair of notes. */
export function newGameSound(o: Out): void {
  noise(o, { filter: 'bandpass', freq: 1500, q: 2, dur: 0.05, gain: 0.7 });
  tone(o, { type: 'triangle', freq: 440, dur: 0.1, gain: 0.5, at: 0.05 });
  tone(o, { type: 'triangle', freq: 660, dur: 0.14, gain: 0.45, at: 0.14 });
}
