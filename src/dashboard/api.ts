const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'tradeflow_token';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },

  setAuthToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  async login(email: string, password: string) {
    const data = await request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
  }) {
    const data = await request<{ token: string; user: Record<string, unknown> }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async getMe() {
    return request<{ user: Record<string, unknown> }>('/auth/me');
  },

  async getDashboard() {
    return request<Record<string, unknown>>('/dashboard/overview');
  },

  async getLiveFeed(category = 'all') {
    return request<{
      success: boolean;
      marketData: Array<{
        symbol: string;
        label: string;
        category: 'crypto' | 'forex' | 'metal' | 'oil';
        provider: string;
        price: number | null;
        change24h: number;
        high24h: number | null;
        low24h: number | null;
        volume: number | null;
        quoteVolume: number | null;
        status: 'live' | 'unavailable';
        updatedAt: string;
        error?: string;
      }>;
      updatedAt: string;
    }>(`/dashboard/live-feed?category=${encodeURIComponent(category)}`);
  },

  async getStrategyResults() {
    return request<{
      success: boolean;
      results: Array<{
        strategy: string;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        openTrades: number;
        pnl: number;
        avgProfitPercent: number;
        activeSignals: number;
        avgConfidence: number;
        winRate: number;
        latestSignal: null | {
          symbol: string;
          side: string;
          confidenceScore: number;
          analysis: string;
          createdAt: string;
        };
      }>;
    }>('/dashboard/strategy-results');
  },

  async getAiLearning() {
    return request<{
      success: boolean;
      performance: {
        predictions: number;
        correctPredictions: number;
        accuracy: string | number;
        lastTraining: string | null;
      };
      learning: {
        mode: string;
        recentSignals: number;
        avgSignalConfidence: number;
        lastTraining: string | null;
        trackedAssetTypes: string[];
      };
      models: Array<{
        assetType: string;
        priceDirection: number;
        opportunityScore: number;
        volatilityForecast: number;
      }>;
    }>('/dashboard/ai-learning');
  },

  async getTrades(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page)  query.set('page',  String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return request<Record<string, unknown>>(`/trades?${query}`);
  },

  async getTradeStats(timeframe = '30d') {
    return request<{
      stats: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalProfit: number;
        totalLoss: number;
        netProfit: number;
        avgProfit: number;
        avgLoss: number;
        winRate: string | number;
        profitFactor?: string | number;
      };
    }>(`/trades/stats/overview?timeframe=${encodeURIComponent(timeframe)}`);
  },

  async createTrade(payload: {
    symbol: string;
    assetType: 'crypto' | 'forex' | 'commodity' | 'stock';
    side: 'buy' | 'sell';
    entryPrice: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    orderType: 'market' | 'limit' | 'stop';
    isPaperTrade?: boolean;
  }) {
    return request<{ message: string; trade: Record<string, unknown> }>('/trades', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async closeTrade(id: string) {
    return request<{ message: string; trade: Record<string, unknown> }>(`/trades/${id}/close`, {
      method: 'POST',
    });
  },

  async getSignals() {
    return request<Record<string, unknown>>('/signals');
  },

  async getStrategies() {
    return request<Record<string, unknown>>('/strategies');
  },

  async getPortfolio() {
    return request<Record<string, unknown>>('/user/portfolio');
  },

  async getTradingSettings() {
    return request<{
      settings: {
        autoTrading: boolean;
        paperTrading: boolean;
        defaultStrategy: string;
        riskLevel: string;
        maxDailyLoss: number;
        maxPositionSize: number;
        stopLossPercent: number;
        takeProfitPercent: number;
        leverage: number;
      };
    }>('/user/trading-settings');
  },

  async toggleAutoTrading(enabled: boolean) {
    return request<{ success: boolean; autoTrading: boolean; message: string }>('/user/toggle-auto-trading', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  async togglePaperTrading(enabled: boolean) {
    return request<{ success: boolean; paperTrading: boolean; message: string }>('/user/toggle-paper-trading', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  async getSubscription() {
    return request<{
      success: boolean;
      subscription: {
        tier: string;
        status: string;
        expiresAt?: string;
        isFounder: boolean;
        features: string[];
      };
    }>('/wallet/subscription');
  },

  async getTiers() {
    return request<Record<string, unknown>>('/wallet/tiers');
  },

  async createWalletSession() {
    return request<{
      success: boolean;
      session: {
        id: string;
        uri: string;
        message: string;
        expiresAt: string;
      };
    }>('/wallet/connect', { method: 'POST' });
  },

  async getWalletSession(sessionId: string) {
    return request<{
      success: boolean;
      status: {
        status: string;
        walletAddress?: string;
        chainId?: number;
      };
    }>(`/wallet/session/${encodeURIComponent(sessionId)}`);
  },

  async verifyWallet(payload: {
    sessionId: string;
    address: string;
    chainId: number;
    signature: string;
    message: string;
  }) {
    return request<{
      success: boolean;
      token: string;
      user: Record<string, unknown>;
      session: Record<string, unknown>;
    }>('/wallet/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async linkWallet(payload: {
    sessionId: string;
    address: string;
    chainId: number;
    signature: string;
    message: string;
  }) {
    return request<{
      success: boolean;
      linked: boolean;
      user: Record<string, unknown>;
      session: Record<string, unknown>;
    }>('/wallet/link', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async disconnectWallet(sessionId: string) {
    return request<{ success: boolean; message: string }>('/wallet/disconnect', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  async getMt5Status() {
    return request<{
      success: boolean;
      mode: 'bridge' | 'metaapi' | 'mock';
      account: Record<string, unknown>;
    }>('/mt5/status');
  },

  async getMt5Positions() {
    return request<{ success: boolean; positions: Record<string, unknown>[] }>('/mt5/positions');
  },

  async getMt5Orders() {
    return request<{ success: boolean; orders: Record<string, unknown>[] }>('/mt5/orders');
  },

  async getMt5Connections() {
    return request<{ success: boolean; connections: Record<string, unknown>[] }>('/mt5/connections');
  },

  async saveMt5Connection(payload: Record<string, unknown>) {
    return request<{ success: boolean; connection: Record<string, unknown> }>('/mt5/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async testMt5Connection(id: string) {
    return request<{ success: boolean; connection: Record<string, unknown>; account: Record<string, unknown> }>(`/mt5/connections/${id}/test`, {
      method: 'POST',
    });
  },

  async activateMt5Connection(id: string) {
    return request<{ success: boolean; connection: Record<string, unknown> }>(`/mt5/connections/${id}/activate`, {
      method: 'POST',
    });
  },

  async deleteMt5Connection(id: string) {
    return request<{ success: boolean; message: string }>(`/mt5/connections/${id}`, {
      method: 'DELETE',
    });
  },

  async getExchangeConnections() {
    return request<{ success: boolean; connections: Record<string, unknown>[] }>('/exchange/connections');
  },

  async saveExchangeConnection(payload: Record<string, unknown>) {
    return request<{ success: boolean; connection: Record<string, unknown> }>('/exchange/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async testExchangeConnection(payload: Record<string, unknown>) {
    return request<{ success: boolean; message: string; account?: Record<string, unknown> }>('/exchange/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async activateExchangeConnection(id: string) {
    return request<{ success: boolean; connection: Record<string, unknown> }>(`/exchange/connections/${id}/activate`, {
      method: 'POST',
    });
  },

  async deleteExchangeConnection(id: string) {
    return request<{ success: boolean; message: string }>(`/exchange/connections/${id}`, {
      method: 'DELETE',
    });
  },

  async getKlines(symbol: string, interval = '1h', exchange?: string) {
    const q = new URLSearchParams({ interval, limit: '200' });
    if (exchange) q.set('exchange', exchange);
    return request<{ klines: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> }>(
      `/exchange/klines/${symbol}?${q}`
    );
  },
};
