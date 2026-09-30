/**
 * Authoritative room server (transport-independent).
 *
 * Owns every room's state and decides everything: seats, turn order, move
 * numbers, legality (with the shared engine), game over and surrender.
 * Clients only send requests; nothing a client sends about the board is
 * trusted. The WebSocket host (server/index.ts) and the tests' loopback
 * transport both drive this same class.
 */
import { applyMove, createInitialGameState, opponent } from '../engine/index.ts';
import type { GameState, Move, Side } from '../engine/index.ts';
import type { ClientMessage, ErrorCode, RejectReason, ServerMessage } from './protocol.ts';
import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH, decode, parseClientMessage } from './protocol.ts';
import type { EndReason, OnlineRoomState, PlayerInfo, RoomStatus, SeatCredentials } from './types.ts';
import { isValidMove, normalizeNickname, normalizeRoomId } from './validation.ts';

/** One live connection as the room server sees it. */
export interface ServerConnection {
  readonly id: string;
  send(message: ServerMessage): void;
}

interface Seat {
  readonly id: string;
  readonly token: string;
  readonly nickname: string;
  readonly side: Side;
  connId: string | null;
}

interface Room {
  readonly id: string;
  status: RoomStatus;
  game: GameState;
  moves: Move[];
  red: Seat | null;
  blue: Seat | null;
  winner: Side | null;
  endReason: EndReason | null;
  /** Last time anything happened (for closing abandoned rooms). */
  touchedAt: number;
}

export interface RoomServerOptions {
  now?: () => number;
  /** Random string source (tests make it deterministic). */
  random?: () => number;
  /** Rooms with nobody connected are closed after this long (ms). */
  idleCloseMs?: number;
  /** Max messages per connection per rate window. */
  rateLimit?: number;
  rateWindowMs?: number;
  /** Max MOVE_REQUESTs per connection per rate window. */
  moveRateLimit?: number;
}

/** Seat tokens and room codes come from the platform CSPRNG when available. */
function secureRandom(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
  return Math.random();
}

const DEFAULTS = {
  idleCloseMs: 10 * 60_000,
  rateLimit: 30,
  rateWindowMs: 5_000,
  moveRateLimit: 6,
};

interface ConnState {
  readonly conn: ServerConnection;
  roomId: string | null;
  seatId: string | null;
  windowStart: number;
  messages: number;
  moves: number;
}

export class RoomServer {
  private readonly rooms = new Map<string, Room>();
  private readonly conns = new Map<string, ConnState>();
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly opts: typeof DEFAULTS;

  constructor(options: RoomServerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? secureRandom;
    this.opts = {
      idleCloseMs: options.idleCloseMs ?? DEFAULTS.idleCloseMs,
      rateLimit: options.rateLimit ?? DEFAULTS.rateLimit,
      rateWindowMs: options.rateWindowMs ?? DEFAULTS.rateWindowMs,
      moveRateLimit: options.moveRateLimit ?? DEFAULTS.moveRateLimit,
    };
  }

  // ---- connections --------------------------------------------------------

  connect(conn: ServerConnection): void {
    this.conns.set(conn.id, { conn, roomId: null, seatId: null, windowStart: this.now(), messages: 0, moves: 0 });
  }

  /** The socket went away: the seat stays reserved so the player can reconnect. */
  disconnect(connId: string): void {
    const c = this.conns.get(connId);
    this.conns.delete(connId);
    if (!c?.roomId) return;
    const room = this.rooms.get(c.roomId);
    const seat = room && this.seatById(room, c.seatId);
    if (!room || !seat || seat.connId !== connId) return;
    seat.connId = null;
    room.touchedAt = this.now();
    this.broadcast(room, { type: 'PLAYER_LEFT', side: seat.side, reason: 'disconnected', room: this.view(room) }, seat.side);
  }

  /** Raw text from a connection. */
  receive(connId: string, raw: string): void {
    this.handle(connId, decode(raw));
  }

