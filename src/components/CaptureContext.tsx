import type { CSSProperties } from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH, getBoardPoint } from '../board/layout.ts';
import { SIDE_NAMES_VI, getPieceDisplayName } from '../config/pieceIdentity.ts';
import type { CombatState } from '../game/controller.ts';
import { CAPTURE_CONTEXT } from './combat/combatTimeline.ts';

/** Gap left at each end of the trajectory so it never crosses a token face. */
const END_GAP = 0.42;

/**
 * Board-level context for a capture, shown before the combat overlay:
 * a trajectory from the attacker to the defender, an impact marker on the
 * defender and a compact "MÃ ĐỎ ⚔ TỐT XANH" label in the river band (which
 * holds no intersections). The tokens themselves are highlighted by
 * PieceLayer; this layer never blocks input (input is locked anyway).
 */
export function CaptureContext({ combat, reducedMotion }: { combat: CombatState; reducedMotion: boolean }) {
  const { attacker, defender, move } = combat;
  const a = getBoardPoint(move.from.x, move.from.y);
  const d = getBoardPoint(move.to.x, move.to.y);
  const len = Math.hypot(d.x - a.x, d.y - a.y);
  const ux = (d.x - a.x) / len;
  const uy = (d.y - a.y) / len;
  const gap = Math.min(END_GAP, len / 2 - 0.05);
  const x1 = a.x + ux * gap;
  const y1 = a.y + uy * gap;
  const x2 = d.x - ux * gap;
  const y2 = d.y - uy * gap;
  const att = getPieceDisplayName(attacker.side, attacker.type);
  const def = getPieceDisplayName(defender.side, defender.type);
  const timing = {
    '--ctx-trajectory': `${CAPTURE_CONTEXT.trajectory}ms`,
    '--ctx-label': `${CAPTURE_CONTEXT.label}ms`,
    '--ctx-draw': `${CAPTURE_CONTEXT.label - CAPTURE_CONTEXT.trajectory}ms`,
  } as CSSProperties;
  const gradientId = `capture-gradient-${combat.id}`;

  return (
    <div
      className={`board__layer board__layer--context${reducedMotion ? ' is-reduced' : ''}`}
      style={timing}
      data-testid="capture-context"
      data-from={`${move.from.x},${move.from.y}`}
      data-to={`${move.to.x},${move.to.y}`}
    >
      <svg className="capture-context__svg" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
            <stop offset="0" stopColor="#f6e3a1" />
            <stop offset="1" stopColor="#e0463a" />
          </linearGradient>
        </defs>
        <line
          className="capture-context__trail"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          pathLength={1}
          stroke={`url(#${gradientId})`}
          data-testid="capture-trajectory"
        />
        <line className="capture-context__streak" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
        <circle className="capture-context__impact" cx={d.x} cy={d.y} r={0.5} data-testid="capture-impact" />
      </svg>
      <div className="capture-context__label" role="status" data-testid="capture-label">
        <span className={`capture-context__piece capture-context__piece--${attacker.side}`}>
          {att.name} {SIDE_NAMES_VI[attacker.side]}
        </span>
        <span className="capture-context__sword" aria-label="tấn công">
          ⚔
        </span>
        <span className={`capture-context__piece capture-context__piece--${defender.side}`}>
          {def.name} {SIDE_NAMES_VI[defender.side]}
        </span>
      </div>
    </div>
  );
}
