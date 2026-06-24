import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { AccountConnectorAdapter } from '../core/websocketClient.js';

export const bybitAccountAdapter: AccountConnectorAdapter = {
  name: 'bybit_v5',
  buildUrl() {
    return 'wss://stream-testnet.bybit.com/v5/private';
  },
  createPingMessage() {
    return { op: 'ping' };
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    const topic = String(message.topic ?? '');
    const item = Array.isArray(message.data) ? message.data[0] as Record<string, unknown> : message.data as Record<string, unknown>;
    if (!item) return null;

    const base = {
      id: `${topic}-${item.orderId ?? item.symbol ?? receivedAt}`,
      exchange: 'bybit_v5',
      symbol: typeof item.symbol === 'string' ? item.symbol : undefined,
      orderId: item.orderId != null ? String(item.orderId) : undefined,
      clientOrderId: typeof item.orderLinkId === 'string' ? item.orderLinkId : undefined,
      side: item.side === 'Sell' ? 'sell' : item.side === 'Buy' ? 'buy' : undefined,
      orderType: typeof item.orderType === 'string' ? item.orderType : undefined,
      status: typeof item.orderStatus === 'string' ? item.orderStatus : undefined,
      price: item.price != null ? Number(item.price) : undefined,
      quantity: item.qty != null ? Number(item.qty) : undefined,
      filledQuantity: item.cumExecQty != null ? Number(item.cumExecQty) : undefined,
      remainingQuantity: item.leavesQty != null ? Number(item.leavesQty) : undefined,
      fee: item.execFee != null ? Number(item.execFee) : undefined,
      feeAsset: typeof item.feeCurrency === 'string' ? item.feeCurrency : undefined,
      timestamp: Number(item.updatedTime ?? item.creationTime ?? Date.now()),
      receivedAt,
      latencyMs: Math.max(0, receivedAt - Number(item.updatedTime ?? item.creationTime ?? receivedAt)),
      raw
    } satisfies Omit<NormalizedAccountEvent, 'eventType'>;

    if (topic.includes('wallet')) return { ...base, eventType: 'BALANCE_UPDATE' };
    if (topic.includes('position')) return { ...base, eventType: 'POSITION_UPDATE', unrealizedPnl: item.unrealisedPnl != null ? Number(item.unrealisedPnl) : undefined };
    if (topic.includes('order')) return { ...base, eventType: 'ORDER_UPDATE' };
    if (topic.includes('execution')) return { ...base, eventType: 'ORDER_FILLED' };
    return null;
  }
};
