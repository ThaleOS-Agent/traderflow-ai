import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const TOKEN_KEY = 'tradeflow_token';

const client: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  portfolio: {
    totalBalance: number;
    availableBalance: number;
    investedAmount: number;
    totalProfit: number;
    totalLoss: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
  };
  tradingSettings: {
    autoTrading: boolean;
    paperTrading: boolean;
    defaultStrategy: string;
    riskLevel: string;
  };
}

export interface Trade {
  _id: string;
  symbol: string;
  assetType: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'pending' | 'open' | 'closed' | 'cancelled';
  profit?: number;
  openedAt: string;
  closedAt?: string;
  isPaperTrade: boolean;
  strategy: string;
}

export interface MarketDataItem {
  symbol: string;
  price: number;
  volume: number;
  high24h: number;
  low24h: number;
  change24h: number;
  assetType: string;
  lastUpdated: string;
}

export interface DashboardOverview {
  portfolio: User['portfolio'];
  tradingSettings: User['tradingSettings'];
  openPositions: Trade[];
  openPositionsCount: number;
  todayTradesCount: number;
  todayPnL: number;
  recentSignals: unknown[];
  marketData: MarketDataItem[];
  engineStatus: { running: boolean; uptime: number };
}

export const api = {
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await client.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    api.setToken(res.data.token);
    return res.data;
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
  }): Promise<{ token: string; user: User }> {
    const res = await client.post<{ token: string; user: User }>('/api/auth/register', data);
    api.setToken(res.data.token);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await client.get<{ user: User }>('/api/auth/me');
    return res.data.user;
  },

  async getDashboardOverview(): Promise<DashboardOverview> {
    const res = await client.get<DashboardOverview>('/api/dashboard/overview');
    return res.data;
  },

  async getMarketData(): Promise<MarketDataItem[]> {
    const res = await client.get<{ marketData: MarketDataItem[] }>('/api/dashboard/market-data');
    return res.data.marketData;
  },

  async getPerformanceChart(timeframe = '30d'): Promise<unknown[]> {
    const res = await client.get<{ chartData: unknown[] }>('/api/dashboard/performance-chart', {
      params: { timeframe },
    });
    return res.data.chartData;
  },

  async getTrades(params?: { status?: string; limit?: number; page?: number }): Promise<{
    trades: Trade[];
    pagination: { total: number; page: number; pages: number };
  }> {
    const res = await client.get('/api/trades', { params });
    return res.data;
  },

  async closeTrade(id: string): Promise<Trade> {
    const res = await client.post<{ trade: Trade }>(`/api/trades/${id}/close`);
    return res.data.trade;
  },

  async getTradeStats(timeframe = '30d'): Promise<unknown> {
    const res = await client.get('/api/trades/stats/overview', { params: { timeframe } });
    return res.data.stats;
  },

  async getBotStatus(): Promise<unknown> {
    const res = await client.get('/api/dashboard/bot-status');
    return res.data;
  },
};
