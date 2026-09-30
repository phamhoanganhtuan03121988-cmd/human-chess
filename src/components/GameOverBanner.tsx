import type { GameOverView } from '../game/controller.ts';

interface GameOverBannerProps {
  view: GameOverView;
  onNewGame: () => void;
  /** Watch the recorded game again; hidden when not available. */
  onReplay?: (() => void) | null;
}

/**
 * End-of-game banner over the board. Compact and semi-transparent so the
 * final position stays visible; the engine result is the only source.
 */
export function GameOverBanner({ view, onNewGame, onReplay = null }: GameOverBannerProps) {
  return (
    <div className="board__layer board__layer--banner">
      <div
        className={`game-over game-over--${view.winner}`}
        role="alert"
        data-testid="game-over"
        data-winner={view.winner}
        data-reason={view.reason}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-over__title">{view.title}</div>
        <div className="game-over__winner">{view.winnerText}</div>
        <div className="game-over__detail">{view.detail}</div>
        <div className="game-over__actions">
          <button type="button" className="game-over__button game-over__button--primary" onClick={onNewGame}>
            VÁN MỚI
          </button>
          {onReplay && (
            <button type="button" className="game-over__button" onClick={onReplay}>
              XEM LẠI
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
