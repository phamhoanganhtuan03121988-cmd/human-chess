# human-chess — Cờ Tướng (Cinematic Xiangqi)

React + TypeScript + Vite. Play against the computer (offline, local-first) or
against a friend online in a private room.

```bash
npm install
npm run dev          # local development (AI play)
npm test             # unit + UI tests
npm run typecheck
npm run build        # production build in dist/
```

## Online multiplayer (private rooms)

- **Start screen → CHƠI ONLINE → TẠO PHÒNG**: you get a 6-character room code
  and a link `https://<host>/room/KX7P9A`. The creator is Red.
- **VÀO PHÒNG** (code) or opening the link: the second player is Blue. A third
  player is refused; finished rooms cannot be joined.
- The **room server is authoritative**: clients only send move requests; the
  server checks the seat, the turn, the move number and legality with the same
  engine (`src/engine`) and broadcasts accepted moves in order. Both boards play
  them with the normal capture context / combat / animation.
- Refresh or a network drop does not lose the game: the browser remembers its
  seat (`localStorage`) and reconnects; the server resends the full move list.

### Running the room server

`server/index.ts` serves the built game **and** the WebSocket endpoint `/ws`:

```bash
npm run build
npm run server       # http://localhost:8787 — open two browsers to play
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | listen port (default 8787) |
| `ALLOWED_ORIGINS` | server | comma-separated origins allowed to open `/ws` (set it in production) |
| `DIST_DIR` / `SERVE_STATIC=0` | server | where the built game is / serve only `/ws` |
| `VITE_MULTIPLAYER_URL` | frontend build | WebSocket URL of the room server when the game is hosted elsewhere (public, not a secret) |

Rooms are kept **in memory**, so run a **single instance** (e.g. Render, Fly.io,
Railway or any VPS with Node ≥ 22.6). With the game on **Vercel**: deploy the
frontend as usual (`vercel.json` rewrites `/room/*` to the app), run the room
server on a Node host, set `VITE_MULTIPLAYER_URL=wss://…/ws` in the Vercel
project and `ALLOWED_ORIGINS=https://<your-vercel-domain>` on the server.

Vercel Functions now accept WebSockets (public beta), but connections are not
guaranteed to reach the same instance, so rooms would need an external store
(e.g. Redis) — not implemented yet. The room logic (`src/multiplayer/room.ts`)
is transport-independent to make that move possible.
