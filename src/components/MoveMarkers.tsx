import type { Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

/** Clickable area around the intersection and the visible dot, in board units. */
const HIT_SIZE = 0.7;
const DOT_SIZE = 0.2;

interface MoveMarkersProps {
  /** Legal destinations that are empty (captures are marked with a ring instead). */
  targets: readonly Position[];
  onSelectTarget: (position: Position) => void;
}

/** Legal-move dots, each centered exactly on its intersection. */
export function MoveMarkers({ targets, onSelectTarget }: MoveMarkersProps) {
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
    </div>
  );
}
