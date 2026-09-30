/**
 * Multiplayer client (no React). Keeps one connection to the room server,
 * reconnects with back-off, rejoins its seat after a refresh or a network
 * drop, and keeps the authoritative move list in server order.
 *
 * The client never decides that a move happened: moves appear here only when
 * the server sends MOVE_ACCEPTED with the next move number. Anything out of
 * sequence triggers a full SYNC_STATE instead of being applied.
 */
import type { Move, Side } from '../engine/index.ts';
import type { ErrorCode, RejectReason, ServerMessage } from './protocol.ts';
import { decode, parseServerMessage } from './protocol.ts';
import { clearSession, saveSession } from './session.ts';
import type { Transport, TransportFactory } from './transport.ts';
import type { EndReason, OnlineRoomState, SeatCredentials } from './types.ts';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

export type ClientEvent =
  | { readonly type: 'status'; readonly status: ConnectionStatus }
  /** Seat obtained (create / join) or restored (reconnect / sync): replaces the move list. */
  | { readonly type: 'seated'; readonly you: SeatCredentials; readonly room: OnlineRoomState; readonly moves: readonly Move[] }
  | { readonly type: 'room'; readonly room: OnlineRoomState }
  | { readonly type: 'playerLeft'; readonly side: Side; readonly reason: 'disconnected' | 'left'; readonly room: OnlineRoomState }
  /** The next move, in order (moveNumber === moves.length after it). */
  | { readonly type: 'move'; readonly moveNumber: number; readonly move: Move; readonly side: Side; readonly room: OnlineRoomState }
  | { readonly type: 'rejected'; readonly moveNumber: number; readonly reason: RejectReason }
  | { readonly type: 'gameOver'; readonly winner: Side; readonly reason: EndReason; readonly room: OnlineRoomState }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly room?: OnlineRoomState };

export interface ClientOptions {
  /** Delays between reconnect attempts (ms); the last value repeats. */
  backoffMs?: readonly number[];
  pingMs?: number;
  /** No message from the server for this long → treat the connection as dead. */
  deadAfterMs?: number;
  /** Persist the seat in localStorage (default true). */
  persist?: boolean;
}

const DEFAULT_BACKOFF = [500, 1000, 2000, 4000, 8000];

export class MultiplayerClient {
  status: ConnectionStatus = 'idle';
  seat: SeatCredentials | null = null;
  room: OnlineRoomState | null = null;
  /** Authoritative moves, in server order. */
  moves: Move[] = [];

  private transport: Transport | null = null;
  private readonly listeners = new Set<(e: ClientEvent) => void>();
  private readonly queue: string[] = [];
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeard = 0;
  private disposed = false;
  private readonly backoff: readonly number[];
  private readonly pingMs: number;
  private readonly deadAfterMs: number;
  private readonly persist: boolean;

  constructor(
    private readonly factory: TransportFactory,
    options: ClientOptions = {},
  ) {
    this.backoff = options.backoffMs ?? DEFAULT_BACKOFF;
    this.pingMs = options.pingMs ?? 15_000;
    this.deadAfterMs = options.deadAfterMs ?? 40_000;
    this.persist = options.persist ?? true;
  }

