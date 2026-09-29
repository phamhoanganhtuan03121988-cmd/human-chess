import type { PieceSide, PieceType } from '../config/assets.ts';
import { getPieceAsset } from '../config/assets.ts';
import { RAISED_PIECE_Z_INDEX, getPieceSprite, getPieceZIndex } from '../config/pieceSprites.ts';
import { BOARD_WIDTH } from '../board/layout.ts';
import { BoardAnchor } from './BoardAnchor.tsx';

export interface PieceInteraction {
  hovered?: boolean;
  selected?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onSelect?: () => void;
}

interface PieceProps extends PieceInteraction {
  side: PieceSide;
  type: PieceType;
  x: number;
  y: number;
  /** Outline the sprite bounds (debug mode). */
  debug?: boolean;
}

/** Board units → CSS length relative to the board width (container query units). */
export function boardUnits(units: number): string {
  return `${(units / BOARD_WIDTH) * 100}cqw`;
}

/**
 * A static game piece: the official PNG for side + type, resolved through
 * the asset manifest, with its bottom-center anchor on intersection (x, y).
 */
export function Piece({ side, type, x, y, debug = false, hovered, selected, onHoverChange, onSelect }: PieceProps) {
  const sprite = getPieceSprite(type);
  const classes = ['piece', debug && 'piece--debug', hovered && 'is-hovered', selected && 'is-selected'];
  return (
    <BoardAnchor
      x={x}
      y={y}
      anchorX={sprite.anchorX}
      anchorY={sprite.anchorY}
      zIndex={hovered || selected ? RAISED_PIECE_Z_INDEX : getPieceZIndex(y)}
      className={classes.filter(Boolean).join(' ')}
    >
      <img
        className={`piece__img piece__img--${side}`}
        src={getPieceAsset(side, type)}
        alt={`${side} ${type}`}
        draggable={false}
        data-testid="piece"
        data-side={side}
        data-type={type}
        style={{ height: boardUnits(sprite.height) }}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
        onClick={onSelect}
      />
    </BoardAnchor>
  );
}
