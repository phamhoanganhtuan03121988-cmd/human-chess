// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import * as audio from '../../src/audio/index.ts';
import { getIntersectionPosition } from '../../src/board/layout.ts';
import { fromViewCoordinate, getBoardPerspective, toViewCoordinate } from '../../src/board/perspective.ts';
import type { BoardPerspective } from '../../src/board/perspective.ts';
import { getMoveOffset } from '../../src/components/animation/movement.ts';
import { Board } from '../../src/components/Board.tsx';
import { CaptureContext } from '../../src/components/CaptureContext.tsx';
import { CAPTURE_CONTEXT } from '../../src/components/combat/combatTimeline.ts';
import type { CombatState } from '../../src/game/controller.ts';
import { MultiplayerClient } from '../../src/multiplayer/client.ts';
import { setTransportFactory } from '../../src/multiplayer/config.ts';
import { RoomServer } from '../../src/multiplayer/room.ts';
import { createLoopback } from '../../src/multiplayer/transport.ts';
import type { Loopback } from '../../src/multiplayer/transport.ts';

/*
 * Board perspective is presentation only: the online Blue seat sees the board
 * rotated 180° (Blue at the bottom). Engine coordinates, moves and the protocol
 * are the same for both players.
 */

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
const frame = () => screen.getByTestId('board-frame');
/** Where an anchor is drawn, as the intersection (in view coordinates) it sits on. */
const drawnAt = (anchor: Element) => {
  const style = (anchor as HTMLElement).style;
  const left = parseFloat(style.left);
  const top = parseFloat(style.top);
  for (let x = 0; x <= 8; x++)
    for (let y = 0; y <= 9; y++) {
      const p = getIntersectionPosition(x, y);
      if (Math.abs(p.left - left) < 1e-6 && Math.abs(p.top - top) < 1e-6) return { x, y };
    }
  throw new Error(`not on an intersection: ${left}% ${top}%`);
};
const engineAt = (anchor: Element) => ({ x: Number((anchor as HTMLElement).dataset.x), y: Number((anchor as HTMLElement).dataset.y) });
const pieceAnchor = (x: number, y: number) =>
  document.querySelector(`.board__layer--pieces .board-anchor[data-x="${x}"][data-y="${y}"]`)!;
/** The piece button drawn on view intersection (vx, vy), found by where it is DRAWN. */
const pieceDrawnAt = (vx: number, vy: number) => {
  const anchor = [...document.querySelectorAll('.board__layer--pieces .board-anchor')].find((a) => {
    const d = drawnAt(a);
    return d.x === vx && d.y === vy;
  });
  return anchor?.querySelector<HTMLElement>('[data-testid="piece"]') ?? null;
};
const markerDrawnAt = (vx: number, vy: number) =>
  screen.getAllByTestId('move-marker').find((m) => {
    const d = drawnAt(m.closest('.board-anchor')!);
    return d.x === vx && d.y === vy;
  }) ?? null;

async function redCreatesRoom() {
  const red = new MultiplayerClient(remote.factory, { persist: false });
  opponents.push(red);
  red.createRoom('Tuấn');
  await run(40);
  return red;
}
/** This App joins the room as Blue through the lobby. */
async function appJoinsAsBlue(roomId: string) {
  history.replaceState(null, '', `/room/${roomId}`);
  render(<App />);
  const lobby = screen.getByTestId('online-lobby');
  fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: 'Lan' } });
  fireEvent.click(within(lobby).getByTestId('join-room'));
  await run(60);
}

describe('perspective mapping (pure)', () => {
  it('is Red for the local AI game and online Red, Blue for the online Blue seat', () => {
    expect(getBoardPerspective(null)).toBe('red');
    expect(getBoardPerspective('red')).toBe('red');
    expect(getBoardPerspective('blue')).toBe('blue');
  });

  it('Red perspective is the identity; Blue is a 180° rotation of the grid', () => {
    for (let x = 0; x <= 8; x++)
      for (let y = 0; y <= 9; y++) {
        expect(toViewCoordinate(x, y, 'red')).toEqual({ x, y });
        expect(toViewCoordinate(x, y, 'blue')).toEqual({ x: 8 - x, y: 9 - y });
        // Its own inverse: a tapped (drawn) intersection maps back to the same engine one.
        const view = toViewCoordinate(x, y, 'blue');
        expect(fromViewCoordinate(view.x, view.y, 'blue')).toEqual({ x, y });
      }
    // Visual corners for Blue: top-left shows Red's right rook, bottom-right Blue's left rook.
    expect(fromViewCoordinate(0, 0, 'blue')).toEqual({ x: 8, y: 9 });
    expect(fromViewCoordinate(8, 9, 'blue')).toEqual({ x: 0, y: 0 });
  });

  it('movement animates toward the drawn destination', () => {
    const move = { from: { x: 1, y: 9 }, to: { x: 2, y: 7 } };
    expect(getMoveOffset(move, 'red')).toEqual({ x: 1, y: -2 });
    expect(getMoveOffset(move, 'blue')).toEqual({ x: -1, y: 2 });
  });
});

