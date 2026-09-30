import { beforeEach, describe, expect, it } from 'vitest';
import type { Move } from '../../src/engine/index.ts';
import { RoomServer } from '../../src/multiplayer/room.ts';
import type { ServerMessage } from '../../src/multiplayer/protocol.ts';
import { ROOM_ID_PATTERN, parseClientMessage } from '../../src/multiplayer/protocol.ts';
import type { SeatCredentials } from '../../src/multiplayer/types.ts';
import { normalizeNickname, normalizeRoomId, replayMoves } from '../../src/multiplayer/validation.ts';

/** A fake connection that records what the server sends it. */
function conn(server: RoomServer, id: string) {
  const inbox: ServerMessage[] = [];
  server.connect({ id, send: (m) => inbox.push(m) });
  return {
    inbox,
    send: (m: object) => server.handle(id, m),
    last: () => inbox[inbox.length - 1]!,
    of: <T extends ServerMessage['type']>(type: T) => inbox.filter((m) => m.type === type) as Extract<ServerMessage, { type: T }>[],
  };
}

const mv = (fx: number, fy: number, tx: number, ty: number): Move => ({ from: { x: fx, y: fy }, to: { x: tx, y: ty } });

let now = 0;
let server: RoomServer;
beforeEach(() => {
  now = 1_000;
  let seed = 7;
  server = new RoomServer({ now: () => now, random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
});

/** Red creates, Blue joins: a room in play. */
function startGame() {
  const a = conn(server, 'A');
  a.send({ type: 'CREATE_ROOM', nickname: 'Tuấn' });
  const red = (a.last() as Extract<ServerMessage, { type: 'ROOM_JOINED' }>).you;
  const b = conn(server, 'B');
  b.send({ type: 'JOIN_ROOM', roomId: red.roomId, nickname: 'Lan' });
  const blue = (b.last() as Extract<ServerMessage, { type: 'ROOM_JOINED' }>).you;
  const play = (c: ReturnType<typeof conn>, seat: SeatCredentials, n: number, m: Move) =>
    c.send({ type: 'MOVE_REQUEST', roomId: seat.roomId, playerId: seat.playerId, moveNumber: n, from: m.from, to: m.to });
  return { a, b, red, blue, play };
}

describe('input validation', () => {
  it('normalises nicknames and room codes', () => {
    expect(normalizeNickname('  Tuấn  ')).toBe('Tuấn');
    expect(normalizeNickname('a\u0000b')).toBe('ab');
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname('x'.repeat(17))).toBeNull();
    expect(normalizeRoomId(' kx7p9a ')).toBe('KX7P9A');
    expect(normalizeRoomId('KX7P9')).toBeNull();
    expect(normalizeRoomId('KX7P0A')).toBeNull(); // 0 is not in the alphabet
  });

  it('rejects malformed messages, including off-board or extra move fields', () => {
    expect(parseClientMessage({ type: 'NOPE' })).toBeNull();
    expect(parseClientMessage({ type: 'MOVE_REQUEST', roomId: 'A', playerId: 'p', moveNumber: 1, from: { x: 9, y: 0 }, to: { x: 0, y: 0 } })).toBeNull();
    expect(parseClientMessage({ type: 'MOVE_REQUEST', roomId: 'A', playerId: 'p', moveNumber: 0, from: { x: 1, y: 0 }, to: { x: 0, y: 0 } })).toBeNull();
    expect(parseClientMessage({ type: 'MOVE_REQUEST', roomId: 'A', playerId: 'p', moveNumber: 1, from: { x: 1, y: 0, board: 1 }, to: { x: 0, y: 0 } })).toBeNull();
    const c = conn(server, 'X');
    c.send({ type: 'CREATE_ROOM' });
    expect(c.last()).toEqual({ type: 'ERROR', code: 'BAD_MESSAGE' });
    server.receive('X', '{not json');
    expect(c.last()).toEqual({ type: 'ERROR', code: 'BAD_MESSAGE' });
  });
});

describe('room lifecycle', () => {
  it('create room: short code, creator is Red, waiting for an opponent', () => {
    const a = conn(server, 'A');
    a.send({ type: 'CREATE_ROOM', nickname: 'Tuấn' });
    const msg = a.last() as Extract<ServerMessage, { type: 'ROOM_JOINED' }>;
    expect(msg.type).toBe('ROOM_JOINED');
    expect(msg.room.roomId).toMatch(ROOM_ID_PATTERN);
    expect(msg.you.side).toBe('red');
    expect(msg.you.nickname).toBe('Tuấn');
    expect(msg.room.status).toBe('waiting');
    expect(msg.room.redPlayer).toMatchObject({ nickname: 'Tuấn', side: 'red', connected: true });
    expect(msg.room.bluePlayer).toBeNull();
    expect(msg.moves).toEqual([]);
  });

  it('join room: second player is Blue, game starts, Red is told', () => {
    const { a, blue } = startGame();
    expect(blue.side).toBe('blue');
    const joined = a.of('PLAYER_JOINED')[0]!;
    expect(joined).toMatchObject({ side: 'blue', nickname: 'Lan' });
    expect(joined.room.status).toBe('playing');
    expect(joined.room.currentTurn).toBe('red');
  });

  it('a third player is rejected; unknown and malformed rooms are reported', () => {
    const { red } = startGame();
    const c = conn(server, 'C');
    c.send({ type: 'JOIN_ROOM', roomId: red.roomId, nickname: 'Minh' });
    expect(c.last()).toMatchObject({ type: 'ERROR', code: 'ROOM_FULL' });
    c.send({ type: 'JOIN_ROOM', roomId: 'ZZZZZZ', nickname: 'Minh' });
    expect(c.last()).toMatchObject({ type: 'ERROR', code: 'ROOM_NOT_FOUND' });
    c.send({ type: 'JOIN_ROOM', roomId: 'abc', nickname: 'Minh' });
    expect(c.last()).toMatchObject({ type: 'ERROR', code: 'INVALID_ROOM_ID' });
    c.send({ type: 'JOIN_ROOM', roomId: red.roomId, nickname: '   ' });
    expect(c.last()).toMatchObject({ type: 'ERROR', code: 'INVALID_NICKNAME' });
  });

  it('leaving a waiting room closes it; empty rooms are closed after the idle timeout', () => {
    const a = conn(server, 'A');
    a.send({ type: 'CREATE_ROOM', nickname: 'Tuấn' });
    const you = (a.last() as Extract<ServerMessage, { type: 'ROOM_JOINED' }>).you;
    a.send({ type: 'LEAVE_ROOM', roomId: you.roomId, playerId: you.playerId });
    expect(server.getRoom(you.roomId)).toBeNull();

    const { red } = startGame();
    server.disconnect('A');
    server.disconnect('B');
    now += 9 * 60_000;
    server.sweep();
    expect(server.getRoom(red.roomId)).not.toBeNull(); // still within the grace period
    now += 2 * 60_000;
    server.sweep();
    expect(server.getRoom(red.roomId)).toBeNull();
  });
});

describe('authoritative moves', () => {
  it('a valid move is accepted and broadcast to both players with its number', () => {
    const { a, b, red, play } = startGame();
    play(a, red, 1, mv(1, 7, 4, 7));
    for (const c of [a, b]) {
      const acc = c.of('MOVE_ACCEPTED')[0]!;
      expect(acc).toMatchObject({ moveNumber: 1, side: 'red', move: mv(1, 7, 4, 7) });
      expect(acc.room.currentTurn).toBe('blue');
      expect(acc.room.moveNumber).toBe(1);
    }
  });

  it('rejects wrong side, wrong turn, illegal moves, duplicates and out-of-order numbers', () => {
    const { a, b, red, blue, play } = startGame();
    const reason = (c: ReturnType<typeof conn>) => (c.last() as Extract<ServerMessage, { type: 'MOVE_REJECTED' }>).reason;
    play(b, blue, 1, mv(1, 2, 4, 2)); // Blue moving first
    expect(reason(b)).toBe('NOT_YOUR_TURN');
    play(b, blue, 1, mv(1, 2, 4, 2)); // still not Blue's turn
    play(a, red, 1, mv(1, 0, 2, 2)); // a Blue piece
    expect(reason(a)).toBe('ILLEGAL_MOVE');
    play(a, red, 1, mv(1, 9, 1, 5)); // horse cannot move like that
    expect(reason(a)).toBe('ILLEGAL_MOVE');
    play(a, red, 2, mv(1, 7, 4, 7)); // skips move 1
    expect(reason(a)).toBe('OUT_OF_SEQUENCE');
    play(a, red, 1, mv(1, 7, 4, 7));
    expect(a.last().type).toBe('MOVE_ACCEPTED');
    play(a, red, 1, mv(1, 7, 4, 7)); // replayed request
    expect(reason(a)).toBe('DUPLICATE');
    // Another connection cannot move for Red by copying Red's playerId.
    const c = conn(server, 'C');
    play(c, red, 2, mv(7, 7, 4, 7));
    expect(reason(c)).toBe('NOT_IN_ROOM');
    expect(server.getRoom(red.roomId)!.moveNumber).toBe(1);
  });

  it('keeps the move sequence identical on both sides and matching the engine', () => {
    const { a, b, red, blue, play } = startGame();
    const line = [mv(1, 7, 4, 7), mv(7, 0, 6, 2), mv(4, 7, 4, 3), mv(6, 2, 4, 3), mv(7, 7, 4, 7), mv(0, 0, 0, 1)];
    expect(replayMoves(line)).not.toBeNull(); // a legal line
    line.forEach((m, i) => play(i % 2 === 0 ? a : b, i % 2 === 0 ? red : blue, i + 1, m));
    const seqA = a.of('MOVE_ACCEPTED').map((m) => [m.moveNumber, m.move]);
    const seqB = b.of('MOVE_ACCEPTED').map((m) => [m.moveNumber, m.move]);
    expect(seqA).toEqual(line.map((m, i) => [i + 1, m]));
    expect(seqB).toEqual(seqA);
    expect(replayMoves(line)).not.toBeNull();
  });

  it('rate-limits a flood of move requests', () => {
    const { a, red, play } = startGame();
    for (let i = 0; i < 10; i++) play(a, red, 99, mv(1, 7, 4, 7));
    expect(a.of('MOVE_REJECTED').map((m) => m.reason).slice(-3)).toEqual(['RATE_LIMITED', 'RATE_LIMITED', 'RATE_LIMITED']);
  });
});

describe('game over, surrender and reconnect', () => {
  it('checkmate (decided by the engine on the server) ends the room; both players get GAME_OVER once', () => {
    const { a, b, red, blue, play } = startGame();
    // A real 47-ply game in which Red mates (same line as the UI tests).
    const LINE = [
      [1, 7, 1, 0], [6, 0, 4, 2], [1, 0, 3, 0], [7, 2, 8, 2], [3, 0, 0, 0], [4, 0, 4, 1], [0, 0, 5, 0], [4, 1, 4, 0],
      [5, 0, 8, 0], [4, 0, 4, 1], [8, 0, 8, 3], [8, 2, 7, 2], [7, 7, 7, 0], [1, 2, 1, 0], [7, 0, 1, 0], [7, 2, 7, 0],
      [1, 0, 7, 0], [4, 2, 6, 0], [7, 0, 2, 0], [4, 1, 4, 0], [2, 0, 6, 0], [4, 0, 3, 0], [8, 3, 4, 3], [3, 0, 3, 1],
      [4, 3, 0, 3], [3, 1, 3, 2], [0, 3, 6, 3], [2, 3, 2, 4], [4, 6, 4, 5], [2, 4, 2, 5], [2, 6, 2, 5], [3, 2, 3, 1],
      [4, 5, 4, 4], [3, 1, 3, 2], [2, 5, 2, 4], [3, 2, 3, 1], [0, 6, 0, 5], [3, 1, 3, 2], [0, 5, 0, 4], [3, 2, 3, 1],
      [0, 4, 1, 4], [3, 1, 3, 2], [8, 9, 8, 8], [3, 2, 3, 1], [4, 4, 5, 4], [3, 1, 3, 0], [8, 8, 3, 8],
    ].map(([fx, fy, tx, ty]) => mv(fx!, fy!, tx!, ty!));
    LINE.forEach((m, i) => {
      now += 1_000; // players take at least a moment per move (rate limit: 6 moves / 5 s)
      play(i % 2 === 0 ? a : b, i % 2 === 0 ? red : blue, i + 1, m);
    });
    expect(a.of('MOVE_ACCEPTED')).toHaveLength(47);
    expect(b.of('MOVE_ACCEPTED')).toHaveLength(47);
    expect(server.getRoom(red.roomId)).toMatchObject({ status: 'finished', winner: 'red', endReason: 'checkmate', moveNumber: 47 });
    for (const c of [a, b]) expect(c.of('GAME_OVER')).toEqual([expect.objectContaining({ winner: 'red', reason: 'checkmate' })]);
    // Nothing more can be played.
    play(b, blue, 48, mv(3, 0, 4, 0));
    expect(b.last()).toMatchObject({ type: 'MOVE_REJECTED', reason: 'NOT_PLAYING' });
  });

  it('surrender: the opponent wins, both are told, further moves are refused', () => {
    const { a, b, red, blue, play } = startGame();
    b.send({ type: 'SURRENDER', roomId: blue.roomId, playerId: blue.playerId });
    for (const c of [a, b]) expect(c.of('GAME_OVER')[0]).toMatchObject({ winner: 'red', reason: 'surrender' });
    expect(server.getRoom(red.roomId)).toMatchObject({ status: 'finished', winner: 'red', endReason: 'surrender' });
    play(a, red, 1, mv(1, 7, 4, 7));
    expect(a.last()).toMatchObject({ type: 'MOVE_REJECTED', reason: 'NOT_PLAYING' });
    const c = conn(server, 'C');
    c.send({ type: 'JOIN_ROOM', roomId: red.roomId, nickname: 'Minh' });
    expect(c.last()).toMatchObject({ type: 'ERROR', code: 'ROOM_FINISHED' });
  });

  it('a dropped player keeps the seat; RECONNECT restores it with a full SYNC_STATE', () => {
    const { a, b, red, play } = startGame();
    play(a, red, 1, mv(1, 7, 4, 7));
    server.disconnect('A');
    expect(b.of('PLAYER_LEFT')[0]).toMatchObject({ side: 'red', reason: 'disconnected' });
    expect(server.getRoom(red.roomId)!.redPlayer!.connected).toBe(false);
    // Wrong token: refused.
    const intruder = conn(server, 'X');
    intruder.send({ type: 'RECONNECT', roomId: red.roomId, playerId: red.playerId, token: 'guess' });
    expect(intruder.last()).toMatchObject({ type: 'ERROR', code: 'SESSION_INVALID' });
    // The real player comes back on a new connection.
    const a2 = conn(server, 'A2');
    a2.send({ type: 'RECONNECT', roomId: red.roomId, playerId: red.playerId, token: red.token });
    const sync = a2.last() as Extract<ServerMessage, { type: 'SYNC_STATE' }>;
    expect(sync.type).toBe('SYNC_STATE');
    expect(sync.you.side).toBe('red');
    expect(sync.moves).toEqual([mv(1, 7, 4, 7)]);
    expect(sync.room).toMatchObject({ status: 'playing', currentTurn: 'blue', moveNumber: 1 });
    expect(server.getRoom(red.roomId)!.redPlayer!.connected).toBe(true);
    expect(b.last()).toMatchObject({ type: 'ROOM_STATE' });
    // SYNC_REQUEST gives the same picture.
    a2.send({ type: 'SYNC_REQUEST', roomId: red.roomId, playerId: red.playerId });
    expect((a2.last() as Extract<ServerMessage, { type: 'SYNC_STATE' }>).moves).toHaveLength(1);
  });

  it('leaving a game in progress counts as surrender', () => {
    const { a, b, red } = startGame();
    a.send({ type: 'LEAVE_ROOM', roomId: red.roomId, playerId: red.playerId });
    expect(b.of('GAME_OVER')[0]).toMatchObject({ winner: 'blue', reason: 'surrender' });
  });

  it('answers PING with PONG', () => {
    const a = conn(server, 'A');
    a.send({ type: 'PING', t: 42 });
    expect(a.last()).toEqual({ type: 'PONG', t: 42 });
  });
});
