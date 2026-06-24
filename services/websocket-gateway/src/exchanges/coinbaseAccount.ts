import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const coinbaseAccountAdapter: AccountConnectorAdapter = {
  name: 'coinbase_advanced_trade',
  buildUrl() {
    return 'wss://advanced-trade-ws.coinbase.com';
  },
  createPingMessage() {
    return { type: 'subscribe', channel: 'heartbeats' };
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    const channel = String(message.channel ?? message.type ?? '');
    const event = Array.isArray(message.events) ? message.events[0] as Record<string, unknown> : null;
    if (!event) return null;

    return {
      id: `${channel}-${String(event.order_id ?? event.product_id ?? receivedAt)}`,
      exchange: 'coinbase_advanced_trade',
      eventType: channel.includes('heartbeats')
        ? 'HEARTBEAT'
        : channel.includes('user')
          ? 'ORDER_UPDATE'
          : 'ACCOUNT_UPDATE',
      symbol: typeof event.product_id === 'string' ? event.product_id : undefined,
      orderId: event.order_id != null ? String(event.order_id) : undefined,
      clientOrderId: event.client_order_id != null ? String(event.client_order_id) : undefined,
      side: event.side === 'SELL' ? 'sell' : event.side === 'BUY' ? 'buy' : undefined,
      orderType: typeof event.order_type === 'string' ? event.order_type : undefined,
      status: typeof event.status === 'string' ? event.status : undefined,
      price: event.price != null ? Number(event.price) : undefined,
      quantity: event.order_quantity != null ? Number(event.order_quantity) : undefined,
      filledQuantity: event.filled_value != null ? Number(event.filled_value) : undefined,
      timestamp: Number(event.event_time ?? Date.now()),
      receivedAt,
      latencyMs: Math.max(0, receivedAt - Number(event.event_time ?? receivedAt)),
      raw
    };
  }
};
