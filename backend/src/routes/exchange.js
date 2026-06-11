import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { ExchangeConnector } from '../services/exchangeConnector.js';
import { MultiExchangeConnector } from '../services/exchanges/multiExchange.js';

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

    const raw = await connector.getKlines(symbol, interval, parseInt(limit));

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
    // This would require user's API key
    // For now, return mock data
    res.json({
      balances: [
        { asset: 'USDT', free: 10000, locked: 0 },
        { asset: 'BTC', free: 0.5, locked: 0 },
        { asset: 'ETH', free: 5, locked: 0 }
      ]
    });
  } catch (error) {
    logger.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Test connection with API keys
router.post('/test-connection', authenticate, async (req, res) => {
  try {
    const { apiKey, apiSecret, isTestnet } = req.body;
    
    const connector = new ExchangeConnector('binance', isTestnet);
    connector.setCredentials(apiKey, apiSecret);
    
    // Test by getting account info
    const account = await connector.getAccount();
    
    res.json({
      success: true,
      message: 'Connection successful',
      accountType: account.accountType,
      canTrade: account.canTrade
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