  /** Parsed JSON from a connection (validated here). */
  handle(connId: string, value: unknown): void {
    const c = this.conns.get(connId);
    if (!c) return;
    if (!this.withinRate(c, false)) return c.conn.send({ type: 'ERROR', code: 'RATE_LIMITED' });
    const msg = parseClientMessage(value);
    if (!msg) return c.conn.send({ type: 'ERROR', code: 'BAD_MESSAGE' });
    switch (msg.type) {
      case 'PING':
        return c.conn.send({ type: 'PONG', t: msg.t });
      case 'CREATE_ROOM':
        return this.createRoom(c, msg.nickname);
      case 'JOIN_ROOM':
        return this.joinRoom(c, msg.roomId, msg.nickname);
      case 'RECONNECT':
        return this.reconnect(c, msg);
      case 'SYNC_REQUEST':
        return this.sync(c, msg.roomId, msg.playerId);
      case 'MOVE_REQUEST':
        return this.move(c, msg);
      case 'SURRENDER':
        return this.surrender(c, msg.roomId, msg.playerId);
      case 'LEAVE_ROOM':
        return this.leave(c, msg.roomId, msg.playerId);
    }
  }

  /** Closes rooms nobody has been connected to for a while. Call periodically. */
  sweep(): void {
    const t = this.now();
    for (const room of this.rooms.values()) {
      const anyone = room.red?.connId || room.blue?.connId;
      if (!anyone && t - room.touchedAt >= this.opts.idleCloseMs) {
        room.status = 'closed';
        this.rooms.delete(room.id);
      }
    }
  }

