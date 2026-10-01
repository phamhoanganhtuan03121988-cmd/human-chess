import { useLayoutEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PieceSide, PieceType } from '../config/assets.ts';
import { getPortraitAsset } from '../config/assets.ts';
import { PIECE_MOVES_VI, SIDE_NAMES_VI, getPieceDisplayName } from '../config/pieceIdentity.ts';
import { StaticToken } from './PieceToken.tsx';

interface CharacterActionCardProps {
  side: PieceSide;
  type: PieceType;
  /** Number of legal moves of the selected piece right now. */
  moveCount: number;
}

/** Where the card goes: beside the board, over the move panel, or below the board. */
type Placement = 'side' | 'panel' | 'below';

/** Narrowest gutter (px) beside the board that fits the full card. */
const MIN_SIDE_GUTTER = 176;
const MAX_CARD_WIDTH = 248;
const GAP = 12;

interface Layout {
  placement: Placement;
  style: CSSProperties;
}

/**
 * Chooses a spot that never covers the board: the empty gutter left of the
 * board when it is wide enough (desktop, tablet, phone landscape), else the
 * area of a move panel beside the board, else a compact row below the board
 * (phones in portrait).
 */
function measure(): Layout {
  const frame = (document.querySelector('[data-testid="board-frame"]') || document.querySelector('[data-testid="game-board-3d"]'))?.getBoundingClientRect();
  if (!frame || frame.width === 0) return { placement: 'below', style: {} };
  const gutter = frame.left - 16;
  if (gutter >= MIN_SIDE_GUTTER) {
    const width = Math.min(MAX_CARD_WIDTH, gutter - GAP);
    return {
      placement: 'side',
      style: { top: frame.top, left: frame.left - GAP - width, width, maxHeight: frame.height },
    };
  }
  const panel = document.querySelector('[data-testid="side-panel"]')?.getBoundingClientRect();
  // Only a panel beside the board (not one stacked under it in portrait).
  if (panel && panel.width > 0 && panel.top < frame.bottom) {
    return { placement: 'panel', style: { top: panel.top, left: panel.left, width: panel.width, maxHeight: panel.height } };
  }
  const banner = document.querySelector('[data-testid="connection-banner"]')?.getBoundingClientRect();
  const anchorBottom = banner && banner.height > 0 ? banner.bottom : frame.bottom;
  const below = window.innerHeight - anchorBottom - GAP;
  return {
    placement: 'below',
    style: { top: anchorBottom + GAP, left: frame.left, width: frame.width, maxHeight: Math.max(below, 96) },
  };
}

function useCardLayout(key: string): Layout {
  const [layout, setLayout] = useState<Layout>({ placement: 'below', style: {} });
  useLayoutEffect(() => {
    const update = () => setLayout(measure());
    update();
    window.addEventListener('resize', update);
    // The board resizes/moves when the move panel opens/closes or connection banner appears.
    const frame = document.querySelector('[data-testid="board-frame"]');
    const banner = document.querySelector('[data-testid="connection-banner"]');
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer && frame) observer.observe(frame);
    if (observer && banner) observer.observe(banner);
    const appEl = document.querySelector('.app');
    const mutationObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(update) : null;
    if (mutationObserver && appEl) {
      mutationObserver.observe(appEl, { childList: true, subtree: true });
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [key]);
  return layout;
}

/** Title-case a Vietnamese name: "MÃ" → "Mã". */
function titleCase(name: string): string {
  const lower = name.toLocaleLowerCase('vi');
  return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
}

/**
 * Detail card for the selected piece: faction, Xiangqi character, the
 * existing character portrait and how the piece moves. Shown only while a
 * piece is selected; purely informational (never blocks board input).
 */
export function CharacterActionCard({ side, type, moveCount }: CharacterActionCardProps) {
  const { name, glyph } = getPieceDisplayName(side, type);
  const { placement, style } = useCardLayout(`${side}-${type}`);
  const [loaded, setLoaded] = useState(false);
  return (
    <aside
      className={`character-card character-card--${side} character-card--${placement}`}
      style={style}
      aria-label={`Thẻ nhân vật: ${name} ${SIDE_NAMES_VI[side]}`}
      aria-live="polite"
      data-testid="character-card"
      data-placement={placement}
      data-side={side}
      data-type={type}
    >
      <header className="character-card__head">
        <StaticToken side={side} type={type} size="34px" />
        <div className="character-card__names">
          <span className="character-card__title">
            {name} {SIDE_NAMES_VI[side]}
          </span>
          <span className="character-card__glyph" lang="zh-Hant">
            {glyph}
          </span>
        </div>
      </header>
      <div className="character-card__portrait">
        <img
          key={`${side}-${type}`}
          src={getPortraitAsset(side, type)}
          alt={`Chân dung ${titleCase(name)} ${SIDE_NAMES_VI[side].toLocaleLowerCase('vi')}`}
          className={loaded ? 'is-loaded' : undefined}
          onLoad={() => setLoaded(true)}
          draggable={false}
        />
      </div>
      <div className="character-card__body">
        <div className="character-card__row">
          <span className="character-card__name">“{titleCase(name)}”</span>
          <span className="character-card__moves" data-testid="character-card-moves">
            {moveCount > 0 ? `${moveCount} nước đi` : 'Không có nước đi'}
          </span>
        </div>
        <div className="character-card__rule">
          <MoveDiagram side={side} type={type} />
          <p>{PIECE_MOVES_VI[type]}</p>
        </div>
      </div>
    </aside>
  );
}

/* Movement pattern on a 5×5 grid around the piece (board orientation: Red moves up). */
type Dot = [dx: number, dy: number, kind?: 'alt'];
function pattern(side: PieceSide, type: PieceType): { dots: Dot[]; lines?: boolean } {
  const fwd = side === 'red' ? -1 : 1;
  switch (type) {
    case 'general':
      return { dots: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
    case 'advisor':
      return { dots: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
    case 'elephant':
      return { dots: [[2, 2], [2, -2], [-2, 2], [-2, -2]] };
    case 'knight':
      return { dots: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] };
    case 'rook':
    case 'cannon':
      return { dots: [], lines: true };
    case 'pawn':
      return { dots: [[0, fwd], [1, 0, 'alt'], [-1, 0, 'alt']] };
  }
}

function MoveDiagram({ side, type }: { side: PieceSide; type: PieceType }) {
  const { dots, lines } = pattern(side, type);
  const c = (v: number) => 10 + (v + 2) * 20;
  return (
    <svg className="move-diagram" viewBox="0 0 100 100" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={c(-2)} y1={c(i - 2)} x2={c(2)} y2={c(i - 2)} className="move-diagram__grid" />
          <line x1={c(i - 2)} y1={c(-2)} x2={c(i - 2)} y2={c(2)} className="move-diagram__grid" />
        </g>
      ))}
      {lines && (
        <>
          <line x1={c(-2)} y1={c(0)} x2={c(2)} y2={c(0)} className="move-diagram__path" />
          <line x1={c(0)} y1={c(-2)} x2={c(0)} y2={c(2)} className="move-diagram__path" />
        </>
      )}
      {dots.map(([dx, dy, kind]) => (
        <circle key={`${dx},${dy}`} cx={c(dx)} cy={c(dy)} r={6} className={kind ? 'move-diagram__dot--alt' : 'move-diagram__dot'} />
      ))}
      <circle cx={c(0)} cy={c(0)} r={9} className="move-diagram__piece" />
    </svg>
  );
}
