import { useEffect, useState } from 'react';
import { playHoverSound } from '../audio/index.ts';
import { getPortraitAsset } from '../config/assets.ts';
import { findGeneral, pieceAt } from '../engine/index.ts';
import type { Position } from '../engine/index.ts';
import { PIECE_HEADROOM } from '../config/pieceSprites.ts';
import type { UiAction, UiState } from '../game/controller.ts';
import {
  getActivity,
  getAiState,
  getCheckingPieces,
  getGameOverView,
  getPlacements,
  isCaptureTarget,
  isPresenting,
} from '../game/controller.ts';
import { GameOverBanner } from './GameOverBanner.tsx';
import { isGameOver } from '../engine/index.ts';
import { Board } from './Board.tsx';
import { getImpactProfile } from './combat/combatFx.ts';
import { useReducedMotion } from './combat/useReducedMotion.ts';
import { getMoveDuration, getMovementStyle } from './animation/movement.ts';
import { useMovementDriver } from './animation/useMovementDriver.ts';
import { GroundLayer } from './GroundLayer.tsx';
import { MoveMarkers } from './MoveMarkers.tsx';
import { PieceLayer } from './PieceLayer.tsx';

interface GameBoardProps {
  ui: UiState;
  dispatch: (action: UiAction) => void;
  debug?: boolean;
}

/**
 * The playable board: renders the engine GameState and reports clicks as
 * board positions. All rule decisions happen in the engine via the controller.
 */
export function GameBoard({ ui, dispatch, debug = false }: GameBoardProps) {
  const [hovered, setHovered] = useState<Position | null>(null);
  const reducedMotion = useReducedMotion();
  useMovementDriver(ui.movement, dispatch, reducedMotion);
  const { game, selected, legalMoves, lastMove } = ui;

  const placements = getPlacements(game);
  const click = (position: Position) => dispatch({ type: 'click', position });
  const captureTargets = legalMoves.map((m) => m.to).filter((p) => isCaptureTarget(ui, p));
  const emptyTargets = legalMoves.map((m) => m.to).filter((p) => !pieceAt(game.board, p));
  usePortraitPreload(ui, captureTargets);
  const withSide = (p: Position | null) => {
    const piece = p && pieceAt(game.board, p);
    return p && piece ? { ...p, side: piece.side } : null;
  };

  // Subtle board shake at the combat impact (skipped for reduced motion).
  const shakePx = ui.combat?.phase === 'impact' && !reducedMotion ? getImpactProfile(ui.combat.attacker.type).shakePx : 0;

  const activity = getActivity(ui);
  const interactive = !isGameOver(game) && !isPresenting(ui) && getAiState(ui) === 'idle';
  const checkedGeneral = game.inCheck ? findGeneral(game.board, game.turn) : null;
  const gameOver = getGameOverView(game);
  const lastMoveSide = lastMove ? (pieceAt(game.board, lastMove.to)?.side ?? null) : null;

  return (
    <Board
      turn={activity === 'over' ? null : game.turn}
      over={activity === 'over'}
      waiting={activity === 'thinking' || activity === 'moving' || activity === 'combat'}
      combat={ui.combat !== null}
      shakePx={shakePx}
      debug={debug}
      headroom={PIECE_HEADROOM}
      interactive={interactive}
      onBackgroundClick={() => dispatch({ type: 'clearSelection' })}
    >
      <GroundLayer
        hovered={withSide(hovered)}
        selected={withSide(selected)}
        captureTargets={captureTargets}
        lastMove={lastMove}
        lastMoveSide={lastMoveSide}
        checkedGeneral={checkedGeneral}
        checkers={getCheckingPieces(game)}
        defeatedGeneral={gameOver?.defeatedGeneral ?? null}
        victorGeneral={gameOver ? findGeneral(game.board, gameOver.winner) : null}
        landingKey={lastMove && !reducedMotion ? `${ui.gameId}:${game.history.length}` : null}
      />
      <PieceLayer
        placements={placements}
        hovered={hovered}
        selected={selected}
        captureTargets={captureTargets}
        onHoverChange={(p) => {
          // Tick once when entering a new piece the player can act on.
          if (p && interactive && (hovered?.x !== p.x || hovered?.y !== p.y)) {
            const piece = pieceAt(game.board, p);
            if (piece && (piece.side === game.turn || captureTargets.some((c) => c.x === p.x && c.y === p.y))) {
              playHoverSound();
            }
          }
          setHovered(p);
        }}
        onClickPiece={click}
        moving={
          ui.movement
            ? { from: ui.movement.move.from, style: getMovementStyle(ui.movement.move, getMoveDuration(reducedMotion)) }
            : null
        }
        landedAt={lastMove?.to ?? null}
        actingSide={interactive ? game.turn : null}
        alertAt={checkedGeneral}
        debug={debug}
      />
      <MoveMarkers targets={emptyTargets} captureTargets={captureTargets} hovered={hovered} onSelectTarget={click} />
      {gameOver && <GameOverBanner view={gameOver} onNewGame={() => dispatch({ type: 'newGame' })} />}
    </Board>
  );
}

/**
 * Starts loading the attacker's and possible defenders' portraits as soon as a
 * capture is available, so the combat cards appear without a blank frame.
 */
function usePortraitPreload(ui: UiState, captureTargets: readonly Position[]) {
  const urls = [ui.selected, ...captureTargets]
    .map((p) => p && pieceAt(ui.game.board, p))
    .filter((p) => p !== null)
    .map((p) => getPortraitAsset(p.side, p.type));
  const key = captureTargets.length ? urls.join('|') : '';
  useEffect(() => {
    if (!key) return;
    for (const url of key.split('|')) {
      const img = new Image();
      img.src = url;
    }
  }, [key]);
}
