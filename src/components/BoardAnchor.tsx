import type { ReactNode } from 'react';
import { getIntersectionPosition } from '../board/layout.ts';

interface BoardAnchorProps {
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
}

/**
 * Places its child with the child's CENTER exactly on intersection (x, y).
 * Must be rendered inside <Board>. All on-board content (debug markers now,
 * pieces later) should be positioned through this component.
 */
export function BoardAnchor({ x, y, children, className }: BoardAnchorProps) {
  const { left, top } = getIntersectionPosition(x, y);
  return (
    <div
      className={['board-anchor', className].filter(Boolean).join(' ')}
      style={{ left: `${left}%`, top: `${top}%` }}
      data-x={x}
      data-y={y}
    >
      {children}
    </div>
  );
}
