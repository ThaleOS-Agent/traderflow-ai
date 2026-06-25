const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'tradeflow_token';

export interface PortfolioStats {
  totalBalance: number;
  availableBalance: number;
  investedAmount: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface UserSubscription {
  tier: string;
  status?: 'active' | 'expired' | 'cancelled' | 'lifetime';
  startedAt?: string | null;
  expiresAt?: string | null;
  paymentMethod?: string;
  txHash?: string;
  autoRenew?: boolean;
}

export interface AuthUser {
  _id?: string;
  id?: string;
  email?: string;
  walletAddress?: string;
  authMethod?: 'email' | 'wallet';
  chainId?: string | number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  country?: string;
  isVerified?: boolean;
  isActive?: boolean;
  isFounder?: boolean;
  role?: 'user' | 'admin' | 'founder';
  tier?: string;
  features?: string[];
  subscription?: UserSubscription;
  tradingSettings?: TradingSettings;
  portfolio?: PortfolioStats;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface TradeSummary {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'BUY' | 'SELL';
  status: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profit?: number;
  profitLoss?: number;
  strategy: string;
  assetType?: string;
  isPaperTrade?: boolean;
  isAutoTrade?: boolean;
  exchange?: string;
  createdAt?: string;
  openedAt?: string;
}

export interface SignalSummary {
  _id: string;
  symbol: string;
  side: string;
  strategy: string;
  confidenceScore: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  createdAt: string;
}

export interface TradingSettings {
  autoTrading: boolean;
  paperTrading: boolean;
  defaultStrategy: string;
  riskLevel: string;
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  leverage: number;
}

export interface WalletConnectSession {
  id: string;
  uri: string;
  message: string;
  expiresAt: string;
}

export interface WalletSessionStatus {
  status: 'pending' | 'connected' | 'disconnected' | 'expired' | string;
  walletAddress?: string;
  chainId?: number;
}

export interface WalletTierConfig {
  name: string;
  price: number;
  features: string[];
  maxStrategies: number;
  maxPositions: number;
  apiCallsPerDay: number;
}

export interface AuthResponse {
  message?: string;
  token: string;
  user: AuthUser;
}

export interface WalletVerificationResponse {
  success: boolean;
  token?: string;
  linked?: boolean;
  user: AuthUser;
  session: {
    id: string;
    status: string;
    message: string;
    createdAt?: string;
    expiresAt: string;
    disconnectedAt?: string;
    walletAddress?: string;
    userId?: string;
    chainId?: number;
    uri?: string;
  };
}

export interface ExchangeConnection {
  id: string;
  name: string;
  isTestnet: boolean;
  isActive: boolean;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasPassphrase: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DerivSymbol {
  symbol: string;
  displayName: string;
  market: string;
  marketDisplayName: string;
  subgroup: string;
  symbolType: string;
  pip: number;
}

export interface DerivContract {
  contractType: string;
  contractCategory?: string;
  exchangeName?: string;
  market?: string;
  sentiment?: string;
  startType?: string;
  minContractDuration?: string;
  maxContractDuration?: string;
  barrierCategory?: string;
  expiryType?: string;
}

export interface DerivProposal {
  id: string;
  longcode: string;
  spot: number;
  displayValue: number;
  payout: number;
  askPrice: number;
  commission: number;
  dateStart?: number;
  dateExpiry?: number;
  contractType: string;
  currency: string;
}

export interface ExchangeVenue {
  name: string;
  label?: string;
  type?: string;
  credentialHint?: string;
  configured?: boolean;
  connection?: ExchangeConnection | null;
  capabilities?: {
    live: boolean;
    paper: boolean;
    assetClasses: string[];
    transport: {
      marketData: string;
      account: string;
      orders: string;
      platformWebSocket: boolean;
      nativeExchangeWebSocket: boolean;
    };
    credentials: string[];
    supports: string[];
    notes: string;
  } | null;
}

export interface AccountMonitorCard {
  _id?: string;
  exchange: string;
  label: string;
  configured: boolean;
  authenticated: boolean;
  privateStreamStatus: string;
  heartbeatStatus: string;
  lastPong: string | null;
  reconnectCount: number;
  nextSessionRotation: string | null;
  listenKeyRefreshTimer: string | null;
  latestBalanceEvent: Record<string, unknown> | null;
  latestOrderEvent: Record<string, unknown> | null;
  stateReconciliationStatus: string;
  tradingPermissionStatus: string;
  withdrawalPermissionWarning: boolean;
  assistantMessage: string;
  config: {
    exchange: string;
    environment: string;
    authMethod?: string;
    permissions?: {
      trade?: boolean;
      withdraw?: boolean;
    };
  };
}

export interface AccountMonitorResponse {
  flags: {
    enablePaperTrading: boolean;
    enableLiveTrading: boolean;
    demoMode: boolean;
  };
  cards: AccountMonitorCard[];
  warnings: string[];
  recommendations: string[];
  recentAudit?: Record<string, unknown>[];
}

export interface DashboardOverviewResponse {
  portfolio: PortfolioStats;
  tradingSettings: TradingSettings;
  openPositions: TradeSummary[];
  openPositionsCount: number;
  todayTradesCount: number;
  todayPnL: string;
  recentSignals: SignalSummary[];
  marketData: Array<{
    symbol: string;
    price: number;
    change24h: string;
    assetType?: string;
  }>;
  engineStatus: Record<string, unknown>;
}

export interface TradesResponse {
  trades: TradeSummary[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
}

export interface SignalsResponse {
  signals: SignalSummary[];
  pagination?: {
    total: number;
    page: number;
    pages: number;
  };
}

export interface PortfolioResponse {
  portfolio: PortfolioStats;
  openPositions: TradeSummary[];
  recentTrades: TradeSummary[];
}

export interface Mt5AccountSummary {
  login?: string;
  name?: string;
  broker?: string;
  currency?: string;
  balance?: number | null;
  equity?: number | null;
  margin?: number | null;
  freeMargin?: number | null;
  server?: string;
  platform?: string;
  accountNumber?: string;
  configuredAccountId?: string;
  accountId?: string;
  connected?: boolean;
  _mock?: boolean;
}

export interface Mt5Position {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  openTime: string;
  _mock?: boolean;
}

export interface Mt5Order {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  state?: string;
  placedAt?: string;
}

export interface MtConnection {
  id: string;
  platform: 'mt4' | 'mt5';
  provider: 'bridge' | 'metaapi';
  label: string;
  login?: string;
  server?: string;
  accountId?: string;
  apiUrl?: string;
  isDemo: boolean;
  isActive: boolean;
  connectionStatus: 'untested' | 'connected' | 'failed';
  lastConnectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Mt5ConnectionPayload {
  platform: 'mt4' | 'mt5';
  provider: 'bridge' | 'metaapi';
  label: string;
  login?: string;
  server?: string;
  accountId?: string;
  apiUrl?: string;
  apiKey?: string;
  token?: string;
  isDemo: boolean;
  isActive?: boolean;
  testConnection?: boolean;
}

export interface StreamingConnection {
  venue: string;
  exchange?: string;
  isTestnet: boolean;
  transport?: string;
  status: string;
  healthScore?: number;
  healthBand?: string;
  symbols: string[];
  connectedAt: number | null;
  lastMessageAt: number | null;
  lastPingAt?: number | null;
  lastPongAt?: number | null;
  lastError: string | null;
  latencyMs?: number | null;
  reconnectCount?: number;
  reconnectAttempts: number;
  lastDisconnectReason?: string | null;
  lastReconnectTime?: number | null;
  missedPings?: number;
  sequenceGaps?: number;
  messageRate?: number;
  warnings?: string[];
  recommendations?: string[];
  recoveryActions?: string[];
}

export interface StreamingStatus {
  supportedVenues?: string[];
  states?: Record<string, string>;
  queues?: Record<string, { name: string; depth: number; dropped: number }>;
  workers?: Record<string, { processed: number; failed: number; lastProcessedAt: number | null }>;
  connections: StreamingConnection[];
  warnings?: string[];
  recommendations?: string[];
  recoveryActions?: string[];
  recentAudit?: Record<string, unknown>[];
}

export interface ExchangeCapabilitiesResponse {
  success: boolean;
  venues: Array<ExchangeVenue & {
    capabilities?: {
      live: boolean;
      paper: boolean;
      assetClasses: string[];
      transport: {
        marketData: string;
        account: string;
        orders: string;
        platformWebSocket: boolean;
        nativeExchangeWebSocket: boolean;
      };
      credentials: string[];
      supports: string[];
      notes: string;
    } | null;
  }>;
  platformWebSocket: {
    path: string;
    authEvent: string;
    subscribeEvent: string;
    channels: string[];
    notes: string;
  };
}

export interface ExchangeStreamingStatusResponse {
  success: boolean;
  streaming: StreamingStatus;
}

export interface ExchangeRouteCandidate {
  exchange: string;
  status: string;
  healthScore: number;
  latencyMs: number | null;
  reconnectCount: number;
  spread: number | null;
  feeBps: number;
  slippageBps: number | null;
  routeConfidenceScore: number;
}

export interface ExchangeSelectedRoute extends ExchangeRouteCandidate {
  symbol?: string;
  reason?: string;
  notes?: string[];
}

export interface ExchangeRoutePreviewResponse {
  success: boolean;
  route: {
    symbol: string;
    evaluatedAt: string;
    candidates: ExchangeRouteCandidate[];
    selectedRoute: ExchangeSelectedRoute | null;
  };
}

export interface ExchangeBalanceEntry {
  asset?: string;
  free?: number | string;
  locked?: number | string;
  total?: number | string;
  available?: number | string;
  balance?: number | string;
  equity?: number | string;
  margin?: number | string;
  unrealizedPnl?: number | string;
}

export interface ExchangeBalanceResponse {
  success: boolean;
  exchange: string;
  balances: Record<string, ExchangeBalanceEntry | number | string | null>;
}

export interface ExchangeConnectionPayload {
  name: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
  isActive?: boolean;
  testConnection?: boolean;
}

export interface ExchangeTestConnectionPayload {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
}

export interface ExchangeTestAccountSummary {
  accountType?: string;
  canTrade?: boolean;
  balances?: ExchangeBalanceResponse['balances'];
  buyerCommission?: number;
  sellerCommission?: number;
  makerCommission?: number;
  takerCommission?: number;
}

export interface ExchangeTestConnectionResponse {
  success: boolean;
  message: string;
  exchange?: string;
  account?: ExchangeTestAccountSummary;
  accountType?: string;
  canTrade?: boolean;
}

export interface StrategyWeights {
  neuralNetwork: number;
  fibonacci: number;
  volatility: number;
  kelly: number;
  trend: number;
  meanReversion: number;
  breakout: number;
  rlExit: number;
}

export interface TrainingActionPerformance {
  winRate?: number | string;
  profitFactor?: number | string;
  sharpeRatio?: number | string;
  projectedWinRate?: number | string;
  targetWinRate?: number | string;
  status?: string;
  strategy?: string;
  testResults?: Array<{
    symbol: string;
    action: string;
    confidence: number;
    reasoning: string;
  }>;
}

export interface TrainingJobResult {
  jobId?: string;
  status?: string;
  requestedBy?: string | null;
  epochs?: number;
  startedAt?: string;
  completedAt?: string;
  trainingDataProvided?: boolean;
  performance?: TrainingActionPerformance;
  weights?: StrategyWeights;
  error?: string;
}

export interface TrainingApplyResult {
  applied: boolean;
  weights?: StrategyWeights;
  error?: string;
}

export interface TrainingDeployResult {
  deployed: boolean;
  performance: Required<Pick<TrainingActionPerformance, 'projectedWinRate' | 'targetWinRate' | 'status' | 'strategy' | 'testResults'>> & {
    profitFactor: number | string;
  };
}

export interface TrainingSignalMarketData {
  currentPrice?: number;
  price?: number;
  prices?: number[];
  volumes?: number[];
  highs?: number[];
  lows?: number[];
  volatility?: number;
  momentum?: number;
}

export interface TrainingSignalRequest {
  symbol: string;
  assetType?: 'crypto' | 'forex' | 'commodity' | 'stock';
  persist?: boolean;
  marketData?: TrainingSignalMarketData;
}

export interface TrainingSignalResponse extends SignalSummary {
  assetType?: string;
  confidence?: string;
  timeframe?: string;
  analysis?: string;
  metadata?: {
    rawSignal?: {
      action?: string;
      confidence?: number;
      reasoning?: string;
    };
    generatedBy?: string;
    modelVersion?: string;
  };
}

export interface TrainingActionResponse<T> {
  success: boolean;
  result: T;
}

type AiLearningResponse = {
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
};

type Mt5StatusResponse = {
  success: boolean;
  mode: 'bridge' | 'metaapi' | 'mock';
  account: Mt5AccountSummary;
};

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

function normalizeAiLearning(raw: {
  success: boolean;
  performance: {
    predictions?: number;
    correctPredictions?: number;
    accuracy?: string | number;
    lastTraining?: string | null;
    models?: Array<Record<string, unknown>>;
  };
  learning: {
    mode?: string;
    recentSignals?: number;
    avgSignalConfidence?: number;
    lastTraining?: string | null;
    trackedAssetTypes?: string[];
  };
  models?: Array<Record<string, unknown>>;
}): AiLearningResponse {
  const sourceModels = Array.isArray(raw.models) && raw.models.length
    ? raw.models
    : Array.isArray(raw.performance?.models)
      ? raw.performance.models
      : [];

  const normalizedModels = sourceModels.map((model, index) => {
    const name = String(model.name || model.assetType || `model_${index + 1}`);
    const lowerName = name.toLowerCase();
    const type = String(model.type || '');

    return {
      assetType: name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(),
      priceDirection: lowerName.includes('price') ? 0.75 : type.includes('classifier') ? 0.72 : 0.7,
      opportunityScore: lowerName.includes('opportunity') ? 0.73 : type.includes('ensemble') ? 0.72 : 0.68,
      volatilityForecast: lowerName.includes('volatility') ? 0.7 : type.includes('forecast') ? 0.69 : 0.65,
    };
  });

  return {
    success: Boolean(raw.success),
    performance: {
      predictions: Number(raw.performance?.predictions || 0),
      correctPredictions: Number(raw.performance?.correctPredictions || 0),
      accuracy: raw.performance?.accuracy ?? 0,
      lastTraining: raw.performance?.lastTraining ?? raw.learning?.lastTraining ?? null,
    },
    learning: {
      mode: raw.learning?.mode || 'online-simulated',
      recentSignals: Number(raw.learning?.recentSignals || 0),
      avgSignalConfidence: Number(raw.learning?.avgSignalConfidence || 0),
      lastTraining: raw.learning?.lastTraining ?? raw.performance?.lastTraining ?? null,
      trackedAssetTypes: Array.isArray(raw.learning?.trackedAssetTypes) ? raw.learning.trackedAssetTypes : [],
    },
    models: normalizedModels,
  };
}

function normalizeMt5Status(raw: {
  success: boolean;
  mode: 'bridge' | 'metaapi' | 'mock';
  account: Mt5AccountSummary;
}): Mt5StatusResponse {
  const account = (raw.account || {}) as Mt5AccountSummary & Record<string, unknown>;
  const accountNumber = String(
    account.accountNumber ??
    account.login ??
    account.accountId ??
    account.configuredAccountId ??
    ''
  );

  return {
    success: Boolean(raw.success),
    mode: raw.mode,
    account: {
      ...account,
      accountNumber,
      connected: Boolean(account.connected ?? (raw.mode !== 'mock')),
    },
  };
}

export const api = {
  async getHealth() {
    return request<{
      status: string;
      timestamp: string;
      tradingEngine: string;
      patternScanner: string;
      assetScanner: string;
      autoExecution: string;
      agentOrchestrator: string;
      nativeExchangeStreams?: {
        supportedVenues: string[];
        connections: Array<{
          venue: string;
          isTestnet: boolean;
          status: string;
          symbols: string[];
          connectedAt: number | null;
          lastMessageAt: number | null;
          lastError: string | null;
          reconnectAttempts: number;
        }>;
      };
      arbitrageDetector: string;
      mlPredictor: string;
      notificationService: string;
      advancedRiskManager: string;
      accountGatewayFlags?: {
        enablePaperTrading: boolean;
        enableLiveTrading: boolean;
        demoMode: boolean;
      };
      activePatterns: unknown[] | number;
      trackedAssets: number;
      activeOpportunities: number;
      arbitrageOpportunities: number;
      notificationSubscriptions: number;
    }>('/health');
  },

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
    const data = await request<AuthResponse>('/auth/login', {
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
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async getMe() {
    return request<{ user: AuthUser }>('/auth/me');
  },

  async getDashboard() {
    return request<DashboardOverviewResponse>('/dashboard/overview');
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

  async getAgentStatus() {
    return request<{
      success: boolean;
      status: {
        initialized: boolean;
        canonicalExecutor: string;
        sharedRiskManager: string;
        agents: Array<{
          id: string;
          label: string;
          role: string;
          service: string;
          domain: string;
          stage: string;
          description: string;
          capabilities: string[];
          status: string;
          lastSeenAt: string;
        }>;
        stats: Record<string, number | string | null>;
        contextCounts: Record<string, number>;
      };
    }>('/agents/status');
  },

  async getAgentEvents(limit = 12) {
    return request<{
      success: boolean;
      events: Array<{
        id: string;
        source: string;
        type: string;
        status: string;
        payload: Record<string, unknown>;
        timestamp: string;
      }>;
    }>(`/agents/events?limit=${encodeURIComponent(String(limit))}`);
  },

  async getAiLearning() {
    return request<{
      success: boolean;
      performance: {
        predictions?: number;
        correctPredictions?: number;
        accuracy?: string | number;
        lastTraining?: string | null;
        models?: Array<Record<string, unknown>>;
      };
      learning: {
        mode?: string;
        recentSignals?: number;
        avgSignalConfidence?: number;
        lastTraining?: string | null;
        trackedAssetTypes?: string[];
      };
      models?: Array<Record<string, unknown>>;
    }>('/dashboard/ai-learning').then(normalizeAiLearning);
  },

  async getTrades(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page)  query.set('page',  String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return request<TradesResponse>(`/trades?${query}`);
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
    exchange?: string;
  }) {
    return request<{ message: string; trade: TradeSummary }>('/trades', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async closeTrade(id: string) {
    return request<{ message: string; trade: TradeSummary }>(`/trades/${id}/close`, {
      method: 'POST',
    });
  },

  async getSignals() {
    return request<SignalsResponse>('/signals');
  },

  async getStrategies() {
    return request<Record<string, unknown>>('/strategies');
  },

  async getAvailableStrategies() {
    return request<{
      strategies: Array<{
        code: string;
        name: string;
        description: string;
        type: string;
        supportedAssets: string[];
      }>;
    }>('/strategies/available');
  },

  async getPortfolio() {
    return request<PortfolioResponse>('/user/portfolio');
  },

  async getTradingSettings() {
    return request<{
      settings: TradingSettings;
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
    return request<{
      success: boolean;
      tiers: Record<string, WalletTierConfig>;
    }>('/wallet/tiers');
  },

  async createWalletSession() {
    return request<{
      success: boolean;
      session: WalletConnectSession;
    }>('/wallet/connect', { method: 'POST' });
  },

  async getWalletSession(sessionId: string) {
    return request<{
      success: boolean;
      status: WalletSessionStatus;
    }>(`/wallet/session/${encodeURIComponent(sessionId)}`);
  },

  async verifyWallet(payload: {
    sessionId: string;
    address: string;
    chainId: number;
    signature: string;
    message: string;
  }) {
    return request<WalletVerificationResponse>('/wallet/verify', {
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
    return request<WalletVerificationResponse>('/wallet/link', {
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
      account: Mt5AccountSummary;
    }>('/mt5/status').then(normalizeMt5Status);
  },

  async getMt5Positions() {
    return request<{ success: boolean; positions: Mt5Position[] }>('/mt5/positions');
  },

  async getMt5Orders() {
    return request<{ success: boolean; orders: Mt5Order[] }>('/mt5/orders');
  },

  async getMt5Connections() {
    return request<{ success: boolean; connections: MtConnection[] }>('/mt5/connections');
  },

  async saveMt5Connection(payload: Mt5ConnectionPayload) {
    return request<{ success: boolean; connection: MtConnection }>('/mt5/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async testMt5Connection(id: string) {
    return request<{ success: boolean; connection: MtConnection; account: Mt5AccountSummary }>(`/mt5/connections/${id}/test`, {
      method: 'POST',
    });
  },

  async activateMt5Connection(id: string) {
    return request<{ success: boolean; connection: MtConnection }>(`/mt5/connections/${id}/activate`, {
      method: 'POST',
    });
  },

  async deleteMt5Connection(id: string) {
    return request<{ success: boolean; message: string }>(`/mt5/connections/${id}`, {
      method: 'DELETE',
    });
  },

  async getExchangeConnections() {
    return request<{
      success: boolean;
      supported?: ExchangeVenue[];
      connections: ExchangeConnection[];
    }>('/exchange/connections');
  },

  async getExchangeCapabilities() {
    return request<ExchangeCapabilitiesResponse>('/exchange/capabilities');
  },

  async getExchangeStreamingStatus() {
    return request<ExchangeStreamingStatusResponse>('/exchange/streaming/status');
  },

  async getExchangeRoutePreview(symbol: string, quantity = 0) {
    return request<ExchangeRoutePreviewResponse>('/exchange/streaming/route-preview', {
      method: 'POST',
      body: JSON.stringify({ symbol, quantity }),
    });
  },

  async getAccountConnectionsMonitor() {
    return request<{
      success: boolean;
      monitor: AccountMonitorResponse;
    }>('/account-connections/monitor');
  },

  async getAccountConnectionDefaults(exchange: string) {
    return request<{
      success: boolean;
      config: Record<string, unknown>;
    }>(`/account-connections/defaults/${encodeURIComponent(exchange)}`);
  },

  async saveAccountConnection(payload: Record<string, unknown>) {
    return request<{
      success: boolean;
      connection: AccountMonitorCard;
    }>('/account-connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async toggleAccountConnectionLive(id: string, enabled: boolean) {
    return request<{
      success: boolean;
      connection: AccountMonitorCard;
    }>(`/account-connections/${encodeURIComponent(id)}/toggle-live`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  async getExchangeConnection(id: string) {
    return request<{
      success: boolean;
      connection: ExchangeConnection;
      venue: ExchangeVenue;
    }>(`/exchange/connections/${id}`);
  },

  async saveExchangeConnection(payload: ExchangeConnectionPayload) {
    return request<{ success: boolean; connection: ExchangeConnection }>('/exchange/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async testExchangeConnection(payload: ExchangeTestConnectionPayload) {
    return request<ExchangeTestConnectionResponse>('/exchange/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async activateExchangeConnection(id: string) {
    return request<{ success: boolean; connection: ExchangeConnection }>(`/exchange/connections/${id}/activate`, {
      method: 'POST',
    });
  },

  async deactivateExchangeConnection(id: string) {
    return request<{ success: boolean; connection: ExchangeConnection }>(`/exchange/connections/${id}/deactivate`, {
      method: 'POST',
    });
  },

  async deleteExchangeConnection(id: string) {
    return request<{ success: boolean; message: string }>(`/exchange/connections/${id}`, {
      method: 'DELETE',
    });
  },

  async getExchangeBalance(exchange?: string) {
    const query = exchange ? `?exchange=${encodeURIComponent(exchange)}` : '';
    return request<ExchangeBalanceResponse>(`/exchange/balance${query}`);
  },

  async getDerivSymbols(market?: string) {
    const query = market ? `?market=${encodeURIComponent(market)}` : '';
    return request<{ success: boolean; symbols: DerivSymbol[] }>(`/deriv/symbols${query}`);
  },

  async getDerivContracts(symbol: string) {
    return request<{ success: boolean; contracts: DerivContract[] }>(`/deriv/contracts/${encodeURIComponent(symbol)}`);
  },

  async getDerivProposal(payload: {
    symbol: string;
    contractType: string;
    amount: number;
    basis?: 'stake' | 'payout';
    duration: number;
    durationUnit: string;
    currency?: string;
  }) {
    return request<{ success: boolean; proposal: DerivProposal }>('/deriv/proposal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getDerivBalance() {
    return request<{
      success: boolean;
      account: {
        loginId?: string;
        balance: number;
        currency: string;
        isVirtual?: boolean;
        email?: string;
      };
    }>('/deriv/balance');
  },

  async buyDerivContract(payload: {
    proposalId: string;
    price: number;
    symbol?: string;
    contractType?: string;
  }) {
    return request<{
      success: boolean;
      buy: {
        contract_id?: string | number;
        transaction_id?: string | number;
        shortcode?: string;
      };
    }>('/deriv/buy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getKlines(symbol: string, interval = '1h', exchange?: string) {
    const q = new URLSearchParams({ interval, limit: '200' });
    if (exchange) q.set('exchange', exchange);
    return request<{ klines: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> }>(
      `/exchange/klines/${symbol}?${q}`
    );
  },

  async updateTradingSettings(settings: TradingSettings) {
    return request<{ settings: TradingSettings }>('/user/trading-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async addExchangeKeys(payload: { exchange: string; apiKey: string; apiSecret: string; isTestnet: boolean }) {
    return request<{ message: string; exchange: ExchangeConnection }>('/user/exchange-keys', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async startTraining() {
    return request<TrainingActionResponse<TrainingJobResult>>('/training/start', {
      method: 'POST',
    });
  },

  async applyTraining() {
    return request<TrainingActionResponse<TrainingApplyResult>>('/training/apply', {
      method: 'POST',
    });
  },

  async deployMasterStrategy() {
    return request<TrainingActionResponse<TrainingDeployResult>>('/training/deploy-master', {
      method: 'POST',
    });
  },

  async generateTrainingSignal(payload: TrainingSignalRequest) {
    return request<{ success: boolean; signal: TrainingSignalResponse }>('/training/generate-signal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
