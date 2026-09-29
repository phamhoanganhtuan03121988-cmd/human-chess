import type { PieceSide } from '../config/assets.ts';
import type { Move, Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { PieceRing } from './PieceRing.tsx';
import { boardUnits } from './Piece.tsx';

interface GroundLayerProps {
  hovered: (Position & { side: PieceSide }) | null;
  selected: (Position & { side: PieceSide }) | null;
  captureTargets: readonly Position[];
  lastMove: Move | null;
  /** General of the side to move, when it is in check. */
  checkedGeneral: Position | null;
}

const LAST_FROM_SIZE = 0.3;

/** Everything drawn on the ground beneath the characters, anchored to intersections. */
export function GroundLayer({ hovered, selected, captureTargets, lastMove, checkedGeneral }: GroundLayerProps) {
  return (
    <div className="board__layer board__layer--ground">
      {lastMove && (
        <>
          <BoardAnchor x={lastMove.from.x} y={lastMove.from.y}>
            <div
              className="last-move-from"
              data-testid="last-move-from"
              data-x={lastMove.from.x}
              data-y={lastMove.from.y}
              style={{ width: boardUnits(LAST_FROM_SIZE), height: boardUnits(LAST_FROM_SIZE) }}
            />
          </BoardAnchor>
          <PieceRing x={lastMove.to.x} y={lastMove.to.y} variant="last-move" />
        </>
      )}
      {checkedGeneral && <PieceRing x={checkedGeneral.x} y={checkedGeneral.y} variant="check" />}
      {captureTargets.map((p) => (
        <PieceRing key={`c${p.x},${p.y}`} x={p.x} y={p.y} variant="capture" />
      ))}
      {hovered && !(selected && selected.x === hovered.x && selected.y === hovered.y) && (
        <PieceRing x={hovered.x} y={hovered.y} variant="hover" side={hovered.side} />
      )}
      {selected && <PieceRing x={selected.x} y={selected.y} variant="selected" side={selected.side} />}
    </div>
  );
}
