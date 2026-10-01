/**
 * Cờ Tướng room server: serves the built game (dist/) and the multiplayer
 * WebSocket endpoint (/ws) from one Node process.
 *
 *   npm run build && npm run server        # http://localhost:8787
 *
 * Environment:
 *   PORT              listen port (default 8787; hosts such as Render set it)
 *   HOST              interface to bind (default 0.0.0.0, i.e. reachable from outside the container)
 *   DIST_DIR          built frontend to serve (default ./dist; set SERVE_STATIC=0 to disable)
 *   ALLOWED_ORIGINS   comma-separated origins allowed to open /ws (e.g. the Vercel frontend URL);
 *                     unset = any origin (local development)
 *
 * Rooms live in memory (RoomServer), so run ONE instance. See README for hosting.
 */
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { MAX_MESSAGE_BYTES } from '../src/multiplayer/protocol.ts';
import { RoomServer } from '../src/multiplayer/room.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = resolve(process.env.DIST_DIR ?? 'dist');
const SERVE_STATIC = process.env.SERVE_STATIC !== '0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const rooms = new RoomServer();

// ---- static files (the built game) -------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // Health check for the host (e.g. Render's Health Check Path).
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end('{"status":"ok"}');
    return;
  }
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end(`ok rooms=${rooms.roomCount}`);
    return;
  }
  if (!SERVE_STATIC) {
    res.writeHead(404).end();
    return;
  }
  // Resolve inside DIST only (no path traversal).
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(DIST, rel);
  if (!file.startsWith(DIST + sep) && file !== DIST) {
    res.writeHead(400).end();
    return;
  }
  const isFile = existsSync(file) && statSync(file).isFile();
  // SPA routes such as /room/KX7P9A fall back to index.html.
  if (!isFile) {
    if (extname(url.pathname)) {
      res.writeHead(404).end();
      return;
    }
    file = join(DIST, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(503, { 'content-type': 'text/plain' }).end('Build the game first: npm run build');
      return;
    }
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  const immutable = file.includes(`${sep}assets${sep}index-`);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

// ---- WebSocket rooms --------------------------------------------------------------

const http = createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const origin = req.headers.origin ?? '';
  if (url.pathname !== '/ws' || (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin))) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws: WebSocket) => {
  const id = randomUUID();
  alive.set(ws, true);
  rooms.connect({
    id,
    send: (message) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    },
  });
  ws.on('pong', () => alive.set(ws, true));
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    alive.set(ws, true);
    rooms.receive(id, data.toString());
  });
  ws.on('close', () => rooms.disconnect(id));
  ws.on('error', () => ws.terminate());
});

// Drop dead sockets (their seats stay reserved for reconnecting) and close abandoned rooms.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 5_000).unref();
setInterval(() => rooms.sweep(), 60_000).unref();

http.listen(PORT, HOST, () => {
  const origins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS.join(', ') : 'any';
  console.log(`Cờ Tướng server on ${HOST}:${PORT}  (ws: /ws, origins: ${origins}, static: ${SERVE_STATIC ? DIST : 'off'})`);
});