  /** Test / monitoring view of a room. */
  getRoom(roomId: string): OnlineRoomState | null {
    const room = this.rooms.get(roomId);
    return room ? this.view(room) : null;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  // ---- lobby ----------------------------------------------------------------

  private createRoom(c: ConnState, rawNickname: string): void {
    const nickname = normalizeNickname(rawNickname);
    if (!nickname) return c.conn.send({ type: 'ERROR', code: 'INVALID_NICKNAME' });
    let id = this.randomRoomId();
    while (this.rooms.has(id)) id = this.randomRoomId();
    const room: Room = {
      id,
      status: 'waiting',
      game: createInitialGameState(),
      moves: [],
      red: null,
      blue: null,
      winner: null,
      endReason: null,
      touchedAt: this.now(),
    };
    room.red = this.newSeat('red', nickname, c.conn.id);
    this.rooms.set(id, room);
    this.bind(c, room, room.red);
    c.conn.send({ type: 'ROOM_JOINED', you: this.credentials(room, room.red), room: this.view(room), moves: [] });
  }

  private joinRoom(c: ConnState, rawRoomId: string, rawNickname: string): void {
    const roomId = normalizeRoomId(rawRoomId);
    if (!roomId) return c.conn.send({ type: 'ERROR', code: 'INVALID_ROOM_ID' });
    const nickname = normalizeNickname(rawNickname);
    if (!nickname) return c.conn.send({ type: 'ERROR', code: 'INVALID_NICKNAME' });
    const room = this.rooms.get(roomId);
    if (!room) return c.conn.send({ type: 'ERROR', code: 'ROOM_NOT_FOUND' });
    if (room.status === 'finished' || room.status === 'closed') {
      return c.conn.send({ type: 'ERROR', code: 'ROOM_FINISHED', room: this.view(room) });
    }
    if (room.red && room.blue) return c.conn.send({ type: 'ERROR', code: 'ROOM_FULL', room: this.view(room) });
    // The creator is Red; the second player always gets the free seat (Blue).
    const side: Side = room.red ? 'blue' : 'red';
    const seat = this.newSeat(side, nickname, c.conn.id);
    if (side === 'red') room.red = seat;
    else room.blue = seat;
    if (room.red && room.blue) room.status = 'playing';
    room.touchedAt = this.now();
    this.bind(c, room, seat);
    c.conn.send({ type: 'ROOM_JOINED', you: this.credentials(room, seat), room: this.view(room), moves: [...room.moves] });
    this.broadcast(room, { type: 'PLAYER_JOINED', side, nickname, room: this.view(room) }, side);
  }

  private reconnect(c: ConnState, msg: Extract<ClientMessage, { type: 'RECONNECT' }>): void {
    const room = this.rooms.get(normalizeRoomId(msg.roomId) ?? '');
    const seat = room && this.seatById(room, msg.playerId);
    if (!room || !seat || seat.token !== msg.token) return c.conn.send({ type: 'ERROR', code: 'SESSION_INVALID' });
    // A newer connection takes over the seat (e.g. a refreshed tab).
    if (seat.connId && seat.connId !== c.conn.id) {
      const old = this.conns.get(seat.connId);
      if (old) {
        old.roomId = null;
        old.seatId = null;
      }
    }
    seat.connId = c.conn.id;
    room.touchedAt = this.now();
    this.bind(c, room, seat);
    c.conn.send({ type: 'SYNC_STATE', you: this.credentials(room, seat), room: this.view(room), moves: [...room.moves] });
    this.broadcast(room, { type: 'ROOM_STATE', room: this.view(room) }, seat.side);
  }

  private sync(c: ConnState, roomId: string, playerId: string): void {
    const found = this.seated(c, roomId, playerId);
    if (!found) return c.conn.send({ type: 'ERROR', code: 'NOT_IN_ROOM' });
    const { room, seat } = found;
    c.conn.send({ type: 'SYNC_STATE', you: this.credentials(room, seat), room: this.view(room), moves: [...room.moves] });
  }

  // ---- play -----------------------------------------------------------------

  private move(c: ConnState, msg: Extract<ClientMessage, { type: 'MOVE_REQUEST' }>): void {
    const reject = (reason: RejectReason) =>
      c.conn.send({ type: 'MOVE_REJECTED', roomId: msg.roomId, moveNumber: msg.moveNumber, reason });
    if (!this.withinRate(c, true)) return reject('RATE_LIMITED');
    // The connection itself must hold the seat: a playerId in the payload is not enough.
    const room = c.roomId ? this.rooms.get(c.roomId) : undefined;
    if (!room || room.id !== normalizeRoomId(msg.roomId)) return reject('NOT_IN_ROOM');
    const seat = this.seatById(room, c.seatId);
    if (!seat || seat.connId !== c.conn.id) return reject('NOT_IN_ROOM');
    if (seat.id !== msg.playerId) return reject('WRONG_PLAYER');
    if (room.status !== 'playing') return reject('NOT_PLAYING');
    // Sequence first: a retransmitted move arrives when it is already the opponent's turn.
    const expected = room.moves.length + 1;
    if (msg.moveNumber < expected) return reject('DUPLICATE');
    if (msg.moveNumber > expected) return reject('OUT_OF_SEQUENCE');
    if (room.game.turn !== seat.side) return reject('NOT_YOUR_TURN');
    const move: Move = { from: msg.from, to: msg.to };
    if (!isValidMove(room.game, move)) return reject('ILLEGAL_MOVE');

    const result = applyMove(room.game, move);
    if (!result.ok) return reject('ILLEGAL_MOVE');
    room.game = result.state;
    room.moves.push(move);
    room.touchedAt = this.now();
    if (room.game.status !== 'playing') {
      room.status = 'finished';
      room.winner = room.game.winner;
      room.endReason = room.game.status;
    }
    const view = this.view(room);
    this.broadcast(room, { type: 'MOVE_ACCEPTED', roomId: room.id, moveNumber: expected, move, side: seat.side, room: view });
    if (room.status === 'finished' && room.winner && room.endReason) {
      this.broadcast(room, { type: 'GAME_OVER', roomId: room.id, winner: room.winner, reason: room.endReason, room: view });
    }
  }

  private surrender(c: ConnState, roomId: string, playerId: string): void {
    const found = this.seated(c, roomId, playerId);
    if (!found) return c.conn.send({ type: 'ERROR', code: 'NOT_IN_ROOM' });
    const { room, seat } = found;
    if (room.status !== 'playing') return c.conn.send({ type: 'ERROR', code: 'ROOM_FINISHED', room: this.view(room) });
    this.finish(room, opponent(seat.side), 'surrender');
  }

  /** Leaving a waiting room closes it; leaving a game in progress counts as surrender. */
  private leave(c: ConnState, roomId: string, playerId: string): void {
    const found = this.seated(c, roomId, playerId);
    if (!found) return;
    const { room, seat } = found;
    if (room.status === 'playing') this.finish(room, opponent(seat.side), 'surrender');
    seat.connId = null;
    c.roomId = null;
    c.seatId = null;
    if (room.status === 'waiting') {
      room.status = 'closed';
      this.rooms.delete(room.id);
      return;
    }
    room.touchedAt = this.now();
    this.broadcast(room, { type: 'PLAYER_LEFT', side: seat.side, reason: 'left', room: this.view(room) }, seat.side);
  }

  private finish(room: Room, winner: Side, reason: EndReason): void {
    room.status = 'finished';
    room.winner = winner;
    room.endReason = reason;
    room.touchedAt = this.now();
    this.broadcast(room, { type: 'GAME_OVER', roomId: room.id, winner, reason, room: this.view(room) });
  }

  // ---- helpers --------------------------------------------------------------

  private withinRate(c: ConnState, isMove: boolean): boolean {
    const t = this.now();
    if (t - c.windowStart >= this.opts.rateWindowMs) {
      c.windowStart = t;
      c.messages = 0;
      c.moves = 0;
    }
    if (isMove) return ++c.moves <= this.opts.moveRateLimit;
    return ++c.messages <= this.opts.rateLimit;
  }

  private seated(c: ConnState, roomId: string, playerId: string): { room: Room; seat: Seat } | null {
    const room = c.roomId ? this.rooms.get(c.roomId) : undefined;
    if (!room || room.id !== normalizeRoomId(roomId)) return null;
    const seat = this.seatById(room, c.seatId);
    if (!seat || seat.id !== playerId || seat.connId !== c.conn.id) return null;
    return { room, seat };
  }

  private seatById(room: Room, id: string | null | undefined): Seat | null {
    if (!id) return null;
    if (room.red?.id === id) return room.red;
    if (room.blue?.id === id) return room.blue;
    return null;
  }

  private bind(c: ConnState, room: Room, seat: Seat): void {
    // One seat per connection: joining another room releases the previous seat.
    if (c.roomId && (c.roomId !== room.id || c.seatId !== seat.id)) {
      const prev = this.rooms.get(c.roomId);
      const prevSeat = prev && this.seatById(prev, c.seatId);
      if (prevSeat && prevSeat.connId === c.conn.id) prevSeat.connId = null;
    }
    c.roomId = room.id;
    c.seatId = seat.id;
    seat.connId = c.conn.id;
  }

  private newSeat(side: Side, nickname: string, connId: string): Seat {
    return { id: this.randomToken(12), token: this.randomToken(24), nickname, side, connId };
  }

  private credentials(room: Room, seat: Seat): SeatCredentials {
    return { roomId: room.id, playerId: seat.id, token: seat.token, side: seat.side, nickname: seat.nickname };
  }

  private broadcast(room: Room, message: ServerMessage, exceptSide?: Side): void {
    for (const seat of [room.red, room.blue]) {
      if (!seat || !seat.connId || seat.side === exceptSide) continue;
      this.conns.get(seat.connId)?.conn.send(message);
    }
  }

  private view(room: Room): OnlineRoomState {
    const info = (seat: Seat | null): PlayerInfo | null =>
      seat ? { id: seat.id, nickname: seat.nickname, side: seat.side, connected: seat.connId !== null } : null;
    return {
      roomId: room.id,
      status: room.status,
      redPlayer: info(room.red),
      bluePlayer: info(room.blue),
      currentTurn: room.game.turn,
      moveNumber: room.moves.length,
      lastMove: room.moves[room.moves.length - 1] ?? null,
      winner: room.winner,
      endReason: room.endReason,
    };
  }

  private randomRoomId(): string {
    let id = '';
    for (let i = 0; i < ROOM_ID_LENGTH; i++) id += ROOM_ID_ALPHABET[Math.floor(this.random() * ROOM_ID_ALPHABET.length)];
    return id;
  }

  private randomToken(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < length; i++) s += chars[Math.floor(this.random() * chars.length)];
    return s;
  }
}

export type { ErrorCode };
