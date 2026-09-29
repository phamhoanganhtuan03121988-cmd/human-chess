import type { GameOverView } from '../game/controller.ts';

interface GameOverBannerProps {
  view: GameOverView;
  onNewGame: () => void;
}

/**
 * End-of-game banner over the board. Compact and semi-transparent so the
 * final position stays visible; the engine result is the only source.
 */
export function GameOverBanner({ view, onNewGame }: GameOverBannerProps) {
  return (
    <div className="board__layer board__layer--banner">
      <div
        className={`game-over game-over--${view.winner}`}
        role="alert"
        data-testid="game-over"
        data-winner={view.winner}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-over__title">{view.title}</div>
        <div className="game-over__winner">{view.winner.toUpperCase()} WINS</div>
        <div className="game-over__detail">{view.detail}</div>
        <button type="button" className="game-over__button" onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  );
}
