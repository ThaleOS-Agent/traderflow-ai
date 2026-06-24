import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const oandaAccountAdapter: AccountConnectorAdapter = {
  name: 'oanda_practice',
  buildUrl() {
    return 'wss://stream-fxpractice.oanda.com/v3/accounts/<accountId>/transactions/stream';
  },
  createPingMessage() {
    return { type: 'PING' };
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    if (message.type === 'HEARTBEAT') {
      return {
        id: `oanda-heartbeat-${receivedAt}`,
        exchange: 'oanda_practice',
        eventType: 'HEARTBEAT',
        timestamp: receivedAt,
        receivedAt,
        latencyMs: 0,
        raw
      };
    }

    return {
      id: `oanda-${String(message.id ?? receivedAt)}`,
      exchange: 'oanda_practice',
      eventType: message.type === 'ORDER_FILL' ? 'ORDER_FILLED' : 'ORDER_UPDATE',
      symbol: typeof message.instrument === 'string' ? message.instrument : undefined,
      orderId: message.orderID != null ? String(message.orderID) : undefined,
      side: Number(message.units ?? 0) < 0 ? 'sell' : 'buy',
      price: message.price != null ? Number(message.price) : undefined,
      quantity: message.units != null ? Math.abs(Number(message.units)) : undefined,
      realizedPnl: message.pl != null ? Number(message.pl) : undefined,
      timestamp: message.time ? Date.parse(String(message.time)) : receivedAt,
      receivedAt,
      latencyMs: message.time ? Math.max(0, receivedAt - Date.parse(String(message.time))) : 0,
      raw
    };
  }
};