describe('perspective in the app', () => {
  it('local AI game: Red perspective, unchanged layout (Red general drawn at the bottom)', () => {
    render(<App initialScreen="game" />);
    expect(frame().dataset.perspective).toBe('red');
    expect(frame().classList.contains('board-frame--view-blue')).toBe(false);
    expect(drawnAt(pieceAnchor(4, 9))).toEqual({ x: 4, y: 9 });
    expect(drawnAt(pieceAnchor(4, 0))).toEqual({ x: 4, y: 0 });
  });

  it('online Red: Red perspective', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('play-online'));
    const lobby = screen.getByTestId('online-lobby');
    fireEvent.change(within(lobby).getByTestId('nickname-input'), { target: { value: 'Tuấn' } });
    fireEvent.click(within(lobby).getByTestId('create-room'));
    await run(40);
    const blue = new MultiplayerClient(remote.factory, { persist: false });
    opponents.push(blue);
    blue.joinRoom(screen.getByTestId('room-code').textContent!, 'Lan');
    await run(60);
    expect(frame().dataset.perspective).toBe('red');
    expect(drawnAt(pieceAnchor(4, 9))).toEqual({ x: 4, y: 9 });
  });

  it('online Blue: the board is drawn rotated 180° — Blue at the bottom, Red on top', async () => {
    const red = await redCreatesRoom();
    await appJoinsAsBlue(red.seat!.roomId);
    expect(frame().dataset.perspective).toBe('blue');
    expect(frame().classList.contains('board-frame--view-blue')).toBe(true);
    // Every piece is drawn on the rotated intersection; data keeps engine coordinates.
    for (const anchor of document.querySelectorAll('.board__layer--pieces .board-anchor')) {
      const e = engineAt(anchor);
      expect(drawnAt(anchor)).toEqual({ x: 8 - e.x, y: 9 - e.y });
    }
    expect(pieceDrawnAt(4, 9)!.dataset.side).toBe('blue'); // Blue general at the bottom centre
    expect(pieceDrawnAt(4, 0)!.dataset.side).toBe('red');
    expect(pieceDrawnAt(0, 0)).toMatchObject({ dataset: { side: 'red', type: 'rook' } }); // visual top-left
    expect(pieceDrawnAt(8, 9)).toMatchObject({ dataset: { side: 'blue', type: 'rook' } }); // visual bottom-right
    expect(engineAt(pieceDrawnAt(0, 0)!.closest('.board-anchor')!)).toEqual({ x: 8, y: 9 });
    expect(engineAt(pieceDrawnAt(8, 9)!.closest('.board-anchor')!)).toEqual({ x: 0, y: 0 });
  });

  it('Blue taps what it sees: the drawn destination sends the engine move; markers and last move are rotated', async () => {
    const red = await redCreatesRoom();
    await appJoinsAsBlue(red.seat!.roomId);
    red.requestMove(1, { from: { x: 7, y: 7 }, to: { x: 4, y: 7 } }); // Red: central cannon
    await run(1200);

    // Last move marks (engine 7,7 → 4,7) are drawn rotated.
    expect(drawnAt(screen.getByTestId('last-move-from').closest('.board-anchor')!)).toEqual({ x: 1, y: 2 });
    expect(drawnAt(screen.getByTestId('ring-last-move').closest('.board-anchor')!)).toEqual({ x: 4, y: 2 });

    // Blue's left knight (engine 1,0) is drawn at view (7,9): tap it where it is seen.
    const knight = pieceDrawnAt(7, 9)!;
    expect(knight.dataset).toMatchObject({ side: 'blue', type: 'knight' });
    fireEvent.click(knight);
    const selectedRing = screen.getByTestId('ring-selected');
    expect(engineAt(selectedRing.closest('.board-anchor')!)).toEqual({ x: 1, y: 0 });
    expect(drawnAt(selectedRing.closest('.board-anchor')!)).toEqual({ x: 7, y: 9 });
    // Every legal-move marker is drawn on the rotated intersection of its engine target.
    const markers = screen.getAllByTestId('move-marker');
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) {
      const e = engineAt(m.closest('.board-anchor')!);
      expect(drawnAt(m.closest('.board-anchor')!)).toEqual({ x: 8 - e.x, y: 9 - e.y });
    }
    // Tap the destination drawn at view (6,7) = engine (2,2).
    fireEvent.click(markerDrawnAt(6, 7)!);
    await run(1200);
    expect(red.moves).toEqual([
      { from: { x: 7, y: 7 }, to: { x: 4, y: 7 } },
      { from: { x: 1, y: 0 }, to: { x: 2, y: 2 } },
    ]);
    expect(pieceAnchor(2, 2).querySelector('[data-testid="piece"]')!.getAttribute('data-type')).toBe('knight');
    expect(drawnAt(pieceAnchor(2, 2))).toEqual({ x: 6, y: 7 });
  });

  it('capture context marks attacker/defender where they are drawn; the combat overlay and HUD are not rotated', async () => {
    const red = await redCreatesRoom();
    await appJoinsAsBlue(red.seat!.roomId);
    red.requestMove(1, { from: { x: 1, y: 7 }, to: { x: 1, y: 0 } }); // Red cannon takes Blue's knight
    await run(60);
    const context = screen.getByTestId('capture-context');
    expect(context.dataset).toMatchObject({ from: '1,7', to: '1,0' }); // engine data
    expect(drawnAt(document.querySelector('.piece-token.is-attacking')!.closest('.board-anchor')!)).toEqual({ x: 7, y: 2 });
    expect(drawnAt(document.querySelector('.piece-token.is-targeted')!.closest('.board-anchor')!)).toEqual({ x: 7, y: 9 });
    const impact = screen.getByTestId('capture-impact');
    expect([Number(impact.getAttribute('cx')), Number(impact.getAttribute('cy'))]).toEqual([7.5, 9.5]); // view (7,9) in board units

    await run(CAPTURE_CONTEXT.end + 100);
    const overlay = screen.getByTestId('combat-overlay');
    expect(frame().contains(overlay)).toBe(false); // player-facing, outside the board
    expect(overlay.getAttribute('style') ?? '').not.toMatch(/rotate/);
    for (const id of ['online-hud', 'status', 'surrender']) expect(frame().contains(screen.getByTestId(id))).toBe(false);
  });
});

