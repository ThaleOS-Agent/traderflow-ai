import type { AccountConfig, NormalizedAccountEvent } from '../config/accountConfig.js';
import type { AccountConnectorAdapter } from '../core/websocketClient.js';

function event(raw: Record<string, unknown>, receivedAt: number, type: NormalizedAccountEvent['eventType']): NormalizedAccountEvent {
  const timestamp = Number(raw.E ?? raw.T ?? Date.now());
  return {
    id: `${type}-${raw.i ?? raw.a ?? receivedAt}`,
    exchange: 'binance_futures',
    accountId: typeof raw.a === 'string' ? raw.a : undefined,
    eventType: type,
    symbol: typeof raw.s === 'string' ? raw.s : undefined,
    orderId: raw.i != null ? String(raw.i) : undefined,
    clientOrderId: typeof raw.c === 'string' ? raw.c : undefined,
    side: raw.S === 'SELL' ? 'sell' : raw.S === 'BUY' ? 'buy' : undefined,
    orderType: typeof raw.o === 'string' ? raw.o : undefined,
    status: typeof raw.X === 'string' ? raw.X : undefined,
    price: raw.p != null ? Number(raw.p) : undefined,
    quantity: raw.q != null ? Number(raw.q) : undefined,
    filledQuantity: raw.z != null ? Number(raw.z) : undefined,
    remainingQuantity: raw.q != null && raw.z != null ? Number(raw.q) - Number(raw.z) : undefined,
    realizedPnl: raw.rp != null ? Number(raw.rp) : undefined,
    timestamp,
    receivedAt,
    latencyMs: Math.max(0, receivedAt - timestamp),
    sequence: raw.u != null ? Number(raw.u) : undefined,
    raw
  };
}

export const binanceAccountAdapter: AccountConnectorAdapter = {
  name: 'binance_futures',
  buildUrl(config: AccountConfig) {
    return config.environment === 'mainnet'
      ? 'wss://fstream.binance.com/ws/<listenKey>'
      : 'wss://stream.binancefuture.com/ws/<listenKey>';
  },
  createPingMessage() {
    return { op: 'ping' };
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    if (message.e === 'ACCOUNT_UPDATE') return event(message, receivedAt, 'ACCOUNT_UPDATE');
    if (message.e === 'balanceUpdate') return event(message, receivedAt, 'BALANCE_UPDATE');
    if (message.e === 'ORDER_TRADE_UPDATE') {
      const order = message.o as Record<string, unknown>;
      if (!order) return null;
      const executionType = String(order.x ?? '');
      const statusType = executionType === 'TRADE'
        ? (Number(order.z ?? 0) >= Number(order.q ?? 0) ? 'ORDER_FILLED' : 'ORDER_PARTIAL_FILL')
        : executionType === 'CANCELED'
          ? 'ORDER_CANCELLED'
          : executionType === 'REJECTED'
            ? 'ORDER_REJECTED'
            : 'ORDER_UPDATE';
      return event({ ...order, E: message.E }, receivedAt, statusType as NormalizedAccountEvent['eventType']);
    }
    return null;
  }
};
