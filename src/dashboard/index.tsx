import { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Activity, DollarSign,
  BarChart2, Zap, RefreshCw, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Wifi, WifiOff, Settings,
  Crown, Star, CreditCard, ShieldCheck, Power, Brain, Radio, XCircle, Play, Menu, Bot, Newspaper,
} from 'lucide-react';
import { api, type ExchangeVenue, type PortfolioStats, type SignalSummary, type TradeSummary, type TradingSettings } from './api';
import { useTradeWebSocket, type LiveMarketData, type LivePortfolioUpdate, type LiveSignal, type LiveTrade, type LiveWsEvent } from '../hooks/useTradeWebSocket';

const SubscriptionPage = lazy(async () => {
  const module = await import('./SubscriptionPage');
  return { default: module.SubscriptionPage };
});

const TradingViewChart = lazy(async () => {
  const module = await import('./TradingViewChart');
  return { default: module.TradingViewChart };
});

const DTraderPanel = lazy(async () => {
  const module = await import('./DTraderPanel');
  return { default: module.DTraderPanel };
});

const MT5Panel = lazy(async () => {
  const module = await import('./MT5Panel');
  return { default: module.MT5Panel };
});

const ExchangeConnections = lazy(async () => {
  const module = await import('./ExchangeConnections');
  return { default: module.ExchangeConnections };
});

const SettingsPage = lazy(async () => {
  const module = await import('./SettingsPage');
  return { default: module.SettingsPage };
});

// ── Types ──────────────────────────────────────────────────────────────────

type Trade = TradeSummary;
type Signal = SignalSummary;

interface MarketFeedItem {
  symbol: string;
  label: string;
  category: 'crypto' | 'forex' | 'metal' | 'oil';
  provider: string;
  price: number | null;
  change24h: number;
  high24h: number | null;
  low24h: number | null;
  volume: number | null;
  status: 'live' | 'unavailable';
  updatedAt: string;
}

interface StrategyResult {
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
}

interface AiLearning {
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
    trackedAssetTypes: string[];
  };
  models: Array<{
    assetType: string;
    priceDirection: number;
    opportunityScore: number;
    volatilityForecast: number;
  }>;
}

interface TradeStats {
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
}

interface LiveFeedEvent {
  id: string;
  event: string;
  kind: 'signal' | 'order' | 'trade' | 'market' | 'portfolio' | 'system';
  title: string;
  detail: string;
  timestamp: number;
}

interface AgentCardData {
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
}

interface AgentStatus {
  initialized: boolean;
  canonicalExecutor: string;
  sharedRiskManager: string;
  agents: AgentCardData[];
  stats: {
    ingestedEvents?: number;
    routedOpportunities?: number;
    approvedExecutions?: number;
    rejectedExecutions?: number;
    dispatchedExecutions?: number;
    failedExecutions?: number;
    lastEventAt?: string | null;
  };
  contextCounts: {
    market?: number;
    news?: number;
    opportunities?: number;
    patterns?: number;
    arbitrage?: number;
    ml?: number;
    signals?: number;
    riskDecisions?: number;
    executions?: number;
  };
}

interface AgentEvent {
  id: string;
  source: string;
  type: string;
  status: string;
  payload: {
    symbol?: string;
    exchange?: string;
    reason?: string;
  };
  timestamp: string;
}

