/**
 * Transport: how the client's text messages reach the room server. The game
 * never depends on a particular realtime vendor — swap the factory.
 *
 * - webSocketTransport: a plain WebSocket to the room server (server/index.ts,
 *   or any host speaking the same protocol).
 * - createLoopback: an in-process RoomServer (tests, no network).
 */
import type { RoomServer } from './room.ts';
import type { ServerMessage } from './protocol.ts';

export interface Transport {
  send(text: string): void;
  close(): void;
  onOpen: (() => void) | null;
  onMessage: ((text: string) => void) | null;
  /** Fired once when the connection ends (or fails to open). */
  onClose: (() => void) | null;
}

export type TransportFactory = () => Transport;

export function webSocketTransport(url: string): TransportFactory {
  return () => {
    const t: Transport = { send: () => {}, close: () => {}, onOpen: null, onMessage: null, onClose: null };
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      queueMicrotask(() => t.onClose?.());
      return t;
    }
    let closed = false;
    const onUnload = () => {
      try {
        ws.close(1000, 'Page unloaded');
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', onUnload);
      window.addEventListener('beforeunload', onUnload);
    }
    const end = () => {
      if (closed) return;
      closed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onUnload);
        window.removeEventListener('beforeunload', onUnload);
      }
      t.onClose?.();
    };
    ws.onopen = () => t.onOpen?.();
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') t.onMessage?.(e.data);
    };
    ws.onclose = end;
    ws.onerror = end;
    t.send = (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    };
    t.close = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      end();
    };
    return t;
  };
}

/**
 * Where the room server lives: VITE_MULTIPLAYER_URL when set (e.g. a Vercel
 * frontend talking to a separate realtime host), otherwise `/ws` on the page's
 * own origin (the bundled Node server serves both the game and `/ws`).
 */
export function resolveServerUrl(): string | null {
  const configured = (import.meta.env?.VITE_MULTIPLAYER_URL as string | undefined)?.trim();
  if (configured) return configured;
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export interface Loopback {
  readonly factory: TransportFactory;
  /** Simulates a network drop for every open connection. */
  dropAll(): void;
  /** While offline, new connections fail immediately. */
  setOffline(offline: boolean): void;
}

/** Connection ids are unique across loopbacks (several may share one server). */
let nextLoopbackId = 0;

/** In-memory transport wired to a RoomServer (asynchronous, like a real socket). */
export function createLoopback(server: RoomServer): Loopback {
  let offline = false;
  const open = new Set<() => void>();
  const factory: TransportFactory = () => {
    const id = `loop-${++nextLoopbackId}`;
    const t: Transport = { send: () => {}, close: () => {}, onOpen: null, onMessage: null, onClose: null };
    if (offline) {
      queueMicrotask(() => t.onClose?.());
      return t;
    }
    let alive = true;
    const end = () => {
      if (!alive) return;
      alive = false;
      open.delete(end);
      server.disconnect(id);
      queueMicrotask(() => t.onClose?.());
    };
    server.connect({
      id,
      send: (message: ServerMessage) => {
        const text = JSON.stringify(message);
        queueMicrotask(() => alive && t.onMessage?.(text));
      },
    });
    open.add(end);
    t.send = (text) => {
      if (alive) queueMicrotask(() => alive && server.receive(id, text));
    };
    t.close = end;
    queueMicrotask(() => alive && t.onOpen?.());
    return t;
  };
  return {
    factory,
    dropAll: () => [...open].forEach((end) => end()),
    setOffline: (v) => {
      offline = v;
    },
  };
}
