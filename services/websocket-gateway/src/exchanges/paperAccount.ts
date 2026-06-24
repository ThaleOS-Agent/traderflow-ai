import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const paperAccountAdapter: AccountConnectorAdapter = {
  name: 'paper',
  buildUrl() {
    return 'paper://local-simulated-stream';
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    return {
      id: `paper-${String(message.id ?? receivedAt)}`,
      exchange: 'paper',
      eventType: (message.eventType as 'ORDER_NEW') ?? 'ACCOUNT_UPDATE',
      symbol: typeof message.symbol === 'string' ? message.symbol : undefined,
      orderId: message.orderId != null ? String(message.orderId) : undefined,
      side: message.side === 'sell' ? 'sell' : message.side === 'buy' ? 'buy' : undefined,
      price: message.price != null ? Number(message.price) : undefined,
      quantity: message.quantity != null ? Number(message.quantity) : undefined,
      timestamp: Number(message.timestamp ?? receivedAt),
      receivedAt,
      latencyMs: Math.max(0, receivedAt - Number(message.timestamp ?? receivedAt)),
      raw
    };
  }
};
