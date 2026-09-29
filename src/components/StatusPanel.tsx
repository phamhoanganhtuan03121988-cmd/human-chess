import type { StatusView } from '../game/controller.ts';

const REASON: Record<Extract<StatusView, { kind: 'over' }>['reason'], string> = {
  checkmate: 'CHECKMATE',
  stalemate: 'STALEMATE',
  general_captured: 'GENERAL CAPTURED',
};

/** Turn / thinking / check / winner, read from the engine status and AI state. */
export function StatusPanel({ status }: { status: StatusView }) {
  if (status.kind === 'over') {
    return (
      <div className={`status status--${status.winner} status--over`} role="status" data-testid="status">
        <span className="status__main">
          {REASON[status.reason]} — {status.winner.toUpperCase()} WINS
        </span>
      </div>
    );
  }
  const side = status.side.toUpperCase();
  const main = status.thinking ? `${side} THINKING...` : status.check ? `${side} IN CHECK` : `${side} TURN`;
  return (
    <div
      className={`status status--${status.side}${status.thinking ? ' status--thinking' : ''}`}
      role="status"
      data-testid="status"
    >
      <span className="status__main">{main}</span>
      {status.thinking && status.check && <span className="status__check">IN CHECK</span>}
    </div>
  );
}
