import express from 'express';
import { Trade } from '../models/Trade.js';
import { Signal } from '../models/Signal.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';
import { getLiveMarketFeed, getMarketFeedSymbols } from '../services/marketFeedService.js';
import { mlPredictor } from '../services/mlPredictor.js';

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

// Get normalized cross-asset live market feed
router.get('/live-feed', async (req, res) => {
  try {
    const { category = 'all' } = req.query;
    const marketData = await getLiveMarketFeed(String(category));

    res.json({
      success: true,
      symbols: getMarketFeedSymbols(),
      marketData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get live feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to get live market feed' });
  }
});

// Get strategy performance/results for dashboard cards
router.get('/strategy-results', authenticateToken, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.userId }).sort({ openedAt: -1 }).limit(500);
    const signals = await Signal.find({}).sort({ createdAt: -1 }).limit(500);
    const strategyMap = new Map();

    const ensure = (name) => {
      const key = name || 'unknown';
      if (!strategyMap.has(key)) {
        strategyMap.set(key, {
          strategy: key,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          openTrades: 0,
          pnl: 0,
          avgProfitPercent: 0,
          activeSignals: 0,
          avgConfidence: 0,
          latestSignal: null,
        });
      }
      return strategyMap.get(key);
    };

    for (const trade of trades) {
      const row = ensure(trade.strategy);
      row.totalTrades += 1;
      row.pnl += Number(trade.profit || 0);
      row.avgProfitPercent += Number(trade.profitPercent || 0);
      if (trade.status === 'open' || trade.status === 'pending') row.openTrades += 1;
      if (Number(trade.profit || 0) > 0) row.winningTrades += 1;
      if (Number(trade.profit || 0) < 0) row.losingTrades += 1;
    }

    for (const signal of signals) {
      const row = ensure(signal.strategy);
      if (signal.status === 'active') row.activeSignals += 1;
      row.avgConfidence += Number(signal.confidenceScore || 0);
      if (!row.latestSignal || new Date(signal.createdAt) > new Date(row.latestSignal.createdAt)) {
        row.latestSignal = {
          symbol: signal.symbol,
          side: signal.side,
          confidenceScore: signal.confidenceScore,
          analysis: signal.analysis,
          createdAt: signal.createdAt,
        };
      }
    }

    const signalCounts = signals.reduce((acc, signal) => {
      acc[signal.strategy] = (acc[signal.strategy] || 0) + 1;
      return acc;
    }, {});

    const results = Array.from(strategyMap.values()).map((row) => {
      const closedTrades = row.winningTrades + row.losingTrades;
      const signalCount = signalCounts[row.strategy] || 0;
      return {
        ...row,
        winRate: closedTrades ? (row.winningTrades / closedTrades) * 100 : 0,
        avgProfitPercent: row.totalTrades ? row.avgProfitPercent / row.totalTrades : 0,
        avgConfidence: signalCount ? row.avgConfidence / signalCount : 0,
      };
    }).sort((a, b) => b.activeSignals - a.activeSignals || b.pnl - a.pnl);

    res.json({ success: true, results });
  } catch (error) {
    logger.error('Get strategy results error:', error);
    res.status(500).json({ success: false, error: 'Failed to get strategy results' });
  }
});

// Get compact AI/ML learning status for dashboard
router.get('/ai-learning', authenticateToken, async (req, res) => {
  try {
    const performance = mlPredictor.getPerformance();
    const recentSignals = await Signal.find({}).sort({ createdAt: -1 }).limit(25);
    const avgConfidence = recentSignals.length
      ? recentSignals.reduce((sum, signal) => sum + Number(signal.confidenceScore || 0), 0) / recentSignals.length
      : 0;

    res.json({
      success: true,
      performance,
      learning: {
        mode: 'online-simulated',
        recentSignals: recentSignals.length,
        avgSignalConfidence: avgConfidence,
        lastTraining: performance.lastTraining,
        trackedAssetTypes: performance.models?.map((model) => model.assetType) ?? [],
      },
      models: performance.models ?? [],
    });
  } catch (error) {
    logger.error('Get AI learning error:', error);
    res.status(500).json({ success: false, error: 'Failed to get AI learning status' });
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
