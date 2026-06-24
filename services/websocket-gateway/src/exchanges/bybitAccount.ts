import { createHmac } from 'node:crypto';
import type { NormalizedAccountEvent } from '../config/accountConfig.js';
import type { AccountConfig } from '../config/accountConfig.js';
import type { AccountConnectorAdapter } from '../core/websocketClient.js';

function getBybitRegionHost() {
  const region = String(process.env.BYBIT_REGION || 'global').trim().toLowerCase();

  switch (region) {
    case 'tr':
    case 'turkey':
      return 'stream.bybit.tr';
    case 'kz':
    case 'kazakhstan':
      return 'stream.bybit.kz';
    case 'ge':
    case 'georgia':
      return 'stream.bybitgeorgia.ge';
    default:
      return 'stream.bybit.com';
  }
}

function getPrivateBaseUrl(config: AccountConfig) {
  if (config.environment === 'testnet') {
    return 'wss://stream-testnet.bybit.com/v5/private';
  }

  return `wss://${getBybitRegionHost()}/v5/private`;
}

function withMaxActiveTime(url: string) {
  const maxActiveTime = String(process.env.BYBIT_MAX_ACTIVE_TIME || '').trim();
  if (!maxActiveTime) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}max_active_time=${encodeURIComponent(maxActiveTime)}`;
}

function getCredentialSet(config: AccountConfig) {
  const isTestnet = config.environment === 'testnet';
  const apiKey = isTestnet
    ? process.env.BYBIT_TESTNET_API_KEY || process.env.BYBIT_API_KEY
    : process.env.BYBIT_API_KEY;
  const apiSecret = isTestnet
    ? process.env.BYBIT_TESTNET_API_SECRET || process.env.BYBIT_API_SECRET
    : process.env.BYBIT_API_SECRET;

  return {
    apiKey: String(apiKey || '').trim(),
    apiSecret: String(apiSecret || '').trim()
  };
}

function signAuthPayload(apiSecret: string, expires: number) {
  return createHmac('sha256', apiSecret)
    .update(`GET/realtime${expires}`)
    .digest('hex');
}

function classifyOrderEvent(status: string | undefined): NormalizedAccountEvent['eventType'] {
  switch (status) {
    case 'New':
    case 'Created':
    case 'Untriggered':
      return 'ORDER_NEW';
    case 'PartiallyFilled':
      return 'ORDER_PARTIAL_FILL';
    case 'Filled':
      return 'ORDER_FILLED';
    case 'Cancelled':
    case 'Deactivated':
      return 'ORDER_CANCELLED';
    case 'Rejected':
      return 'ORDER_REJECTED';
    default:
      return 'ORDER_UPDATE';
  }
}

function firstCoinEntry(item: Record<string, unknown>) {
  const coins = Array.isArray(item.coin) ? item.coin as Array<Record<string, unknown>> : [];
  return coins[0];
}

export const bybitAccountAdapter: AccountConnectorAdapter = {
  name: 'bybit_v5',
  buildUrl(config) {
    return withMaxActiveTime(getPrivateBaseUrl(config));
  },
  authenticate(socket, config) {
    const { apiKey, apiSecret } = getCredentialSet(config);
    if (!apiKey || !apiSecret) {
      throw new Error(`Missing Bybit ${config.environment} WebSocket credentials`);
    }

    const expires = Date.now() + 1_000;
    const signature = signAuthPayload(apiSecret, expires);
    socket.send(JSON.stringify({
      op: 'auth',
      args: [apiKey, expires, signature]
    }));
  },
  createPingMessage() {
    return { req_id: `ping-${Date.now()}`, op: 'ping' };
  },
  isPongMessage(raw) {
    const message = raw as Record<string, unknown>;
    if (message.op === 'pong') return true;
    return message.op === 'ping' && message.ret_msg === 'pong';
  },
  normalizeMessage(raw, receivedAt) {
    const message = raw as Record<string, unknown>;
    const authRetCode = typeof message.retCode === 'number'
      ? message.retCode
      : message.success === false
        ? -1
        : 0;
    if (message.op === 'auth' && authRetCode !== 0) {
      return {
        id: `bybit-auth-failure-${receivedAt}`,
        exchange: 'bybit_v5',
        eventType: 'AUTH_FAILURE',
        status: typeof message.retMsg === 'string' ? message.retMsg : typeof message.ret_msg === 'string' ? message.ret_msg : 'auth_failed',
        timestamp: receivedAt,
        receivedAt,
        latencyMs: 0,
        raw
      };
    }

    const topic = String(message.topic ?? '');
    const item = Array.isArray(message.data) ? message.data[0] as Record<string, unknown> : message.data as Record<string, unknown>;
    if (!item) return null;

    const status = typeof item.orderStatus === 'string' ? item.orderStatus : undefined;
    const timestamp = Number(item.updatedTime ?? item.creationTime ?? message.creationTime ?? Date.now());
    const coin = firstCoinEntry(item);

    const base = {
      id: `${topic}-${item.orderId ?? item.symbol ?? receivedAt}`,
      exchange: 'bybit_v5',
      accountId: typeof item.accountType === 'string' ? item.accountType : undefined,
      symbol: typeof item.symbol === 'string' ? item.symbol : undefined,
      orderId: item.orderId != null ? String(item.orderId) : undefined,
      clientOrderId: typeof item.orderLinkId === 'string' ? item.orderLinkId : undefined,
      side: item.side === 'Sell' ? 'sell' : item.side === 'Buy' ? 'buy' : undefined,
      orderType: typeof item.orderType === 'string' ? item.orderType : undefined,
      status,
      price: item.price != null ? Number(item.price) : item.entryPrice != null ? Number(item.entryPrice) : undefined,
      quantity: item.qty != null ? Number(item.qty) : item.size != null ? Number(item.size) : undefined,
      filledQuantity: item.cumExecQty != null ? Number(item.cumExecQty) : undefined,
      remainingQuantity: item.leavesQty != null ? Number(item.leavesQty) : undefined,
      fee: item.execFee != null ? Number(item.execFee) : undefined,
      feeAsset: typeof item.feeCurrency === 'string' ? item.feeCurrency : undefined,
      balanceAsset: typeof coin?.coin === 'string' ? coin.coin : undefined,
      balanceFree: coin?.availableToWithdraw != null ? Number(coin.availableToWithdraw) : undefined,
      balanceLocked: coin?.locked != null ? Number(coin.locked) : undefined,
      realizedPnl: item.curRealisedPnl != null ? Number(item.curRealisedPnl) : undefined,
      unrealizedPnl: item.unrealisedPnl != null ? Number(item.unrealisedPnl) : undefined,
      timestamp,
      receivedAt,
      latencyMs: Math.max(0, receivedAt - timestamp),
      raw
    } satisfies Omit<NormalizedAccountEvent, 'eventType'>;

    if (topic === 'wallet') return { ...base, eventType: 'BALANCE_UPDATE' };
    if (topic.startsWith('position')) return { ...base, eventType: 'POSITION_UPDATE' };
    if (topic.startsWith('order')) return { ...base, eventType: classifyOrderEvent(status) };
    if (topic.includes('execution')) return { ...base, eventType: 'ORDER_FILLED' };
    return null;
  }
};
