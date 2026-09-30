/**
 * Wire protocol between the game client and the room server (JSON text
 * messages). Only moves travel over the network — never the board; each
 * side rebuilds positions with the shared engine.
 *
 * Every incoming message is untrusted: parseClientMessage / parseServerMessage
 * check shape and limits before anything else looks at it.
 */
import type { Move, Position, Side } from '../engine/index.ts';
import type { EndReason, OnlineRoomState, SeatCredentials } from './types.ts';

/** Upper bound for one message (bytes of JSON text). Leaves room for future chat, which is not implemented. */
export const MAX_MESSAGE_BYTES = 4096;
export const NICKNAME_MAX = 16;
export const ROOM_ID_LENGTH = 6;
/** Room codes avoid look-alike characters (no 0/O, 1/I/L). */
export const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

// ---- client → server --------------------------------------------------------

export type ClientMessage =
  | { readonly type: 'CREATE_ROOM'; readonly nickname: string }
  | { readonly type: 'JOIN_ROOM'; readonly roomId: string; readonly nickname: string }
  | { readonly type: 'RECONNECT'; readonly roomId: string; readonly playerId: string; readonly token: string }
  | { readonly type: 'SYNC_REQUEST'; readonly roomId: string; readonly playerId: string }
  | {
      readonly type: 'MOVE_REQUEST';
      readonly roomId: string;
      readonly playerId: string;
      /** The number this move would get (current moveNumber + 1). */
      readonly moveNumber: number;
      readonly from: Position;
      readonly to: Position;
    }
  | { readonly type: 'SURRENDER'; readonly roomId: string; readonly playerId: string }
  | { readonly type: 'LEAVE_ROOM'; readonly roomId: string; readonly playerId: string }
  | { readonly type: 'PING'; readonly t: number };

// ---- server → client --------------------------------------------------------

export type ErrorCode =
  | 'BAD_MESSAGE'
  | 'RATE_LIMITED'
  | 'INVALID_NICKNAME'
  | 'INVALID_ROOM_ID'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_FINISHED'
  | 'SESSION_INVALID'
  | 'NOT_IN_ROOM';

export type RejectReason =
  | 'NOT_IN_ROOM'
  | 'NOT_PLAYING'
  | 'WRONG_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'DUPLICATE'
  | 'OUT_OF_SEQUENCE'
  | 'ILLEGAL_MOVE'
  | 'RATE_LIMITED';

export type ServerMessage =
  /** Reply to CREATE_ROOM / JOIN_ROOM: your seat, the room and the moves so far. */
  | { readonly type: 'ROOM_JOINED'; readonly you: SeatCredentials; readonly room: OnlineRoomState; readonly moves: readonly Move[] }
  | { readonly type: 'ROOM_STATE'; readonly room: OnlineRoomState }
  | { readonly type: 'PLAYER_JOINED'; readonly side: Side; readonly nickname: string; readonly room: OnlineRoomState }
  | { readonly type: 'PLAYER_LEFT'; readonly side: Side; readonly reason: 'disconnected' | 'left'; readonly room: OnlineRoomState }
  /** Full resynchronisation (after RECONNECT or SYNC_REQUEST). */
  | { readonly type: 'SYNC_STATE'; readonly you: SeatCredentials; readonly room: OnlineRoomState; readonly moves: readonly Move[] }
  | { readonly type: 'MOVE_ACCEPTED'; readonly roomId: string; readonly moveNumber: number; readonly move: Move; readonly side: Side; readonly room: OnlineRoomState }
  | { readonly type: 'MOVE_REJECTED'; readonly roomId: string; readonly moveNumber: number; readonly reason: RejectReason }
  | { readonly type: 'GAME_OVER'; readonly roomId: string; readonly winner: Side; readonly reason: EndReason; readonly room: OnlineRoomState }
  | { readonly type: 'ERROR'; readonly code: ErrorCode; readonly room?: OnlineRoomState }
  | { readonly type: 'PONG'; readonly t: number };

// ---- parsing ----------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isPos = (v: unknown): v is Position => isObj(v) && isInt(v.x, 0, 8) && isInt(v.y, 0, 9) && Object.keys(v).length === 2;

/** Decodes raw text into JSON, enforcing the size limit. */
export function decode(raw: string): unknown {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** A well-formed client message, or null. (Semantic checks happen in the room server.) */
export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isObj(value) || typeof value.type !== 'string') return null;
  const v = value;
  const id = (k: string) => isStr(v[k], 64);
  switch (v.type) {
    case 'CREATE_ROOM':
      return typeof v.nickname === 'string' && v.nickname.length <= 64 ? { type: 'CREATE_ROOM', nickname: v.nickname } : null;
    case 'JOIN_ROOM':
      return id('roomId') && typeof v.nickname === 'string' && v.nickname.length <= 64
        ? { type: 'JOIN_ROOM', roomId: v.roomId as string, nickname: v.nickname }
        : null;
    case 'RECONNECT':
      return id('roomId') && id('playerId') && id('token')
        ? { type: 'RECONNECT', roomId: v.roomId as string, playerId: v.playerId as string, token: v.token as string }
        : null;
    case 'SYNC_REQUEST':
    case 'SURRENDER':
    case 'LEAVE_ROOM':
      return id('roomId') && id('playerId') ? { type: v.type, roomId: v.roomId as string, playerId: v.playerId as string } : null;
    case 'MOVE_REQUEST':
      return id('roomId') && id('playerId') && isInt(v.moveNumber, 1, 10_000) && isPos(v.from) && isPos(v.to)
        ? {
            type: 'MOVE_REQUEST',
            roomId: v.roomId as string,
            playerId: v.playerId as string,
            moveNumber: v.moveNumber as number,
            from: { x: v.from.x, y: v.from.y },
            to: { x: v.to.x, y: v.to.y },
          }
        : null;
    case 'PING':
      return typeof v.t === 'number' && Number.isFinite(v.t) ? { type: 'PING', t: v.t } : null;
    default:
      return null;
  }
}

const SERVER_TYPES = new Set([
  'ROOM_JOINED',
  'ROOM_STATE',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'SYNC_STATE',
  'MOVE_ACCEPTED',
  'MOVE_REJECTED',
  'GAME_OVER',
  'ERROR',
  'PONG',
]);

/** Server messages come from our own server; the client still checks the envelope and move shapes. */
export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isObj(value) || typeof value.type !== 'string' || !SERVER_TYPES.has(value.type)) return null;
  if (value.type === 'MOVE_ACCEPTED') {
    const m = value.move;
    if (!isInt(value.moveNumber, 1, 10_000) || !isObj(m) || !isPos(m.from) || !isPos(m.to)) return null;
  }
  if ((value.type === 'ROOM_JOINED' || value.type === 'SYNC_STATE') && !Array.isArray(value.moves)) return null;
  return value as unknown as ServerMessage;
}
