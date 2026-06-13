import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Circle, AlertCircle } from 'lucide-react';
import { api } from './api';

interface MT5Account {
  login: string;
  name: string;
  broker: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  platform: string;
  connected: boolean;
  _mock?: boolean;
}

interface MT5Position {
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

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function MT5Panel() {
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [positions, setPositions] = useState<MT5Position[]>([]);
  const [mode, setMode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, posRes] = await Promise.allSettled([
        api.getMt5Status(),
        api.getMt5Positions(),
      ]);

      if (statusRes.status === 'fulfilled') {
        setAccount(statusRes.value.account as unknown as MT5Account);
        setMode(statusRes.value.mode);
      }
      if (posRes.status === 'fulfilled') {
        setPositions(posRes.value.positions as unknown as MT5Position[]);
      }
    } catch {
      setError('Failed to load MT5 data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">MT4 / MT5</p>
            <div className="flex items-center gap-1.5">
              <Circle className={`w-2 h-2 fill-current ${
                account?.connected ? 'text-green-400' : account?._mock ? 'text-yellow-400' : 'text-gray-600'
              }`} />
              <span className="text-xs text-gray-500 capitalize">
                {mode === 'mock' ? 'Demo (not configured)' : mode === 'bridge' ? 'Bridge connected' : mode === 'metaapi' ? 'MetaAPI cloud' : '…'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
        </p>
      )}

      {account && (
        <>
          {/* Account summary */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Balance</p>
              <p className="text-white font-semibold text-sm">${fmt(account.balance)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Equity</p>
              <p className="text-white font-semibold text-sm">${fmt(account.equity)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Free Margin</p>
              <p className="text-white font-semibold text-sm">${fmt(account.freeMargin)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Open P&L</p>
              <p className={`font-semibold text-sm ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}${fmt(totalProfit)}
              </p>
            </div>
          </div>

          <p className="text-gray-600 text-xs mb-2">{account.broker} · {account.platform} · {account.currency}</p>

          {/* Open positions */}
          {positions.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Open Positions</p>
              <div className="space-y-2">
                {positions.map(pos => (
                  <div key={pos.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      {pos.type === 'BUY'
                        ? <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      }
                      <div>
                        <p className="text-white text-xs font-semibold">{pos.symbol}</p>
                        <p className="text-gray-600 text-xs">{pos.volume} lots @ {pos.openPrice}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold font-mono ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.profit >= 0 ? '+' : ''}${fmt(pos.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {positions.length === 0 && !loading && (
            <p className="text-gray-600 text-xs text-center py-3">No open positions</p>
          )}

          {account._mock && (
            <p className="mt-3 text-yellow-600 text-xs text-center">
              Showing demo data. Set MT5_API_URL or MT5_METAAPI_TOKEN in .env to connect.
            </p>
          )}
        </>
      )}

      {loading && !account && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
