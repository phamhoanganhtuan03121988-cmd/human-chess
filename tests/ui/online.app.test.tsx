// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { CAPTURE_CONTEXT } from '../../src/components/combat/combatTimeline.ts';
import type { Move } from '../../src/engine/index.ts';
import { MultiplayerClient } from '../../src/multiplayer/client.ts';
import { setTransportFactory } from '../../src/multiplayer/config.ts';
import { RoomServer } from '../../src/multiplayer/room.ts';
import { SESSION_KEY } from '../../src/multiplayer/session.ts';
import { createLoopback } from '../../src/multiplayer/transport.ts';
import type { Loopback } from '../../src/multiplayer/transport.ts';

let server: RoomServer;
let loop: Loopback;
/** The remote opponent's own network path (drops on `loop` do not affect it). */
let remote: Loopback;
let opponents: MultiplayerClient[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState(null, '', '/');
  audio.setAudioBackend({ play: () => true });
  server = new RoomServer();
  loop = createLoopback(server);
  remote = createLoopback(server);
  setTransportFactory(loop.factory);
  opponents = [];
});
afterEach(() => {
  cleanup();
  opponents.forEach((o) => o.dispose());
  setTransportFactory(undefined);
  vi.useRealTimers();
  audio.setAudioBackend(null);
  history.replaceState(null, '', '/');
});

/** Advances fake time in small steps, letting loopback messages (microtasks) through. */
const run = async (ms = 0) => {
  const steps = Math.max(1, Math.ceil(ms / 20));
  for (let i = 0; i < steps; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(20, ms));
    });
  }
};
const token = (x: number, y: number) =>
  document.querySelector<HTMLElement>(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"] [data-testid="piece"]`);
const marker = (x: number, y: number) =>
  screen.getAllByTestId('move-marker').find((m) => m.dataset.x === `${x}` && m.dataset.y === `${y}`)!;
const status = () => screen.getByTestId('status').textContent;
const mv = (fx: number, fy: number, tx: number, ty: number): Move => ({ from: { x: fx, y: fy }, to: { x: tx, y: ty } });

/** Red (this App) creates a room; returns the room code. */
async function createRoomAsRed(nickname = 'Tuấn') {
  render(<App />);
  fireEvent.click(screen.getByTestId('play-online'));
  const lobby = screen.getByTestId('online-lobby');
  fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: nickname } });
  fireEvent.click(within(lobby).getByTestId('create-room'));
  await run(40);
  return screen.getByTestId('room-code').textContent!;
}

/** Blue joins with a separate client (the remote opponent). */
async function blueJoins(roomId: string) {
  const blue = new MultiplayerClient(remote.factory, { persist: false });
  opponents.push(blue);
  blue.joinRoom(roomId, 'Lan');
  await run(40);
  return blue;
}

describe('start screen', () => {
  it('offers CHƠI VỚI MÁY and CHƠI ONLINE; difficulty belongs to the AI game', () => {
    render(<App />);
    const start = screen.getByTestId('start-screen');
    expect(within(start).getByText('CHƠI VỚI MÁY')).toBeTruthy();
    expect(within(start).getByTestId('play-online').textContent).toBe('CHƠI ONLINE');
    expect(within(start).getByText('Độ khó')).toBeTruthy();
    expect(start.textContent).toContain('độ khó áp dụng cho máy');
    fireEvent.click(screen.getByTestId('play-online'));
    expect(screen.queryByTestId('start-screen')).toBeNull();
    expect(screen.getByTestId('online-lobby').textContent).toContain('TẠO PHÒNG');
  });

  it('reports an unavailable server instead of hanging', async () => {
    setTransportFactory(null);
    render(<App />);
    fireEvent.click(screen.getByTestId('play-online'));
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Tuấn' } });
    fireEvent.click(screen.getByTestId('create-room'));
    await run(20);
    expect(screen.getByTestId('online-problem').dataset.code).toBe('UNAVAILABLE');
  });

  it('asks for a nickname before creating a room', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('play-online'));
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('create-room'));
    expect(screen.getByRole('alert').textContent).toContain('1 đến 16');
    expect(server.roomCount).toBe(0);
  });
});

