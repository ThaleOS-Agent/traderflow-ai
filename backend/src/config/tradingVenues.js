export const TRADING_VENUES = {
  binance: {
    id: 'binance',
    label: 'Binance',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: false,
  },
  coinbase: {
    id: 'coinbase',
    label: 'Coinbase Exchange',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: true,
    passphraseLabel: 'API Passphrase',
  },
  kraken: {
    id: 'kraken',
    label: 'Kraken',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: false,
    requiresPassphrase: false,
  },
  kucoin: {
    id: 'kucoin',
    label: 'KuCoin',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: true,
    passphraseLabel: 'API Passphrase',
  },
  bybit: {
    id: 'bybit',
    label: 'Bybit',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: false,
  },
  ftx: {
    id: 'ftx',
    label: 'FTX',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: false,
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: true,
    requiresPassphrase: false,
  },
  bitfinex: {
    id: 'bitfinex',
    label: 'Bitfinex',
    type: 'exchange',
    assetTypes: ['crypto'],
    supportsPublicSandbox: false,
    requiresPassphrase: false,
  },
  interactive_brokers: {
    id: 'interactive_brokers',
    label: 'Interactive Brokers',
    type: 'broker',
    assetTypes: ['stock', 'options', 'forex', 'commodity'],
    supportsPublicSandbox: true,
    requiresPassphrase: false,
  },
  oanda: {
    id: 'oanda',
    label: 'OANDA',
    type: 'broker',
    assetTypes: ['forex', 'commodity'],
    supportsPublicSandbox: true,
    requiresPassphrase: true,
    passphraseLabel: 'Account ID',
  },
};

const COMMODITY_SYMBOLS = new Set([
  'XAUUSD',
  'XAGUSD',
  'USOIL',
  'UKOIL',
  'WTICO_USD',
  'BCO_USD',
  'XAU_USD',
  'XAG_USD',
]);

export function getTradingVenue(id) {
  if (!id) return null;
  return TRADING_VENUES[String(id).toLowerCase()] || null;
}

export function getSupportedVenueNames() {
  return Object.keys(TRADING_VENUES);
}

export function normalizeVenueName(id) {
  return getTradingVenue(id)?.id || null;
}

export function resolveVenueForSymbol(symbol, explicit, fallback = 'binance') {
  const explicitVenue = normalizeVenueName(explicit);
  if (explicitVenue) return explicitVenue;

  const upper = String(symbol || '').toUpperCase();
  if (upper.includes('_') || COMMODITY_SYMBOLS.has(upper)) {
    return 'oanda';
  }

  return fallback;
}

export function getVenueSandboxFlag(id) {
  return getTradingVenue(id)?.supportsPublicSandbox !== false;
}

export function venueSupportsAssetType(id, assetType) {
  const venue = getTradingVenue(id);
  if (!venue || !assetType) return false;
  return venue.assetTypes.includes(String(assetType).toLowerCase());
}
