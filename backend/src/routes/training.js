import express from 'express';
import { mlTrainingService } from '../services/mlTrainingService.js';
import { ensembleMaster } from '../services/ensembleMasterStrategy.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/training/start
 * @desc Start ML training for all bots/agents
 * @access Private/Admin
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
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
    if (!req.user.isAdmin) {
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
    if (!req.user.isAdmin) {
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
    const { symbol, marketData } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol required'
      });
    }
    
    const signal = await ensembleMaster.generateEnsembleSignal(symbol, marketData || {});
    
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

export default router;
