import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { patternScanner } from '../services/patternScanner.js';
import { harmonicDetector } from '../services/harmonicPatterns.js';

const router = express.Router();

// Get all active patterns
router.get('/active', async (req, res) => {
  try {
    const patterns = patternScanner.getActivePatterns();
    res.json({ patterns });
  } catch (error) {
    logger.error('Get active patterns error:', error);
    res.status(500).json({ error: 'Failed to get active patterns' });
  }
});

// Get pattern history
router.get('/history', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const history = patternScanner.getPatternHistory(parseInt(limit));
    res.json({ history });
  } catch (error) {
    logger.error('Get pattern history error:', error);
    res.status(500).json({ error: 'Failed to get pattern history' });
  }
});

// Get pattern statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = patternScanner.getPatternStats();
    res.json({ stats });
  } catch (error) {
    logger.error('Get pattern stats error:', error);
    res.status(500).json({ error: 'Failed to get pattern statistics' });
  }
});

// Get pattern configuration
router.get('/config', async (req, res) => {
  try {
    const config = harmonicDetector.getPatternStats();
    res.json({ config });
  } catch (error) {
    logger.error('Get pattern config error:', error);
    res.status(500).json({ error: 'Failed to get pattern configuration' });
  }
});

// Scan specific symbol for patterns
router.post('/scan/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.body;
    
    const ExchangeConnector = (await import('../services/exchangeConnector.js')).ExchangeConnector;
    const connector = new ExchangeConnector('binance', true);
    
    const klines = await connector.getKlines(symbol.toUpperCase(), timeframe, 100);
    
    const prices = klines.map(k => parseFloat(k[4]));
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    
    const patterns = harmonicDetector.scan(prices, highs, lows);
    
    res.json({ 
      symbol: symbol.toUpperCase(),
      timeframe,
      patternsFound: patterns.length,
      patterns
    });
  } catch (error) {
    logger.error('Pattern scan error:', error);
    res.status(500).json({ error: 'Failed to scan for patterns' });
  }
});

// Execute trade from pattern
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const patterns = patternScanner.getActivePatterns();
    const pattern = patterns.find(p => p.id === id);
    
    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found or expired' });
    }
    
    // Import trading engine
    const { tradingEngine } = await import('../server.js');
    
    // Create signal from pattern
    const signal = {
      symbol: pattern.symbol,
      assetType: 'crypto',
      side: pattern.direction === 'bullish' ? 'buy' : 'sell',
      entryPrice: pattern.entryPrice,
      stopLoss: pattern.stopLoss,
      takeProfit: pattern.targets[1], // Use second target
      confidence: pattern.confidence > 80 ? 'high' : pattern.confidence > 60 ? 'medium' : 'low',
      confidenceScore: pattern.confidence,
      strategy: `harmonic_${pattern.patternType.toLowerCase()}`,
      timeframe: pattern.timeframe,
      analysis: `${pattern.patternType} ${pattern.direction} pattern detected with ${pattern.confidence.toFixed(1)}% confidence. ` +
                `Fibonacci ratios: AB/XA=${pattern.ratios.AB_XA.toFixed(3)}, ` +
                `BC/AB=${pattern.ratios.BC_AB.toFixed(3)}, ` +
                `CD/BC=${pattern.ratios.CD_BC.toFixed(3)}`,
      metadata: {
        patternType: pattern.patternType,
        ratios: pattern.ratios,
        targets: pattern.targets
      }
    };
    
    // Execute trade
    const result = await tradingEngine.executeOneClickTrade(req.userId, null, signal);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Trade executed based on ${pattern.patternType} pattern`,
        signal
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Pattern trade execution error:', error);
    res.status(500).json({ error: 'Failed to execute pattern trade' });
  }
});

export default router;
