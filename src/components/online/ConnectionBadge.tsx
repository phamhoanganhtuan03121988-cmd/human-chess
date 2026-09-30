import type { ConnectionStatus } from '../../multiplayer/client.ts';
import { CONNECTION_TEXT } from './texts.ts';

const TONE: Record<ConnectionStatus, 'ok' | 'wait' | 'bad'> = {
  idle: 'wait',
  connecting: 'wait',
  connected: 'ok',
  reconnecting: 'wait',
  offline: 'bad',
};

/** Small connection indicator for the online HUD (🟢 / 🟡 / 🔴). */
export function ConnectionBadge({ status, compact = false }: { status: ConnectionStatus; compact?: boolean }) {
  const tone = TONE[status];
  return (
    <span
      className={`connection-badge connection-badge--${tone}`}
      role="status"
      aria-live="polite"
      title={CONNECTION_TEXT[status]}
      data-testid="connection-badge"
      data-status={status}
    >
      <span className="connection-badge__dot" aria-hidden="true" />
      <span className={compact ? 'connection-badge__text visually-hidden' : 'connection-badge__text'}>{CONNECTION_TEXT[status]}</span>
    </span>
  );
}
