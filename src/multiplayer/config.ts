/**
 * Which transport the game uses to reach the room server. Defaults to a
 * WebSocket to resolveServerUrl(); tests (or another realtime provider)
 * install their own factory. Null = online play unavailable here.
 */
import { resolveServerUrl, webSocketTransport } from './transport.ts';
import type { TransportFactory } from './transport.ts';

let override: TransportFactory | null | undefined;

export function setTransportFactory(factory: TransportFactory | null | undefined): void {
  override = factory;
}

export function getTransportFactory(): TransportFactory | null {
  if (override !== undefined) return override;
  const url = resolveServerUrl();
  return url ? webSocketTransport(url) : null;
}
