import express from 'express';
import { notificationService } from '../services/notificationService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/notifications/vapid-key
 * @desc Get VAPID public key for push subscription
 * @access Private
 */
router.get('/vapid-key', authenticate, async (req, res) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();
    
    res.json({
      success: true,
      publicKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/notifications/subscribe
 * @desc Subscribe to push notifications
 * @access Private
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user._id.toString();
    
    const result = await notificationService.subscribe(userId, subscription);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/notifications/unsubscribe
 * @desc Unsubscribe from push notifications
 * @access Private
 */
router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const result = await notificationService.unsubscribe(userId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/notifications/send
 * @desc Send test notification
 * @access Private
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const userId = req.user._id.toString();
    
    const result = await notificationService.sendNotification(userId, {
      type: 'test',
      title: title || 'Test Notification',
      body: body || 'This is a test notification from TradeFlow AI',
      data: data || { action: 'test' }
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = notificationService.getStats();
    
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
 * @route POST /api/notifications/broadcast
 * @desc Broadcast notification to all users (admin only)
 * @access Private/Admin
 */
router.post('/broadcast', authenticate, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const results = await notificationService.broadcast({
      type: 'announcement',
      title: title || 'Announcement',
      body: body || '',
      data: data || { action: 'announcement' }
    });
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
