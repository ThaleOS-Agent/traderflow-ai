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
    return request<Record<string, unknown>>('/dashboard');
  },

  async getTrades(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page)  query.set('page',  String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return request<Record<string, unknown>>(`/trades?${query}`);
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

  async getKlines(symbol: string, interval = '1h', exchange?: string) {
    const q = new URLSearchParams({ interval, limit: '200' });
    if (exchange) q.set('exchange', exchange);
    return request<{ klines: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> }>(
      `/exchange/klines/${symbol}?${q}`
    );
  },

  async getTradingSettings() {
    return request<{ settings: Record<string, unknown> }>('/user/trading-settings');
  },

  async updateTradingSettings(settings: Record<string, unknown>) {
    return request<{ settings: Record<string, unknown> }>('/user/trading-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async addExchangeKeys(payload: { exchange: string; apiKey: string; apiSecret: string; isTestnet: boolean }) {
    return request<{ message: string; exchange: Record<string, unknown> }>('/user/exchange-keys', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
