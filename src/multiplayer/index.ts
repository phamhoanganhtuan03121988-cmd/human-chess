/**
 * Online multiplayer foundation: protocol, authoritative room server,
 * transports and the client. Independent of React; the game UI uses it
 * through src/game/useOnlineGame.ts.
 */
export * from './types.ts';
export * from './protocol.ts';
export { RoomServer } from './room.ts';
export type { RoomServerOptions, ServerConnection } from './room.ts';
export { MultiplayerClient } from './client.ts';
export type { ClientEvent, ClientOptions, ConnectionStatus } from './client.ts';
export { createLoopback, resolveServerUrl, webSocketTransport } from './transport.ts';
export type { Loopback, Transport, TransportFactory } from './transport.ts';
export { normalizeNickname, normalizeRoomId, replayMoves, isValidMove } from './validation.ts';
export { clearSession, loadNickname, loadSession, saveNickname, saveSession } from './session.ts';
export { getTransportFactory, setTransportFactory } from './config.ts';
