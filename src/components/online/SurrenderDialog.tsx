import { Modal } from '../ui/Modal.tsx';

/** Confirmation before surrendering an online game. */
export function SurrenderDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal labelledBy="surrender-title" onClose={onCancel} closeOnBackdrop className="confirm" testId="surrender-dialog">
      <h2 id="surrender-title" className="modal__title">
        ĐẦU HÀNG?
      </h2>
      <p className="modal__text">Bạn có chắc muốn đầu hàng? Đối thủ sẽ thắng ván này.</p>
      <div className="modal__actions">
        <button type="button" className="btn" data-autofocus onClick={onCancel}>
          HỦY
        </button>
        <button type="button" className="btn btn--danger" data-testid="confirm-surrender" onClick={onConfirm}>
          ĐẦU HÀNG
        </button>
      </div>
    </Modal>
  );
}
