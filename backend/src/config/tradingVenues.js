export const SUPPORTED_TRADING_VENUES = Object.freeze([
  'deriv',
  'binance',
  'coinbase',
  'kraken',
  'kucoin',
  'bybit',
  'gemini',
  'bitfinex',
  'interactive_brokers',
  'oanda'
]);

export const normalizeTradingVenue = (venue) => {
  if (!venue) return 'binance';

  const normalized = venue.toString().trim().toLowerCase();
  return SUPPORTED_TRADING_VENUES.includes(normalized) ? normalized : 'binance';
};

export const isSupportedTradingVenue = (venue) => (
  SUPPORTED_TRADING_VENUES.includes(venue?.toString().trim().toLowerCase())
);

export const normalizeStrategyName = (strategy) => (
  strategy?.toString().trim().toLowerCase().replace(/\s+/g, '_') || 'auto'
);
