import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * MetaTrader 4/5 connector.
 *
 * Resolution order:
 *   1. Local REST bridge  — MT5_API_URL env var (e.g. the EA bridge running on the terminal)
 *   2. MetaAPI cloud      — MT5_METAAPI_TOKEN env var  (https://metaapi.cloud)
 *   3. Mock / offline     — returns placeholder data so the UI still renders
 */

const BRIDGE_URL   = process.env.MT5_API_URL;
const METAAPI_TOKEN = process.env.MT5_METAAPI_TOKEN;
const METAAPI_ACCOUNT = process.env.MT5_METAAPI_ACCOUNT_ID;
const METAAPI_BASE = 'https://mt-client-api-v1.london.agiliumtrade.ai';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isBridgeConfigured() { return Boolean(BRIDGE_URL); }
function isMetaApiConfigured() { return Boolean(METAAPI_TOKEN && METAAPI_ACCOUNT); }

const bridgeClient = BRIDGE_URL
  ? axios.create({ baseURL: BRIDGE_URL, timeout: 10_000,
      headers: { 'X-Api-Key': process.env.MT5_API_KEY || '' } })
  : null;

const metaApiClient = METAAPI_TOKEN
  ? axios.create({ baseURL: METAAPI_BASE, timeout: 15_000,
      headers: { 'auth-token': METAAPI_TOKEN } })
  : null;

// ── Bridge adapter ────────────────────────────────────────────────────────────

async function bridgeGetAccount() {
  const { data } = await bridgeClient.get('/account');
  return data;
}

async function bridgeGetPositions() {
  const { data } = await bridgeClient.get('/positions');
  return data;
}

async function bridgeGetOrders() {
  const { data } = await bridgeClient.get('/orders');
  return data;
}

async function bridgeGetHistory(limit = 50) {
  const { data } = await bridgeClient.get('/history', { params: { limit } });
  return data;
}

async function bridgePlaceOrder(payload) {
  const { data } = await bridgeClient.post('/order', payload);
  return data;
}

async function bridgeClosePosition(positionId) {
  const id = String(positionId || '');
  if (!/^\d+$/.test(id)) {
    throw new Error('Invalid position id');
  }
  const { data } = await bridgeClient.delete(`/positions/${encodeURIComponent(id)}`);
  return data;
}

// ── MetaAPI adapter ───────────────────────────────────────────────────────────

async function metaApiGetAccount() {
  const { data } = await metaApiClient.get(`/users/current/accounts/${METAAPI_ACCOUNT}`);
  return {
    login: data.login,
    name: data.name,
    broker: data.broker,
    currency: data.currency,
    leverage: data.leverage,
    balance: data.connectionStatus === 'CONNECTED' ? data.balance : null,
    equity: data.equity,
    margin: data.usedMargin,
    freeMargin: data.freeMargin,
    server: data.server,
    platform: data.platform,
    connected: data.connectionStatus === 'CONNECTED',
  };
}

async function metaApiGetPositions() {
  const { data } = await metaApiClient.get(
    `/users/current/accounts/${METAAPI_ACCOUNT}/positions`
  );
  return (data || []).map(p => ({
    id: p.id,
    symbol: p.symbol,
    type: p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
    volume: p.volume,
    openPrice: p.openPrice,
    currentPrice: p.currentPrice,
    profit: p.profit,
    swap: p.swap,
    openTime: p.time,
    comment: p.comment,
  }));
}

async function metaApiGetOrders() {
  const { data } = await metaApiClient.get(
    `/users/current/accounts/${METAAPI_ACCOUNT}/orders`
  );
  return (data || []).map(o => ({
    id: o.id,
    symbol: o.symbol,
    type: o.type,
    volume: o.volume,
    openPrice: o.openPrice,
    stopLoss: o.stopLoss,
    takeProfit: o.takeProfit,
    state: o.state,
    placedAt: o.time,
  }));
}

async function metaApiPlaceOrder(payload) {
  const body = {
    symbol: payload.symbol,
    actionType: payload.side === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    volume: payload.volume,
    stopLoss: payload.stopLoss,
    takeProfit: payload.takeProfit,
    comment: payload.comment || 'TradeFlow AI',
  };
  const { data } = await metaApiClient.post(
    `/users/current/accounts/${METAAPI_ACCOUNT}/trade`, body
  );
  return data;
}

async function metaApiClosePosition(positionId) {
  const { data } = await metaApiClient.post(
    `/users/current/accounts/${METAAPI_ACCOUNT}/trade`,
    { actionType: 'POSITION_CLOSE_ID', positionId }
  );
  return data;
}

// ── Mock data (offline / not configured) ────────────────────────────────────

function mockAccount() {
  return {
    login: 'DEMO-12345',
    name: 'TradeFlow Demo',
    broker: 'MetaQuotes-Demo',
    currency: 'USD',
    leverage: 100,
    balance: 10000,
    equity: 10245.50,
    margin: 120.00,
    freeMargin: 10125.50,
    server: 'MetaQuotes-Demo',
    platform: 'MT5',
    connected: false,
    _mock: true,
  };
}

function mockPositions() {
  return [
    { id: 'mock-1', symbol: 'EURUSD', type: 'BUY', volume: 0.10, openPrice: 1.0850, currentPrice: 1.0871, profit: 21.00, swap: -0.50, openTime: new Date().toISOString(), _mock: true },
    { id: 'mock-2', symbol: 'XAUUSD', type: 'BUY', volume: 0.01, openPrice: 2300.00, currentPrice: 2318.50, profit: 18.50, swap: -1.20, openTime: new Date().toISOString(), _mock: true },
  ];
}

function mockOrders() {
  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

export const mt5Connector = {
  get mode() {
    if (isBridgeConfigured()) return 'bridge';
    if (isMetaApiConfigured()) return 'metaapi';
    return 'mock';
  },

  async getAccount() {
    try {
      if (isBridgeConfigured()) return await bridgeGetAccount();
      if (isMetaApiConfigured()) return await metaApiGetAccount();
    } catch (err) {
      logger.warn('MT5 getAccount fallback to mock:', err.message);
    }
    return mockAccount();
  },

  async getPositions() {
    try {
      if (isBridgeConfigured()) return await bridgeGetPositions();
      if (isMetaApiConfigured()) return await metaApiGetPositions();
    } catch (err) {
      logger.warn('MT5 getPositions fallback to mock:', err.message);
    }
    return mockPositions();
  },

  async getOrders() {
    try {
      if (isBridgeConfigured()) return await bridgeGetOrders();
      if (isMetaApiConfigured()) return await metaApiGetOrders();
    } catch (err) {
      logger.warn('MT5 getOrders fallback to mock:', err.message);
    }
    return mockOrders();
  },

  async getHistory(limit = 50) {
    try {
      if (isBridgeConfigured()) return await bridgeGetHistory(limit);
      // MetaAPI history requires separate subscription tier
    } catch (err) {
      logger.warn('MT5 getHistory fallback:', err.message);
    }
    return [];
  },

  async placeOrder(payload) {
    if (isBridgeConfigured()) return bridgePlaceOrder(payload);
    if (isMetaApiConfigured()) return metaApiPlaceOrder(payload);
    throw new Error('MT5 connector not configured. Set MT5_API_URL or MT5_METAAPI_TOKEN in .env');
  },

  async closePosition(positionId) {
    if (isBridgeConfigured()) return bridgeClosePosition(positionId);
    if (isMetaApiConfigured()) return metaApiClosePosition(positionId);
    throw new Error('MT5 connector not configured. Set MT5_API_URL or MT5_METAAPI_TOKEN in .env');
  },
};
