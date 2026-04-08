import express from 'express';
import { arbitrageDetector } from '../services/arbitrageDetector.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/arbitrage/opportunities
 * @desc Get current arbitrage opportunities
 * @access Private
 */
router.get('/opportunities', authenticate, async (req, res) => {
  try {
    const { minProfit = 0 } = req.query;
    
    const opportunities = arbitrageDetector.getOpportunities(parseFloat(minProfit));
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/arbitrage/stats
 * @desc Get arbitrage detector statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = arbitrageDetector.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/arbitrage/execute
 * @desc Execute arbitrage opportunity
 * @access Private
 */
router.post('/execute', authenticate, async (req, res) => {
  try {
    const { opportunityId } = req.body;
    
    const result = await arbitrageDetector.executeArbitrage(opportunityId);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/arbitrage/exchanges
 * @desc Get supported exchanges for arbitrage
 * @access Private
 */
router.get('/exchanges', authenticate, async (req, res) => {
  try {
    const exchanges = [
      { name: 'binance', supported: true },
      { name: 'coinbase', supported: true },
      { name: 'kraken', supported: true },
      { name: 'kucoin', supported: true },
      { name: 'bybit', supported: true },
      { name: 'ftx', supported: true },
      { name: 'gemini', supported: true },
      { name: 'bitfinex', supported: true },
      { name: 'interactive_brokers', supported: true },
      { name: 'oanda', supported: true }
    ];
    
    res.json({
      success: true,
      exchanges
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