describe('online room: Red in this browser, Blue remote', () => {
  it('create room → waiting screen with code, side and link; URL becomes /room/CODE', async () => {
    const code = await createRoomAsRed();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const waiting = screen.getByTestId('waiting-room');
    expect(waiting.textContent).toContain('Bạn là');
    expect(waiting.textContent).toContain('ĐỎ');
    expect(waiting.textContent).toContain('Đang chờ đối thủ');
    expect((within(waiting).getByLabelText('Gửi link này cho đối thủ') as HTMLInputElement).value).toBe(`${location.origin}/room/${code}`);
    expect(location.pathname).toBe(`/room/${code}`);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toMatchObject({ roomId: code, side: 'red', nickname: 'Tuấn' });
  });

  it('plays a synchronised game: requests wait for the server, both sides see the same moves', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);
    expect(screen.queryByTestId('waiting-room')).toBeNull();
    expect(screen.getByTestId('online-hud').textContent).toContain('Lan');
    expect(screen.getByTestId('connection-badge').dataset.status).toBe('connected');
    expect(status()).toBe('ĐẾN LƯỢT BẠN');

    // Red cannot touch Blue's pieces.
    fireEvent.click(token(1, 0)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();

    // Red plays: nothing moves until the server accepts.
    fireEvent.click(token(4, 6)!);
    fireEvent.click(marker(4, 5));
    expect(token(4, 6)!.dataset.moving).toBeUndefined();
    expect(token(4, 5)).toBeNull();
    await run(20); // MOVE_ACCEPTED arrives → the normal movement animation
    await run(300);
    expect(token(4, 5)!.dataset).toMatchObject({ side: 'red', type: 'pawn' });
    expect(blue.moves).toEqual([mv(4, 6, 4, 5)]);
    expect(status()).toBe('ĐANG CHỜ XANH');

    // While waiting, Red's clicks do nothing.
    fireEvent.click(token(0, 9)!);
    expect(screen.queryByTestId('ring-selected')).toBeNull();

    // Blue replies from the other browser; it appears here with its animation.
    blue.requestMove(2, mv(1, 2, 1, 9)); // Blue cannon jumps the Red cannon and takes the Red horse
    await run(20);
    expect(screen.getByTestId('capture-context')).toBeTruthy(); // same capture context as offline
    await run(CAPTURE_CONTEXT.end);
    expect(screen.getByTestId('combat-overlay')).toBeTruthy(); // …and the same CombatOverlay
    await run(1700);
    expect(screen.queryByTestId('combat-overlay')).toBeNull();
    expect(token(1, 9)!.dataset).toMatchObject({ side: 'blue', type: 'cannon' });
    expect(status()).toBe('ĐẾN LƯỢT BẠN');
    expect(screen.getAllByTestId('piece')).toHaveLength(31);
  });

  it('an illegal or out-of-turn request never changes the board', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);
    blue.requestMove(1, mv(1, 2, 4, 2)); // Blue tries to move first
    await run(40);
    expect(screen.getAllByTestId('piece')).toHaveLength(32);
    expect(token(1, 2)!.dataset.type).toBe('cannon');
    expect(status()).toBe('ĐẾN LƯỢT BẠN');
  });

  it('surrender asks for confirmation, then both sides see the result', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);
    const results: string[] = [];
    blue.subscribe((e) => e.type === 'gameOver' && results.push(`${e.winner}:${e.reason}`));
    fireEvent.click(screen.getByTestId('surrender'));
    expect(screen.getByTestId('surrender-dialog').textContent).toContain('Bạn có chắc muốn đầu hàng?');
    fireEvent.click(screen.getByText('HỦY'));
    expect(screen.queryByTestId('surrender-dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('surrender'));
    fireEvent.click(screen.getByTestId('confirm-surrender'));
    await run(40);
    const banner = screen.getByTestId('game-over');
    expect(banner.textContent).toContain('ĐẦU HÀNG');
    expect(banner.textContent).toContain('XANH THẮNG');
    expect(results).toEqual(['blue:surrender']);
    expect(status()).toBe('ĐẦU HÀNG — XANH THẮNG');
    expect(screen.getByTestId('leave-online')).toBeTruthy(); // after the game: leave the room
  });

  it('reconnects after a network drop and keeps playing from the server state', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(marker(4, 5));
    await run(400);
    loop.setOffline(true);
    loop.dropAll();
    await run(20);
    expect(screen.getByTestId('connection-badge').dataset.status).toBe('reconnecting');
    // The opponent moves while Red is away (Red misses MOVE_ACCEPTED #2).
    expect(blue.requestMove(2, mv(0, 3, 0, 4))).toBe(true);
    await run(20);
    loop.setOffline(false);
    await run(3000);
    expect(screen.getByTestId('connection-badge').dataset.status).toBe('connected');
    await run(400);
    expect(token(0, 4)!.dataset).toMatchObject({ side: 'blue', type: 'pawn' }); // synced
    expect(status()).toBe('ĐẾN LƯỢT BẠN');
  });

  it('a refresh of /room/CODE rejoins the same seat', async () => {
    const code = await createRoomAsRed();
    await blueJoins(code);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(marker(4, 5));
    await run(400);
    cleanup(); // the tab is closed / refreshed
    await run(20);
    render(<App />); // location is /room/CODE and the seat is remembered
    await run(60);
    expect(screen.queryByTestId('start-screen')).toBeNull();
    expect(screen.queryByTestId('online-lobby')).toBeNull();
    expect(token(4, 5)!.dataset).toMatchObject({ side: 'red', type: 'pawn' });
    expect(status()).toBe('ĐANG CHỜ XANH');
  });
});

