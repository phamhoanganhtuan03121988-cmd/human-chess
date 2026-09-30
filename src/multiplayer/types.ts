/**
 * Online multiplayer: shared types (client, room server and UI).
 * Moves use the engine's own Move/Position types — there is one rules
 * implementation (src/engine) for local play, online play, replay and the
 * server-side validation.
 */
import type { Move, Side } from '../engine/index.ts';

export type GameMode = 'local-ai' | 'online';

export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'closed';

/** Why a finished game ended. */
export type EndReason = 'checkmate' | 'stalemate' | 'general_captured' | 'surrender';

export interface PlayerInfo {
  readonly id: string;
  readonly nickname: string;
  readonly side: Side;
  /** Currently connected to the room server. */
  readonly connected: boolean;
}

/** Public room state, as the server shares it with both players. */
export interface OnlineRoomState {
  readonly roomId: string;
  readonly status: RoomStatus;
  readonly redPlayer: PlayerInfo | null;
  readonly bluePlayer: PlayerInfo | null;
  readonly currentTurn: Side;
  /** Number of moves played so far (the next move is moveNumber + 1). */
  readonly moveNumber: number;
  readonly lastMove: Move | null;
  readonly winner: Side | null;
  readonly endReason: EndReason | null;
}

/** What a player needs to rejoin their seat after a refresh or a network drop. */
export interface SeatCredentials {
  readonly roomId: string;
  readonly playerId: string;
  /** Random per-seat token issued by the server; not a password or account secret. */
  readonly token: string;
  readonly side: Side;
  readonly nickname: string;
}
