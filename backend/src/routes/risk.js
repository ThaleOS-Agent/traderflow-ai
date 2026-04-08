import express from 'express';
import { advancedRiskManager } from '../services/advancedRiskManager.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/risk/portfolio
 * @desc Get portfolio risk assessment
 * @access Private
 */
router.get('/portfolio', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const riskAssessment = await advancedRiskManager.assessPortfolioRisk(userId);
    
    res.json({
      success: true,
      risk: riskAssessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk/position
 * @desc Assess position risk
 * @access Private
 */
router.post('/position', authenticate, async (req, res) => {
  try {
    const { symbol, positionSize, currentPrice, marketData } = req.body;
    const userId = req.user._id.toString();
    
    const portfolioValue = req.user.portfolio?.totalValue || 10000;
    
    const riskAssessment = await advancedRiskManager.assessPositionRisk(
      symbol,
      positionSize,
      currentPrice,
      portfolioValue,
      marketData
    );
    
    res.json({
      success: true,
      risk: riskAssessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk/pre-trade
 * @desc Pre-trade risk check
 * @access Private
 */
router.post('/pre-trade', authenticate, async (req, res) => {
  try {
    const tradeParams = req.body;
    const userId = req.user._id.toString();
    
    const check = await advancedRiskManager.preTradeCheck(userId, tradeParams);
    
    res.json({
      success: true,
      check
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk/dashboard
 * @desc Get risk dashboard data
 * @access Private
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const dashboard = await advancedRiskManager.getRiskDashboard(userId);
    
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk/limits
 * @desc Get risk limits
 * @access Private
 */
router.get('/limits', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      limits: advancedRiskManager.riskLimits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk/limits
 * @desc Update risk limits (admin only)
 * @access Private/Admin
 */
router.post('/limits', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const newLimits = req.body;
    
    // Update limits
    Object.assign(advancedRiskManager.riskLimits, newLimits);
    
    res.json({
      success: true,
      limits: advancedRiskManager.riskLimits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk/emergency-stop/reset
 * @desc Reset emergency stop
 * @access Private/Admin
 */
router.post('/emergency-stop/reset', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    advancedRiskManager.resetEmergencyStop();
    
    res.json({
      success: true,
      message: 'Emergency stop reset'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk/alerts
 * @desc Get active risk alerts
 * @access Private
 */
router.get('/alerts', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      alerts: advancedRiskManager.activeAlerts,
      emergencyStop: advancedRiskManager.emergencyStop
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
