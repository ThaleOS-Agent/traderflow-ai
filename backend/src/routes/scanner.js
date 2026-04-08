import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { assetScanner } from '../server.js';

const router = express.Router();

// Get scanner status
router.get('/status', async (req, res) => {
  try {
    const stats = assetScanner.getStats();
    res.json({
      status: assetScanner.isRunning ? 'running' : 'stopped',
      stats,
      config: assetScanner.config
    });
  } catch (error) {
    logger.error('Get scanner status error:', error);
    res.status(500).json({ error: 'Failed to get scanner status' });
  }
});

// Get all tracked assets
router.get('/assets', async (req, res) => {
  try {
    const { exchange, limit = 100 } = req.query;
    
    let assets = assetScanner.getAllAssets();
    
    if (exchange) {
      assets = assets.filter(a => a.exchange === exchange);
    }
    
    res.json({
      total: assets.length,
      assets: assets.slice(0, parseInt(limit))
    });
  } catch (error) {
    logger.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// Get active opportunities
router.get('/opportunities', async (req, res) => {
  try {
    const { minConfidence = 70, limit = 50 } = req.query;
    
    const opportunities = assetScanner.getOpportunities(parseInt(minConfidence));
    
    res.json({
      total: opportunities.length,
      opportunities: opportunities.slice(0, parseInt(limit))
    });
  } catch (error) {
    logger.error('Get opportunities error:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

// Manually trigger scan
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    // Trigger scan in background
    assetScanner.scanAllAssets();
    
    res.json({
      message: 'Scan triggered',
      status: 'scanning'
    });
  } catch (error) {
    logger.error('Manual scan error:', error);
    res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

// Scan specific symbol
router.post('/scan/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.body;
    
    const MultiExchangeConnector = (await import('../services/exchanges/multiExchange.js')).MultiExchangeConnector;
    const connector = new MultiExchangeConnector(exchange, true);
    
    const klines = await connector.getKlines(symbol.toUpperCase(), '1h', 100);
    
    res.json({
      symbol: symbol.toUpperCase(),
      exchange,
      dataPoints: klines.length,
      message: 'Data retrieved'
    });
  } catch (error) {
    logger.error('Symbol scan error:', error);
    res.status(500).json({ error: 'Failed to scan symbol' });
  }
});

// Get top opportunities by strategy
router.get('/opportunities/by-strategy', async (req, res) => {
  try {
    const opportunities = assetScanner.getOpportunities(70);
    
    const byStrategy = {};
    for (const opp of opportunities) {
      const strategy = opp.strategy || 'unknown';
      if (!byStrategy[strategy]) {
        byStrategy[strategy] = [];
      }
      byStrategy[strategy].push(opp);
    }
    
    res.json({ byStrategy });
  } catch (error) {
    logger.error('Get opportunities by strategy error:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

// Get opportunities by exchange
router.get('/opportunities/by-exchange', async (req, res) => {
  try {
    const opportunities = assetScanner.getOpportunities(70);
    
    const byExchange = {};
    for (const opp of opportunities) {
      const exchange = opp.exchange || 'unknown';
      if (!byExchange[exchange]) {
        byExchange[exchange] = [];
      }
      byExchange[exchange].push(opp);
    }
    
    res.json({ byExchange });
  } catch (error) {
    logger.error('Get opportunities by exchange error:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

export default router;
