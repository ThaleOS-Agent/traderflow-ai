import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const okxAccountAdapter: AccountConnectorAdapter = {
  name: 'okx_v5',
  buildUrl() {
    return 'wss://ws.okx.com:8443/ws/v5/private';
  },
  createPingMessage() {
    return 'ping';
  },
  isPongMessage(raw) {
    return raw === 'pong';
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    const arg = message.arg as Record<string, unknown> | undefined;
    const channel = String(arg?.channel ?? '');
    const item = Array.isArray(message.data) ? message.data[0] as Record<string, unknown> : null;
    if (!item) return null;

    return {
      id: `${channel}-${String(item.ordId ?? item.ccy ?? receivedAt)}`,
      exchange: 'okx_v5',
      eventType: channel.includes('orders')
        ? 'ORDER_UPDATE'
        : channel.includes('balance_and_position')
          ? 'POSITION_UPDATE'
          : 'ACCOUNT_UPDATE',
      symbol: typeof item.instId === 'string' ? item.instId : undefined,
      orderId: item.ordId != null ? String(item.ordId) : undefined,
      clientOrderId: item.clOrdId != null ? String(item.clOrdId) : undefined,
      side: item.side === 'sell' ? 'sell' : item.side === 'buy' ? 'buy' : undefined,
      orderType: typeof item.ordType === 'string' ? item.ordType : undefined,
      status: typeof item.state === 'string' ? item.state : undefined,
      price: item.px != null ? Number(item.px) : undefined,
      quantity: item.sz != null ? Number(item.sz) : undefined,
      filledQuantity: item.accFillSz != null ? Number(item.accFillSz) : undefined,
      timestamp: Number(item.uTime ?? Date.now()),
      receivedAt,
      latencyMs: Math.max(0, receivedAt - Number(item.uTime ?? receivedAt)),
      raw
    };
  }
};
