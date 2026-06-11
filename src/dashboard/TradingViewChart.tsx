import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart, CandlestickSeries,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts';
import { RefreshCw, TrendingUp, ChevronDown } from 'lucide-react';

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SymbolOption {
  symbol: string;
  label: string;
  exchange: string;
  category: 'crypto' | 'forex' | 'metal' | 'oil';
}

const SYMBOLS: SymbolOption[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', exchange: 'binance', category: 'crypto' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', exchange: 'binance', category: 'crypto' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', exchange: 'binance', category: 'crypto' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', exchange: 'binance', category: 'crypto' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT', exchange: 'binance', category: 'crypto' },
  { symbol: 'EUR_USD', label: 'EUR/USD', exchange: 'oanda', category: 'forex' },
  { symbol: 'GBP_USD', label: 'GBP/USD', exchange: 'oanda', category: 'forex' },
  { symbol: 'USD_JPY', label: 'USD/JPY', exchange: 'oanda', category: 'forex' },
  { symbol: 'AUD_USD', label: 'AUD/USD', exchange: 'oanda', category: 'forex' },
  { symbol: 'XAU_USD', label: 'Gold (XAU)', exchange: 'oanda', category: 'metal' },
  { symbol: 'XAG_USD', label: 'Silver (XAG)', exchange: 'oanda', category: 'metal' },
  { symbol: 'WTICO_USD', label: 'WTI Oil', exchange: 'oanda', category: 'oil' },
  { symbol: 'BCO_USD', label: 'Brent Oil', exchange: 'oanda', category: 'oil' },
];

const INTERVALS = [
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'text-cyan-400',
  forex: 'text-blue-400',
  metal: 'text-yellow-400',
  oil: 'text-orange-400',
};

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchCandles(symbol: string, exchange: string, timeframe: string): Promise<Candle[]> {
  const token = localStorage.getItem('tradeflow_token');
  const url = `${BASE_URL}/exchange/klines/${symbol}?interval=${timeframe}&limit=200&exchange=${exchange}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    klines?: Array<{ timestamp: number; open: number; high: number; low: number; close: number }>;
  };
  return (data.klines ?? []).map(k => ({
    time: Math.floor(k.timestamp / 1000) as UTCTimestamp,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  }));
}

export function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption>(SYMBOLS[0]);
  const [chartInterval, setChartInterval] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);

  // Init chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!seriesRef.current) return;
    setLoading(true);
    setError('');
    try {
      const candles = await fetchCandles(selectedSymbol.symbol, selectedSymbol.exchange, chartInterval);
      if (candles.length > 0) {
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();
        const last = candles[candles.length - 1];
        const first = candles[0];
        setLastPrice(last.close);
        setPriceChange(((last.close - first.open) / first.open) * 100);
      }
    } catch {
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, chartInterval]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 60_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const categoryGroups = SYMBOLS.reduce<Record<string, SymbolOption[]>>((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s];
    return acc;
  }, {});

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Symbol picker */}
          <div className="relative">
            <button
              onClick={() => setShowSymbolMenu(v => !v)}
              className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-cyan-400 transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              {selectedSymbol.label}
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {showSymbolMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSymbolMenu(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 bg-[#0d0d14] border border-white/10 rounded-xl shadow-2xl p-2 w-56 max-h-72 overflow-y-auto">
                  {(Object.entries(categoryGroups) as [string, SymbolOption[]][]).map(([cat, syms]) => (
                    <div key={cat} className="mb-2">
                      <p className={`text-xs font-semibold uppercase px-2 py-1 ${CATEGORY_COLORS[cat]}`}>{cat}</p>
                      {syms.map(s => (
                        <button
                          key={s.symbol}
                          onClick={() => { setSelectedSymbol(s); setShowSymbolMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedSymbol.symbol === s.symbol
                              ? 'bg-white/10 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Live price + change */}
          {lastPrice !== null && (
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm">
                {lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
              </span>
              {priceChange !== null && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  priceChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Interval buttons */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5">
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => setChartInterval(iv.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartInterval === iv.value
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart canvas */}
      <div className="relative" style={{ height: 320 }}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={loadData} className="mt-2 text-xs text-gray-500 hover:text-gray-300">
                Retry
              </button>
            </div>
          </div>
        )}
        {loading && !lastPrice && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#050508]/60">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Footer — exchange + category badge */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-2">
        <span className={`text-xs font-semibold uppercase ${CATEGORY_COLORS[selectedSymbol.category]}`}>
          {selectedSymbol.category}
        </span>
        <span className="text-gray-600 text-xs">via</span>
        <span className="text-gray-500 text-xs capitalize">{selectedSymbol.exchange}</span>
        <span className="ml-auto text-gray-700 text-xs">Auto-refreshes every 60s</span>
      </div>
    </div>
  );
}
