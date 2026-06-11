import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Activity, DollarSign,
  BarChart2, Zap, RefreshCw, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Wifi, WifiOff,
} from 'lucide-react';
import { api } from './api';
import { useTradeWebSocket, type LiveSignal, type LiveTrade } from '../hooks/useTradeWebSocket';

// ── Types ──────────────────────────────────────────────────────────────────

interface PortfolioStats {
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

interface Trade {
  _id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  status: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profitLoss?: number;
  strategy: string;
  createdAt: string;
}

interface Signal {
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsd(n: number) {
  return `$${fmt(Math.abs(n))}`;
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

export function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Keep stable refs so WebSocket callbacks don't go stale
  const tradesRef = useRef(trades);
  const signalsRef = useRef(signals);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);

  // Live WebSocket updates
  const handleSignal = useCallback((sig: LiveSignal) => {
    setSignals(prev => {
      const exists = prev.some(s => s._id === sig._id);
      if (exists) return prev;
      return [sig, ...prev].slice(0, 6);
    });
  }, []);

  const handleTrade = useCallback((trade: LiveTrade) => {
    setTrades(prev => {
      const idx = prev.findIndex(t => t._id === trade._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = trade as Trade;
        return next;
      }
      return [trade as Trade, ...prev].slice(0, 10);
    });
  }, []);

  const { status: wsStatus } = useTradeWebSocket({
    onSignal: handleSignal,
    onTrade: handleTrade,
    onPortfolioUpdate: useCallback(() => {
      // Refresh portfolio stats on any server-pushed portfolio event
      api.getPortfolio().then(res => {
        const p = res as { portfolio?: PortfolioStats };
        if (p.portfolio) setPortfolio(p.portfolio);
      }).catch(() => {/* non-critical */});
    }, []),
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const [portfolioRes, tradesRes, signalsRes] = await Promise.allSettled([
        api.getPortfolio(),
        api.getTrades({ limit: 10 }),
        api.getSignals(),
      ]);

      if (portfolioRes.status === 'fulfilled') {
        const p = portfolioRes.value as { portfolio?: PortfolioStats };
        setPortfolio(p.portfolio ?? null);
      }
      if (tradesRes.status === 'fulfilled') {
        const t = tradesRes.value as { trades?: Trade[] };
        setTrades(t.trades ?? []);
      }
      if (signalsRes.status === 'fulfilled') {
        const s = signalsRes.value as { signals?: Signal[] };
        setSignals((s.signals ?? []).slice(0, 6));
      }
    } catch {
      setError('Failed to load dashboard data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const netPnL = (portfolio?.totalProfit ?? 0) - (portfolio?.totalLoss ?? 0);
  const netPositive = netPnL >= 0;

  return (
    <div className="min-h-screen bg-[#050508] text-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back. Here's your portfolio overview.</p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={DollarSign}
          label="Total Balance"
          value={fmtUsd(portfolio?.totalBalance ?? 0)}
          sub={`Available: ${fmtUsd(portfolio?.availableBalance ?? 0)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Net P&L"
          value={`${netPositive ? '+' : '-'}${fmtUsd(netPnL)}`}
          sub={netPositive ? 'Overall profitable' : 'In drawdown'}
          positive={netPositive}
        />
        <StatCard
          icon={Activity}
          label="Win Rate"
          value={`${fmt(portfolio?.winRate ?? 0, 1)}%`}
          sub={`${portfolio?.winningTrades ?? 0}W / ${portfolio?.losingTrades ?? 0}L`}
          positive={(portfolio?.winRate ?? 0) >= 50}
        />
        <StatCard
          icon={BarChart2}
          label="Total Trades"
          value={String(portfolio?.totalTrades ?? 0)}
          sub={`Invested: ${fmtUsd(portfolio?.investedAmount ?? 0)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Signals */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full">
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
              <p className="text-gray-600 text-sm text-center py-8">No active signals</p>
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
        </div>

        {/* Recent Trades */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-300 mb-4">
              Recent Trades
            </h2>

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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trades.map(trade => {
                      const pnl = trade.profitLoss ?? 0;
                      const pnlPositive = pnl >= 0;
                      return (
                        <tr key={trade._id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white font-semibold">{trade.symbol}</td>
                          <td className="py-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono-custom ${
                              trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {trade.side}
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
                              {trade.status === 'CLOSED' ? (
                                <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-gray-500">Closed</span></>
                              ) : (
                                <><Activity className="w-3 h-3 text-cyan-400 animate-pulse" /><span className="text-cyan-400">Open</span></>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paper trading notice */}
      <div className="mt-6 flex items-center gap-2 text-xs text-yellow-500/70 bg-yellow-500/5 border border-yellow-500/10 rounded-xl px-4 py-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Paper trading mode is active by default. All trades use simulated funds. Enable live trading in Settings.
      </div>
    </div>
  );
}
