import { useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '../../multiplayer/client.ts';

export const RECONNECT_BANNER_DURATION_MS = 2500;

interface OnlineConnectionBannerProps {
  connection: ConnectionStatus;
  opponentConnected: boolean;
  playing: boolean;
  combat: boolean;
}

/**
 * Compact connection banner shown below the board on mobile portrait.
 * Hidden when connection is normal or during combat; automatically shows
 * a temporary "Đã kết nối lại" cue after reconnecting.
 */
export function OnlineConnectionBanner({
  connection,
  opponentConnected,
  playing,
  combat,
}: OnlineConnectionBannerProps) {
  const [justReconnected, setJustReconnected] = useState(false);
  const prevConnectionRef = useRef(connection);
  const prevOpponentConnectedRef = useRef(opponentConnected);

  const selfDisconnected = connection === 'reconnecting' || connection === 'offline';
  const opponentAway = playing && !opponentConnected;

  useEffect(() => {
    const prevConn = prevConnectionRef.current;
    const prevOpp = prevOpponentConnectedRef.current;

    prevConnectionRef.current = connection;
    prevOpponentConnectedRef.current = opponentConnected;

    const selfReconnected =
      (prevConn === 'reconnecting' || prevConn === 'offline') && connection === 'connected';
    const opponentReconnected = !prevOpp && opponentConnected && playing;

    if (selfReconnected || opponentReconnected) {
      setJustReconnected(true);
      const timer = window.setTimeout(() => setJustReconnected(false), RECONNECT_BANNER_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [connection, opponentConnected, playing]);

  // Never compete with CombatOverlay
  if (combat) return null;

  let message: string | null = null;
  let tone: 'wait' | 'bad' | 'ok' = 'wait';

  if (selfDisconnected) {
    message = 'Đang chờ kết nối lại...';
    tone = connection === 'offline' ? 'bad' : 'wait';
  } else if (opponentAway) {
    message = 'Đối thủ mất kết nối';
    tone = 'wait';
  } else if (justReconnected) {
    message = 'Đã kết nối lại';
    tone = 'ok';
  }

  if (!message) return null;

  return (
    <div
      className={`connection-banner connection-banner--${tone}`}
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
      data-tone={tone}
    >
      <span className="connection-banner__dot" aria-hidden="true" />
      <span className="connection-banner__text">{message}</span>
    </div>
  );
}
