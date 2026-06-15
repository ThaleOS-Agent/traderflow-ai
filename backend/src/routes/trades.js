import express from 'express';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';
import { MultiExchangeConnector } from '../services/exchanges/multiExchange.js';
import { metatraderAccountService } from '../services/metatraderAccountService.js';
import { recalculatePortfolio, toObjectId } from '../utils/portfolio.js';

const router = express.Router();

function activeExchange(user) {
  const exchanges = user.getDecryptedExchanges?.() || [];
  return exchanges.find(exchange => exchange.isActive) || exchanges[0] || null;
}

function brokerAsset(assetType) {
  return assetType === 'forex' || assetType === 'commodity';
}

// Get all trades
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const allowedStatuses = ['pending', 'open', 'closed', 'cancelled', 'failed'];
    
    const query = { userId: req.userId };
    if (status !== undefined) {
      if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      query.status = status;
    }
    
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
          userId: toObjectId(req.userId),
          openedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } },
          losingTrades: { $sum: { $cond: [{ $lt: ['$profit', 0] }, 1, 0] } },
          totalProfit: { $sum: { $cond: [{ $gt: ['$profit', 0] }, '$profit', 0] } },
          totalLoss: { $sum: { $cond: [{ $lt: ['$profit', 0] }, '$profit', 0] } },
          netProfit: { $sum: '$profit' },
          avgProfit: { $avg: { $cond: [{ $gt: ['$profit', 0] }, '$profit', null] } },
          avgLoss: { $avg: { $cond: [{ $lt: ['$profit', 0] }, '$profit', null] } }
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
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const paperTrade = isPaperTrade !== false || user.tradingSettings?.paperTrading !== false;
    let execution = null;

    if (!paperTrade) {
      if (brokerAsset(assetType)) {
        if (!(user.metatraderAccounts || []).length) {
          return res.status(400).json({ error: 'Live forex/commodity execution requires a saved MT4/MT5 connection' });
        }
        execution = await metatraderAccountService.placeOrder(user, req.body.metatraderAccountId, {
          symbol,
          side: side.toUpperCase(),
          volume: quantity,
          stopLoss,
          takeProfit,
          comment: 'TradeFlow manual trade'
        });
      } else {
        const exchange = activeExchange(user);
        if (!exchange) {
          return res.status(400).json({ error: 'Live crypto/stock execution requires a saved exchange connection' });
        }

        const connector = new MultiExchangeConnector(exchange.name, exchange.isTestnet);
        connector.setCredentials(exchange.apiKey, exchange.apiSecret, exchange.passphrase);
        execution = await connector.createOrder({
          symbol,
          side,
          type: orderType,
          quantity,
          price: orderType === 'market' ? undefined : entryPrice
        });
      }
    }
    
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
      status: paperTrade || execution ? 'open' : 'pending',
      orderType,
      exchange: brokerAsset(assetType) ? 'metatrader' : activeExchange(user)?.name || 'paper',
      exchangeOrderId: execution?.orderId || execution?.orderId?.toString?.() || execution?.id || execution?.orderFillTransaction?.id || null,
      isAutoTrade: false,
      isPaperTrade: paperTrade,
      strategy: 'manual',
      metadata: {
        execution
      }
    });
    
    await trade.save();
    const portfolio = await recalculatePortfolio(req.userId);

    tradingEngine.broadcast('tradeExecuted', {
      userId: req.userId,
      trade: trade.toJSON(),
      isPaperTrade: paperTrade
    });
    tradingEngine.broadcast('orderExecuted', {
      userId: req.userId,
      order: trade.toJSON(),
      isPaperTrade: paperTrade
    });
    tradingEngine.broadcast('portfolio_update', {
      userId: req.userId,
      portfolio
    });
    
    res.status(201).json({
      message: paperTrade ? 'Paper trade created' : 'Live trade executed',
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
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let closeExecution = null;
    if (!trade.isPaperTrade) {
      if (trade.exchange === 'metatrader') {
        if (!trade.exchangeOrderId) {
          return res.status(400).json({ error: 'Cannot close MT4/MT5 trade without broker position ID' });
        }
        closeExecution = await metatraderAccountService.closePosition(user, req.body.metatraderAccountId, trade.exchangeOrderId);
      } else {
        const exchange = activeExchange(user);
        if (!exchange) {
          return res.status(400).json({ error: 'Live close requires an active exchange connection' });
        }

        const connector = new MultiExchangeConnector(exchange.name, exchange.isTestnet);
        connector.setCredentials(exchange.apiKey, exchange.apiSecret, exchange.passphrase);
        closeExecution = await connector.createOrder({
          symbol: trade.symbol,
          side: trade.side === 'buy' ? 'sell' : 'buy',
          type: 'market',
          quantity: trade.quantity
        });
      }
    }

    if (closeExecution) {
      trade.metadata = {
        ...(trade.metadata || {}),
        closeExecution
      };
    }

    // Get current price from market data
    const marketData = tradingEngine.marketData.get(trade.symbol);
    const exitPrice = marketData?.currentPrice || trade.entryPrice;
    
    // Close trade
    await tradingEngine.closeTrade(trade, exitPrice, 'manual_close');

    const portfolio = await recalculatePortfolio(req.userId);
    tradingEngine.broadcast('portfolio_update', {
      userId: req.userId,
      portfolio
    });
    
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
    const portfolio = await recalculatePortfolio(req.userId);

    tradingEngine.broadcast('orderClosed', {
      userId: req.userId,
      order: trade.toJSON()
    });
    tradingEngine.broadcast('portfolio_update', {
      userId: req.userId,
      portfolio
    });
    
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
          userId: toObjectId(req.userId),
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
