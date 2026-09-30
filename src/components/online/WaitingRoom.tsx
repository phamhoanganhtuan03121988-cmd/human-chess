import { useState } from 'react';
import type { ConnectionStatus } from '../../multiplayer/client.ts';
import type { SeatCredentials } from '../../multiplayer/types.ts';
import { roomLink } from '../../game/route.ts';
import { Modal } from '../ui/Modal.tsx';
import { ConnectionBadge } from './ConnectionBadge.tsx';
import { SIDE_BADGE } from './texts.ts';

/** Shown to the room creator until an opponent joins. */
export function WaitingRoom({ seat, connection, onLeave }: { seat: SeatCredentials; connection: ConnectionStatus; onLeave: () => void }) {
  const link = roomLink(seat.roomId);
  const [copied, setCopied] = useState<'yes' | 'manual' | null>(null);
  const copy = () => {
    const done = () => setCopied('yes');
    const fallback = () => {
      setCopied('manual');
      const input = document.getElementById('room-link') as HTMLInputElement | null;
      input?.select();
    };
    try {
      navigator.clipboard.writeText(link).then(done, fallback);
    } catch {
      fallback();
    }
  };
  return (
    <Modal labelledBy="waiting-title" className="waiting-room" testId="waiting-room">
      <p className="waiting-room__eyebrow">PHÒNG</p>
      <h2 id="waiting-title" className="waiting-room__code room-code" data-testid="room-code">
        {seat.roomId}
      </h2>
      <p className="waiting-room__side">
        Bạn là <b className={`side-${seat.side}`}>{SIDE_BADGE[seat.side]}</b>
      </p>
      <p className="waiting-room__wait">
        <span className="waiting-room__spinner" aria-hidden="true" />
        Đang chờ đối thủ...
      </p>
      <label className="field waiting-room__link" htmlFor="room-link">
        <span className="field__label">Gửi link này cho đối thủ</span>
        <input id="room-link" className="field__input" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div className="modal__actions">
        <button type="button" className="btn btn--primary" data-autofocus data-testid="copy-link" onClick={copy}>
          {copied === 'yes' ? 'ĐÃ SAO CHÉP ✓' : 'SAO CHÉP LINK'}
        </button>
        <button type="button" className="btn" data-testid="leave-room" onClick={onLeave}>
          RỜI PHÒNG
        </button>
      </div>
      {copied === 'manual' && <p className="waiting-room__hint">Không sao chép tự động được — hãy sao chép link ở trên.</p>}
      <div className="waiting-room__connection">
        <ConnectionBadge status={connection} />
      </div>
    </Modal>
  );
}
