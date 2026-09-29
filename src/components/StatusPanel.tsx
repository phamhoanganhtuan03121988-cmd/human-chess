import type { Side } from '../engine/index.ts';
import type { Activity, StatusView } from '../game/controller.ts';

const REASON: Record<Extract<StatusView, { kind: 'over' }>['reason'], string> = {
  checkmate: 'CHIẾU BÍ',
  stalemate: 'BẾ TẮC',
  general_captured: 'TƯỚNG BỊ BẮT',
};

const SIDE_LABEL: Record<Side, string> = { red: 'ĐỎ', blue: 'XANH' };
const SIDE_NAME: Record<Side, string> = { red: 'Đỏ', blue: 'Xanh' };

interface StatusPanelProps {
  status: StatusView;
  /** What the game is doing (from getActivity); drives the wording and hint. */
  activity?: Activity;
  /** Side played by the computer, if any. */
  aiSide?: Side | null;
}

/** Main status line for the current turn / activity. */
function mainText(status: Extract<StatusView, { kind: 'turn' }>, activity: Activity): string {
  const side = SIDE_LABEL[status.side];
  if (activity === 'combat') return `${side} TẤN CÔNG`;
  if (activity === 'moving') return `${side} ĐANG ĐI`;
  if (status.thinking || activity === 'thinking') return `${side} ĐANG NGHĨ...`;
  if (status.check) return `${side} BỊ CHIẾU`;
  return `LƯỢT ${side}`;
}

/** A trailing "..." is kept in the text (screen readers, tests) but drawn as animated dots. */
function renderMain(text: string) {
  if (!text.endsWith('...')) return text;
  return (
    <>
      {text.slice(0, -3)}
      <span className="status__ellipsis">...</span>
    </>
  );
}

/** Short hint telling the player whether they can act. */
function hintText(status: StatusView, activity: Activity, aiSide: Side | null): string {
  if (status.kind === 'over') return 'Ván đã kết thúc';
  const aiActing = aiSide !== null && status.side === aiSide;
  switch (activity) {
    case 'combat':
      return 'Đang giao chiến…';
    case 'moving':
      return aiActing ? `Chờ chút — ${SIDE_NAME[status.side]} đang đi` : 'Đang di chuyển…';
    case 'thinking':
      return `Chờ chút — ${SIDE_NAME[status.side]} đang nghĩ`;
    default:
      if (aiActing) return 'Chờ chút';
      return status.check ? 'Bảo vệ Tướng!' : 'Đến lượt bạn';
  }
}

/**
 * Turn / thinking / moving / combat / check / winner, read from the engine
 * status and UI activity. The pill re-mounts when the turn or result
 * changes, which plays a short entry transition.
 */
export function StatusPanel({ status, activity = 'idle', aiSide = null }: StatusPanelProps) {
  const hint = hintText(status, activity, aiSide);
  if (status.kind === 'over') {
    return (
      <div className="status-panel">
        <div
          key={`over-${status.winner}`}
          className={`status status--${status.winner} status--over`}
          role="status"
          data-testid="status"
        >
          <span className="status__main">
            {REASON[status.reason]} — {SIDE_LABEL[status.winner]} THẮNG
          </span>
        </div>
        <span className="status-hint" data-testid="status-hint">
          {hint}
        </span>
      </div>
    );
  }
  const waiting = activity !== 'idle' || (aiSide !== null && status.side === aiSide);
  const classes = [
    'status',
    `status--${status.side}`,
    `status--${activity}`,
    status.thinking && 'status--thinking',
    status.check && 'status--check',
  ];
  return (
    <div className="status-panel">
      <div
        key={`turn-${status.side}`}
        className={classes.filter(Boolean).join(' ')}
        role="status"
        data-testid="status"
        data-activity={activity}
      >
        <span className="status__dot" aria-hidden="true" />
        <span className="status__main">{renderMain(mainText(status, activity))}</span>
        {(status.thinking || activity === 'thinking') && (
          <span className="status__dots" data-testid="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        {status.thinking && status.check && <span className="status__check">BỊ CHIẾU</span>}
      </div>
      <span className={waiting ? 'status-hint status-hint--wait' : 'status-hint'} data-testid="status-hint">
        {hint}
      </span>
    </div>
  );
}
