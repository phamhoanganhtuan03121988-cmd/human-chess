import type { CSSProperties } from 'react';
import type { PieceSide, PieceType } from '../config/assets.ts';
import { getPieceAsset } from '../config/assets.ts';
import { RAISED_PIECE_Z_INDEX, getPieceSprite, getPieceZIndex } from '../config/pieceSprites.ts';
import { BOARD_WIDTH } from '../board/layout.ts';
import { BoardAnchor } from './BoardAnchor.tsx';

export interface PieceInteraction {
  hovered?: boolean;
  selected?: boolean;
  /** The selected piece can capture this piece. */
  capturable?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onSelect?: () => void;
  /** Movement animation vars (see animation/movement.ts) while this piece travels. */
  motion?: CSSProperties | null;
  /** Settle briefly after arriving (the move just committed here). */
  landing?: boolean;
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
 * A game piece: the official PNG for side + type, resolved through
 * the asset manifest, with its bottom-center anchor on intersection (x, y).
 */
export function Piece({
  side,
  type,
  x,
  y,
  debug = false,
  hovered,
  selected,
  capturable,
  onHoverChange,
  onSelect,
  motion,
  landing,
}: PieceProps) {
  const sprite = getPieceSprite(type);
  const classes = [
    'piece',
    debug && 'piece--debug',
    hovered && 'is-hovered',
    selected && 'is-selected',
    capturable && 'is-capturable',
  ];
  return (
    <BoardAnchor
      x={x}
      y={y}
      anchorX={sprite.anchorX}
      anchorY={sprite.anchorY}
      zIndex={hovered || selected || motion ? RAISED_PIECE_Z_INDEX : getPieceZIndex(y)}
      className={classes.filter(Boolean).join(' ')}
    >
      <img
        className={[
          'piece__img',
          `piece__img--${side}`,
          motion && 'is-moving',
          landing && !motion && 'is-landing',
        ]
          .filter(Boolean)
          .join(' ')}
        src={getPieceAsset(side, type)}
        alt={`${side} ${type}`}
        draggable={false}
        data-testid="piece"
        data-side={side}
        data-type={type}
        data-moving={motion ? 'true' : undefined}
        style={{ height: boardUnits(sprite.height), ...motion }}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      />
    </BoardAnchor>
  );
}
