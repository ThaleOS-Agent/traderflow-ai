import express from 'express';
import { dexIntegration } from '../services/dexIntegration.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/dex/stats
 * @desc Get DEX integration statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = dexIntegration.getStats();
    
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
 * @route GET /api/dex/dexes
 * @desc Get supported DEXes
 * @access Private
 */
router.get('/dexes', authenticate, async (req, res) => {
  try {
    const dexes = dexIntegration.getSupportedDEXes();
    
    res.json({
      success: true,
      dexes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/dex/:dexName/tokens
 * @desc Get supported tokens for a DEX
 * @access Private
 */
router.get('/:dexName/tokens', authenticate, async (req, res) => {
  try {
    const { dexName } = req.params;
    const tokens = dexIntegration.getSupportedTokens(dexName);
    
    res.json({
      success: true,
      dex: dexName,
      tokens
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/dex/quote
 * @desc Get price quote for a swap
 * @access Private
 */
router.get('/quote', authenticate, async (req, res) => {
  try {
    const { dex, tokenIn, tokenOut, amount, feeTier } = req.query;
    
    if (!dex || !tokenIn || !tokenOut || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: dex, tokenIn, tokenOut, amount'
      });
    }
    
    const quote = await dexIntegration.getQuote(
      dex,
      tokenIn,
      tokenOut,
      parseFloat(amount),
      feeTier ? parseInt(feeTier) : 3000
    );
    
    res.json({
      success: true,
      quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/dex/best-price
 * @desc Get best price across all DEXes
 * @access Private
 */
router.get('/best-price', authenticate, async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount } = req.query;
    
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: tokenIn, tokenOut, amount'
      });
    }
    
    const result = await dexIntegration.getBestPrice(
      tokenIn,
      tokenOut,
      parseFloat(amount)
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/dex/swap
 * @desc Execute swap (requires wallet configuration)
 * @access Private
 */
router.post('/swap', authenticate, async (req, res) => {
  try {
    const { dex, tokenIn, tokenOut, amount, slippage, walletConfig } = req.body;
    
    if (!dex || !tokenIn || !tokenOut || !amount || !walletConfig) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await dexIntegration.executeSwap(
      dex,
      tokenIn,
      tokenOut,
      parseFloat(amount),
      slippage || 0.5,
      walletConfig
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
 * @route GET /api/dex/pool-info
 * @desc Get pool information
 * @access Private
 */
router.get('/pool-info', authenticate, async (req, res) => {
  try {
    const { dex, tokenA, tokenB } = req.query;
    
    if (!dex || !tokenA || !tokenB) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: dex, tokenA, tokenB'
      });
    }
    
    const poolInfo = await dexIntegration.getPoolInfo(dex, tokenA, tokenB);
    
    res.json({
      success: true,
      poolInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
