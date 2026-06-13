import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { mt5Connector } from '../services/mt5Connector.js';

const router = express.Router();

// All MT5 routes require authentication
router.use(authenticate);

// GET /api/mt5/status  — connector mode + account summary
router.get('/status', async (req, res) => {
  try {
    const account = await mt5Connector.getAccount();
    res.json({ success: true, mode: mt5Connector.mode, account });
  } catch (err) {
    logger.error('MT5 status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/account
router.get('/account', async (req, res) => {
  try {
    const account = await mt5Connector.getAccount();
    res.json({ success: true, account });
  } catch (err) {
    logger.error('MT5 account error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/positions
router.get('/positions', async (req, res) => {
  try {
    const positions = await mt5Connector.getPositions();
    res.json({ success: true, positions });
  } catch (err) {
    logger.error('MT5 positions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await mt5Connector.getOrders();
    res.json({ success: true, orders });
  } catch (err) {
    logger.error('MT5 orders error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/history?limit=50
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const history = await mt5Connector.getHistory(limit);
    res.json({ success: true, history });
  } catch (err) {
    logger.error('MT5 history error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mt5/order  — place a market/limit order
// Body: { symbol, side: 'BUY'|'SELL', volume, stopLoss?, takeProfit?, comment? }
router.post('/order', async (req, res) => {
  try {
    const { symbol, side, volume, stopLoss, takeProfit, comment } = req.body;

    if (!symbol || !side || !volume) {
      return res.status(400).json({ success: false, error: 'symbol, side, and volume are required' });
    }
    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ success: false, error: 'side must be BUY or SELL' });
    }
    if (typeof volume !== 'number' || volume <= 0) {
      return res.status(400).json({ success: false, error: 'volume must be a positive number' });
    }

    const result = await mt5Connector.placeOrder({ symbol, side, volume, stopLoss, takeProfit, comment });
    res.json({ success: true, result });
  } catch (err) {
    logger.error('MT5 place order error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/mt5/positions/:id  — close a position
router.delete('/positions/:id', async (req, res) => {
  try {
    const result = await mt5Connector.closePosition(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    logger.error('MT5 close position error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
