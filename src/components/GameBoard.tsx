import { useEffect, useState } from 'react';
import { getPortraitAsset } from '../config/assets.ts';
import { findGeneral, pieceAt } from '../engine/index.ts';
import type { Position } from '../engine/index.ts';
import { PIECE_HEADROOM } from '../config/pieceSprites.ts';
import type { UiAction, UiState } from '../game/controller.ts';
import { getAiState, getPlacements, isCaptureTarget } from '../game/controller.ts';
import { isGameOver } from '../engine/index.ts';
import { Board } from './Board.tsx';
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

  return (
    <Board
      debug={debug}
      headroom={PIECE_HEADROOM}
      interactive={!isGameOver(game) && !ui.combat && getAiState(ui) === 'idle'}
      onBackgroundClick={() => dispatch({ type: 'clearSelection' })}
    >
      <GroundLayer
        hovered={withSide(hovered)}
        selected={withSide(selected)}
        captureTargets={captureTargets}
        lastMove={lastMove}
        checkedGeneral={game.inCheck ? findGeneral(game.board, game.turn) : null}
      />
      <PieceLayer
        placements={placements}
        hovered={hovered}
        selected={selected}
        captureTargets={captureTargets}
        onHoverChange={setHovered}
        onClickPiece={click}
        debug={debug}
      />
      <MoveMarkers targets={emptyTargets} onSelectTarget={click} />
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
