import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const krakenAccountAdapter: AccountConnectorAdapter = {
  name: 'kraken_v2',
  buildUrl() {
    return 'wss://ws-auth.kraken.com/v2';
  },
  createPingMessage() {
    return { method: 'ping' };
  },
  isPongMessage(raw) {
    const message = raw as Record<string, unknown>;
    return message.method === 'pong' || message.channel === 'heartbeat';
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    const item = Array.isArray(message.data) ? message.data[0] as Record<string, unknown> : null;
    if (!item) return null;

    return {
      id: `${String(message.channel ?? 'kraken')}-${String(item.order_id ?? item.symbol ?? receivedAt)}`,
      exchange: 'kraken_v2',
      eventType: String(message.channel ?? '').includes('balances')
        ? 'BALANCE_UPDATE'
        : String(message.channel ?? '').includes('executions')
          ? 'ORDER_FILLED'
          : 'ORDER_UPDATE',
      symbol: typeof item.symbol === 'string' ? item.symbol : undefined,
      orderId: item.order_id != null ? String(item.order_id) : undefined,
      clientOrderId: item.cl_ord_id != null ? String(item.cl_ord_id) : undefined,
      side: item.side === 'sell' ? 'sell' : item.side === 'buy' ? 'buy' : undefined,
      orderType: typeof item.order_type === 'string' ? item.order_type : undefined,
      status: typeof item.order_status === 'string' ? item.order_status : undefined,
      price: item.limit_price != null ? Number(item.limit_price) : undefined,
      quantity: item.order_qty != null ? Number(item.order_qty) : undefined,
      filledQuantity: item.cum_qty != null ? Number(item.cum_qty) : undefined,
      remainingQuantity: item.leaves_qty != null ? Number(item.leaves_qty) : undefined,
      fee: item.fee_usd_equiv != null ? Number(item.fee_usd_equiv) : undefined,
      timestamp: Number(item.timestamp ?? Date.now()),
      receivedAt,
      latencyMs: Math.max(0, receivedAt - Number(item.timestamp ?? receivedAt)),
      raw
    };
  }
};
