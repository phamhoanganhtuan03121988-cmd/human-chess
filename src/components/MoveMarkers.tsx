import type { Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

/** Clickable area around the intersection and the visible dot, in board units. */
const HIT_SIZE = 0.7;
const DOT_SIZE = 0.2;
/** Capture reticle diameter, in board units. */
const RETICLE_SIZE = 0.62;

interface MoveMarkersProps {
  /** Legal destinations that are empty. */
  targets: readonly Position[];
  /** Legal captures (the enemy piece itself is clicked; the reticle is visual only). */
  captureTargets?: readonly Position[];
  /** Hovered position, to emphasise a hovered capture target. */
  hovered?: Position | null;
  onSelectTarget: (position: Position) => void;
}

const same = (a: Position | null | undefined, b: Position) => !!a && a.x === b.x && a.y === b.y;

/** Legal-move dots and capture reticles, each centered exactly on its intersection. */
export function MoveMarkers({ targets, captureTargets = [], hovered = null, onSelectTarget }: MoveMarkersProps) {
  return (
    <div className="board__layer board__layer--markers">
      {targets.map((p) => (
        <BoardAnchor key={`${p.x},${p.y}`} x={p.x} y={p.y}>
          <button
            type="button"
            className="move-marker"
            aria-label={`Move to ${p.x},${p.y}`}
            data-testid="move-marker"
            data-x={p.x}
            data-y={p.y}
            style={{ width: boardUnits(HIT_SIZE), height: boardUnits(HIT_SIZE) }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTarget(p);
            }}
          >
            <span className="move-marker__dot" style={{ width: boardUnits(DOT_SIZE), height: boardUnits(DOT_SIZE) }} />
          </button>
        </BoardAnchor>
      ))}
      {captureTargets.map((p) => (
        <BoardAnchor key={`c${p.x},${p.y}`} x={p.x} y={p.y}>
          <span
            className={same(hovered, p) ? 'capture-reticle is-hovered' : 'capture-reticle'}
            data-testid="capture-reticle"
            data-x={p.x}
            data-y={p.y}
            aria-hidden="true"
            style={{ width: boardUnits(RETICLE_SIZE), height: boardUnits(RETICLE_SIZE) }}
          />
        </BoardAnchor>
      ))}
    </div>
  );
}
