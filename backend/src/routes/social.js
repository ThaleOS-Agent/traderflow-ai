import express from 'express';
import { socialTradingService } from '../services/socialTrading.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/social/trader/register
 * @desc Register as a trader for social trading
 * @access Private
 */
router.post('/trader/register', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const profileData = req.body;
    
    const traderProfile = await socialTradingService.registerTrader(userId, profileData);
    
    res.json({
      success: true,
      trader: traderProfile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/social/trader/profile/:traderId
 * @desc Get trader profile
 * @access Private
 */
router.get('/trader/profile/:traderId', authenticate, async (req, res) => {
  try {
    const { traderId } = req.params;
    const profile = socialTradingService.getTraderProfile(traderId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Trader profile not found'
      });
    }
    
    res.json({
      success: true,
      profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/social/signal
 * @desc Post a trading signal
 * @access Private
 */
router.post('/signal', authenticate, async (req, res) => {
  try {
    const providerId = req.user._id.toString();
    const signalData = req.body;
    
    const signal = await socialTradingService.postSignal(providerId, signalData);
    
    res.json({
      success: true,
      signal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/social/signals/:providerId
 * @desc Get active signals from a provider
 * @access Private
 */
router.get('/signals/:providerId', authenticate, async (req, res) => {
  try {
    const { providerId } = req.params;
    const signals = socialTradingService.getActiveSignals(providerId);
    
    res.json({
      success: true,
      count: signals.length,
      signals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/social/copy
 * @desc Create a copy trading relationship
 * @access Private
 */
router.post('/copy', authenticate, async (req, res) => {
  try {
    const followerId = req.user._id.toString();
    const { providerId, settings } = req.body;
    
    const relationship = await socialTradingService.createCopyRelationship(
      followerId, 
      providerId, 
      settings
    );
    
    res.json({
      success: true,
      relationship
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/social/copy/performance/:relationshipId
 * @desc Get copy trading performance
 * @access Private
 */
router.get('/copy/performance/:relationshipId', authenticate, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const performance = await socialTradingService.getCopyPerformance(relationshipId);
    
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
 * @route POST /api/social/copy/stop/:relationshipId
 * @desc Stop copy trading relationship
 * @access Private
 */
router.post('/copy/stop/:relationshipId', authenticate, async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const result = await socialTradingService.stopCopyRelationship(relationshipId);
    
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
 * @route GET /api/social/leaderboard
 * @desc Get trader leaderboard
 * @access Private
 */
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const { timeframe = 'monthly', limit = 50 } = req.query;
    
    const leaderboard = await socialTradingService.getTraderLeaderboard(timeframe, parseInt(limit));
    
    res.json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/social/trader/update-metrics
 * @desc Update trader performance metrics
 * @access Private
 */
router.post('/trader/update-metrics', authenticate, async (req, res) => {
  try {
    const traderId = req.user._id.toString();
    const metrics = await socialTradingService.updateTraderMetrics(traderId);
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/social/stats
 * @desc Get social trading statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = socialTradingService.getStats();
    
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

export default router;
