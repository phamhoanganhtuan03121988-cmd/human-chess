import { createContext, useContext } from 'react';
import type { BoardPerspective } from '../board/perspective.ts';

/**
 * The perspective of the board being rendered, provided by <Board>. Everything
 * placed on intersections reads it (through BoardAnchor or directly), so all
 * board layers rotate together while their data stays in engine coordinates.
 */
const BoardPerspectiveContext = createContext<BoardPerspective>('red');

export const BoardPerspectiveProvider = BoardPerspectiveContext.Provider;

export function useBoardPerspective(): BoardPerspective {
  return useContext(BoardPerspectiveContext);
}
