import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { ExchangeConnector } from '../services/exchangeConnector.js';
import { MultiExchangeConnector } from '../services/exchanges/multiExchange.js';
import { getMarketCandles } from '../services/marketFeedService.js';
import { SUPPORTED_TRADING_VENUES } from '../config/tradingVenues.js';

const router = express.Router();

// Detect which exchange to use from the symbol when not explicitly provided
function resolveExchange(symbol, explicit) {
  if (explicit) return explicit;
  const upper = symbol.toUpperCase();
  // OANDA-style symbols contain underscore (EUR_USD) or are known commodities
  if (upper.includes('_') || ['XAUUSD','XAGUSD','USOIL','UKOIL','WTICO_USD','BCO_USD','XAU_USD','XAG_USD'].includes(upper)) {
    return 'oanda';
  }
  return 'binance';
}

// Whether an exchange requires auth for public market data
function isTestnet(exchange) {
  return exchange !== 'kraken' && exchange !== 'bitfinex';
}

function sanitizeExchange(exchange) {
  const obj = exchange.toObject ? exchange.toObject() : exchange;
  return {
    id: obj._id?.toString(),
    name: obj.name,
    isTestnet: obj.isTestnet,
    isActive: obj.isActive,
    hasApiKey: Boolean(obj.apiKey),
    hasApiSecret: Boolean(obj.apiSecret),
    hasPassphrase: Boolean(obj.passphrase),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

const VENUE_DETAILS = {
  binance: { label: 'Binance', type: 'exchange', credentialHint: 'API key + secret' },
  coinbase: { label: 'Coinbase Advanced Trade', type: 'exchange', credentialHint: 'API key + secret + passphrase' },
  kraken: { label: 'Kraken', type: 'exchange', credentialHint: 'API key + secret' },
  kucoin: { label: 'KuCoin', type: 'exchange', credentialHint: 'API key + secret + passphrase' },
  bybit: { label: 'Bybit', type: 'exchange', credentialHint: 'API key + secret' },
  gemini: { label: 'Gemini', type: 'exchange', credentialHint: 'API key + secret' },
  bitfinex: { label: 'Bitfinex', type: 'exchange', credentialHint: 'API key + secret' },
  interactive_brokers: { label: 'Interactive Brokers', type: 'broker', credentialHint: 'OAuth bearer token' },
  oanda: { label: 'OANDA', type: 'broker', credentialHint: 'Token + account ID' }
};

function getActiveExchange(user, requestedExchange) {
  const exchanges = user.getDecryptedExchanges?.() || [];
  if (requestedExchange) {
    return exchanges.find(ex => ex._id.toString() === requestedExchange || ex.name === requestedExchange);
  }
  return exchanges.find(ex => ex.isActive) || exchanges[0] || null;
}

// Get ticker for a symbol
router.get('/ticker/:symbol', async (req, res) => {
  try {
    const exchange = resolveExchange(req.params.symbol, req.query.exchange);
    const connector = new MultiExchangeConnector(exchange, isTestnet(exchange));
    const ticker = await connector.getTicker(req.params.symbol.toUpperCase());

    res.json({ ticker, exchange });
  } catch (error) {
    logger.error('Get ticker error:', error);
    res.status(500).json({ error: 'Failed to get ticker' });
  }
});

// Get order book
router.get('/orderbook/:symbol', async (req, res) => {
  try {
    const { limit = 100, exchange: exQ } = req.query;
    const exchange = resolveExchange(req.params.symbol, exQ);
    const connector = new MultiExchangeConnector(exchange, isTestnet(exchange));
    const orderBook = await connector.getOrderBook(req.params.symbol.toUpperCase(), parseInt(limit));
    
    res.json({ orderBook });
  } catch (error) {
    logger.error('Get orderbook error:', error);
    res.status(500).json({ error: 'Failed to get order book' });
  }
});

// Get klines/candlestick data
router.get('/klines/:symbol', async (req, res) => {
  try {
    const { interval = '1h', limit = 200, exchange: exQ } = req.query;
    const symbol = req.params.symbol.toUpperCase();
    const exchange = resolveExchange(symbol, exQ);
    const connector = new MultiExchangeConnector(exchange, isTestnet(exchange));

    let raw;
    try {
      raw = await connector.getKlines(symbol, interval, parseInt(limit));
    } catch (providerError) {
      if (exchange !== 'oanda') throw providerError;
      raw = await getMarketCandles(symbol, interval, parseInt(limit));
    }

    // Normalise: multi-exchange getKlines already returns objects; Binance returns arrays
    const klines = raw.map(k => {
      if (Array.isArray(k)) {
        return {
          timestamp: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        };
      }
      return {
        timestamp: typeof k.timestamp === 'number' ? k.timestamp : Number(k.timestamp),
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume ?? 0),
      };
    });

    res.json({ klines, exchange, symbol });
  } catch (error) {
    logger.error('Get klines error:', error);
    res.status(500).json({ error: 'Failed to get klines', detail: error.message });
  }
});

// Get account balance (requires API key)
router.get('/balance', authenticate, async (req, res) => {
  try {
    const saved = getActiveExchange(req.user, req.query.exchange);
    if (!saved) {
      return res.status(400).json({ success: false, error: 'No exchange connection configured' });
    }

    const connector = new MultiExchangeConnector(saved.name, saved.isTestnet);
    connector.setCredentials(saved.apiKey, saved.apiSecret, saved.passphrase);
    const balances = await connector.getAccount();

    res.json({ success: true, exchange: saved.name, balances });
  } catch (error) {
    logger.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// List saved exchange connections
router.get('/connections', authenticate, async (req, res) => {
  try {
    const saved = (req.user.exchanges || []).map(sanitizeExchange);
    const savedByName = new Map(saved.map(connection => [connection.name, connection]));

    res.json({
      success: true,
      supported: SUPPORTED_TRADING_VENUES.map(name => ({
        name,
        ...VENUE_DETAILS[name],
        configured: savedByName.has(name),
        connection: savedByName.get(name) || null
      })),
      connections: saved
    });
  } catch (error) {
    logger.error('List exchange connections error:', error);
    res.status(500).json({ success: false, error: 'Failed to list exchange connections' });
  }
});

// Save an exchange connection
router.post('/connections', authenticate, async (req, res) => {
  try {
    const {
      name = 'binance',
      apiKey = '',
      apiSecret = '',
      passphrase = '',
      isTestnet = true,
      isActive = true,
      testConnection = false
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Exchange name is required' });
    }
    const normalizedName = name.trim().toLowerCase();
    if (!SUPPORTED_TRADING_VENUES.includes(normalizedName)) {
      return res.status(400).json({ success: false, error: 'Unsupported exchange or broker' });
    }

    const existing = req.user.exchanges.find(exchange => exchange.name === normalizedName);
    const nextConnection = {
      name: normalizedName,
      apiKey,
      apiSecret,
      passphrase,
      isTestnet: Boolean(isTestnet),
      isActive: Boolean(isActive)
    };

    if (existing) {
      existing.set(nextConnection);
    } else {
      req.user.exchanges.push(nextConnection);
    }

    const exchange = existing || req.user.exchanges[req.user.exchanges.length - 1];

    let testResult = null;
    if (testConnection) {
      const connector = new MultiExchangeConnector(normalizedName, Boolean(isTestnet));
      connector.setCredentials(apiKey, apiSecret, passphrase);
      testResult = await connector.getAccount();
    }

    await req.user.save();

    res.status(existing ? 200 : 201).json({
      success: true,
      connection: sanitizeExchange(exchange),
      testResult
    });
  } catch (error) {
    logger.error('Save exchange connection error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Activate a saved exchange connection
router.post('/connections/:id/activate', authenticate, async (req, res) => {
  try {
    const exchange = req.user.exchanges.id(req.params.id);
    if (!exchange) {
      return res.status(404).json({ success: false, error: 'Exchange connection not found' });
    }

    exchange.isActive = true;
    await req.user.save();

    res.json({ success: true, connection: sanitizeExchange(exchange) });
  } catch (error) {
    logger.error('Activate exchange connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deactivate a saved exchange connection
router.post('/connections/:id/deactivate', authenticate, async (req, res) => {
  try {
    const exchange = req.user.exchanges.id(req.params.id);
    if (!exchange) {
      return res.status(404).json({ success: false, error: 'Exchange connection not found' });
    }

    exchange.isActive = false;
    await req.user.save();

    res.json({ success: true, connection: sanitizeExchange(exchange) });
  } catch (error) {
    logger.error('Deactivate exchange connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a saved exchange connection
router.delete('/connections/:id', authenticate, async (req, res) => {
  try {
    const exchange = req.user.exchanges.id(req.params.id);
    if (!exchange) {
      return res.status(404).json({ success: false, error: 'Exchange connection not found' });
    }

    req.user.exchanges.pull(req.params.id);
    await req.user.save();

    res.json({ success: true, message: 'Exchange connection removed' });
  } catch (error) {
    logger.error('Delete exchange connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test connection with API keys
router.post('/test-connection', authenticate, async (req, res) => {
  try {
    const { exchange = 'binance', apiKey, apiSecret, passphrase = '', isTestnet } = req.body;
    
    if (exchange === 'binance') {
      const connector = new ExchangeConnector('binance', isTestnet);
      connector.setCredentials(apiKey, apiSecret);
    
      const account = await connector.getAccount();
      return res.json({
        success: true,
        message: 'Connection successful',
        accountType: account.accountType,
        canTrade: account.canTrade
      });
    }

    const connector = new MultiExchangeConnector(exchange, isTestnet);
    connector.setCredentials(apiKey, apiSecret, passphrase);
    const account = await connector.getAccount();
    
    res.json({
      success: true,
      message: 'Connection successful',
      exchange,
      account
    });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(400).json({
      success: false,
      error: 'Connection failed',
      message: error.message
    });
  }
});

// Get available trading pairs
router.get('/pairs', async (req, res) => {
  try {
    const connector = new ExchangeConnector('binance', true);
    
    // Return common trading pairs
    const pairs = {
      crypto: [
        { symbol: 'BTCUSDT', name: 'Bitcoin', base: 'BTC', quote: 'USDT' },
        { symbol: 'ETHUSDT', name: 'Ethereum', base: 'ETH', quote: 'USDT' },
        { symbol: 'SOLUSDT', name: 'Solana', base: 'SOL', quote: 'USDT' },
        { symbol: 'BNBUSDT', name: 'BNB', base: 'BNB', quote: 'USDT' },
        { symbol: 'ADAUSDT', name: 'Cardano', base: 'ADA', quote: 'USDT' },
        { symbol: 'DOTUSDT', name: 'Polkadot', base: 'DOT', quote: 'USDT' },
        { symbol: 'XRPUSDT', name: 'Ripple', base: 'XRP', quote: 'USDT' },
        { symbol: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE', quote: 'USDT' }
      ],
      forex: [
        { symbol: 'EURUSD', name: 'EUR/USD', base: 'EUR', quote: 'USD' },
        { symbol: 'GBPUSD', name: 'GBP/USD', base: 'GBP', quote: 'USD' },
        { symbol: 'USDJPY', name: 'USD/JPY', base: 'USD', quote: 'JPY' },
        { symbol: 'AUDUSD', name: 'AUD/USD', base: 'AUD', quote: 'USD' },
        { symbol: 'USDCAD', name: 'USD/CAD', base: 'USD', quote: 'CAD' },
        { symbol: 'USDCHF', name: 'USD/CHF', base: 'USD', quote: 'CHF' }
      ],
      commodity: [
        { symbol: 'XAUUSD', name: 'Gold', base: 'XAU', quote: 'USD' },
        { symbol: 'XAGUSD', name: 'Silver', base: 'XAG', quote: 'USD' },
        { symbol: 'USOIL', name: 'WTI Oil', base: 'USOIL', quote: 'USD' },
        { symbol: 'UKOIL', name: 'Brent Oil', base: 'UKOIL', quote: 'USD' }
      ]
    };
    
    res.json({ pairs });
  } catch (error) {
    logger.error('Get pairs error:', error);
    res.status(500).json({ error: 'Failed to get trading pairs' });
  }
});

export default router;
