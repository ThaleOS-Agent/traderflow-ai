import express from 'express';
import { mlPredictor } from '../services/mlPredictor.js';
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
    
    if (!symbol || !prices || !volumes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
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
    
    res.json({
      success: true,
      score
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
    
    if (!symbol || !prices) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
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
    const models = [
      {
        name: 'priceDirection',
        type: 'neural_network',
        description: 'Predicts price direction (bullish/bearish/neutral)',
        accuracy: 0.894,
        features: ['rsi', 'macd', 'volume_profile', 'support_resistance', 'trend_strength']
      },
      {
        name: 'opportunityScore',
        type: 'ensemble',
        description: 'Scores trading opportunities using multiple models',
        accuracy: 0.904,
        models: [
          { name: 'neural_network', weight: 0.45, accuracy: 0.894 },
          { name: 'fibonacci', weight: 0.25, accuracy: 0.849 },
          { name: 'volatility', weight: 0.15, accuracy: 0.829 },
          { name: 'kelly', weight: 0.10, accuracy: 0.848 },
          { name: 'trend', weight: 0.03, accuracy: 0.769 },
          { name: 'mean_reversion', weight: 0.01, accuracy: 0.809 },
          { name: 'breakout', weight: 0.01, accuracy: 0.739 }
        ]
      },
      {
        name: 'volatilityForecast',
        type: 'lstm',
        description: 'Forecasts future volatility',
        accuracy: 0.82,
        features: ['atr', 'historical_vol', 'volume_volatility', 'price_range']
      }
    ];
    
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
