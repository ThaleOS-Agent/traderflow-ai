import axios from 'axios';
import { logger } from '../utils/logger.js';

const FEED_SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'Bitcoin', category: 'crypto', provider: 'binance' },
  { symbol: 'ETHUSDT', label: 'Ethereum', category: 'crypto', provider: 'binance' },
  { symbol: 'SOLUSDT', label: 'Solana', category: 'crypto', provider: 'binance' },
  { symbol: 'BNBUSDT', label: 'BNB', category: 'crypto', provider: 'binance' },
  { symbol: 'EURUSD=X', label: 'EUR/USD', category: 'forex', provider: 'yahoo', displaySymbol: 'EUR_USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', category: 'forex', provider: 'yahoo', displaySymbol: 'GBP_USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY', category: 'forex', provider: 'yahoo', displaySymbol: 'USD_JPY' },
  { symbol: 'GC=F', label: 'Gold', category: 'metal', provider: 'yahoo', displaySymbol: 'XAU_USD' },
  { symbol: 'SI=F', label: 'Silver', category: 'metal', provider: 'yahoo', displaySymbol: 'XAG_USD' },
  { symbol: 'CL=F', label: 'WTI Oil', category: 'oil', provider: 'yahoo', displaySymbol: 'WTI' },
  { symbol: 'BZ=F', label: 'Brent Oil', category: 'oil', provider: 'yahoo', displaySymbol: 'BRENT' },
];

const DISPLAY_TO_PROVIDER = FEED_SYMBOLS.reduce((acc, item) => {
  acc[item.displaySymbol ?? item.symbol] = item;
  acc[item.symbol] = item;
  return acc;
}, {});

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function changePercent(current, previous) {
  if (!current || !previous) return 0;
  return ((current - previous) / previous) * 100;
}

async function fetchBinanceTicker(item) {
  const { data } = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
    params: { symbol: item.symbol },
    timeout: 10_000,
  });

  return {
    symbol: item.symbol,
    label: item.label,
    category: item.category,
    provider: item.provider,
    price: normalizeNumber(data.lastPrice),
    change24h: normalizeNumber(data.priceChangePercent) ?? 0,
    high24h: normalizeNumber(data.highPrice),
    low24h: normalizeNumber(data.lowPrice),
    volume: normalizeNumber(data.volume),
    quoteVolume: normalizeNumber(data.quoteVolume),
    status: 'live',
    updatedAt: new Date().toISOString(),
  };
}

async function fetchYahooQuote(item) {
  const { data } = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}`,
    {
      params: { range: '1d', interval: '5m' },
      timeout: 10_000,
    }
  );

  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const meta = result?.meta ?? {};
  const closes = (quote?.close ?? []).filter((v) => Number.isFinite(Number(v))).map(Number);
  const highs = (quote?.high ?? []).filter((v) => Number.isFinite(Number(v))).map(Number);
  const lows = (quote?.low ?? []).filter((v) => Number.isFinite(Number(v))).map(Number);
  const volumes = (quote?.volume ?? []).filter((v) => Number.isFinite(Number(v))).map(Number);
  const price = normalizeNumber(meta.regularMarketPrice) ?? closes.at(-1) ?? null;
  const previousClose = normalizeNumber(meta.chartPreviousClose) ?? closes[0] ?? price;

  return {
    symbol: item.displaySymbol ?? item.symbol,
    label: item.label,
    category: item.category,
    provider: item.provider,
    price,
    change24h: changePercent(price, previousClose),
    high24h: highs.length ? Math.max(...highs) : null,
    low24h: lows.length ? Math.min(...lows) : null,
    volume: volumes.at(-1) ?? null,
    quoteVolume: null,
    status: 'live',
    updatedAt: new Date().toISOString(),
  };
}

export async function getLiveMarketFeed(category = 'all') {
  const symbols = FEED_SYMBOLS.filter((item) => category === 'all' || item.category === category);

  const settled = await Promise.allSettled(
    symbols.map((item) => item.provider === 'binance' ? fetchBinanceTicker(item) : fetchYahooQuote(item))
  );

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    const item = symbols[index];
    logger.warn(`Market feed unavailable for ${item.symbol}: ${result.reason?.message || result.reason}`);
    return {
      symbol: item.displaySymbol ?? item.symbol,
      label: item.label,
      category: item.category,
      provider: item.provider,
      price: null,
      change24h: 0,
      high24h: null,
      low24h: null,
      volume: null,
      quoteVolume: null,
      status: 'unavailable',
      updatedAt: new Date().toISOString(),
      error: result.reason?.message || 'Provider unavailable',
    };
  });
}

export function getMarketFeedSymbols() {
  return FEED_SYMBOLS.map(({ symbol, displaySymbol, label, category, provider }) => ({
    symbol: displaySymbol ?? symbol,
    providerSymbol: symbol,
    label,
    category,
    provider,
  }));
}

export async function getMarketCandles(symbol, interval = '1h', limit = 200) {
  const item = DISPLAY_TO_PROVIDER[symbol] ?? DISPLAY_TO_PROVIDER[String(symbol).toUpperCase()];
  if (!item || item.provider !== 'yahoo') {
    throw new Error(`No fallback candle provider configured for ${symbol}`);
  }

  const yahooInterval = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '60m',
    '4h': '60m',
    '1d': '1d',
  }[interval] || '60m';
  const range = interval === '1d' ? '6mo' : interval === '4h' ? '1mo' : '5d';

  const { data } = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}`,
    {
      params: { range, interval: yahooInterval },
      timeout: 10_000,
    }
  );

  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  const candles = timestamps.map((timestamp, index) => ({
    timestamp: timestamp * 1000,
    open: normalizeNumber(quote?.open?.[index]),
    high: normalizeNumber(quote?.high?.[index]),
    low: normalizeNumber(quote?.low?.[index]),
    close: normalizeNumber(quote?.close?.[index]),
    volume: normalizeNumber(quote?.volume?.[index]) ?? 0,
  })).filter((candle) => candle.open && candle.high && candle.low && candle.close);

  return candles.slice(-Number(limit || 200));
}