  subscribe(listener: (e: ClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  createRoom(nickname: string): void {
    this.request({ type: 'CREATE_ROOM', nickname });
  }

  joinRoom(roomId: string, nickname: string): void {
    this.request({ type: 'JOIN_ROOM', roomId, nickname });
  }

  /** Rejoin a remembered seat (after a refresh). */
  resume(seat: SeatCredentials): void {
    this.seat = seat;
    this.ensureConnected();
    if (this.status === 'connected') this.sendNow({ type: 'RECONNECT', roomId: seat.roomId, playerId: seat.playerId, token: seat.token });
  }

  /** Asks the server to play `move` as move number `moveNumber`. False if offline (nothing sent). */
  requestMove(moveNumber: number, move: Move): boolean {
    if (!this.seat || this.status !== 'connected') return false;
    this.sendNow({
      type: 'MOVE_REQUEST',
      roomId: this.seat.roomId,
      playerId: this.seat.playerId,
      moveNumber,
      from: move.from,
      to: move.to,
    });
    return true;
  }

  surrender(): boolean {
    if (!this.seat || this.status !== 'connected') return false;
    this.sendNow({ type: 'SURRENDER', roomId: this.seat.roomId, playerId: this.seat.playerId });
    return true;
  }

  requestSync(): void {
    if (this.seat && this.status === 'connected') {
      this.sendNow({ type: 'SYNC_REQUEST', roomId: this.seat.roomId, playerId: this.seat.playerId });
    }
  }

  /** Leave the room (a game in progress counts as surrender) and forget the seat. */
  leave(): void {
    if (this.seat && this.status === 'connected') {
      this.sendNow({ type: 'LEAVE_ROOM', roomId: this.seat.roomId, playerId: this.seat.playerId });
    }
    this.forgetSeat();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    const t = this.transport;
    this.transport = null;
    t?.close();
    this.listeners.clear();
  }

  // ---- connection -----------------------------------------------------------

  private request(message: object): void {
    const text = JSON.stringify(message);
    this.ensureConnected();
    if (this.status === 'connected') this.transport?.send(text);
    else this.queue.push(text);
  }

  private sendNow(message: object): void {
    this.transport?.send(JSON.stringify(message));
  }

  private ensureConnected(): void {
    if (this.disposed || this.transport) return;
    this.setStatus(this.seat ? 'reconnecting' : 'connecting');
    const t = this.factory();
    this.transport = t;
    t.onOpen = () => {
      if (this.transport !== t) return;
      this.attempt = 0;
      this.lastHeard = Date.now();
      this.setStatus('connected');
      this.startPing();
      if (this.seat) {
        this.sendNow({ type: 'RECONNECT', roomId: this.seat.roomId, playerId: this.seat.playerId, token: this.seat.token });
      }
      for (const text of this.queue.splice(0)) t.send(text);
    };
    t.onMessage = (text) => {
      if (this.transport !== t) return;
      this.lastHeard = Date.now();
      const msg = parseServerMessage(decode(text));
      if (msg) this.onServerMessage(msg);
    };
    t.onClose = () => {
      if (this.transport !== t) return;
      this.transport = null;
      this.clearTimers();
      if (this.disposed) return;
      if (this.seat) {
        // Keep trying: the seat is reserved on the server.
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      } else {
        this.queue.length = 0;
        this.setStatus('offline');
      }
    };
  }

  private scheduleReconnect(): void {
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)]!;
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastHeard > this.deadAfterMs) {
        this.transport?.close(); // silent connection: reconnect
        return;
      }
      this.sendNow({ type: 'PING', t: Date.now() });
    }, this.pingMs);
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pingTimer = null;
    this.reconnectTimer = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.emit({ type: 'status', status });
  }

  private forgetSeat(): void {
    this.seat = null;
    this.room = null;
    this.moves = [];
    if (this.persist) clearSession();
  }

  // ---- messages ---------------------------------------------------------------

  private onServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'ROOM_JOINED':
      case 'SYNC_STATE':
        this.seat = msg.you;
        this.room = msg.room;
        this.moves = msg.moves.map((m) => ({ from: m.from, to: m.to }));
        if (this.persist) saveSession(msg.you);
        return this.emit({ type: 'seated', you: msg.you, room: msg.room, moves: this.moves });
      case 'ROOM_STATE':
      case 'PLAYER_JOINED':
        this.room = msg.room;
        return this.emit({ type: 'room', room: msg.room });
      case 'PLAYER_LEFT':
        this.room = msg.room;
        return this.emit({ type: 'playerLeft', side: msg.side, reason: msg.reason, room: msg.room });
      case 'MOVE_ACCEPTED': {
        if (msg.moveNumber !== this.moves.length + 1) {
          // Missed or duplicated a move: never apply out of order, resynchronise instead.
          if (msg.moveNumber > this.moves.length + 1) this.requestSync();
          return;
        }
        const move = { from: msg.move.from, to: msg.move.to };
        this.moves.push(move);
        this.room = msg.room;
        return this.emit({ type: 'move', moveNumber: msg.moveNumber, move, side: msg.side, room: msg.room });
      }
      case 'MOVE_REJECTED':
        return this.emit({ type: 'rejected', moveNumber: msg.moveNumber, reason: msg.reason });
      case 'GAME_OVER':
        this.room = msg.room;
        return this.emit({ type: 'gameOver', winner: msg.winner, reason: msg.reason, room: msg.room });
      case 'ERROR':
        if (msg.code === 'SESSION_INVALID') this.forgetSeat();
        return this.emit({ type: 'error', code: msg.code, room: msg.room });
      case 'PONG':
        return;
    }
  }

  private emit(e: ClientEvent): void {
    for (const l of [...this.listeners]) l(e);
  }
}
