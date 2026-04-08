import express from 'express';
import { Trade } from '../models/Trade.js';
import { Signal } from '../models/Signal.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';

const router = express.Router();

// Get dashboard overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Get open positions
    const openPositions = await Trade.find({
      userId: req.userId,
      status: { $in: ['open', 'pending'] }
    }).sort({ openedAt: -1 });
    
    // Get today's trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTrades = await Trade.find({
      userId: req.userId,
      openedAt: { $gte: today }
    });
    
    // Get recent signals
    const recentSignals = await Signal.find({
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ confidenceScore: -1 }).limit(10);
    
    // Calculate today's P&L
    const todayPnL = todayTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    
    // Get market data
    const marketData = Array.from(tradingEngine.marketData.entries()).map(([symbol, data]) => ({
      symbol,
      price: data.currentPrice,
      change24h: ((data.prices[data.prices.length - 1] - data.prices[data.prices.length - 24]) / data.prices[data.prices.length - 24] * 100).toFixed(2),
      assetType: data.assetType
    }));
    
    res.json({
      portfolio: user.portfolio,
      tradingSettings: user.tradingSettings,
      openPositions,
      openPositionsCount: openPositions.length,
      todayTradesCount: todayTrades.length,
      todayPnL: todayPnL.toFixed(2),
      recentSignals,
      marketData,
      engineStatus: tradingEngine.getStatus()
    });
  } catch (error) {
    logger.error('Get dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

// Get live market data
router.get('/market-data', async (req, res) => {
  try {
    const marketData = Array.from(tradingEngine.marketData.entries()).map(([symbol, data]) => ({
      symbol,
      price: data.currentPrice,
      prices: data.prices.slice(-24), // Last 24 data points
      volume: data.volumes[data.volumes.length - 1],
      high24h: Math.max(...data.prices.slice(-24)),
      low24h: Math.min(...data.prices.slice(-24)),
      change24h: ((data.prices[data.prices.length - 1] - data.prices[data.prices.length - 24]) / data.prices[data.prices.length - 24] * 100).toFixed(2),
      assetType: data.assetType,
      lastUpdated: data.lastUpdated
    }));
    
    res.json({ marketData });
  } catch (error) {
    logger.error('Get market data error:', error);
    res.status(500).json({ error: 'Failed to get market data' });
  }
});

// Get performance chart data
router.get('/performance-chart', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const startDate = new Date();
    if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '90d') startDate.setDate(startDate.getDate() - 90);
    else if (timeframe === '1y') startDate.setFullYear(startDate.getFullYear() - 1);
    
    const trades = await Trade.find({
      userId: req.userId,
      status: 'closed',
      closedAt: { $gte: startDate }
    }).sort({ closedAt: 1 });
    
    // Aggregate by date
    const dailyData = {};
    let cumulativeProfit = 0;
    
    trades.forEach(trade => {
      const date = trade.closedAt.toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          profit: 0,
          trades: 0,
          wins: 0,
          losses: 0
        };
      }
      
      dailyData[date].profit += trade.profit || 0;
      dailyData[date].trades++;
      
      if (trade.profit > 0) dailyData[date].wins++;
      else if (trade.profit < 0) dailyData[date].losses++;
    });
    
    // Convert to array and calculate cumulative
    const chartData = Object.values(dailyData).map(day => {
      cumulativeProfit += day.profit;
      return {
        ...day,
        cumulativeProfit: cumulativeProfit.toFixed(2)
      };
    });
    
    res.json({ chartData });
  } catch (error) {
    logger.error('Get performance chart error:', error);
    res.status(500).json({ error: 'Failed to get performance chart' });
  }
});

// Get asset allocation
router.get('/asset-allocation', authenticateToken, async (req, res) => {
  try {
    const openPositions = await Trade.find({
      userId: req.userId,
      status: { $in: ['open', 'pending'] }
    });
    
    const allocation = {};
    
    openPositions.forEach(trade => {
      const value = trade.entryPrice * trade.quantity;
      
      if (!allocation[trade.assetType]) {
        allocation[trade.assetType] = {
          type: trade.assetType,
          value: 0,
          positions: 0
        };
      }
      
      allocation[trade.assetType].value += value;
      allocation[trade.assetType].positions++;
    });
    
    res.json({ allocation: Object.values(allocation) });
  } catch (error) {
    logger.error('Get asset allocation error:', error);
    res.status(500).json({ error: 'Failed to get asset allocation' });
  }
});

// Get trading bot status
router.get('/bot-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const botConfig = tradingEngine.userBots.get(req.userId);
    
    res.json({
      autoTrading: user.tradingSettings?.autoTrading || false,
      paperTrading: user.tradingSettings?.paperTrading !== false,
      defaultStrategy: user.tradingSettings?.defaultStrategy || 'quantum_ai',
      isRegistered: !!botConfig,
      engineRunning: tradingEngine.isRunning
    });
  } catch (error) {
    logger.error('Get bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

// Get recent activity
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    // Get recent trades
    const recentTrades = await Trade.find({
      userId: req.userId
    }).sort({ openedAt: -1 }).limit(limit);
    
    // Get recent signals with auto-trades
    const recentSignals = await Signal.find({
      'autoTrades.userId': req.userId
    }).sort({ createdAt: -1 }).limit(limit);
    
    // Combine and format
    const activities = [
      ...recentTrades.map(trade => ({
        type: 'trade',
        action: trade.side,
        symbol: trade.symbol,
        quantity: trade.quantity,
        price: trade.entryPrice,
        profit: trade.profit,
        status: trade.status,
        isAutoTrade: trade.isAutoTrade,
        isPaperTrade: trade.isPaperTrade,
        timestamp: trade.openedAt
      })),
      ...recentSignals.map(signal => ({
        type: 'signal',
        action: signal.side,
        symbol: signal.symbol,
        confidence: signal.confidence,
        strategy: signal.strategy,
        timestamp: signal.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    
    res.json({ activities });
  } catch (error) {
    logger.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

export default router;
