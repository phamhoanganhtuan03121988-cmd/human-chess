import { useState } from 'react';
import type { FormEvent } from 'react';
import { NICKNAME_MAX, ROOM_ID_LENGTH } from '../../multiplayer/protocol.ts';
import { loadNickname, saveNickname } from '../../multiplayer/session.ts';
import { normalizeNickname, normalizeRoomId } from '../../multiplayer/validation.ts';
import type { OnlineProblem } from '../../game/useOnlineGame.ts';
import { Modal } from '../ui/Modal.tsx';
import { PROBLEM_TEXT } from './texts.ts';

interface OnlineLobbyProps {
  /** Room code from a shared link (/room/XXXXXX): the lobby then offers to join it. */
  initialRoomId?: string | null;
  busy: boolean;
  problem: OnlineProblem | null;
  onCreate: (nickname: string) => void;
  onJoin: (roomId: string, nickname: string) => void;
  onBack: () => void;
}

/** CHƠI ONLINE: pick a name, then create a private room or join one by code. */
export function OnlineLobby({ initialRoomId = null, busy, problem, onCreate, onJoin, onBack }: OnlineLobbyProps) {
  const [nickname, setNickname] = useState(loadNickname);
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [touched, setTouched] = useState(false);
  const name = normalizeNickname(nickname);
  const code = normalizeRoomId(roomId);
  const nameError = touched && !name ? PROBLEM_TEXT.INVALID_NICKNAME : null;

  const withName = (action: (n: string) => void) => (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!name || busy) return;
    saveNickname(name);
    action(name);
  };
  const create = withName((n) => onCreate(n));
  const join = withName((n) => {
    if (code) onJoin(code, n);
  });

  return (
    <Modal labelledBy="online-title" onClose={onBack} className="online-lobby" testId="online-lobby">
      <h2 id="online-title" className="modal__title">
        CHƠI ONLINE
      </h2>
      <p className="online-lobby__lead">
        {initialRoomId ? (
          <>
            Bạn được mời vào phòng <b className="room-code">{initialRoomId}</b>
          </>
        ) : (
          'Tạo phòng riêng rồi gửi link cho bạn bè, hoặc nhập mã phòng.'
        )}
      </p>
      <form className="online-lobby__form" onSubmit={initialRoomId ? join : create} noValidate>
        <label className="field" htmlFor="online-nickname">
          <span className="field__label">Tên của bạn</span>
          <input
            id="online-nickname"
            className="field__input"
            value={nickname}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            placeholder="VD: Tuấn"
            data-autofocus
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'online-nickname-error' : undefined}
            data-testid="nickname-input"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        {nameError && (
          <p id="online-nickname-error" className="field__error" role="alert">
            {nameError}
          </p>
        )}
        {!initialRoomId && (
          <button type="submit" className="btn btn--primary online-lobby__create" disabled={busy} data-testid="create-room">
            TẠO PHÒNG
          </button>
        )}
        {!initialRoomId && <div className="online-lobby__or">hoặc</div>}
        <div className="online-lobby__join">
          <label className="field" htmlFor="online-room">
            <span className="field__label">Mã phòng</span>
            <input
              id="online-room"
              className="field__input field__input--code"
              value={roomId}
              maxLength={ROOM_ID_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="KX7P9A"
              readOnly={Boolean(initialRoomId)}
              data-testid="room-input"
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            />
          </label>
          <button
            type={initialRoomId ? 'submit' : 'button'}
            className={initialRoomId ? 'btn btn--primary' : 'btn'}
            disabled={busy || !code}
            data-testid="join-room"
            onClick={initialRoomId ? undefined : () => join()}
          >
            VÀO PHÒNG
          </button>
        </div>
      </form>
      {busy && (
        <p className="online-lobby__status" role="status">
          Đang kết nối...
        </p>
      )}
      {problem && !busy && (
        <p className="online-lobby__problem" role="alert" data-testid="online-problem" data-code={problem}>
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      <button type="button" className="btn btn--ghost online-lobby__back" onClick={onBack}>
        QUAY LẠI
      </button>
    </Modal>
  );
}
