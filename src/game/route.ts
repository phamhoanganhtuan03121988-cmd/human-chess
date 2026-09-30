/**
 * Minimal routing: the game is one page; online rooms have their own URL
 * (/room/KX7P9A) so a link can be shared. Uses the History API (no router
 * dependency). Hosting must serve index.html for /room/* (see vercel.json).
 */
import { normalizeRoomId } from '../multiplayer/validation.ts';

const ROOM_PATH = /^\/room\/([^/]+)\/?$/i;

/** Room code in the current URL, or null. */
export function roomIdFromPath(pathname: string = typeof location === 'undefined' ? '/' : location.pathname): string | null {
  const m = ROOM_PATH.exec(pathname);
  return m ? normalizeRoomId(decodeURIComponent(m[1]!)) : null;
}

/** Shows the room in the address bar (or returns to /) without reloading. */
export function setRoomPath(roomId: string | null): void {
  if (typeof history === 'undefined') return;
  const path = roomId ? `/room/${roomId}` : '/';
  if (location.pathname !== path) history.replaceState(null, '', path + location.search);
}

/** Shareable link to a room. */
export function roomLink(roomId: string): string {
  const origin = typeof location === 'undefined' ? '' : location.origin;
  return `${origin}/room/${roomId}`;
}
