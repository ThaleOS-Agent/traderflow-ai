import express from 'express';
import { mlTrainingService } from '../services/mlTrainingService.js';
import { ensembleMaster } from '../services/ensembleMasterStrategy.js';
import { authenticate, hasAdminAccess } from '../middleware/auth.js';
import { Signal } from '../models/Signal.js';
import { tradingEngine } from '../server.js';

const router = express.Router();

function buildMarketData(symbol, marketData = {}) {
  const currentPrice = Number(marketData.currentPrice || marketData.price || (symbol.includes('ETH') ? 3000 : 65000));
  const prices = Array.isArray(marketData.prices) && marketData.prices.length
    ? marketData.prices.map(Number)
    : Array.from({ length: 60 }, (_, index) => currentPrice * (1 + Math.sin(index / 8) * 0.015 + (index - 30) * 0.0005));

  return {
    symbol,
    currentPrice,
    prices,
    volumes: Array.isArray(marketData.volumes) && marketData.volumes.length
      ? marketData.volumes.map(Number)
      : Array.from({ length: prices.length }, (_, index) => 1000 + index * 20),
    highs: Array.isArray(marketData.highs) && marketData.highs.length
      ? marketData.highs.map(Number)
      : prices.map(price => price * 1.01),
    lows: Array.isArray(marketData.lows) && marketData.lows.length
      ? marketData.lows.map(Number)
      : prices.map(price => price * 0.99),
    volatility: Number(marketData.volatility || 0.02),
    momentum: Number(marketData.momentum || 0.4),
  };
}

/**
 * @route POST /api/training/start
 * @desc Start ML training for all bots/agents
 * @access Private/Admin
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    if (!hasAdminAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await mlTrainingService.startTraining();
    
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
 * @route GET /api/training/status
 * @desc Get training status
 * @access Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = mlTrainingService.getTrainingStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/training/weights
 * @desc Get optimized strategy weights
 * @access Private
 */
router.get('/weights', authenticate, async (req, res) => {
  try {
    const weights = mlTrainingService.getOptimizedWeights();
    
    res.json({
      success: true,
      weights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/training/apply
 * @desc Apply trained weights to ensemble master
 * @access Private/Admin
 */
router.post('/apply', authenticate, async (req, res) => {
  try {
    if (!hasAdminAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await mlTrainingService.applyTrainedWeights();
    
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
 * @route POST /api/training/deploy-master
 * @desc Deploy ensemble master strategy
 * @access Private/Admin
 */
router.post('/deploy-master', authenticate, async (req, res) => {
  try {
    if (!hasAdminAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await ensembleMaster.deployMasterStrategy();
    
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
 * @route POST /api/training/generate-signal
 * @desc Generate ensemble signal for a symbol
 * @access Private
 */
router.post('/generate-signal', authenticate, async (req, res) => {
  try {
    const { symbol, marketData, assetType = 'crypto', persist = true } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol required'
      });
    }
    
    const normalizedSymbol = String(symbol).trim().toUpperCase();
    const enrichedMarketData = buildMarketData(normalizedSymbol, marketData || {});
    const rawSignal = await ensembleMaster.generateEnsembleSignal(normalizedSymbol, enrichedMarketData);
    const side = rawSignal.action === 'sell' ? 'sell' : 'buy';
    const entryPrice = enrichedMarketData.currentPrice;
    const confidenceScore = Math.max(70, Math.round((rawSignal.confidence || 0.75) * 100));
    const signal = {
      symbol: normalizedSymbol,
      assetType,
      side,
      entryPrice,
      stopLoss: side === 'buy' ? entryPrice * 0.98 : entryPrice * 1.02,
      takeProfit: side === 'buy' ? entryPrice * 1.04 : entryPrice * 0.96,
      confidence: confidenceScore >= 85 ? 'high' : 'medium',
      confidenceScore,
      strategy: 'ensemble_master',
      timeframe: '1h',
      analysis: rawSignal.reasoning || 'Generated by Ensemble Master AI learning model',
      metadata: {
        rawSignal,
        generatedBy: 'training.generate-signal'
      }
    };

    let savedSignal = null;
    if (persist) {
      savedSignal = await Signal.create({
        signalId: `AI_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...signal,
        currentPrice: entryPrice,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      tradingEngine.broadcast('newSignal', savedSignal.toJSON());
      if (tradingEngine.agentOrchestrator) {
        await tradingEngine.agentOrchestrator.processSignal(savedSignal.toObject(), 'training.generate-signal');
      } else {
        await tradingEngine.checkAutoTrading(savedSignal.toObject());
      }
    }
    
    res.json({
      success: true,
      signal: savedSignal?.toJSON?.() || signal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
