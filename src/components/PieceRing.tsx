import type { PieceSide } from '../config/assets.ts';
import { TOKEN_RING_SIZE } from '../config/pieceSprites.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import { boardUnits } from './Piece.tsx';

export type RingVariant =
  | 'hover'
  | 'selected'
  | 'capture'
  | 'check'
  | 'checker'
  | 'defeated'
  | 'victor'
  | 'last-move';

interface PieceRingProps {
  x: number;
  y: number;
  variant: RingVariant;
  side?: PieceSide;
}

/** Ground ring centered on an intersection, drawn just around the piece token. */
export function PieceRing({ x, y, variant, side }: PieceRingProps) {
  const classes = ['piece-ring', `piece-ring--${variant}`, side && `piece-ring--${side}`];
  return (
    <BoardAnchor x={x} y={y}>
      <div
        className={classes.filter(Boolean).join(' ')}
        data-testid={`ring-${variant}`}
        data-x={x}
        data-y={y}
        data-side={side}
        style={{ width: boardUnits(TOKEN_RING_SIZE), height: boardUnits(TOKEN_RING_SIZE) }}
      />
    </BoardAnchor>
  );
}