describe('room links', () => {
  it('a link to a waiting room lets a second player join as Blue', async () => {
    const red = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(red);
    red.createRoom('Tuấn');
    await run(40);
    const code = red.seat!.roomId;
    history.replaceState(null, '', `/room/${code}`);
    render(<App />);
    const lobby = screen.getByTestId('online-lobby');
    expect(lobby.textContent).toContain(code);
    fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: 'Lan' } });
    fireEvent.click(within(lobby).getByTestId('join-room'));
    await run(60);
    expect(screen.queryByTestId('online-lobby')).toBeNull();
    expect(status()).toBe('ĐANG CHỜ ĐỎ'); // Blue waits for Red's first move
    fireEvent.click(token(4, 3)!); // cannot move Red's… or anything out of turn
    expect(screen.queryByTestId('ring-selected')).toBeNull();
  });

  it('explains unknown and full rooms', async () => {
    history.replaceState(null, '', '/room/ZZZZZZ');
    render(<App />);
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Lan' } });
    fireEvent.click(screen.getByTestId('join-room'));
    await run(40);
    expect(screen.getByTestId('online-problem').textContent).toBe('Phòng không tồn tại hoặc đã đóng.');
    cleanup();

    const a = new MultiplayerClient(remote.factory, { persist: false });
    const b = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(a, b);
    a.createRoom('A');
    await run(40);
    b.joinRoom(a.seat!.roomId, 'B');
    await run(40);
    history.replaceState(null, '', `/room/${a.seat!.roomId}`);
    render(<App />);
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'C' } });
    fireEvent.click(screen.getByTestId('join-room'));
    await run(40);
    expect(screen.getByTestId('online-problem').dataset.code).toBe('ROOM_FULL');
    // Back to the start screen (local play still there).
    fireEvent.click(screen.getByText('QUAY LẠI'));
    expect(screen.getByTestId('start-screen')).toBeTruthy();
    expect(location.pathname).toBe('/');
  });

  it('a disconnected player can rejoin via lobby code input without ROOM_FULL error', async () => {
    // Red creates room
    const a = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(a);
    a.createRoom('Tuấn');
    await run(40);
    const roomId = a.seat!.roomId;

    // Blue joins via App UI
    render(<App />);
    fireEvent.click(screen.getByTestId('play-online'));
    const lobby = screen.getByTestId('online-lobby');
    fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: 'Lan' } });
    fireEvent.change(within(lobby).getByTestId('room-input'), { target: { value: roomId } });
    fireEvent.click(within(lobby).getByTestId('join-room'));
    await run(60);

    expect(screen.queryByTestId('online-lobby')).toBeNull();
    expect(status()).toBe('ĐANG CHỜ ĐỎ');

    // Red makes the first move (Cannon 1,7 -> 4,7)
    a.requestMove(1, mv(1, 7, 4, 7));
    await run(400);
    expect(status()).toBe('ĐẾN LƯỢT BẠN');

    // Simulate Blue closing and reopening the page at root /
    cleanup();
    history.replaceState(null, '', '/');

    // Reopen App at root: Start Screen -> CHƠI ONLINE -> lobby -> re-enter room code
    render(<App />);
    expect(screen.getByTestId('start-screen')).toBeTruthy();
    fireEvent.click(screen.getByTestId('play-online'));
    const lobbyRejoin = screen.getByTestId('online-lobby');
    fireEvent.change(within(lobbyRejoin).getByTestId('nickname-input'), { target: { value: 'Lan' } });
    fireEvent.change(within(lobbyRejoin).getByTestId('room-input'), { target: { value: roomId } });
    fireEvent.click(within(lobbyRejoin).getByTestId('join-room'));
    await run(60);

    // Rejoined smoothly into the game, no ROOM_FULL error
    expect(screen.queryByTestId('online-problem')).toBeNull();
    expect(screen.queryByTestId('online-lobby')).toBeNull();
    // Game is restored with the previous move intact: it is still Blue's turn
    expect(status()).toBe('ĐẾN LƯỢT BẠN');

    // Step 15-17: A third player tries to join using the room code
    const thirdPlayer = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(thirdPlayer);
    let thirdPlayerError: string | null = null;
    thirdPlayer.subscribe((e) => {
      if (e.type === 'error') thirdPlayerError = e.code;
    });
    thirdPlayer.joinRoom(roomId, 'Minh');
    await run(40);
    expect(thirdPlayerError).toBe('ROOM_FULL');
    expect(thirdPlayer.seat).toBeNull();
  });
});

describe('offline mode is unchanged', () => {
  it('CHƠI VỚI MÁY still plays against the AI and never opens a connection', async () => {
    const connect = vi.spyOn(server, 'connect');
    render(<App />);
    fireEvent.click(screen.getByText('CHƠI VỚI MÁY'));
    await run(300);
    fireEvent.click(token(4, 6)!);
    fireEvent.click(marker(4, 5));
    await run(300);
    expect(status()).toBe('XANH ĐANG NGHĨ...');
    await run(3000);
    expect(status()).toBe('LƯỢT ĐỎ');
    expect(connect).not.toHaveBeenCalled();
    expect(screen.queryByTestId('online-hud')).toBeNull();
  });
});
