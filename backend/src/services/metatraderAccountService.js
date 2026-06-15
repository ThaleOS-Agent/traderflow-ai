import axios from 'axios';

const METAAPI_BASE = 'https://mt-client-api-v1.london.agiliumtrade.ai';

function pickAccount(user, accountId) {
  const accounts = user.getDecryptedMetatraderAccounts?.() || [];
  if (accountId) {
    return accounts.find(account => account._id.toString() === accountId);
  }
  return accounts.find(account => account.isActive) || accounts[0] || null;
}

function bridgeClient(account) {
  return axios.create({
    baseURL: account.apiUrl,
    timeout: 10_000,
    headers: account.apiKey ? { 'X-Api-Key': account.apiKey } : {}
  });
}

function metaApiClient(account) {
  return axios.create({
    baseURL: METAAPI_BASE,
    timeout: 15_000,
    headers: { 'auth-token': account.token }
  });
}

function requireAccount(account) {
  if (!account) throw new Error('No MT4/MT5 account configured');
  if (account.provider === 'bridge' && !account.apiUrl) {
    throw new Error('Bridge account requires apiUrl');
  }
  if (account.provider === 'metaapi' && (!account.token || !account.accountId)) {
    throw new Error('MetaAPI account requires token and accountId');
  }
}

function normalizeMetaApiAccount(data, platform) {
  return {
    login: data.login,
    name: data.name,
    broker: data.broker,
    currency: data.currency,
    leverage: data.leverage,
    balance: data.balance ?? null,
    equity: data.equity ?? null,
    margin: data.usedMargin ?? null,
    freeMargin: data.freeMargin ?? null,
    server: data.server,
    platform: data.platform || platform?.toUpperCase(),
    connected: data.connectionStatus === 'CONNECTED',
  };
}

export function sanitizeMetatraderAccount(account) {
  const obj = account.toObject ? account.toObject() : account;
  return {
    id: obj._id?.toString(),
    platform: obj.platform,
    provider: obj.provider,
    label: obj.label,
    login: obj.login,
    server: obj.server,
    accountId: obj.accountId,
    apiUrl: obj.apiUrl,
    isDemo: obj.isDemo,
    isActive: obj.isActive,
    connectionStatus: obj.connectionStatus,
    lastConnectedAt: obj.lastConnectedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

export const metatraderAccountService = {
  pickAccount,

  async testAccount(account) {
    requireAccount(account);
    if (account.provider === 'bridge') {
      const { data } = await bridgeClient(account).get('/account');
      return data;
    }

    const { data } = await metaApiClient(account).get(`/users/current/accounts/${account.accountId}`);
    return normalizeMetaApiAccount(data, account.platform);
  },

  async getAccount(user, accountId) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    const summary = await this.testAccount(account);
    return {
      ...summary,
      configuredAccountId: account._id.toString(),
      provider: account.provider,
      platform: account.platform?.toUpperCase()
    };
  },

  async getPositions(user, accountId) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    if (account.provider === 'bridge') {
      const { data } = await bridgeClient(account).get('/positions');
      return data;
    }

    const { data } = await metaApiClient(account).get(`/users/current/accounts/${account.accountId}/positions`);
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
  },

  async getOrders(user, accountId) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    if (account.provider === 'bridge') {
      const { data } = await bridgeClient(account).get('/orders');
      return data;
    }

    const { data } = await metaApiClient(account).get(`/users/current/accounts/${account.accountId}/orders`);
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
  },

  async getHistory(user, accountId, limit = 50) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    if (account.provider !== 'bridge') return [];
    const { data } = await bridgeClient(account).get('/history', { params: { limit } });
    return data;
  },

  async placeOrder(user, accountId, payload) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    if (account.provider === 'bridge') {
      const { data } = await bridgeClient(account).post('/order', payload);
      return data;
    }

    const body = {
      symbol: payload.symbol,
      actionType: payload.side === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: payload.volume,
      stopLoss: payload.stopLoss,
      takeProfit: payload.takeProfit,
      comment: payload.comment || 'TradeFlow AI',
    };
    const { data } = await metaApiClient(account).post(`/users/current/accounts/${account.accountId}/trade`, body);
    return data;
  },

  async closePosition(user, accountId, positionId) {
    const account = pickAccount(user, accountId);
    requireAccount(account);
    if (account.provider === 'bridge') {
      const { data } = await bridgeClient(account).delete(`/positions/${positionId}`);
      return data;
    }

    const { data } = await metaApiClient(account).post(
      `/users/current/accounts/${account.accountId}/trade`,
      { actionType: 'POSITION_CLOSE_ID', positionId }
    );
    return data;
  }
};
