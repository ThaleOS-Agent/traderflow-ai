import express from 'express';
import { mlPredictor } from '../services/mlPredictor.js';
import { agentOrchestrator } from '../services/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/ml/predict/price-direction
 * @desc Predict price direction for a symbol
 * @access Private
 */
router.post('/predict/price-direction', authenticate, async (req, res) => {
  try {
    const { symbol, assetType, prices, volumes, highs, lows } = req.body;
    const MAX_PRICE_POINTS = 10000;
    
    if (!symbol || !prices || !volumes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    if (!Array.isArray(prices) || prices.length < 2 || prices.length > MAX_PRICE_POINTS) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prices: expected an array with 2 to 10000 elements'
      });
    }

    if (!Array.isArray(volumes) || volumes.length !== prices.length || volumes.length > MAX_PRICE_POINTS) {
      return res.status(400).json({
        success: false,
        error: 'Invalid volumes: expected an array matching prices length (max 10000)'
      });
    }
    
    const marketData = {
      symbol,
      assetType: assetType || 'crypto',
      prices,
      volumes,
      highs: highs || prices,
      lows: lows || prices
    };
    
    const prediction = await mlPredictor.predictPriceDirection(marketData);
    agentOrchestrator.recordMlOutput(prediction, 'ml_predictor');
    
    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/ml/score-opportunity
 * @desc Score a trading opportunity using ML
 * @access Private
 */
router.post('/score-opportunity', authenticate, async (req, res) => {
  try {
    const { opportunity, marketData } = req.body;
    
    if (!opportunity || !marketData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const score = await mlPredictor.scoreOpportunity(opportunity, marketData);
    let orchestration = null;

    if (req.body.routeToOrchestrator === true) {
      orchestration = await agentOrchestrator.processMlOpportunity(
        { opportunity, score },
        'ml_predictor',
        req.userId
      );
    } else {
      agentOrchestrator.recordMlOutput({ score, opportunity }, 'ml_predictor');
    }
    
    res.json({
      success: true,
      score,
      orchestration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/ml/forecast-volatility
 * @desc Forecast volatility for a symbol
 * @access Private
 */
router.post('/forecast-volatility', authenticate, async (req, res) => {
  try {
    const { symbol, assetType, prices, highs, lows } = req.body;
    const MAX_PRICE_POINTS = 10000;
    
    if (!symbol || !prices) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    if (!Array.isArray(prices) || prices.length < 2 || prices.length > MAX_PRICE_POINTS) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prices: expected an array with 2 to 10000 elements'
      });
    }
    
    const marketData = {
      symbol,
      assetType: assetType || 'crypto',
      prices,
      highs: highs || prices,
      lows: lows || prices
    };
    
    const forecast = await mlPredictor.forecastVolatility(marketData);
    agentOrchestrator.recordMlOutput({
      symbol,
      model: 'volatilityForecast',
      forecast
    }, 'ml_predictor');
    
    res.json({
      success: true,
      forecast
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/ml/performance
 * @desc Get ML model performance metrics
 * @access Private
 */
router.get('/performance', authenticate, async (req, res) => {
  try {
    const performance = mlPredictor.getPerformance();
    
    res.json({
      success: true,
      performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/ml/models
 * @desc Get available ML models
 * @access Private
 */
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = await mlPredictor.getModels();
    
    res.json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
