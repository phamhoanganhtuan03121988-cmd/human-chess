import type { PieceSide } from '../config/assets.ts';
import type { Move, Position } from '../engine/index.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { LandingPulse } from './LandingPulse.tsx';
import { PieceRing } from './PieceRing.tsx';
import { boardUnits } from './Piece.tsx';

interface GroundLayerProps {
  hovered: (Position & { side: PieceSide }) | null;
  selected: (Position & { side: PieceSide }) | null;
  captureTargets: readonly Position[];
  lastMove: Move | null;
  /** Side that made the last move (tints the last-move marks). */
  lastMoveSide: PieceSide | null;
  /** General of the side to move, when it is in check. */
  checkedGeneral: Position | null;
  /** Enemy pieces giving check. */
  checkers: readonly Position[];
  /** Losing General once the game is over. */
  defeatedGeneral: Position | null;
  /** Winning General once the game is over (gold highlight). */
  victorGeneral?: Position | null;
  /** Key of the move that just committed; a fresh key plays the landing pulse. */
  landingKey?: string | null;
  /** The last move captured a piece (crimson landing pulse). */
  landingCapture?: boolean;
}

const LAST_FROM_SIZE = 0.42;

/** Everything drawn on the ground beneath the characters, anchored to intersections. */
export function GroundLayer({
  hovered,
  selected,
  captureTargets,
  lastMove,
  lastMoveSide,
  checkedGeneral,
  checkers,
  defeatedGeneral,
  victorGeneral = null,
  landingKey = null,
  landingCapture = false,
}: GroundLayerProps) {
  const sideClass = lastMoveSide ? ` last-move--${lastMoveSide}` : '';
  return (
    <div className="board__layer board__layer--ground">
      {lastMove && (
        <>
          <BoardAnchor x={lastMove.from.x} y={lastMove.from.y}>
            <div
              className={`last-move-from${sideClass}`}
              data-testid="last-move-from"
              data-x={lastMove.from.x}
              data-y={lastMove.from.y}
              data-side={lastMoveSide ?? undefined}
              style={{ width: boardUnits(LAST_FROM_SIZE), height: boardUnits(LAST_FROM_SIZE) }}
            >
              <span className="last-move-from__dot" />
            </div>
          </BoardAnchor>
          <PieceRing x={lastMove.to.x} y={lastMove.to.y} variant="last-move" side={lastMoveSide ?? undefined} />
        </>
      )}
      {lastMove && landingKey && <LandingPulse key={landingKey} at={lastMove.to} capture={landingCapture} />}
      {victorGeneral && <PieceRing x={victorGeneral.x} y={victorGeneral.y} variant="victor" />}
      {checkers.map((p) => (
        <PieceRing key={`k${p.x},${p.y}`} x={p.x} y={p.y} variant="checker" />
      ))}
      {checkedGeneral && <PieceRing x={checkedGeneral.x} y={checkedGeneral.y} variant="check" />}
      {defeatedGeneral && <PieceRing x={defeatedGeneral.x} y={defeatedGeneral.y} variant="defeated" />}
      {captureTargets.map((p) => (
        <PieceRing key={`c${p.x},${p.y}`} x={p.x} y={p.y} variant="capture" />
      ))}
      {hovered && !(selected && selected.x === hovered.x && selected.y === hovered.y) && (
        <PieceRing key={`h${hovered.x},${hovered.y}`} x={hovered.x} y={hovered.y} variant="hover" side={hovered.side} />
      )}
      {selected && (
        <PieceRing key={`s${selected.x},${selected.y}`} x={selected.x} y={selected.y} variant="selected" side={selected.side} />
      )}
    </div>
  );
}
