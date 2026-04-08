import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { ExchangeConnector } from '../services/exchangeConnector.js';

const router = express.Router();

// Get ticker for a symbol
router.get('/ticker/:symbol', async (req, res) => {
  try {
    const connector = new ExchangeConnector('binance', true);
    const ticker = await connector.getTicker(req.params.symbol.toUpperCase());
    
    res.json({ ticker });
  } catch (error) {
    logger.error('Get ticker error:', error);
    res.status(500).json({ error: 'Failed to get ticker' });
  }
});

// Get order book
router.get('/orderbook/:symbol', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const connector = new ExchangeConnector('binance', true);
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
    const { interval = '1h', limit = 100 } = req.query;
    const connector = new ExchangeConnector('binance', true);
    const klines = await connector.getKlines(
      req.params.symbol.toUpperCase(),
      interval,
      parseInt(limit)
    );
    
    // Format klines
    const formattedKlines = klines.map(k => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
      quoteVolume: parseFloat(k[7]),
      trades: k[8]
    }));
    
    res.json({ klines: formattedKlines });
  } catch (error) {
    logger.error('Get klines error:', error);
    res.status(500).json({ error: 'Failed to get klines' });
  }
});

// Get account balance (requires API key)
router.get('/balance', authenticateToken, async (req, res) => {
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
router.post('/test-connection', authenticateToken, async (req, res) => {
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
