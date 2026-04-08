import express from 'express';
import { optionsTradingService } from '../services/optionsTrading.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/options/price
 * @desc Calculate option price using Black-Scholes
 * @access Private
 */
router.post('/price', authenticate, async (req, res) => {
  try {
    const {
      spotPrice,
      strikePrice,
      timeToExpiry, // in years
      riskFreeRate, // annual rate (e.g., 0.05 for 5%)
      volatility,   // annual volatility (e.g., 0.25 for 25%)
      optionType    // 'call' or 'put'
    } = req.body;

    if (!spotPrice || !strikePrice || !timeToExpiry || !optionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const result = optionsTradingService.calculateOptionPrice(
      parseFloat(spotPrice),
      parseFloat(strikePrice),
      parseFloat(timeToExpiry),
      parseFloat(riskFreeRate || 0.05),
      parseFloat(volatility || 0.25),
      optionType
    );

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
 * @route POST /api/options/greeks
 * @desc Calculate option Greeks
 * @access Private
 */
router.post('/greeks', authenticate, async (req, res) => {
  try {
    const {
      spotPrice,
      strikePrice,
      timeToExpiry,
      riskFreeRate,
      volatility,
      optionType
    } = req.body;

    if (!spotPrice || !strikePrice || !timeToExpiry || !optionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const greeks = optionsTradingService.calculateGreeks(
      parseFloat(spotPrice),
      parseFloat(strikePrice),
      parseFloat(timeToExpiry),
      parseFloat(riskFreeRate || 0.05),
      parseFloat(volatility || 0.25),
      optionType
    );

    res.json({
      success: true,
      greeks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/implied-volatility
 * @desc Calculate implied volatility
 * @access Private
 */
router.post('/implied-volatility', authenticate, async (req, res) => {
  try {
    const {
      spotPrice,
      strikePrice,
      timeToExpiry,
      riskFreeRate,
      optionPrice,
      optionType
    } = req.body;

    if (!spotPrice || !strikePrice || !timeToExpiry || !optionPrice || !optionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const result = optionsTradingService.calculateImpliedVolatility(
      parseFloat(spotPrice),
      parseFloat(strikePrice),
      parseFloat(timeToExpiry),
      parseFloat(riskFreeRate || 0.05),
      parseFloat(optionPrice),
      optionType
    );

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
 * @route POST /api/options/chain
 * @desc Calculate option chain for an underlying
 * @access Private
 */
router.post('/chain', authenticate, async (req, res) => {
  try {
    const {
      underlying,
      spotPrice,
      expiry,
      riskFreeRate,
      volatility
    } = req.body;

    if (!underlying || !spotPrice || !expiry) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const chain = optionsTradingService.calculateOptionChain(
      underlying,
      parseFloat(spotPrice),
      expiry,
      parseFloat(riskFreeRate || 0.05),
      parseFloat(volatility || 0.25)
    );

    res.json({
      success: true,
      chain
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/long-call
 * @desc Build Long Call strategy
 * @access Private
 */
router.post('/strategy/long-call', authenticate, async (req, res) => {
  try {
    const { underlying, strike, expiry, premium } = req.body;

    if (!underlying || !strike || !expiry || !premium) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildLongCall(
      underlying,
      parseFloat(strike),
      expiry,
      parseFloat(premium)
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/long-put
 * @desc Build Long Put strategy
 * @access Private
 */
router.post('/strategy/long-put', authenticate, async (req, res) => {
  try {
    const { underlying, strike, expiry, premium } = req.body;

    if (!underlying || !strike || !expiry || !premium) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildLongPut(
      underlying,
      parseFloat(strike),
      expiry,
      parseFloat(premium)
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/bull-call-spread
 * @desc Build Bull Call Spread strategy
 * @access Private
 */
router.post('/strategy/bull-call-spread', authenticate, async (req, res) => {
  try {
    const { underlying, longStrike, shortStrike, expiry, longPremium, shortPremium } = req.body;

    if (!underlying || !longStrike || !shortStrike || !expiry || !longPremium || !shortPremium) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildBullCallSpread(
      underlying,
      parseFloat(longStrike),
      parseFloat(shortStrike),
      expiry,
      parseFloat(longPremium),
      parseFloat(shortPremium)
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/bear-put-spread
 * @desc Build Bear Put Spread strategy
 * @access Private
 */
router.post('/strategy/bear-put-spread', authenticate, async (req, res) => {
  try {
    const { underlying, longStrike, shortStrike, expiry, longPremium, shortPremium } = req.body;

    if (!underlying || !longStrike || !shortStrike || !expiry || !longPremium || !shortPremium) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildBearPutSpread(
      underlying,
      parseFloat(longStrike),
      parseFloat(shortStrike),
      expiry,
      parseFloat(longPremium),
      parseFloat(shortPremium)
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/straddle
 * @desc Build Straddle strategy
 * @access Private
 */
router.post('/strategy/straddle', authenticate, async (req, res) => {
  try {
    const { underlying, strike, expiry, callPremium, putPremium } = req.body;

    if (!underlying || !strike || !expiry || !callPremium || !putPremium) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildStraddle(
      underlying,
      parseFloat(strike),
      expiry,
      parseFloat(callPremium),
      parseFloat(putPremium)
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/iron-condor
 * @desc Build Iron Condor strategy
 * @access Private
 */
router.post('/strategy/iron-condor', authenticate, async (req, res) => {
  try {
    const {
      underlying,
      expiry,
      putLongStrike,
      putShortStrike,
      callShortStrike,
      callLongStrike,
      premiums
    } = req.body;

    if (!underlying || !expiry || !putLongStrike || !putShortStrike || 
        !callShortStrike || !callLongStrike || !premiums) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const strategy = optionsTradingService.buildIronCondor(
      underlying,
      expiry,
      parseFloat(putLongStrike),
      parseFloat(putShortStrike),
      parseFloat(callShortStrike),
      parseFloat(callLongStrike),
      {
        putLong: parseFloat(premiums.putLong),
        putShort: parseFloat(premiums.putShort),
        callShort: parseFloat(premiums.callShort),
        callLong: parseFloat(premiums.callLong)
      }
    );

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/options/strategy/payoff
 * @desc Analyze strategy payoff at different price points
 * @access Private
 */
router.post('/strategy/payoff', authenticate, async (req, res) => {
  try {
    const { strategy, priceRange } = req.body;

    if (!strategy || !priceRange || !Array.isArray(priceRange)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const payoff = optionsTradingService.analyzeStrategyPayoff(strategy, priceRange);

    res.json({
      success: true,
      payoff
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
