import type { PieceSide, PieceType } from '../config/assets.ts';
import { getPieceAsset } from '../config/assets.ts';
import { getPieceSprite, getPieceZIndex } from '../config/pieceSprites.ts';
import { BOARD_WIDTH } from '../board/layout.ts';
import { BoardAnchor } from './BoardAnchor.tsx';

interface PieceProps {
  side: PieceSide;
  type: PieceType;
  x: number;
  y: number;
  /** Outline the sprite bounds (debug mode). */
  debug?: boolean;
}

/**
 * A static game piece: the official PNG for side + type, resolved through
 * the asset manifest, with its bottom-center anchor on intersection (x, y).
 * Sized in container-query units so it scales with the board.
 */
export function Piece({ side, type, x, y, debug = false }: PieceProps) {
  const sprite = getPieceSprite(type);
  return (
    <BoardAnchor
      x={x}
      y={y}
      anchorX={sprite.anchorX}
      anchorY={sprite.anchorY}
      zIndex={getPieceZIndex(y)}
      className={debug ? 'piece piece--debug' : 'piece'}
    >
      <img
        className="piece__img"
        src={getPieceAsset(side, type)}
        alt={`${side} ${type}`}
        draggable={false}
        data-testid="piece"
        data-side={side}
        data-type={type}
        style={{ height: `${(sprite.height / BOARD_WIDTH) * 100}cqw` }}
      />
    </BoardAnchor>
  );
}