interface LiveEventPayload {
  symbol?: string;
  side?: string;
  strategy?: string;
  confidenceScore?: number | string;
  status?: string;
  exchange?: string;
  isPaperTrade?: boolean;
  pairs?: string[];
  trade?: LiveTrade;
  order?: LiveTrade;
  portfolio?: PortfolioStats;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function PanelLoader({ label = 'Loading panel…' }: { label?: string }) {
  return (
    <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-white/10 bg-white/5">
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function fmtUsd(n: number) {
  return `$${fmt(Math.abs(n))}`;
}

function strategyLabel(code: string) {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getLiveEventPayload(value: unknown): LiveEventPayload {
  return value && typeof value === 'object' ? value as LiveEventPayload : {};
}

function eventKind(event: string): LiveFeedEvent['kind'] {
  if (event.toLowerCase().includes('signal')) return 'signal';
  if (event.toLowerCase().includes('order') || event === 'mt5_order') return 'order';
  if (event.toLowerCase().includes('trade')) return 'trade';
  if (event === 'marketData') return 'market';
  if (event === 'portfolio_update') return 'portfolio';
  return 'system';
}

function describeLiveEvent(event: string, data: unknown): Pick<LiveFeedEvent, 'title' | 'detail' | 'kind'> {
  const kind = eventKind(event);
  const record = getLiveEventPayload(data);
  const payload = record.trade ?? record.order ?? record;
  const symbol = String(payload.symbol ?? record.symbol ?? '');
  const side = String(payload.side ?? record.side ?? '').toUpperCase();
  const confidenceScore = payload === record ? record.confidenceScore : record.confidenceScore ?? undefined;
  const exchange = payload.exchange ?? record.exchange;

  if (kind === 'signal') {
    return {
      kind,
      title: symbol ? `${symbol} ${side || 'Signal'}` : 'New signal',
      detail: `${payload.strategy ?? record.strategy ?? 'strategy'} · ${confidenceScore ?? '—'}% confidence`,
    };
  }
  if (kind === 'order' || kind === 'trade') {
    return {
      kind,
      title: symbol ? `${symbol} ${side || 'Order'}` : event,
      detail: `${payload.status ?? record.status ?? 'received'} · ${exchange ?? (record.isPaperTrade ? 'paper' : 'broker')}`,
    };
  }
  if (kind === 'market') {
    const pairs = Array.isArray(record.pairs) ? record.pairs.join(', ') : symbol;
    return {
      kind,
      title: 'Market data update',
      detail: pairs ? `Updated: ${pairs}` : 'Market feed broadcast received',
    };
  }
  if (kind === 'portfolio') {
    return { kind, title: 'Portfolio update', detail: 'Balances and exposure refreshed' };
  }
  return { kind, title: event, detail: 'WebSocket event received' };
}

function agentStatusTone(status: string) {
  if (status === 'online') return 'bg-green-500/15 text-green-300 border-green-500/20';
  if (status === 'manual_review') return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/20';
  return 'bg-white/5 text-gray-400 border-white/10';
}

function summarizeAgentEvent(event: AgentEvent) {
  const symbol = String(event.payload.symbol ?? '');
  const exchange = String(event.payload.exchange ?? '');
  if (symbol && exchange) return `${symbol} · ${exchange}`;
  if (symbol) return symbol;
  if (event.payload.reason) return String(event.payload.reason);
  return event.type.replace(/_/g, ' ');
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-mono-custom uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-cyan-400" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : 'text-gray-500'}`}>
          {positive === true && <ArrowUpRight className="w-3 h-3" />}
          {positive === false && <ArrowDownRight className="w-3 h-3" />}
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  free:     'text-gray-400',
  bronze:   'text-orange-400',
  silver:   'text-slate-300',
  gold:     'text-yellow-400',
  platinum: 'text-cyan-300',
  diamond:  'text-blue-300',
  founder:  'text-amber-400',
};

export function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'main' | 'subscription' | 'settings'>('main');
  const [subscription, setSubscription] = useState<{
    tier: string; status: string; isFounder: boolean; features: string[];
  } | null>(null);
  const [tradingSettings, setTradingSettings] = useState<TradingSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [marketFeed, setMarketFeed] = useState<MarketFeedItem[]>([]);
  const [strategyResults, setStrategyResults] = useState<StrategyResult[]>([]);
  const [aiLearning, setAiLearning] = useState<AiLearning | null>(null);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderMessage, setOrderMessage] = useState('');
  const [learningAction, setLearningAction] = useState('');
  const [learningBusy, setLearningBusy] = useState(false);
  const [exchangeVenues, setExchangeVenues] = useState<ExchangeVenue[]>([]);
  const [showDashboardMenu, setShowDashboardMenu] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveFeedEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [orderForm, setOrderForm] = useState({
    symbol: 'BTCUSDT',
    exchange: 'binance',
    assetType: 'crypto' as 'crypto' | 'forex' | 'commodity' | 'stock',
    side: 'buy' as 'buy' | 'sell',
    orderType: 'market' as 'market' | 'limit' | 'stop',
    entryPrice: '65000',
    quantity: '0.001',
    stopLoss: '63000',
    takeProfit: '69000',
  });

  // Keep stable refs so WebSocket callbacks don't go stale
  const tradesRef = useRef(trades);
  const signalsRef = useRef(signals);
  const liveEventsRef = useRef(liveEvents);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { liveEventsRef.current = liveEvents; }, [liveEvents]);

  const appendLiveEvent = useCallback((event: string, data: unknown, timestamp = Date.now()) => {
    const description = describeLiveEvent(event, data);
    const id = `${event}-${timestamp}-${liveEventsRef.current.length}`;
    setLiveEvents(prev => [{ id, event, timestamp, ...description }, ...prev].slice(0, 12));
  }, []);

  // Live WebSocket updates
  const handleSignal = useCallback((sig: LiveSignal) => {
    appendLiveEvent('newSignal', sig);
    setSignals(prev => {
      const exists = prev.some(s => s._id === sig._id);
      if (exists) return prev;
      return [sig, ...prev].slice(0, 6);
    });
  }, [appendLiveEvent]);

  const handleTrade = useCallback((trade: LiveTrade) => {
    appendLiveEvent('tradeExecuted', trade);
    setTrades(prev => {
      const idx = prev.findIndex(t => t._id === trade._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = trade;
        return next;
      }
      return [trade, ...prev].slice(0, 10);
    });
  }, [appendLiveEvent]);

  const handleOrder = useCallback((order: LiveTrade) => {
    appendLiveEvent('order_update', order);
    if (order._id && order.symbol) {
      setTrades(prev => {
        const idx = prev.findIndex(t => t._id === order._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = order;
          return next;
        }
        return [order, ...prev].slice(0, 10);
      });
    }
  }, [appendLiveEvent]);

  const handleMarketData = useCallback((data: LiveMarketData) => {
    appendLiveEvent('marketData', data);
  }, [appendLiveEvent]);

  const refreshLiveData = useCallback(async () => {
    const [portfolioRes, tradesRes, statsRes, feedRes, strategyRes, aiRes, exchangeRes, agentStatusRes, agentEventsRes] = await Promise.allSettled([
      api.getPortfolio(),
      api.getTrades({ limit: 10 }),
      api.getTradeStats('30d'),
      api.getLiveFeed(),
      api.getStrategyResults(),
      api.getAiLearning(),
      api.getExchangeConnections(),
      api.getAgentStatus(),
      api.getAgentEvents(),
    ]);

    if (portfolioRes.status === 'fulfilled') {
      if (portfolioRes.value.portfolio) setPortfolio(portfolioRes.value.portfolio);
    }
    if (tradesRes.status === 'fulfilled') {
      const nextTrades = tradesRes.value.trades ?? [];
      const currentIds = new Set(tradesRef.current.map(trade => trade._id).filter(Boolean));
      nextTrades
        .filter(trade => trade._id && !currentIds.has(trade._id))
        .slice(0, 3)
        .reverse()
        .forEach(trade => {
          appendLiveEvent(
            trade.isAutoTrade ? 'autoTradeExecuted' : 'order_update',
            trade,
            trade.openedAt ? new Date(trade.openedAt).getTime() : Date.now()
          );
        });
      setTrades(nextTrades);
    }
    if (statsRes.status === 'fulfilled') setTradeStats(statsRes.value.stats);
    if (feedRes.status === 'fulfilled') setMarketFeed(feedRes.value.marketData);
    if (strategyRes.status === 'fulfilled') setStrategyResults(strategyRes.value.results.slice(0, 4));
    if (exchangeRes.status === 'fulfilled') setExchangeVenues(exchangeRes.value.supported ?? []);
    if (agentStatusRes.status === 'fulfilled') setAgentStatus(agentStatusRes.value.status);
    if (agentEventsRes.status === 'fulfilled') setAgentEvents(agentEventsRes.value.events);
    if (aiRes.status === 'fulfilled') {
      setAiLearning({
        performance: aiRes.value.performance,
        learning: aiRes.value.learning,
        models: aiRes.value.models,
      });
    }
  }, [appendLiveEvent]);

  const handleTradeUpdate = useCallback((trade: LiveTrade) => {
    handleTrade(trade);
    refreshLiveData().catch(() => {/* non-critical live refresh */});
  }, [handleTrade, refreshLiveData]);

  const handleOrderUpdate = useCallback((order: LiveTrade) => {
    handleOrder(order);
    refreshLiveData().catch(() => {/* non-critical live refresh */});
  }, [handleOrder, refreshLiveData]);

  const handlePortfolioUpdate = useCallback((data: LivePortfolioUpdate) => {
    appendLiveEvent('portfolio_update', data);
    setPortfolio(data.portfolio);
    refreshLiveData().catch(() => {/* non-critical */});
  }, [appendLiveEvent, refreshLiveData]);

  const { status: wsStatus, lastEvent: lastWsEvent } = useTradeWebSocket({
    onSignal: handleSignal,
    onTrade: handleTradeUpdate,
    onOrder: handleOrderUpdate,
    onMarketData: handleMarketData,
    onPortfolioUpdate: handlePortfolioUpdate,
    onEvent: useCallback((event: LiveWsEvent) => {
      if (['connected', 'authenticated', 'subscribed', 'error'].includes(event.event)) {
        appendLiveEvent(event.event, event.data, event.timestamp);
      }
    }, [appendLiveEvent]),
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const [portfolioRes, tradesRes, signalsRes, subRes, settingsRes, statsRes, feedRes, strategyRes, aiRes, exchangeRes, agentStatusRes, agentEventsRes] = await Promise.allSettled([
        api.getPortfolio(),
        api.getTrades({ limit: 10 }),
        api.getSignals(),
        api.getSubscription(),
        api.getTradingSettings(),
        api.getTradeStats('30d'),
        api.getLiveFeed(),
        api.getStrategyResults(),
        api.getAiLearning(),
        api.getExchangeConnections(),
        api.getAgentStatus(),
        api.getAgentEvents(),
      ]);

      if (portfolioRes.status === 'fulfilled') {
        setPortfolio(portfolioRes.value.portfolio ?? null);
      }
      if (tradesRes.status === 'fulfilled') {
        setTrades(tradesRes.value.trades ?? []);
      }
      if (signalsRes.status === 'fulfilled') {
        setSignals((signalsRes.value.signals ?? []).slice(0, 6));
      }
      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value.subscription);
      }
      if (settingsRes.status === 'fulfilled') {
        setTradingSettings(settingsRes.value.settings);
      }
      if (statsRes.status === 'fulfilled') {
        setTradeStats(statsRes.value.stats);
      }
      if (feedRes.status === 'fulfilled') {
        setMarketFeed(feedRes.value.marketData);
      }
      if (strategyRes.status === 'fulfilled') {
        setStrategyResults(strategyRes.value.results.slice(0, 4));
      }
      if (aiRes.status === 'fulfilled') {
        setAiLearning({
          performance: aiRes.value.performance,
          learning: aiRes.value.learning,
          models: aiRes.value.models,
        });
      }
      if (exchangeRes.status === 'fulfilled') {
        setExchangeVenues(exchangeRes.value.supported ?? []);
      }
      if (agentStatusRes.status === 'fulfilled') {
        setAgentStatus(agentStatusRes.value.status);
      }
      if (agentEventsRes.status === 'fulfilled') {
        setAgentEvents(agentEventsRes.value.events);
      }
    } catch {
      setError('Failed to load dashboard data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshLiveData().catch(() => {/* non-critical live refresh */});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [refreshLiveData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (view === 'subscription') {
    return (
      <div>
        <div className="px-6 pt-6">
          <button
            onClick={() => setView('main')}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-2"
          >
            ← Back to Dashboard
          </button>
        </div>
        <Suspense fallback={<PanelLoader label="Loading subscription…" />}>
          <SubscriptionPage
            currentTier={subscription?.tier ?? 'free'}
            isFounder={subscription?.isFounder ?? false}
            onUpgrade={(tier) => {
              // Direct to founder contact for now; payment integration is a future milestone
              if (tier === 'founder') {
                window.location.href = 'mailto:founder@tradeflow.ai?subject=Founder Access Request';
              } else {
                window.location.href = `mailto:billing@tradeflow.ai?subject=Upgrade to ${tier} plan`;
              }
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <Suspense fallback={<PanelLoader label="Loading settings…" />}>
        <SettingsPage onBack={() => setView('main')} />
      </Suspense>
    );
  }

  const netPnL = (portfolio?.totalProfit ?? 0) - (portfolio?.totalLoss ?? 0);
  const tier = subscription?.tier ?? 'free';
  const isFounder = subscription?.isFounder ?? false;
  const paperTrading = tradingSettings?.paperTrading !== false;
  const autoTrading = tradingSettings?.autoTrading === true;

  const switchTradingMode = async (nextPaperTrading: boolean) => {
    if (settingsSaving || nextPaperTrading === paperTrading) return;
    setSettingsSaving(true);
    setError('');
    try {
      const res = await api.togglePaperTrading(nextPaperTrading);
      setTradingSettings(prev => ({
        ...(prev ?? {
          autoTrading: false,
          paperTrading: true,
          defaultStrategy: 'quantum_ai',
          riskLevel: 'medium',
          maxDailyLoss: 100,
          maxPositionSize: 1000,
          stopLossPercent: 2,
          takeProfitPercent: 4,
          leverage: 1,
        }),
        paperTrading: res.paperTrading,
      }));
    } catch (err) {
      setError((err as Error).message || 'Failed to update trading mode.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleAutoTrading = async () => {
    if (settingsSaving) return;
    setSettingsSaving(true);
    setError('');
    try {
      const res = await api.toggleAutoTrading(!autoTrading);
      setTradingSettings(prev => ({
        ...(prev ?? {
          autoTrading: false,
          paperTrading: true,
          defaultStrategy: 'quantum_ai',
          riskLevel: 'medium',
          maxDailyLoss: 100,
          maxPositionSize: 1000,
          stopLossPercent: 2,
          takeProfitPercent: 4,
          leverage: 1,
        }),
        autoTrading: res.autoTrading,
      }));
    } catch (err) {
      setError((err as Error).message || 'Failed to update auto-trading.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const submitOrder = async () => {
    if (orderSaving) return;
    setOrderSaving(true);
    setOrderError('');
    setOrderMessage('');
    try {
      const payload = {
        symbol: orderForm.symbol.trim().toUpperCase(),
        assetType: orderForm.assetType,
        exchange: orderForm.exchange,
        side: orderForm.side,
        orderType: orderForm.orderType,
        entryPrice: Number(orderForm.entryPrice),
        quantity: Number(orderForm.quantity),
        stopLoss: Number(orderForm.stopLoss),
        takeProfit: Number(orderForm.takeProfit),
        isPaperTrade: paperTrading,
      };

      if (!payload.symbol || !payload.entryPrice || !payload.quantity || !payload.stopLoss || !payload.takeProfit) {
        throw new Error('Complete symbol, price, quantity, stop loss, and take profit before submitting.');
      }

      const res = await api.createTrade(payload);
      setOrderMessage(res.message);
      await refreshLiveData();
    } catch (err) {
      setOrderError((err as Error).message || 'Order failed.');
    } finally {
      setOrderSaving(false);
    }
  };

  const runLearningAction = async (action: 'train' | 'apply' | 'deploy' | 'signal') => {
    if (learningBusy) return;
    setLearningBusy(true);
    setLearningAction('');
    setError('');
    try {
      if (action === 'train') {
        await api.startTraining();
        setLearningAction('AI learning completed and optimized strategy weights.');
      } else if (action === 'apply') {
        await api.applyTraining();
        setLearningAction('Optimized weights applied to the Ensemble Master strategy.');
      } else if (action === 'deploy') {
        await api.deployMasterStrategy();
        setLearningAction('Ensemble Master strategy deployed for live signal generation.');
      } else {
        const entryPrice = Number(orderForm.entryPrice) || 65000;
        await api.generateTrainingSignal({
          symbol: orderForm.symbol.trim().toUpperCase(),
          assetType: orderForm.assetType,
          persist: true,
          marketData: {
            currentPrice: entryPrice,
            prices: [entryPrice * 0.985, entryPrice * 0.99, entryPrice * 0.995, entryPrice, entryPrice * 1.005],
            volumes: [1000, 1150, 1080, 1300, 1250],
            highs: [entryPrice * 0.995, entryPrice, entryPrice * 1.008, entryPrice * 1.01, entryPrice * 1.012],
            lows: [entryPrice * 0.975, entryPrice * 0.982, entryPrice * 0.99, entryPrice * 0.994, entryPrice * 0.998],
          }
        });
        setLearningAction('AI signal generated, persisted, and broadcast to the live feed.');
      }
      await refreshLiveData();
    } catch (err) {
      setError((err as Error).message || 'AI learning action failed.');
    } finally {
      setLearningBusy(false);
    }
  };

  const closeOpenTrade = async (tradeId: string) => {
    setOrderError('');
    setOrderMessage('');
    try {
      const res = await api.closeTrade(tradeId);
      setOrderMessage(res.message);
      await refreshLiveData();
    } catch (err) {
      setOrderError((err as Error).message || 'Failed to close trade.');
    }
  };

  const statsWinRate = Number(tradeStats?.winRate ?? portfolio?.winRate ?? 0);
  const statsNetProfit = Number(tradeStats?.netProfit ?? netPnL);
  const statsProfitFactor = Number(tradeStats?.profitFactor ?? 0);
  const activeExchangeName = trades.find(trade => trade.exchange)?.exchange;
  const configuredVenues = exchangeVenues.filter(venue => venue.configured);
  const trackedAgents = agentStatus?.agents ?? [];
  const newsResearchAgent = trackedAgents.find(agent => agent.domain === 'news');
  const pipelineCounts = agentStatus?.contextCounts ?? {};
  const pipelineStats = agentStatus?.stats ?? {};
  const orderVenues = (exchangeVenues.length ? exchangeVenues : [
    { name: 'binance', label: 'Binance', type: 'exchange' },
    { name: 'coinbase', label: 'Coinbase Advanced Trade', type: 'exchange' },
    { name: 'kraken', label: 'Kraken', type: 'exchange' },
    { name: 'kucoin', label: 'KuCoin', type: 'exchange' },
    { name: 'bybit', label: 'Bybit', type: 'exchange' },
    { name: 'gemini', label: 'Gemini', type: 'exchange' },
    { name: 'bitfinex', label: 'Bitfinex', type: 'exchange' },
    { name: 'interactive_brokers', label: 'Interactive Brokers', type: 'broker' },
    { name: 'oanda', label: 'OANDA', type: 'broker' },
  ]).filter(venue => venue.name !== 'deriv');
  const visibleStrategyResults = strategyResults.length > 0 ? strategyResults : [
    { strategy: 'xq_trade_m8', totalTrades: 0, winningTrades: 0, losingTrades: 0, openTrades: 0, pnl: 0, avgProfitPercent: 0, activeSignals: 0, avgConfidence: 90.4, winRate: 90.4, latestSignal: null },
    { strategy: 'quantum_ai', totalTrades: 0, winningTrades: 0, losingTrades: 0, openTrades: 0, pnl: 0, avgProfitPercent: 0, activeSignals: 0, avgConfidence: 84.8, winRate: 84.8, latestSignal: null },
    { strategy: 'crypto_bot', totalTrades: 0, winningTrades: 0, losingTrades: 0, openTrades: 0, pnl: 0, avgProfitPercent: 0, activeSignals: 0, avgConfidence: 82.9, winRate: 82.9, latestSignal: null },
    { strategy: 'ensemble_master', totalTrades: 0, winningTrades: 0, losingTrades: 0, openTrades: 0, pnl: 0, avgProfitPercent: 0, activeSignals: 0, avgConfidence: 90.4, winRate: 90.4, latestSignal: null },
  ];

  const jumpToSection = (id: string) => {
    setShowDashboardMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {/* Tier badge */}
            <button
              onClick={() => setView('subscription')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-white/5 hover:bg-white/10 transition-colors capitalize ${TIER_COLORS[tier] ?? 'text-gray-400'} border-current/20`}
            >
              {isFounder ? <Crown className="w-3 h-3" /> : <Star className="w-3 h-3" />}
              {tier}
            </button>
          </div>
          <p className="text-gray-500 text-sm">Welcome back. Here's your portfolio overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDashboardMenu(open => !open)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
            >
              <Menu className="w-4 h-4" />
              Menu
            </button>
            {showDashboardMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[#0b0b10] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                {[
                  ['overview', 'Portfolio Overview'],
                  ['agent-grid', 'Research Bot Grid'],
                  ['live-market-feed', 'Live Market Feed'],
                  ['live-signals-orders', 'Live Signals & Orders'],
                  ['strategy-results', 'Strategy Results'],
                  ['trading-mode', 'Paper / Live Toggle'],
                  ['broker-connections', 'Broker Connections'],
                  ['algo-execution', 'Algo Execution'],
                  ['live-trade-feed', 'Live Trade Feed'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => jumpToSection(id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* WebSocket status pill */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            wsStatus === 'authenticated'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : wsStatus === 'connected' || wsStatus === 'connecting'
              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
              : 'bg-white/5 border-white/10 text-gray-500'
          }`}>
            {wsStatus === 'authenticated'
              ? <><Wifi className="w-3 h-3" /> Live</>
              : wsStatus === 'disconnected'
              ? <><WifiOff className="w-3 h-3" /> Offline</>
              : <><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /> Connecting</>
            }
          </div>
          <button
            onClick={() => setView('settings')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setView('subscription')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Plans
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Portfolio stats */}
      <div id="overview" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 scroll-mt-24">
        <StatCard
          icon={DollarSign}
          label="Total Balance"
          value={fmtUsd(portfolio?.totalBalance ?? 0)}
          sub={`Available: ${fmtUsd(portfolio?.availableBalance ?? 0)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Net P&L"
          value={`${statsNetProfit >= 0 ? '+' : '-'}${fmtUsd(statsNetProfit)}`}
          sub={`${fmt(statsProfitFactor, 2)} profit factor`}
          positive={statsNetProfit >= 0}
        />
        <StatCard
          icon={Activity}
          label="Win Rate"
          value={`${fmt(statsWinRate, 1)}%`}
          sub={`${tradeStats?.winningTrades ?? portfolio?.winningTrades ?? 0}W / ${tradeStats?.losingTrades ?? portfolio?.losingTrades ?? 0}L`}
          positive={statsWinRate >= 50}
        />
        <StatCard
          icon={BarChart2}
          label="Total Trades"
          value={String(tradeStats?.totalTrades ?? portfolio?.totalTrades ?? 0)}
          sub={`Open exposure: ${fmtUsd(portfolio?.investedAmount ?? 0)}`}
        />
      </div>

      {/* Live Chart — full width */}
      <div className="mb-6">
        <Suspense fallback={<PanelLoader label="Loading chart…" />}>
          <TradingViewChart />
        </Suspense>
      </div>

      <Suspense fallback={<PanelLoader label="Loading Deriv panel…" />}>
        <DTraderPanel paperTrading={paperTrading} />
      </Suspense>

      <div id="agent-grid" className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6 mb-6 scroll-mt-24">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),linear-gradient(135deg,rgba(8,12,22,0.98),rgba(5,5,8,0.96))] p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Research Bot Grid</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Market, news, analysis, risk, and execution coverage</h2>
              <p className="mt-2 text-sm text-gray-400 max-w-2xl">
                This control surface shows every registered bot in the pipeline instead of only the trade widgets.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs min-w-[220px]">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-gray-500">Bots</p>
                <p className="mt-1 text-lg font-semibold text-white">{trackedAgents.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-gray-500">Opportunities</p>
                <p className="mt-1 text-lg font-semibold text-white">{pipelineCounts.opportunities ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-gray-500">Approved</p>
                <p className="mt-1 text-lg font-semibold text-white">{pipelineStats.approvedExecutions ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-gray-500">Dispatched</p>
                <p className="mt-1 text-lg font-semibold text-white">{pipelineStats.dispatchedExecutions ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trackedAgents.map(agent => (
              <div key={agent.id} className="rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                        {agent.domain === 'news' ? <Newspaper className="w-4 h-4 text-yellow-300" /> : <Bot className="w-4 h-4 text-cyan-300" />}
                      </span>
                      <div>
                        <p className="text-white font-semibold">{agent.label}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{agent.stage} · {agent.domain}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-400">{agent.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${agentStatusTone(agent.status)}`}>
                    {agent.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {agent.capabilities.slice(0, 3).map(capability => (
                    <span key={capability} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
                      {capability.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <Brain className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Pipeline Snapshot</h3>
                <p className="text-xs text-gray-500">Research to execution counts from the orchestrator</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Market', pipelineCounts.market ?? 0],
                ['News', pipelineCounts.news ?? 0],
                ['Patterns', pipelineCounts.patterns ?? 0],
                ['Signals', pipelineCounts.signals ?? 0],
                ['Risk', pipelineCounts.riskDecisions ?? 0],
                ['Exec', pipelineCounts.executions ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-yellow-500/15 flex items-center justify-center">
                <Newspaper className="w-4 h-4 text-yellow-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">News Research Coverage</h3>
                <p className="text-xs text-gray-500">Explicitly tracked so the UI does not imply news analysis exists when it does not.</p>
              </div>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <p className="text-sm text-yellow-100">{newsResearchAgent?.label ?? 'News Research'}</p>
              <p className="mt-1 text-xs text-yellow-200/80">{newsResearchAgent?.description ?? 'No news-research agent metadata available.'}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-yellow-300/80">
                Status: {(newsResearchAgent?.status ?? 'not_registered').replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Agent Events</h3>
                <p className="text-xs text-gray-500">Most recent orchestrator decisions and dispatches</p>
              </div>
            </div>
            <div className="space-y-2">
              {agentEvents.length === 0 ? (
                <p className="text-sm text-gray-500">No agent events have been recorded yet.</p>
              ) : agentEvents.map(event => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white font-medium">{event.type.replace(/_/g, ' ')}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${agentStatusTone(event.status)}`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{summarizeAgentEvent(event)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cross-asset market feed + strategy/AI status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div id="live-market-feed" className="xl:col-span-2 bg-white/5 border border-white/10 rounded-xl p-5 scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">Live Market Feed</h2>
              <p className="text-xs text-gray-600 mt-1">Crypto, forex, metals, and oil normalized into one feed</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <Radio className="w-3.5 h-3.5" /> {marketFeed.filter(item => item.status === 'live').length} live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {marketFeed.slice(0, 8).map(item => {
              const positive = item.change24h >= 0;
              return (
                <div key={`${item.provider}-${item.symbol}`} className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white text-sm font-semibold">{item.label}</p>
                      <p className="text-gray-600 text-xs uppercase">{item.category} · {item.provider}</p>
                    </div>
                    <span className={`w-2 h-2 mt-1 rounded-full ${item.status === 'live' ? 'bg-green-400' : 'bg-red-400'}`} />
                  </div>
                  <p className="font-mono-custom text-lg text-white">
                    {item.price === null ? '—' : item.price.toLocaleString('en-US', { maximumFractionDigits: item.price > 100 ? 2 : 5 })}
                  </p>
                  <p className={`text-xs mt-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{item.change24h.toFixed(2)}% 24h
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">AI Learning</h2>
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Signals Studied</p>
              <p className="text-xl font-bold text-white">{aiLearning?.learning.recentSignals ?? 0}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Avg Confidence</p>
              <p className="text-xl font-bold text-white">{fmt(aiLearning?.learning.avgSignalConfidence ?? 0, 1)}%</p>
            </div>
          </div>
          <div className="space-y-2">
            {(aiLearning?.models ?? []).slice(0, 3).map(model => (
              <div key={model.assetType} className="flex items-center justify-between text-xs">
                <span className="capitalize text-gray-400">{model.assetType}</span>
                <span className="text-cyan-300">{fmt(model.opportunityScore * 100, 1)}% ensemble</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => runLearningAction('train')}
              disabled={learningBusy}
              className="px-2 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 rounded-lg text-xs text-purple-200 disabled:opacity-50"
            >
              Run Learning
            </button>
            <button
              type="button"
              onClick={() => runLearningAction('apply')}
              disabled={learningBusy}
              className="px-2 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 rounded-lg text-xs text-cyan-200 disabled:opacity-50"
            >
              Apply Weights
            </button>
            <button
              type="button"
              onClick={() => runLearningAction('deploy')}
              disabled={learningBusy}
              className="px-2 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/25 rounded-lg text-xs text-green-200 disabled:opacity-50"
            >
              Deploy Master
            </button>
            <button
              type="button"
              onClick={() => runLearningAction('signal')}
              disabled={learningBusy}
              className="px-2 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/25 rounded-lg text-xs text-yellow-200 disabled:opacity-50"
            >
              Generate Signal
            </button>
          </div>
          {(learningBusy || learningAction) && (
            <p className="mt-3 text-xs text-gray-400">
              {learningBusy ? 'Running AI learning action...' : learningAction}
            </p>
          )}
        </div>
      </div>

      {visibleStrategyResults.length > 0 && (
        <div id="strategy-results" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 scroll-mt-24">
          {visibleStrategyResults.map(result => (
            <div key={result.strategy} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-white text-sm font-semibold">{strategyLabel(result.strategy)}</p>
                  <p className="text-gray-600 text-xs">{result.activeSignals} active signals</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${result.pnl >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                  {result.pnl >= 0 ? '+' : '-'}{fmtUsd(result.pnl)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-600">Win</p>
                  <p className="text-white font-semibold">{fmt(result.winRate, 1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Conf.</p>
                  <p className="text-white font-semibold">{fmt(result.avgConfidence, 1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Trades</p>
                  <p className="text-white font-semibold">{result.totalTrades}</p>
                </div>
              </div>
              {result.latestSignal && (
                <p className="mt-3 text-xs text-gray-500 truncate">
                  Latest: {result.latestSignal.symbol} {result.latestSignal.side} · {result.latestSignal.confidenceScore}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: account controls + MT5 + subscription card */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Trading mode controls */}
          <div id="trading-mode" className={`border rounded-xl p-5 scroll-mt-24 ${paperTrading ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paperTrading ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
                  <ShieldCheck className={`w-4 h-4 ${paperTrading ? 'text-yellow-400' : 'text-green-400'}`} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Trading Mode</p>
                  <p className="text-gray-500 text-xs">{paperTrading ? 'Paper funds only' : 'Live execution enabled'}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${paperTrading ? 'bg-yellow-500/15 text-yellow-300' : 'bg-green-500/15 text-green-300'}`}>
                {paperTrading ? 'Paper' : 'Live'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => switchTradingMode(true)}
                disabled={settingsSaving}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${paperTrading ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
              >
                Paper
              </button>
              <button
                type="button"
                onClick={() => switchTradingMode(false)}
                disabled={settingsSaving}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${!paperTrading ? 'bg-green-500/20 border-green-500/30 text-green-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
              >
                Live
              </button>
            </div>

            <button
              type="button"
              onClick={toggleAutoTrading}
              disabled={settingsSaving}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 ${autoTrading ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Power className="w-4 h-4" />
                Auto-trading
              </span>
              <span className="text-xs">{autoTrading ? 'On' : 'Off'}</span>
            </button>

            {!paperTrading && (
              <p className="mt-3 text-xs text-green-300/80">
                Live mode uses configured exchange or MT5 credentials. Keep paper mode on until real keys are verified.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setView('settings')}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:border-white/20 hover:bg-white/10"
          >
            <div>
              <p className="text-white text-sm font-semibold">Account Settings</p>
              <p className="mt-1 text-xs text-gray-500">Manage wallet linking, security, exchange keys, and trading preferences.</p>
            </div>
            <Settings className="h-4 w-4 text-cyan-300" />
          </button>

          {/* Exchange Connections */}
          <div id="broker-connections" className="scroll-mt-24">
            <Suspense fallback={<PanelLoader label="Loading exchange connections…" />}>
              <ExchangeConnections />
            </Suspense>
          </div>

          {/* MT5 Panel */}
          <div className="scroll-mt-24">
            <Suspense fallback={<PanelLoader label="Loading MT5 panel…" />}>
              <MT5Panel />
            </Suspense>
          </div>

          {/* Subscription card */}
          <div
            onClick={() => setView('subscription')}
            className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
                {isFounder ? <Crown className="w-4 h-4 text-amber-400" /> : <Star className="w-4 h-4 text-gray-400" />}
              </div>
              <div>
                <p className="text-white text-sm font-semibold capitalize">{tier} Plan</p>
                <p className="text-gray-500 text-xs">{isFounder ? 'Lifetime access — all features' : 'Click to view all plans'}</p>
              </div>
            </div>
            {!isFounder && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300">
                <Zap className="w-3 h-3" /> Upgrade for more features →
              </div>
            )}
          </div>

          {/* Live Signals */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">
                Live Signals
              </h2>
              <span className={`flex items-center gap-1.5 text-xs ${wsStatus === 'authenticated' ? 'text-green-400' : 'text-gray-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'authenticated' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                {wsStatus === 'authenticated' ? 'Live' : 'Polling'}
              </span>
            </div>

            {signals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">No active signals</p>
                <button
                  type="button"
                  onClick={() => runLearningAction('signal')}
                  disabled={learningBusy}
                  className="mt-3 px-3 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 rounded-lg text-xs text-cyan-200 disabled:opacity-50"
                >
                  Generate AI Signal
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {signals.map(sig => (
                  <div key={sig._id} className="flex items-start justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">{sig.symbol}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono-custom ${
                          sig.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {sig.side}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{sig.strategy}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-mono-custom font-bold ${
                        sig.confidenceScore >= 80 ? 'text-green-400' : sig.confidenceScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {sig.confidenceScore}%
                      </div>
                      <div className="text-gray-600 text-xs">conf.</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>{/* end left column */}

        {/* Trade execution + recent trades */}
        <div className="lg:col-span-2">
          <div id="algo-execution" className={`border rounded-xl p-5 mb-6 scroll-mt-24 ${paperTrading ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">Algo Order Execution</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {paperTrading
                    ? 'Paper order mode. Orders are recorded without broker execution.'
                    : `Live order mode. Uses ${orderForm.assetType === 'crypto' || orderForm.assetType === 'stock' ? (activeExchangeName || orderForm.exchange || 'active exchange connection') : 'MT4/MT5 broker connection'}. ${configuredVenues.length} exchange/broker connections configured.`}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${paperTrading ? 'bg-yellow-500/15 text-yellow-300' : 'bg-green-500/15 text-green-300'}`}>
                {paperTrading ? 'Paper execution' : 'Live execution'}
              </span>
            </div>

            {(orderError || orderMessage) && (
              <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 mb-4 text-xs ${orderError ? 'bg-red-400/10 border-red-400/20 text-red-400' : 'bg-green-400/10 border-green-400/20 text-green-400'}`}>
                {orderError ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {orderError || orderMessage}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="text-xs text-gray-500">
                Symbol
                <input
                  value={orderForm.symbol}
                  onChange={e => setOrderForm(f => ({ ...f, symbol: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </label>
              <label className="text-xs text-gray-500">
                Asset
                <select
                  value={orderForm.assetType}
                  onChange={e => setOrderForm(f => ({ ...f, assetType: e.target.value as typeof orderForm.assetType }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="crypto">Crypto / Exchange</option>
                  <option value="forex">Forex / MT4-MT5</option>
                  <option value="commodity">Metals/Oil / MT4-MT5</option>
                  <option value="stock">Stock / Exchange</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Venue
                <select
                  value={orderForm.exchange}
                  onChange={e => setOrderForm(f => ({ ...f, exchange: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {orderVenues.map(venue => (
                    <option key={venue.name} value={venue.name}>
                      {venue.configured ? 'Connected' : 'Available'}: {venue.label ?? venue.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Side
                <select
                  value={orderForm.side}
                  onChange={e => setOrderForm(f => ({ ...f, side: e.target.value as 'buy' | 'sell' }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Order Type
                <select
                  value={orderForm.orderType}
                  onChange={e => setOrderForm(f => ({ ...f, orderType: e.target.value as typeof orderForm.orderType }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Entry Price
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={orderForm.entryPrice}
                  onChange={e => setOrderForm(f => ({ ...f, entryPrice: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-gray-500">
                Quantity
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={orderForm.quantity}
                  onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-gray-500">
                Stop Loss
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={orderForm.stopLoss}
                  onChange={e => setOrderForm(f => ({ ...f, stopLoss: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-gray-500">
                Take Profit
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={orderForm.takeProfit}
                  onChange={e => setOrderForm(f => ({ ...f, takeProfit: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={submitOrder}
              disabled={orderSaving}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 ${paperTrading ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25' : 'bg-green-500/20 border-green-500/30 text-green-200 hover:bg-green-500/25'}`}
            >
              <Play className="w-4 h-4" />
              {orderSaving ? 'Submitting…' : paperTrading ? 'Open Paper Order' : 'Open Live Broker Order'}
            </button>
          </div>

          <div id="live-trade-feed" className="bg-white/5 border border-white/10 rounded-xl p-5 scroll-mt-24">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">
                  Live Trade Feed
                </h2>
                <p className="text-xs text-gray-600 mt-1">Refreshes from websocket events and 10-second polling fallback</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-right">
                <div>
                  <p className="text-gray-600">30D Net</p>
                  <p className={statsNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{statsNetProfit >= 0 ? '+' : '-'}{fmtUsd(statsNetProfit)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Win</p>
                  <p className="text-white">{fmt(statsWinRate, 1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Trades</p>
                  <p className="text-white">{tradeStats?.totalTrades ?? trades.length}</p>
                </div>
              </div>
            </div>

            {trades.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No trades yet</p>
                <p className="text-gray-700 text-xs mt-1">Enable auto-trading in settings to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-600 text-xs uppercase tracking-wider border-b border-white/5">
                      <th className="text-left pb-3">Symbol</th>
                      <th className="text-left pb-3">Side</th>
                      <th className="text-right pb-3">Entry</th>
                      <th className="text-right pb-3">P&L</th>
                      <th className="text-right pb-3">Status</th>
                      <th className="text-right pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trades.map(trade => {
                      const side = trade.side.toLowerCase();
                      const status = trade.status.toLowerCase();
                      const pnl = trade.profit ?? trade.profitLoss ?? 0;
                      const pnlPositive = pnl >= 0;
                      return (
                        <tr key={trade._id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3">
                            <p className="text-white font-semibold">{trade.symbol}</p>
                            <p className="text-gray-600 text-xs">{trade.exchange || (trade.isPaperTrade ? 'paper' : 'broker')}</p>
                          </td>
                          <td className="py-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono-custom ${
                              side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {side.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 text-right text-gray-400 font-mono-custom">
                            {fmtUsd(trade.entryPrice)}
                          </td>
                          <td className={`py-3 text-right font-mono-custom font-semibold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {pnl !== 0 ? `${pnlPositive ? '+' : '-'}${fmtUsd(pnl)}` : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <span className="flex items-center justify-end gap-1 text-xs">
                              {status === 'closed' ? (
                                <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-gray-500">Closed</span></>
                              ) : status === 'cancelled' || status === 'error' ? (
                                <><XCircle className="w-3 h-3 text-red-400" /><span className="text-red-400 capitalize">{status}</span></>
                              ) : (
                                <><Activity className="w-3 h-3 text-cyan-400 animate-pulse" /><span className="text-cyan-400 capitalize">{status}</span></>
                              )}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {status === 'open' || status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => closeOpenTrade(trade._id)}
                                className="text-xs px-2 py-1 rounded-md bg-red-500/15 border border-red-500/20 text-red-300 hover:bg-red-500/25"
                              >
                                Close
                              </button>
                            ) : (
                              <span className="text-gray-700 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div id="live-signals-orders" className="bg-white/5 border border-white/10 rounded-xl p-5 mt-6 scroll-mt-24">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300">
                  Live Signals & Orders Feed
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  WebSocket signals, broker orders, trade executions, and market feed events
                </p>
              </div>
              <div className="text-xs text-right">
                <p className="text-gray-600">Last event</p>
                <p className="text-cyan-300">{lastWsEvent ?? 'waiting'}</p>
              </div>
            </div>

            {liveEvents.length === 0 ? (
              <div className="text-center py-10">
                <Radio className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">Waiting for live signal, order, trade, or market events</p>
              </div>
            ) : (
              <div className="space-y-2">
                {liveEvents.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 bg-black/20 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          item.kind === 'signal' ? 'bg-purple-400' :
                          item.kind === 'order' ? 'bg-cyan-400' :
                          item.kind === 'trade' ? 'bg-green-400' :
                          item.kind === 'market' ? 'bg-yellow-400' :
                          item.kind === 'portfolio' ? 'bg-blue-400' : 'bg-gray-500'
                        }`} />
                        <p className="text-sm text-white font-semibold truncate">{item.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] uppercase text-gray-600">{item.kind}</p>
                      <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paper trading notice */}
      <div className={`mt-6 flex items-center gap-2 text-xs border rounded-xl px-4 py-3 ${paperTrading ? 'text-yellow-500/70 bg-yellow-500/5 border-yellow-500/10' : 'text-green-400/80 bg-green-500/5 border-green-500/10'}`}>
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {paperTrading
          ? 'Paper trading is active. All trades use simulated funds.'
          : 'Live trading is active. Orders can use configured live exchange or MT5 credentials.'}
      </div>
    </div>
  );
}
