import { getPieceAsset } from '../config/assets.ts';
import type { PieceType } from '../config/assets.ts';
import { PIECE_GLYPHS, PIECE_NAMES_VI } from '../config/pieceIdentity.ts';
import { Modal } from './ui/Modal.tsx';

const PIECES: { type: PieceType; text: string }[] = [
  { type: 'general', text: 'Đi 1 ô ngang hoặc dọc, chỉ trong Cửu cung.' },
  { type: 'advisor', text: 'Đi 1 ô chéo, chỉ trong Cửu cung.' },
  { type: 'elephant', text: 'Đi chéo đúng 2 ô; không qua sông; bị chặn nếu ô giữa có quân ("mắt tượng").' },
  { type: 'knight', text: 'Đi hình chữ L; bị chặn nếu ô liền kề theo hướng đi có quân ("cản chân mã").' },
  { type: 'rook', text: 'Đi ngang/dọc bao xa cũng được, không nhảy qua quân.' },
  { type: 'cannon', text: 'Đi như Xe; khi ăn quân phải nhảy qua đúng 1 quân (ngòi).' },
  { type: 'pawn', text: 'Đi thẳng 1 ô; qua sông được đi ngang; không bao giờ lùi.' },
];

/** How to play: goal, pieces and special rules. Does not affect the game. */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal labelledBy="help-title" onClose={onClose} closeOnBackdrop className="help" testId="help-dialog">
      <div className="help__head">
        <h2 id="help-title" className="modal__title">
          CÁCH CHƠI
        </h2>
        <button type="button" className="btn btn--icon" aria-label="Đóng hướng dẫn" data-autofocus onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="help__body">
        <section>
          <h3>Mục tiêu</h3>
          <p>
            Chiếu bí Tướng đối phương (hoặc bắt được Tướng), hoặc khiến đối phương không còn nước đi hợp lệ. Bạn cầm quân{' '}
            <b className="red">Đỏ</b> và đi trước.
          </p>
        </section>
        <section>
          <h3>Các quân cờ</h3>
          <ul className="help__pieces">
            {PIECES.map(({ type, text }) => (
              <li key={type}>
                <img src={getPieceAsset('red', type)} alt="" aria-hidden="true" />
                <span className="help__glyphs">
                  <span className="red">{PIECE_GLYPHS.red[type]}</span>
                  {PIECE_GLYPHS.blue[type] !== PIECE_GLYPHS.red[type] && (
                    <>
                      {' / '}
                      <span className="blue">{PIECE_GLYPHS.blue[type]}</span>
                    </>
                  )}
                </span>
                <span className="help__name">{PIECE_NAMES_VI[type]}</span>
                <span className="help__text">{text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Luật đặc biệt</h3>
          <ul className="help__rules">
            <li>
              <b>Cản chân Mã:</b> nếu ô sát Mã theo hướng đi có quân, Mã không đi được hướng đó.
            </li>
            <li>
              <b>Tượng không qua sông:</b> Tượng chỉ ở phần sân nhà.
            </li>
            <li>
              <b>Pháo:</b> đi như Xe, nhưng ăn quân bằng cách nhảy qua đúng một quân.
            </li>
            <li>
              <b>Lộ mặt Tướng:</b> hai Tướng không được đối mặt trên cùng một cột mà không có quân nào ở giữa.
            </li>
            <li>
              <b>Sông (楚河 漢界):</b> dải giữa bàn cờ, giữa hàng 5 và 6. Tốt qua sông được đi ngang.
            </li>
            <li>
              <b>Bế tắc:</b> bên đến lượt mà không còn nước đi hợp lệ thì thua.
            </li>
          </ul>
          <svg className="help__river" viewBox="0 0 90 40" aria-label="Sơ đồ sông giữa bàn cờ" role="img">
            <rect x="5" y="3" width="80" height="34" className="help__river-board" />
            <rect x="5" y="15" width="80" height="10" className="help__river-band" />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <g key={i}>
                <line x1={5 + i * 10} y1="3" x2={5 + i * 10} y2="15" />
                <line x1={5 + i * 10} y1="25" x2={5 + i * 10} y2="37" />
              </g>
            ))}
            <text x="45" y="22.5" textAnchor="middle">
              SÔNG
            </text>
          </svg>
        </section>
        <section>
          <h3>Điều khiển</h3>
          <p>Chạm/nhấp một quân Đỏ để chọn, rồi chạm vào điểm xanh để đi hoặc vòng đỏ để ăn quân. Esc: bỏ chọn · M: bật/tắt âm thanh.</p>
        </section>
      </div>
    </Modal>
  );
}
