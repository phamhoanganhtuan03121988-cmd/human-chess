import type { CSSProperties } from 'react';
import type { PieceSide, PieceType } from '../config/assets.ts';
import { SIDE_NAMES_VI, getPieceDisplayName } from '../config/pieceIdentity.ts';
import { RAISED_PIECE_Z_INDEX, TOKEN_MIN_PX, TOKEN_SIZE, getPieceZIndex } from '../config/pieceSprites.ts';
import { BoardAnchor } from './BoardAnchor.tsx';
import type { PieceInteraction } from './Piece.tsx';
import { boardUnits } from './Piece.tsx';

interface PieceTokenProps extends PieceInteraction {
  side: PieceSide;
  type: PieceType;
  x: number;
  y: number;
  /** Outline the token bounds (debug mode). */
  debug?: boolean;
}

/**
 * The visual disc of a Xiangqi token: faction ring, ivory face with an
 * engraved inner ring, and the traditional character. Presentational only;
 * sized by the parent through the `--token` CSS variable.
 */
export function TokenFace({ side, type }: { side: PieceSide; type: PieceType }) {
  return (
    <span className="token-face" aria-hidden="true">
      <span className="token-face__glyph">{getPieceDisplayName(side, type).glyph}</span>
    </span>
  );
}

/** A non-interactive token (help dialog, captured pieces, character card). */
export function StaticToken({ side, type, size }: { side: PieceSide; type: PieceType; size: string }) {
  return (
    <span
      className={`piece-token piece-token--${side} piece-token--static`}
      style={{ '--token': size } as CSSProperties}
      data-side={side}
      data-type={type}
    >
      <TokenFace side={side} type={type} />
    </span>
  );
}

/**
 * A board piece: a compact premium Xiangqi token centered on intersection
 * (x, y), about 0.72 of the intersection spacing wide so neighbours stay
 * clearly separated. One real button per piece (selection, keyboard focus);
 * the character artwork appears in the selection card and in combat.
 */
export function PieceToken({
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
  actionable,
  alert,
}: PieceTokenProps) {
  const { name, glyph } = getPieceDisplayName(side, type);
  const size = `max(${boardUnits(TOKEN_SIZE)}, ${TOKEN_MIN_PX}px)`;
  const classes = [
    'piece-token',
    `piece-token--${side}`,
    hovered && 'is-hovered',
    selected && 'is-selected',
    capturable && 'is-capturable',
    actionable && 'is-actionable',
    alert && 'is-alert',
    motion && 'is-moving',
    landing && !motion && 'is-landing',
    debug && 'piece-token--debug',
  ];
  return (
    <BoardAnchor
      x={x}
      y={y}
      zIndex={hovered || selected || motion ? RAISED_PIECE_Z_INDEX : getPieceZIndex(y)}
      className="piece"
    >
      <button
        type="button"
        className={classes.filter(Boolean).join(' ')}
        style={{ '--token': size, ...motion } as CSSProperties}
        aria-label={`${name} ${SIDE_NAMES_VI[side]} ${glyph}${selected ? ', đang chọn' : ''}`}
        aria-pressed={selected}
        title={`${name} — ${glyph}`}
        data-testid="piece"
        data-side={side}
        data-type={type}
        data-moving={motion ? 'true' : undefined}
        data-actionable={actionable ? 'true' : undefined}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
        onFocus={() => onHoverChange?.(true)}
        onBlur={() => onHoverChange?.(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      >
        <TokenFace side={side} type={type} />
      </button>
    </BoardAnchor>
  );
}
