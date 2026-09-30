import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

/*
 * Runs the real room server the way a host such as Render does: `npm run server`
 * with PORT from the environment, no built frontend (SERVE_STATIC=0) and an
 * origin allow-list, then talks to it over HTTP and a real WebSocket.
 */
const ORIGIN = 'https://human-chess.vercel.app';
let server: ChildProcess;
let base: string;

const freePort = () =>
  new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });

beforeAll(async () => {
  const port = await freePort();
  base = `127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'server/index.ts'], {
    env: { ...process.env, PORT: String(port), SERVE_STATIC: '0', ALLOWED_ORIGINS: ORIGIN },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((ready, fail) => {
    server.stdout!.on('data', (d: Buffer) => d.toString().includes('server on') && ready());
    server.on('exit', (code) => fail(new Error(`server exited (${code})`)));
  });
}, 20_000);
afterAll(() => {
  server?.kill();
});

const open = (origin: string) =>
  new Promise<WebSocket>((ok, fail) => {
    const ws = new WebSocket(`ws://${base}/ws`, { origin });
    ws.once('open', () => ok(ws));
    ws.once('error', fail);
  });
const next = (ws: WebSocket) => new Promise<Record<string, unknown>>((got) => ws.once('message', (d) => got(JSON.parse(d.toString()))));

describe('room server process', () => {

  it('GET /health answers 200 {"status":"ok"}', async () => {
    const res = await fetch(`http://${base}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('serves no files when SERVE_STATIC=0', async () => {
    expect((await fetch(`http://${base}/`)).status).toBe(404);
  });

  it('accepts /ws from an allowed origin and speaks the game protocol', async () => {
    const ws = await open(ORIGIN);
    const reply = next(ws);
    ws.send(JSON.stringify({ type: 'CREATE_ROOM', nickname: 'Tuấn' }));
    const msg = await reply;
    expect(msg.type).toBe('ROOM_JOINED');
    expect(msg.you).toMatchObject({ side: 'red', nickname: 'Tuấn' });
    ws.close();
  });

  it('refuses other origins and other paths', async () => {
    await expect(open('https://evil.example')).rejects.toThrow(/403/);
    await expect(
      new Promise((ok, fail) => {
        const ws = new WebSocket(`ws://${base}/other`, { origin: ORIGIN });
        ws.once('open', ok);
        ws.once('error', fail);
      }),
    ).rejects.toThrow(/403/);
  });
});
