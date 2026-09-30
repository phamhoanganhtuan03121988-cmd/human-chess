/**
 * Remembers this browser's online seat (room, player id, reconnect token,
 * side, nickname) so a refresh of /room/XXXXXX rejoins the same seat. The
 * token only identifies the seat in one short-lived room; no account secret.
 */
import type { SeatCredentials } from './types.ts';

export const SESSION_KEY = 'human-chess:online-session';
export const NICKNAME_KEY = 'human-chess:nickname';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSession(): SeatCredentials | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SeatCredentials>;
    if (
      typeof v.roomId === 'string' &&
      typeof v.playerId === 'string' &&
      typeof v.token === 'string' &&
      (v.side === 'red' || v.side === 'blue') &&
      typeof v.nickname === 'string'
    ) {
      return v as SeatCredentials;
    }
  } catch {
    /* corrupted: ignore */
  }
  return null;
}

export function saveSession(seat: SeatCredentials): void {
  try {
    storage()?.setItem(SESSION_KEY, JSON.stringify(seat));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    storage()?.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function loadNickname(): string {
  try {
    return storage()?.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(nickname: string): void {
  try {
    storage()?.setItem(NICKNAME_KEY, nickname);
  } catch {
    /* ignore */
  }
}
