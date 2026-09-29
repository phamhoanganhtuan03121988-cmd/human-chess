import type { PieceSide } from '../config/assets.ts';
import { RING_HEIGHT, RING_WIDTH } from '../config/pieceSprites.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

export type RingVariant = 'hover' | 'selected' | 'capture' | 'check' | 'last-move';

interface PieceRingProps {
  x: number;
  y: number;
  variant: RingVariant;
  side?: PieceSide;
}

/** Ground ring centered on an intersection, drawn under the character's feet. */
export function PieceRing({ x, y, variant, side }: PieceRingProps) {
  const classes = ['piece-ring', `piece-ring--${variant}`, side && `piece-ring--${side}`];
  return (
    <BoardAnchor x={x} y={y}>
      <div
        className={classes.filter(Boolean).join(' ')}
        data-testid={`ring-${variant}`}
        data-x={x}
        data-y={y}
        style={{ width: boardUnits(RING_WIDTH), height: boardUnits(RING_HEIGHT) }}
      />
    </BoardAnchor>
  );
}
