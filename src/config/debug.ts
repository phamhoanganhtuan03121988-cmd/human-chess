/**
 * Development-only debug switches. Remove or set to false once the board
 * is verified.
 *
 * Can be overridden per page load with URL params:
 *   ?debug=0 / ?debug=1         board debug overlay
 *   ?markers=0 / ?markers=1     starting-position debug markers
 */
export const BOARD_DEBUG_DEFAULT = true;
export const PIECE_MARKERS_DEFAULT = true;

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

export function arePieceMarkersEnabled(): boolean {
  return readFlag('markers', PIECE_MARKERS_DEFAULT);
}
