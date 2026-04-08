import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { autoExecution } from '../server.js';

const router = express.Router();

// Get auto-execution status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const stats = autoExecution.getStats(req.userId);
    const config = autoExecution.getConfig(req.userId);
    
    res.json({
      enabled: config?.enabled || false,
      config,
      stats
    });
  } catch (error) {
    logger.error('Get execution status error:', error);
    res.status(500).json({ error: 'Failed to get execution status' });
  }
});

// Toggle auto-execution
router.post('/toggle', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const config = await autoExecution.toggle(req.userId, enabled);
    
    res.json({
      message: `Auto-execution ${enabled ? 'enabled' : 'disabled'}`,
      enabled: config.enabled
    });
  } catch (error) {
    logger.error('Toggle execution error:', error);
    res.status(500).json({ error: 'Failed to toggle execution' });
  }
});

// Update execution config
router.put('/config', authenticateToken, async (req, res) => {
  try {
    const newConfig = req.body;
    
    const config = await autoExecution.updateConfig(req.userId, newConfig);
    
    res.json({
      message: 'Configuration updated',
      config
    });
  } catch (error) {
    logger.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Execute opportunity manually
router.post('/execute', authenticateToken, async (req, res) => {
  try {
    const { opportunity } = req.body;
    
    if (!opportunity) {
      return res.status(400).json({ error: 'Opportunity data required' });
    }
    
    await autoExecution.executeForUser(req.userId, opportunity);
    
    res.json({
      message: 'Execution triggered',
      opportunity: opportunity.symbol
    });
  } catch (error) {
    logger.error('Manual execution error:', error);
    res.status(500).json({ error: 'Failed to execute' });
  }
});

// Get execution history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const stats = autoExecution.getStats(req.userId);
    
    res.json({
      history: stats?.recentExecutions || []
    });
  } catch (error) {
    logger.error('Get execution history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
