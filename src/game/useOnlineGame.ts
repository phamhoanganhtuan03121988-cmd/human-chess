/**
 * Connects the online room (MultiplayerClient) to the game controller.
 *
 * The server's move list is the source of truth. This hook feeds its moves
 * into the reducer one at a time as `remoteMove`, which plays them exactly
 * like local or AI moves — same capture context, CombatOverlay, animation and
 * engine commit. A move the player makes is only *requested* (pendingMove);
 * it appears on the board when the server accepts it.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Move, Side } from '../engine/index.ts';
import { MultiplayerClient } from '../multiplayer/client.ts';
import type { ClientEvent, ConnectionStatus } from '../multiplayer/client.ts';
import { getTransportFactory } from '../multiplayer/config.ts';
import type { ErrorCode } from '../multiplayer/protocol.ts';
import { clearSession, loadSession } from '../multiplayer/session.ts';
import type { OnlineRoomState, SeatCredentials } from '../multiplayer/types.ts';
import { replayMoves } from '../multiplayer/validation.ts';
import type { UiAction, UiState } from './controller.ts';
import { createUiState } from './controller.ts';

export type OnlineProblem = ErrorCode | 'UNAVAILABLE' | 'OFFLINE' | 'MOVE_NOT_SENT';

export interface OnlineGame {
  readonly connection: ConnectionStatus;
  readonly seat: SeatCredentials | null;
  readonly room: OnlineRoomState | null;
  readonly problem: OnlineProblem | null;
  /** Busy with a lobby request (create / join / resume). */
  readonly busy: boolean;
  createRoom(nickname: string): void;
  joinRoom(roomId: string, nickname: string): void;
  /** Rejoin the seat remembered for `roomId`; false if there is none. */
  resume(roomId: string): boolean;
  surrender(): void;
  /** Leave the room (in progress = surrender) and forget the seat. */
  leave(): void;
  clearProblem(): void;
}

/** Builds the online board state from the server's moves (no animation). */
function stateFromMoves(side: Side, moves: readonly Move[]): UiState | null {
  const game = replayMoves(moves);
  if (!game) return null;
  return createUiState(game, { controlledSide: side, lastMove: moves[moves.length - 1] ?? null });
}

export function useOnlineGame(ui: UiState, dispatch: Dispatch<UiAction>, active: boolean): OnlineGame {
  const clientRef = useRef<MultiplayerClient | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [problem, setProblem] = useState<OnlineProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const sentKey = useRef<string | null>(null);

  const handleEvent = useCallback(
    (e: ClientEvent) => {
      const client = clientRef.current;
      if (!client) return;
      const current = uiRef.current;
      switch (e.type) {
        case 'seated': {
          setBusy(false);
          setProblem(null);
          // Keep what is already on the board if it is the start of the server's sequence
          // and at most one move behind (that one is then played with its animation);
          // otherwise rebuild the position from the server's moves.
          const local = current.game.history;
          const prefix = local.every((r, i) => {
            const m = e.moves[i];
            return m && m.from.x === r.from.x && m.from.y === r.from.y && m.to.x === r.to.x && m.to.y === r.to.y;
          });
          const fits = current.controlledSide === e.you.side && prefix && e.moves.length - local.length <= 1 && !current.forfeit;
          if (!fits) {
            const next = stateFromMoves(e.you.side, e.moves);
            if (next) dispatch({ type: 'load', state: next });
          } else if (current.pendingMove) {
            dispatch({ type: 'clearPending' });
          }
          if (e.room.status === 'finished' && e.room.endReason === 'surrender' && e.room.winner) {
            dispatch({ type: 'forfeit', winner: e.room.winner });
          }
          break;
        }
        case 'rejected':
          dispatch({ type: 'clearPending' });
          if (e.reason === 'DUPLICATE' || e.reason === 'OUT_OF_SEQUENCE') client.requestSync();
          break;
        case 'gameOver':
          // Mate / stalemate / general captured: the engine reaches the same result when the
          // final move is played. Surrender has no move, so it is applied here.
          if (e.reason === 'surrender') dispatch({ type: 'forfeit', winner: e.winner });
          break;
        case 'error':
          setBusy(false);
          setProblem(e.code);
          if (e.code === 'SESSION_INVALID') clearSession();
          break;
        case 'status':
          if (e.status === 'offline') {
            setBusy(false);
            setProblem('OFFLINE');
          }
          if (e.status !== 'connected' && uiRef.current.pendingMove) dispatch({ type: 'clearPending' });
          break;
        default:
          break;
      }
      rerender();
    },
    [dispatch],
  );

  const client = useCallback((): MultiplayerClient | null => {
    if (clientRef.current) return clientRef.current;
    const factory = getTransportFactory();
    if (!factory) {
      setProblem('UNAVAILABLE');
      return null;
    }
    const c = new MultiplayerClient(factory);
    c.subscribe(handleEvent);
    clientRef.current = c;
    return c;
  }, [handleEvent]);

  // Dispose the connection when online play ends or the app unmounts.
  useEffect(() => {
    if (active) return;
    clientRef.current?.dispose();
    clientRef.current = null;
  }, [active]);
  useEffect(() => () => clientRef.current?.dispose(), []);

  const c = clientRef.current;
  const serverMoves = c?.moves.length ?? 0;
  const ply = ui.game.history.length;
  const animating = ui.combat !== null || ui.movement !== null;

  // Play the server's next move once the board is free (one at a time, in order).
  useEffect(() => {
    if (!active || !c || ui.controlledSide === null || animating) return;
    const next = c.moves[ply];
    if (next) dispatch({ type: 'remoteMove', gameId: ui.gameId, ply, move: next });
  }, [active, c, ui.controlledSide, animating, ply, serverMoves, ui.gameId, dispatch]);

  // Send the player's chosen move (once) to the server.
  useEffect(() => {
    const pending = ui.pendingMove;
    if (!pending) {
      sentKey.current = null;
      return;
    }
    const key = `${ui.gameId}:${ply}:${pending.from.x},${pending.from.y}-${pending.to.x},${pending.to.y}`;
    if (sentKey.current === key) return;
    sentKey.current = key;
    if (!c || !c.requestMove(ply + 1, pending)) {
      setProblem('MOVE_NOT_SENT');
      dispatch({ type: 'clearPending' });
    }
  }, [ui.pendingMove, ui.gameId, ply, c, dispatch]);

  return {
    connection: c?.status ?? 'idle',
    seat: c?.seat ?? null,
    room: c?.room ?? null,
    problem,
    busy,
    createRoom: (nickname) => {
      const cl = client();
      if (!cl) return;
      setProblem(null);
      setBusy(true);
      cl.createRoom(nickname);
    },
    joinRoom: (roomId, nickname) => {
      const cl = client();
      if (!cl) return;
      setProblem(null);
      setBusy(true);
      cl.joinRoom(roomId, nickname);
    },
    resume: (roomId) => {
      const seat = loadSession();
      if (!seat || seat.roomId !== roomId) return false;
      const cl = client();
      if (!cl) return false;
      setBusy(true);
      cl.resume(seat);
      return true;
    },
    surrender: () => {
      clientRef.current?.surrender();
    },
    leave: () => {
      clientRef.current?.leave();
      clearSession();
      rerender();
    },
    clearProblem: () => setProblem(null),
  };
}
