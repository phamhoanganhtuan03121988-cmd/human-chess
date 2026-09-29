import { Modal } from './ui/Modal.tsx';

interface ConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/** "Start a new game?" confirmation (only shown mid-game). */
export function ConfirmNewGameDialog({ onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal labelledBy="confirm-title" onClose={onCancel} closeOnBackdrop className="confirm" testId="confirm-new-game">
      <h2 id="confirm-title" className="modal__title">
        BẮT ĐẦU VÁN MỚI?
      </h2>
      <p className="modal__text">Ván hiện tại sẽ bị mất.</p>
      <div className="modal__actions">
        <button type="button" className="btn" data-autofocus onClick={onCancel}>
          HỦY
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          VÁN MỚI
        </button>
      </div>
    </Modal>
  );
}
