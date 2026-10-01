// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { CAPTURE_CONTEXT } from '../../src/components/combat/combatTimeline.ts';
import { RECONNECT_BANNER_DURATION_MS } from '../../src/components/online/OnlineConnectionBanner.tsx';
import type { Move } from '../../src/engine/index.ts';
import { MultiplayerClient } from '../../src/multiplayer/client.ts';
import { setTransportFactory } from '../../src/multiplayer/config.ts';
import { RoomServer } from '../../src/multiplayer/room.ts';
import { createLoopback } from '../../src/multiplayer/transport.ts';
import type { Loopback } from '../../src/multiplayer/transport.ts';

let server: RoomServer;
let loop: Loopback;
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

async function createRoomAsRed(nickname = 'Tuấn') {
  render(<App />);
  fireEvent.click(screen.getByTestId('play-online'));
  const lobby = screen.getByTestId('online-lobby');
  fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: nickname } });
  fireEvent.click(within(lobby).getByTestId('create-room'));
  await run(40);
  return screen.getByTestId('room-code').textContent!;
}

async function blueJoins(roomId: string) {
  const blue = new MultiplayerClient(remote.factory, { persist: false });
  opponents.push(blue);
  blue.joinRoom(roomId, 'Lan');
  await run(40);
  return blue;
}

describe('mobile connection banner', () => {
  it('does not display any banner when connection is normal', async () => {
    const code = await createRoomAsRed();
    await blueJoins(code);
    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  it('shows "Đối thủ mất kết nối" below board when opponent disconnects, keeping HUD status clean', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);

    expect(screen.getByTestId('status').textContent).toBe('ĐẾN LƯỢT BẠN');
    expect(screen.queryByTestId('connection-banner')).toBeNull();

    // Blue drops connection
    remote.dropAll();
    await run(40);

    // Banner appears with expected text
    const banner = screen.getByTestId('connection-banner');
    expect(banner.textContent).toContain('Đối thủ mất kết nối');
    expect(banner.dataset.tone).toBe('wait');

    // Turn status in HUD remains intact and unaffected
    expect(screen.getByTestId('status').textContent).toBe('ĐẾN LƯỢT BẠN');

    // Board and banner are both in the DOM
    const boardFrame = screen.getByTestId('board-frame');
    expect(boardFrame).toBeTruthy();
    expect(banner).toBeTruthy();

    // When Blue reconnects, banner shows "Đã kết nối lại" then auto-hides
    const blueReconnected = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(blueReconnected);
    blueReconnected.resume(blue.seat!);
    await run(60);

    expect(screen.getByTestId('connection-banner').textContent).toBe('Đã kết nối lại');
    expect(screen.getByTestId('connection-banner').dataset.tone).toBe('ok');

    // After duration, banner disappears
    await run(RECONNECT_BANNER_DURATION_MS + 100);
    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  it('shows "Đang chờ kết nối lại..." when local player disconnects, then "Đã kết nối lại" upon reconnect', async () => {
    const code = await createRoomAsRed();
    await blueJoins(code);

    expect(screen.queryByTestId('connection-banner')).toBeNull();

    // Local player drops
    loop.setOffline(true);
    loop.dropAll();
    await run(20);

    const banner = screen.getByTestId('connection-banner');
    expect(banner.textContent).toBe('Đang chờ kết nối lại...');
    expect(banner.dataset.tone).toBe('wait');

    // Turn status in HUD remains intact
    expect(screen.getByTestId('status').textContent).toBe('ĐẾN LƯỢT BẠN');

    // Local player reconnects
    loop.setOffline(false);
    await run(1200);

    expect(screen.getByTestId('connection-banner').textContent).toBe('Đã kết nối lại');
    expect(screen.getByTestId('connection-banner').dataset.tone).toBe('ok');

    await run(RECONNECT_BANNER_DURATION_MS + 200);
    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  it('positions CharacterActionCard below the connection banner without overlapping', async () => {
    const code = await createRoomAsRed();
    await blueJoins(code);

    // Mock mobile portrait getBoundingClientRect for board-frame and connection-banner
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute('data-testid') === 'board-frame') {
        return {
          top: 60,
          bottom: 460,
          left: 16,
          right: 374,
          width: 358,
          height: 400,
          x: 16,
          y: 60,
          toJSON: () => {},
        } as DOMRect;
      }
      if (this.getAttribute('data-testid') === 'connection-banner') {
        return {
          top: 468,
          bottom: 500,
          left: 16,
          right: 374,
          width: 358,
          height: 32,
          x: 16,
          y: 468,
          toJSON: () => {},
        } as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    };

    try {
      // Opponent drops -> connection banner renders
      remote.dropAll();
      await run(40);
      expect(screen.getByTestId('connection-banner')).toBeTruthy();

      // Red selects a piece (pawn at 4, 6)
      fireEvent.click(token(4, 6)!);
      await run(20);

      const card = screen.getByTestId('character-card');
      expect(card).toBeTruthy();
      expect(card.dataset.placement).toBe('below');

      // The card top must start at or below banner.bottom + GAP (500 + 12 = 512px)
      // and NOT at board-frame bottom (460 + 12 = 472px)
      expect(card.style.top).toBe('512px');
    } finally {
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('hides connection banner when CombatOverlay is active', async () => {
    const code = await createRoomAsRed();
    const blue = await blueJoins(code);

    // Red moves pawn
    fireEvent.click(token(4, 6)!);
    const marker = screen.getAllByTestId('move-marker').find((m) => m.dataset.x === '4' && m.dataset.y === '5')!;
    fireEvent.click(marker);
    await run(20);
    await run(300);

    // Blue captures Red's knight: (1, 2) -> (1, 9)
    blue.requestMove(2, { from: { x: 1, y: 2 }, to: { x: 1, y: 9 } });
    await run(20);
    // Board capture context phase
    await run(CAPTURE_CONTEXT.end);
    // Combat overlay is active
    expect(screen.getByTestId('combat-overlay')).toBeTruthy();

    // Now opponent drops during combat and stays offline
    remote.setOffline(true);
    remote.dropAll();
    await run(20);

    // CombatOverlay is active, so connection banner MUST NOT compete with CombatOverlay
    expect(screen.getByTestId('combat-overlay')).toBeTruthy();
    expect(screen.queryByTestId('connection-banner')).toBeNull();

    // When combat completes
    await run(1700);
    expect(screen.queryByTestId('combat-overlay')).toBeNull();

    // Banner reappears since opponent is disconnected
    expect(screen.getByTestId('connection-banner')).toBeTruthy();
    expect(screen.getByTestId('connection-banner').textContent).toContain('Đối thủ mất kết nối');
  });
});
