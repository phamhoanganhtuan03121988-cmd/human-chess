/** Public API of the Xiangqi rule engine. */
export type * from './types.ts';
export { boardFromPlacements, emptyBoard, findGeneral, opponent, pieceAt } from './board.ts';
export { forwardDirection, generalsFacing, getPseudoLegalTargets, isAttacked, isInCheck } from './moves.ts';
export {
  FIRST_TURN,
  applyMove,
  createGameState,
  createInitialGameState,
  getAllLegalMoves,
  getLegalMoves,
  isGameOver,
  isLegalMove,
} from './game.ts';
export { formatBoard, parseBoard } from './notation.ts';
