import type { OnlineProblem } from '../../game/useOnlineGame.ts';
import type { ConnectionStatus } from '../../multiplayer/client.ts';

/** Player-facing explanation of an online problem. */
export const PROBLEM_TEXT: Record<OnlineProblem, string> = {
  UNAVAILABLE: 'Chế độ online chưa được cấu hình ở bản này.',
  OFFLINE: 'Không kết nối được máy chủ online. Kiểm tra mạng rồi thử lại.',
  MOVE_NOT_SENT: 'Chưa gửi được nước đi (mất kết nối). Hãy đi lại khi đã kết nối.',
  BAD_MESSAGE: 'Có lỗi kết nối, hãy thử lại.',
  RATE_LIMITED: 'Thao tác quá nhanh, hãy thử lại sau giây lát.',
  INVALID_NICKNAME: 'Tên cần từ 1 đến 16 ký tự.',
  INVALID_ROOM_ID: 'Mã phòng gồm 6 ký tự (chữ và số).',
  ROOM_NOT_FOUND: 'Phòng không tồn tại hoặc đã đóng.',
  ROOM_FULL: 'Phòng đã đủ 2 người chơi.',
  ROOM_FINISHED: 'Ván đấu trong phòng này đã kết thúc.',
  SESSION_INVALID: 'Phiên chơi cũ không còn hiệu lực.',
  NOT_IN_ROOM: 'Bạn không còn ở trong phòng này.',
};

export const CONNECTION_TEXT: Record<ConnectionStatus, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối...',
  connected: 'Đã kết nối',
  reconnecting: 'Đang kết nối lại...',
  offline: 'Mất kết nối',
};

export const SIDE_BADGE = { red: '🔴 ĐỎ', blue: '🔵 XANH' } as const;
