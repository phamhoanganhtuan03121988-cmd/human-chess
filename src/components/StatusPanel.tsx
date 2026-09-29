import type { StatusView } from '../game/controller.ts';

const REASON: Record<Extract<StatusView, { kind: 'over' }>['reason'], string> = {
  checkmate: 'Checkmate',
  stalemate: 'No legal moves',
  general_captured: 'General captured',
};

/** Turn / check / winner, read from the engine status. */
export function StatusPanel({ status }: { status: StatusView }) {
  if (status.kind === 'over') {
    return (
      <div className={`status status--${status.winner} status--over`} role="status" data-testid="status">
        <span className="status__main">{status.winner.toUpperCase()} WINS</span>
        <span className="status__detail">{REASON[status.reason]}</span>
      </div>
    );
  }
  return (
    <div className={`status status--${status.side}`} role="status" data-testid="status">
      <span className="status__main">{status.side.toUpperCase()} TURN</span>
      {status.check && <span className="status__check">CHECK</span>}
    </div>
  );
}
