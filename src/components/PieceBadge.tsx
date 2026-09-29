import { MAX_Y } from '../board/geometry.ts';
import type { PieceSide, PieceType } from '../config/assets.ts';
import { getPieceGlyph, getPieceLabel } from '../config/pieceIdentity.ts';
import { BADGE_MIN_PX, BADGE_OFFSET, BADGE_SIZE } from '../config/pieceSprites.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import type { PieceInteraction } from './Piece.tsx';
import { boardUnits } from './Piece.tsx';

interface PieceBadgeProps extends PieceInteraction {
  side: PieceSide;
  type: PieceType;
  x: number;
  y: number;
}

/**
 * Round Xiangqi identification badge (e.g. 炮) hanging directly beneath the
 * character's feet. Shares the piece's intersection anchor: the anchor's
 * top-center is the intersection, and the badge is offset down from it.
 * Hovering shows a tooltip with the Vietnamese name and character.
 */
export function PieceBadge({
  side,
  type,
  x,
  y,
  hovered,
  selected,
  capturable,
  onHoverChange,
  onSelect,
  motion,
  landing,
}: PieceBadgeProps) {
  const label = getPieceLabel(side, type);
  const size = `max(${boardUnits(BADGE_SIZE)}, ${BADGE_MIN_PX}px)`;
  // Bottom-rank tooltips open upward so they stay on the board.
  const tooltipAbove = y === MAX_Y;
  const classes = [
    'piece-badge',
    `piece-badge--${side}`,
    hovered && 'is-hovered',
    selected && 'is-selected',
    capturable && 'is-capturable',
  ];

  return (
    <BoardAnchor x={x} y={y} anchorX={0.5} anchorY={0}>
      <div
        className={['piece-badge__slot', motion && 'is-moving', landing && !motion && 'is-landing']
          .filter(Boolean)
          .join(' ')}
        style={{ marginTop: boardUnits(BADGE_OFFSET), ...motion }}
      >
        <button
          type="button"
          className={classes.filter(Boolean).join(' ')}
          style={{ width: size, height: size, fontSize: `calc(${size} * 0.62)` }}
          aria-label={`${side} ${type}: ${label}`}
          aria-pressed={selected}
          data-testid="piece-badge"
          data-side={side}
          data-type={type}
          onPointerEnter={() => onHoverChange?.(true)}
          onPointerLeave={() => onHoverChange?.(false)}
          onFocus={() => onHoverChange?.(true)}
          onBlur={() => onHoverChange?.(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          {getPieceGlyph(side, type)}
        </button>
        {hovered && !motion && (
          <div
            className={`piece-tooltip piece-tooltip--${side} ${tooltipAbove ? 'piece-tooltip--above' : ''}`}
            role="tooltip"
            data-testid="piece-tooltip"
          >
            {label}
          </div>
        )}
      </div>
    </BoardAnchor>
  );
}
