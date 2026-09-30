import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../src/engine/index.ts';
import { MultiplayerClient } from '../../src/multiplayer/client.ts';
import type { ClientEvent } from '../../src/multiplayer/client.ts';
import { RoomServer } from '../../src/multiplayer/room.ts';
import { createLoopback } from '../../src/multiplayer/transport.ts';
import type { Loopback } from '../../src/multiplayer/transport.ts';

const mv = (fx: number, fy: number, tx: number, ty: number): Move => ({ from: { x: fx, y: fy }, to: { x: tx, y: ty } });
/** Let queued loopback messages (microtasks) arrive. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

let server: RoomServer;
let loop: Loopback;
let clients: MultiplayerClient[] = [];

function client() {
  const c = new MultiplayerClient(loop.factory, { persist: false, backoffMs: [100, 200] });
  const events: ClientEvent[] = [];
  c.subscribe((e) => events.push(e));
  clients.push(c);
  return { c, events, of: <T extends ClientEvent['type']>(t: T) => events.filter((e) => e.type === t) as Extract<ClientEvent, { type: T }>[] };
}

beforeEach(() => {
  vi.useFakeTimers();
  server = new RoomServer();
  loop = createLoopback(server);
  clients = [];
});
afterEach(() => {
  clients.forEach((c) => c.dispose());
  vi.useRealTimers();
});

async function pair() {
  const red = client();
  red.c.createRoom('Tuấn');
  await flush();
  const roomId = red.c.seat!.roomId;
  const blue = client();
  blue.c.joinRoom(roomId, 'Lan');
  await flush();
  return { red, blue, roomId };
}

describe('multiplayer client', () => {
  it('create + join over the transport: seats, sides and room state reach both clients', async () => {
    const { red, blue, roomId } = await pair();
    expect(red.c.status).toBe('connected');
    expect(red.c.seat).toMatchObject({ side: 'red', nickname: 'Tuấn', roomId });
    expect(blue.c.seat).toMatchObject({ side: 'blue', nickname: 'Lan', roomId });
    expect(red.c.room!.status).toBe('playing'); // Red was told Blue arrived
    expect(red.of('status').map((e) => e.status)).toEqual(['connecting', 'connected']);
  });

  it('moves arrive at both clients in the same numbered order; the mover waits for the server', async () => {
    const { red, blue } = await pair();
    expect(red.c.requestMove(1, mv(1, 7, 4, 7))).toBe(true);
    expect(red.c.moves).toEqual([]); // nothing applied before MOVE_ACCEPTED
    await flush();
    expect(blue.c.requestMove(2, mv(7, 0, 6, 2))).toBe(true);
    await flush();
    const seq = (x: typeof red) => x.of('move').map((e) => [e.moveNumber, e.side]);
    expect(seq(red)).toEqual([[1, 'red'], [2, 'blue']]);
    expect(seq(blue)).toEqual(seq(red));
    expect(red.c.moves).toEqual(blue.c.moves);
  });

  it('a rejected request is reported and changes nothing', async () => {
    const { red } = await pair();
    red.c.requestMove(1, mv(0, 9, 0, 3)); // rook jumps over its own pawn
    await flush();
    expect(red.of('rejected')[0]).toMatchObject({ moveNumber: 1, reason: 'ILLEGAL_MOVE' });
    expect(red.c.moves).toEqual([]);
  });

  it('never applies an out-of-order MOVE_ACCEPTED: it resynchronises instead', async () => {
    const { red, blue } = await pair();
    red.c.requestMove(1, mv(1, 7, 4, 7));
    await flush();
    // Blue's client "misses" move 1: drop it from its list, then move 2 arrives.
    blue.c.moves = [];
    red.c.requestMove(2, mv(7, 0, 6, 2)); // wrong side: rejected, no effect
    blue.c.requestMove(2, mv(7, 0, 6, 2));
    await flush();
    expect(blue.of('move').map((e) => e.moveNumber)).toEqual([1]); // move 2 was not applied out of order…
    expect(blue.of('seated').length).toBeGreaterThanOrEqual(2); // …a SYNC_STATE replaced the list
    expect(blue.c.moves).toEqual([mv(1, 7, 4, 7), mv(7, 0, 6, 2)]);
  });

  it('reconnects after a network drop and resynchronises the seat and moves', async () => {
    const { red, blue } = await pair();
    red.c.requestMove(1, mv(1, 7, 4, 7));
    await flush();
    loop.setOffline(true);
    loop.dropAll();
    await flush();
    expect(red.c.status).toBe('reconnecting');
    expect(red.c.requestMove(2, mv(0, 9, 0, 8))).toBe(false); // nothing is sent while offline
    await vi.advanceTimersByTimeAsync(150); // first retry fails (still offline)
    expect(red.c.status).toBe('reconnecting');
    loop.setOffline(false);
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(red.c.status).toBe('connected');
    expect(blue.c.status).toBe('connected');
    expect(red.c.seat!.side).toBe('red');
    expect(red.c.moves).toEqual([mv(1, 7, 4, 7)]);
    // Play continues.
    blue.c.requestMove(2, mv(7, 0, 6, 2));
    await flush();
    expect(red.c.moves).toHaveLength(2);
  });

  it('resume() rejoins a remembered seat after a refresh (new client, same credentials)', async () => {
    const { red } = await pair();
    const seat = red.c.seat!;
    red.c.dispose(); // tab closed / refreshed (its connection closes)
    const again = client();
    again.c.resume(seat);
    await flush();
    expect(again.c.status).toBe('connected');
    expect(again.of('seated')[0]!.you.side).toBe('red');
    expect(again.c.room!.redPlayer!.connected).toBe(true);
  });

  it('surrender ends the game for both clients', async () => {
    const { red, blue } = await pair();
    blue.c.surrender();
    await flush();
    for (const x of [red, blue]) expect(x.of('gameOver')[0]).toMatchObject({ winner: 'red', reason: 'surrender' });
  });

  it('reports an unreachable server as offline without hanging', async () => {
    loop.setOffline(true);
    const x = client();
    x.c.createRoom('Tuấn');
    await flush();
    expect(x.c.status).toBe('offline');
  });
});
