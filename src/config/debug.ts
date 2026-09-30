/**
 * Development-only debug switch. Off by default so the normal board shows
 * only the real pieces.
 *
 * Can be overridden per page load with the URL param ?debug=1 / ?debug=0.
 */
export const BOARD_DEBUG_DEFAULT = false;

function readFlag(name: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const value = new URLSearchParams(window.location.search).get(name);
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

export function isBoardDebugEnabled(): boolean {
  return readFlag('debug', BOARD_DEBUG_DEFAULT);
}
