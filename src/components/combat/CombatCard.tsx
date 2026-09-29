import type { Piece } from '../../engine/index.ts';
import { getPortraitAsset } from '../../config/assets.ts';
import { getPieceDisplayName } from '../../config/pieceIdentity.ts';

interface CombatCardProps {
  role: 'attacker' | 'defender';
  piece: Piece;
  visible: boolean;
  /** Both fighters are squared up (from 900 ms until the end). */
  active: boolean;
  impact: boolean;
  defeated: boolean;
}

/** A portrait character card: the piece's official portrait plus its name. */
export function CombatCard({ role, piece, visible, active, impact, defeated }: CombatCardProps) {
  const { name, glyph } = getPieceDisplayName(piece.side, piece.type);
  const classes = [
    'combat-card',
    `combat-card--${role}`,
    `combat-card--${piece.side}`,
    visible && 'is-visible',
    active && 'is-active',
    impact && 'is-impact',
    defeated && 'is-defeated',
  ];
  return (
    <figure className={classes.filter(Boolean).join(' ')} data-testid={`combat-${role}`} data-side={piece.side} data-type={piece.type}>
      <div className="combat-card__frame">
        <img
          className="combat-card__portrait"
          src={getPortraitAsset(piece.side, piece.type)}
          alt={`${piece.side} ${piece.type} portrait`}
          draggable={false}
          data-testid={`combat-${role}-portrait`}
        />
      </div>
      <figcaption className="combat-card__caption">
        <span className="combat-card__role">{role === 'attacker' ? 'TẤN CÔNG' : 'PHÒNG THỦ'}</span>
        <span className="combat-card__name" data-testid={`combat-${role}-name`}>
          {name}
        </span>
        <span className="combat-card__glyph" data-testid={`combat-${role}-glyph`}>
          {glyph}
        </span>
      </figcaption>
    </figure>
  );
}
