import express from 'express';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';

const router = express.Router();

// Get all trades
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const query = { userId: req.userId };
    if (status) query.status = status;
    
    const trades = await Trade.find(query)
      .sort({ openedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Trade.countDocuments(query);
    
    res.json({
      trades,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get trades error:', error);
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

// Get trade by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    res.json({ trade });
  } catch (error) {
    logger.error('Get trade error:', error);
    res.status(500).json({ error: 'Failed to get trade' });
  }
});

// Create manual trade
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      symbol,
      assetType,
      side,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      orderType = 'market',
      isPaperTrade
    } = req.body;
    
    const user = await User.findById(req.userId);
    
    // Create trade
    const trade = new Trade({
      userId: req.userId,
      symbol,
      assetType,
      side,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      status: 'pending',
      orderType,
      isAutoTrade: false,
      isPaperTrade: isPaperTrade !== false || user.tradingSettings?.paperTrading !== false,
      strategy: 'manual'
    });
    
    await trade.save();
    
    // Execute trade through exchange connector
    // (Implementation would go here)
    
    res.status(201).json({
      message: 'Trade created',
      trade
    });
  } catch (error) {
    logger.error('Create trade error:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Close trade
router.post('/:id/close', authenticateToken, async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: { $in: ['open', 'pending'] }
    });
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found or already closed' });
    }
    
    // Get current price from market data
    const marketData = tradingEngine.marketData.get(trade.symbol);
    const exitPrice = marketData?.currentPrice || trade.entryPrice;
    
    // Close trade
    await tradingEngine.closeTrade(trade, exitPrice, 'manual_close');
    
    res.json({
      message: 'Trade closed',
      trade
    });
  } catch (error) {
    logger.error('Close trade error:', error);
    res.status(500).json({ error: 'Failed to close trade' });
  }
});

// Cancel pending trade
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending'
    });
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found or not pending' });
    }
    
    trade.status = 'cancelled';
    await trade.save();
    
    res.json({
      message: 'Trade cancelled',
      trade
    });
  } catch (error) {
    logger.error('Cancel trade error:', error);
    res.status(500).json({ error: 'Failed to cancel trade' });
  }
});

// Get trade statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const startDate = new Date();
    if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '90d') startDate.setDate(startDate.getDate() - 90);
    else if (timeframe === '1y') startDate.setFullYear(startDate.getFullYear() - 1);
    
    const stats = await Trade.aggregate([
      {
        $match: {
          userId: req.userId,
          openedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: {
            $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] }
          },
          losingTrades: {
            $sum: { $cond: [{ $lt: ['$profit', 0] }, 1, 0] }
          },
          totalProfit: {
            $sum: { $cond: [{ $gt: ['$profit', 0] }, '$profit', 0] }
          },
          totalLoss: {
            $sum: { $cond: [{ $lt: ['$profit', 0] }, '$profit', 0] }
          },
          netProfit: { $sum: '$profit' },
          avgProfit: {
            $avg: { $cond: [{ $gt: ['$profit', 0] }, '$profit', null] }
          },
          avgLoss: {
            $avg: { $cond: [{ $lt: ['$profit', 0] }, '$profit', null] }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      avgProfit: 0,
      avgLoss: 0
    };
    
    result.winRate = result.totalTrades > 0 
      ? (result.winningTrades / result.totalTrades * 100).toFixed(2)
      : 0;
    
    result.profitFactor = Math.abs(result.totalLoss) > 0
      ? (result.totalProfit / Math.abs(result.totalLoss)).toFixed(2)
      : 0;
    
    res.json({ stats: result });
  } catch (error) {
    logger.error('Get trade stats error:', error);
    res.status(500).json({ error: 'Failed to get trade statistics' });
  }
});

export default router;
