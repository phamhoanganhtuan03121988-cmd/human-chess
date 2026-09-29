/**
 * Static position evaluation: material + small positional terms.
 * Deterministic; scores are from `side`'s point of view.
 */
import { FILES, RANKS } from '../board/geometry.ts';
import { getPseudoLegalTargets } from '../engine/index.ts';
import type { GameState, Piece, PieceType, Side } from '../engine/index.ts';

export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  general: 10000,
  rook: 900,
  cannon: 450,
  knight: 400,
  elephant: 200,
  advisor: 200,
  pawn: 100,
};

/** Positional weights (small compared to material). */
export const POSITIONAL = {
  pawnCrossedRiver: 40,
  pawnCentralAfterRiver: 20,
  pawnOnLastRank: -20,
  knightCrossedRiver: 10,
  knightOnEdgeFile: -10,
  cannonCentralFile: 10,
  generalOffCentralFile: -10,
  /** Per defending advisor / elephant still on the board (General protection). */
  advisorGuard: 20,
  elephantGuard: 15,
  /** Per pseudo-legal destination, by piece type. */
  mobility: { rook: 3, knight: 4, cannon: 2 } as Readonly<Partial<Record<PieceType, number>>>,
  /** Side to move is in check. */
  inCheck: -40,
} as const;

/** 0 on a side's own back rank, 9 on the enemy back rank. */
function advance(side: Side, y: number): number {
  return side === 'red' ? RANKS - 1 - y : y;
}

function pieceScore(state: GameState, piece: Piece, x: number, y: number): number {
  let score = PIECE_VALUES[piece.type];
  const adv = advance(piece.side, y);
  switch (piece.type) {
    case 'pawn':
      if (adv >= 5) {
        score += POSITIONAL.pawnCrossedRiver;
        if (x >= 3 && x <= 5) score += POSITIONAL.pawnCentralAfterRiver;
      }
      if (adv === RANKS - 1) score += POSITIONAL.pawnOnLastRank;
      break;
    case 'knight':
      if (adv >= 5) score += POSITIONAL.knightCrossedRiver;
      if (x === 0 || x === FILES - 1) score += POSITIONAL.knightOnEdgeFile;
      break;
    case 'cannon':
      if (x === 4) score += POSITIONAL.cannonCentralFile;
      break;
    case 'general':
      if (x !== 4) score += POSITIONAL.generalOffCentralFile;
      break;
    case 'advisor':
      score += POSITIONAL.advisorGuard;
      break;
    case 'elephant':
      score += POSITIONAL.elephantGuard;
      break;
    default:
      break;
  }
  const mobilityWeight = POSITIONAL.mobility[piece.type];
  if (mobilityWeight) score += mobilityWeight * getPseudoLegalTargets(state.board, { x, y }).length;
  return score;
}

/** Evaluation of a non-terminal position from `side`'s point of view. */
export function evaluate(state: GameState, side: Side): number {
  let total = 0;
  for (let x = 0; x < FILES; x++) {
    for (let y = 0; y < RANKS; y++) {
      const piece = state.board[x]![y];
      if (!piece) continue;
      const s = pieceScore(state, piece, x, y);
      total += piece.side === side ? s : -s;
    }
  }
  if (state.inCheck) total += state.turn === side ? POSITIONAL.inCheck : -POSITIONAL.inCheck;
  return total;
}