describe('capture trajectory', () => {
  const combat: CombatState = {
    id: 1,
    phase: 'context',
    attacker: { side: 'red', type: 'cannon' },
    defender: { side: 'blue', type: 'knight' },
    move: { from: { x: 1, y: 7 }, to: { x: 1, y: 0 } },
  };
  const trajectory = (perspective: BoardPerspective) => {
    render(
      <Board perspective={perspective}>
        <CaptureContext combat={combat} reducedMotion={false} />
      </Board>,
    );
    const line = screen.getByTestId('capture-trajectory');
    const v = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(line.getAttribute(a)));
    cleanup();
    return v;
  };
  it('runs from the drawn attacker to the drawn defender', () => {
    const [, ry1, , ry2] = trajectory('red');
    expect(ry1).toBeGreaterThan(ry2); // Red view: the cannon shoots up the board
    const [bx1, by1, bx2, by2] = trajectory('blue');
    expect(by1).toBeLessThan(by2); // Blue view: the same capture comes down toward Blue
    expect(bx1).toBeCloseTo(7.5);
    expect(bx2).toBeCloseTo(7.5);
  });
});

describe('upright content', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  it('rotates coordinates, never the board, the tokens or their glyphs', () => {
    // No CSS rotation anywhere on the board, tokens or overlays.
    expect(css).not.toMatch(/rotate\(\s*180deg\s*\)/);
    const blueRules = [...css.matchAll(/\.board-frame--view-blue[^{]*\{([^}]*)\}/g)].map((m) => m[1]!);
    expect(blueRules.length).toBeGreaterThan(0);
    for (const body of blueRules) expect(body).not.toMatch(/transform|rotate|scale/);
  });

  it('tokens and glyphs carry no rotation in the Blue perspective', async () => {
    const red = await redCreatesRoom();
    await appJoinsAsBlue(red.seat!.roomId);
    for (const el of frame().querySelectorAll<HTMLElement>('.board, .board__layer, .board-anchor, .piece-token, .token-face, .token-face__glyph')) {
      expect(el.style.transform).not.toMatch(/rotate|scale\(-1/);
      expect(el.style.rotate ?? '').toBe('');
    }
    expect(screen.getAllByTestId('piece')[0]!.querySelector('.token-face__glyph')!.textContent).toMatch(/\S/);
  });
});
