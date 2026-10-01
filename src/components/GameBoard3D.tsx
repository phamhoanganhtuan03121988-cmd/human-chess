import { useEffect, useRef, useState } from 'react';
import type { UiAction, UiState } from '../game/controller.ts';
import type { BoardPerspective } from '../board/perspective.ts';
import type { Position } from '../engine/types.ts';
import { getBoardPerspective } from '../board/perspective.ts';
import {
  findGeneral,
  pieceAt,
} from '../engine/index.ts';
import {
  getGameOverView,
  getPlacements,
  isCaptureTarget,
} from '../game/controller.ts';
import { getPortraitAsset } from '../config/assets.ts';
import { CAPTURE_CONTEXT, CAPTURE_CONTEXT_REDUCED_MS } from './combat/combatTimeline.ts';
import { useReducedMotion } from './combat/useReducedMotion.ts';
import { useMovementDriver } from './animation/useMovementDriver.ts';
import { CaptureContext } from './CaptureContext.tsx';
import { GameOverBanner } from './GameOverBanner.tsx';
import { Board3DScene } from '../board3d/boardScene.ts';
import { isWebGLAvailable } from '../board3d/webglSupport.ts';

interface GameBoard3DProps {
  ui: UiState;
  dispatch: (action: UiAction) => void;
  debug?: boolean;
  onNewGame?: () => void;
  onReplay?: (() => void) | null;
  showResult?: boolean;
  perspective?: BoardPerspective;
  onFallbackTo2D?: (reason?: string) => void;
}

export function GameBoard3D({
  ui,
  dispatch,
  onNewGame,
  onReplay = null,
  showResult = true,
  perspective,
  onFallbackTo2D,
}: GameBoard3DProps) {
  const boardPerspective = perspective ?? getBoardPerspective(ui.controlledSide);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Board3DScene | null>(null);
  const [initFailed, setInitFailed] = useState(false);

  const reducedMotion = useReducedMotion();
  useMovementDriver(ui.movement, dispatch, reducedMotion);

  const { game, selected, legalMoves, lastMove } = ui;
  const placements = getPlacements(game);
  const captureTargets = legalMoves.map((m) => m.to).filter((p) => isCaptureTarget(ui, p));
  const emptyTargets = legalMoves.map((m) => m.to).filter((p) => !pieceAt(game.board, p));

  usePortraitPreload(ui, captureTargets);

  // Capture context driver for smooth combat hand-off
  const context = ui.combat?.phase === 'context' ? ui.combat : null;
  useCaptureContextDriver(context?.id ?? null, dispatch, reducedMotion);

  const checkedGeneral = game.inCheck ? findGeneral(game.board, game.turn) : null;
  const gameOver = getGameOverView(game, ui.forfeit);

  // Initialize 3D scene on mount
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setInitFailed(true);
      onFallbackTo2D?.('Thiết bị không hỗ trợ WebGL. Đang chuyển về chế độ 2D.');
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    try {
      const scene = new Board3DScene(container, {
        perspective: boardPerspective,
        onSelectPosition: (pos) => dispatch({ type: 'click', position: pos }),
        reducedMotion,
      });
      sceneRef.current = scene;

      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize 3D scene:', err);
      setInitFailed(true);
      onFallbackTo2D?.('Không thể khởi tạo bàn cờ 3D. Đang chuyển về chế độ 2D.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update perspective & reduced motion
  useEffect(() => {
    sceneRef.current?.updatePerspective(boardPerspective);
  }, [boardPerspective]);

  useEffect(() => {
    sceneRef.current?.updateReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Sync pieces and markers whenever game state changes
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.syncPieces(placements, selected, checkedGeneral);
    sceneRef.current.syncMarkers(selected, emptyTargets, captureTargets, lastMove, checkedGeneral);
  }, [placements, selected, emptyTargets, captureTargets, lastMove, checkedGeneral]);

  // Animate movement when ui.movement changes
  useEffect(() => {
    if (!sceneRef.current || !ui.movement) return;
    sceneRef.current.animateMove(ui.movement.move);
  }, [ui.movement]);

  const handleResetCamera = () => {
    sceneRef.current?.resetCamera();
  };

  if (initFailed) {
    return (
      <div className="game-board-3d-fallback">
        <p>Không thể tải chế độ 3D trên thiết bị này.</p>
        <button
          type="button"
          className="toolbar__button toolbar__button--accent"
          onClick={() => onFallbackTo2D?.()}
        >
          Trở về bàn cờ 2D
        </button>
      </div>
    );
  }

  return (
    <div className="game-board-3d-wrapper" data-testid="game-board-3d">
      <div className="game-board-3d-canvas-container" ref={containerRef} />

      {/* Floating 3D controls */}
      <div className="game-board-3d-controls">
        <button
          type="button"
          className="game-board-3d-btn"
          title="Đặt lại góc nhìn bàn cờ"
          onClick={handleResetCamera}
        >
          ↺ Góc nhìn
        </button>
      </div>

      {context && <CaptureContext key={context.id} combat={context} reducedMotion={reducedMotion} />}
      {gameOver && showResult && (
        <GameOverBanner view={gameOver} onNewGame={onNewGame ?? (() => dispatch({ type: 'newGame' }))} onReplay={onReplay} />
      )}
    </div>
  );
}

function useCaptureContextDriver(combatId: number | null, dispatch: (action: UiAction) => void, reducedMotion: boolean) {
  useEffect(() => {
    if (combatId === null) return;
    const ms = reducedMotion ? CAPTURE_CONTEXT_REDUCED_MS : CAPTURE_CONTEXT.end;
    const t = window.setTimeout(() => dispatch({ type: 'combatPhase', id: combatId, phase: 'entering' }), ms);
    return () => window.clearTimeout(t);
  }, [combatId, dispatch]);
}

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
