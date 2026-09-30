import type { ReactNode } from 'react';
import { getIntersectionPosition } from '../board/layout.ts';
import { toViewCoordinate } from '../board/perspective.ts';
import { useBoardPerspective } from './BoardPerspective.tsx';

interface BoardAnchorProps {
  x: number;
  y: number;
  children: ReactNode;
  /**
   * Point of the child placed on the intersection, as fractions of the
   * child's width/height. Defaults to the center (0.5, 0.5); pieces use a
   * bottom-center anchor.
   */
  anchorX?: number;
  anchorY?: number;
  zIndex?: number;
  className?: string;
}

/**
 * Places its child so that the child's anchor point sits exactly on
 * intersection (x, y). Must be rendered inside <Board>. All on-board
 * content (pieces, debug overlays) is positioned through this component.
 * (x, y) are engine coordinates; the board perspective decides where that
 * intersection is drawn (data-x / data-y keep the engine coordinates).
 */
export function BoardAnchor({ x, y, children, anchorX = 0.5, anchorY = 0.5, zIndex, className }: BoardAnchorProps) {
  const view = toViewCoordinate(x, y, useBoardPerspective());
  const { left, top } = getIntersectionPosition(view.x, view.y);
  return (
    <div
      className={['board-anchor', className].filter(Boolean).join(' ')}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(${-anchorX * 100}%, ${-anchorY * 100}%)`,
        zIndex,
      }}
      data-x={x}
      data-y={y}
    >
      {children}
    </div>
  );
}
