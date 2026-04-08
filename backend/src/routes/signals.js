import express from 'express';
import { Signal } from '../models/Signal.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';

const router = express.Router();

// Get all signals
router.get('/', async (req, res) => {
  try {
    const { status, symbol, strategy, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (symbol) query.symbol = symbol.toUpperCase();
    if (strategy) query.strategy = strategy;
    
    const signals = await Signal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Signal.countDocuments(query);
    
    res.json({
      signals,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get signals error:', error);
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

// Get active signals
router.get('/active', async (req, res) => {
  try {
    const signals = await Signal.find({
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ confidenceScore: -1, createdAt: -1 });
    
    res.json({ signals });
  } catch (error) {
    logger.error('Get active signals error:', error);
    res.status(500).json({ error: 'Failed to get active signals' });
  }
});

// Get signal by ID
router.get('/:id', async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    res.json({ signal });
  } catch (error) {
    logger.error('Get signal error:', error);
    res.status(500).json({ error: 'Failed to get signal' });
  }
});

// Execute one-click trade from signal
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { customParams } = req.body;
    
    // Ensure user is registered with trading engine
    if (!tradingEngine.userBots.has(req.userId)) {
      await tradingEngine.registerUser(req.userId);
    }
    
    const result = await tradingEngine.executeOneClickTrade(
      req.userId,
      req.params.id,
      customParams
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Trade executed successfully'
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Execute signal trade error:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

// Copy trade (alias for execute)
router.post('/:id/copy', authenticateToken, async (req, res) => {
  try {
    // Ensure user is registered with trading engine
    if (!tradingEngine.userBots.has(req.userId)) {
      await tradingEngine.registerUser(req.userId);
    }
    
    const result = await tradingEngine.executeOneClickTrade(
      req.userId,
      req.params.id
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Trade copied successfully'
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Copy trade error:', error);
    res.status(500).json({ error: 'Failed to copy trade' });
  }
});

// Get signal statistics
router.get('/stats/performance', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const startDate = new Date();
    if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '90d') startDate.setDate(startDate.getDate() - 90);
    
    const stats = await Signal.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['executed', 'hit_sl', 'hit_tp'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSignals: { $sum: 1 },
          winningSignals: {
            $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] }
          },
          losingSignals: {
            $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$confidenceScore' },
          byStrategy: {
            $push: {
              strategy: '$strategy',
              result: '$result',
              profit: '$profit'
            }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalSignals: 0,
      winningSignals: 0,
      losingSignals: 0,
      avgConfidence: 0
    };
    
    result.winRate = result.totalSignals > 0
      ? (result.winningSignals / result.totalSignals * 100).toFixed(2)
      : 0;
    
    res.json({ stats: result });
  } catch (error) {
    logger.error('Get signal stats error:', error);
    res.status(500).json({ error: 'Failed to get signal statistics' });
  }
});

export default router;
