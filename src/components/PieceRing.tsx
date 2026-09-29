import type { PieceSide } from '../config/assets.ts';
import { RING_HEIGHT, RING_WIDTH } from '../config/pieceSprites.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

/** Ground ring centered on the intersection, under the feet (hover / selected). */
export function PieceRing({ side, x, y, selected }: { side: PieceSide; x: number; y: number; selected: boolean }) {
  return (
    <BoardAnchor x={x} y={y}>
      <div
        className={`piece-ring piece-ring--${side} ${selected ? 'is-selected' : 'is-hovered'}`}
        data-testid="piece-ring"
        style={{ width: boardUnits(RING_WIDTH), height: boardUnits(RING_HEIGHT) }}
      />
    </BoardAnchor>
  );
}
