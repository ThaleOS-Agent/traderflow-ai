import express from 'express';
import { Strategy } from '../models/Strategy.js';
import { getAllStrategies } from '../services/strategies/index.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Get all strategies
router.get('/', async (req, res) => {
  try {
    const strategies = await Strategy.find({ isPublic: true, isActive: true });
    
    res.json({ strategies });
  } catch (error) {
    logger.error('Get strategies error:', error);
    res.status(500).json({ error: 'Failed to get strategies' });
  }
});

// Get available strategies (from code)
router.get('/available', async (req, res) => {
  try {
    const strategies = getAllStrategies();
    res.json({ strategies });
  } catch (error) {
    logger.error('Get available strategies error:', error);
    res.status(500).json({ error: 'Failed to get available strategies' });
  }
});

// Get strategy by code
router.get('/:code', async (req, res) => {
  try {
    const strategy = await Strategy.findOne({ code: req.params.code });
    
    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    
    res.json({ strategy });
  } catch (error) {
    logger.error('Get strategy error:', error);
    res.status(500).json({ error: 'Failed to get strategy' });
  }
});

// Create custom strategy (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      type,
      supportedAssets,
      defaultParams,
      riskSettings
    } = req.body;
    
    const strategy = new Strategy({
      name,
      code,
      description,
      type,
      supportedAssets,
      defaultParams,
      riskSettings,
      createdBy: req.userId
    });
    
    await strategy.save();
    
    res.status(201).json({
      message: 'Strategy created',
      strategy
    });
  } catch (error) {
    logger.error('Create strategy error:', error);
    res.status(500).json({ error: 'Failed to create strategy' });
  }
});

// Update strategy performance
router.put('/:code/performance', authenticateToken, async (req, res) => {
  try {
    const { performance } = req.body;
    
    const strategy = await Strategy.findOneAndUpdate(
      { code: req.params.code },
      { performance, updatedAt: new Date() },
      { new: true }
    );
    
    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    
    res.json({ strategy });
  } catch (error) {
    logger.error('Update strategy performance error:', error);
    res.status(500).json({ error: 'Failed to update strategy performance' });
  }
});

export default router;
