import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { mt5Connector } from '../services/mt5Connector.js';
import {
  metatraderAccountService,
  sanitizeMetatraderAccount
} from '../services/metatraderAccountService.js';

const router = express.Router();

// All MT5 routes require authentication
router.use(authenticate);

function hasUserMetatraderAccount(user) {
  return (user.metatraderAccounts || []).length > 0;
}

// GET /api/mt5/connections
router.get('/connections', async (req, res) => {
  try {
    res.json({
      success: true,
      connections: (req.user.metatraderAccounts || []).map(sanitizeMetatraderAccount)
    });
  } catch (err) {
    logger.error('MT connection list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mt5/connections
router.post('/connections', async (req, res) => {
  try {
    const {
      platform = 'mt5',
      provider = 'bridge',
      label = '',
      login = '',
      server = '',
      accountId = '',
      apiUrl = '',
      apiKey = '',
      token = '',
      isDemo = true,
      isActive = true,
      testConnection = true
    } = req.body;

    if (!['mt4', 'mt5'].includes(platform)) {
      return res.status(400).json({ success: false, error: 'platform must be mt4 or mt5' });
    }
    if (!['bridge', 'metaapi'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'provider must be bridge or metaapi' });
    }
    if (provider === 'bridge' && !apiUrl) {
      return res.status(400).json({ success: false, error: 'Bridge provider requires apiUrl' });
    }
    if (provider === 'metaapi' && (!token || !accountId)) {
      return res.status(400).json({ success: false, error: 'MetaAPI provider requires token and accountId' });
    }

    if (isActive) {
      req.user.metatraderAccounts.forEach(account => { account.isActive = false; });
    }

    req.user.metatraderAccounts.push({
      platform,
      provider,
      label: label || `${platform.toUpperCase()} ${provider}`,
      login,
      server,
      accountId,
      apiUrl,
      apiKey,
      token,
      isDemo,
      isActive,
      connectionStatus: 'untested'
    });

    const account = req.user.metatraderAccounts[req.user.metatraderAccounts.length - 1];

    if (testConnection) {
      try {
        await metatraderAccountService.testAccount({
          ...account.toObject(),
          apiKey,
          token
        });
        account.connectionStatus = 'connected';
        account.lastConnectedAt = new Date();
      } catch (testErr) {
        account.connectionStatus = 'failed';
      }
    }

    await req.user.save();

    res.status(201).json({
      success: true,
      connection: sanitizeMetatraderAccount(account)
    });
  } catch (err) {
    logger.error('MT connection create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mt5/connections/:id/test
router.post('/connections/:id/test', async (req, res) => {
  try {
    const account = req.user.metatraderAccounts.id(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const decrypted = req.user.getDecryptedMetatraderAccounts().find(item => item._id.toString() === req.params.id);
    const summary = await metatraderAccountService.testAccount(decrypted);
    account.connectionStatus = 'connected';
    account.lastConnectedAt = new Date();
    await req.user.save();

    res.json({
      success: true,
      connection: sanitizeMetatraderAccount(account),
      account: summary
    });
  } catch (err) {
    const account = req.user.metatraderAccounts.id(req.params.id);
    if (account) {
      account.connectionStatus = 'failed';
      await req.user.save().catch(() => undefined);
    }
    logger.error('MT connection test error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/mt5/connections/:id/activate
router.post('/connections/:id/activate', async (req, res) => {
  try {
    const account = req.user.metatraderAccounts.id(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    req.user.metatraderAccounts.forEach(item => { item.isActive = item._id.toString() === req.params.id; });
    await req.user.save();

    res.json({
      success: true,
      connection: sanitizeMetatraderAccount(account)
    });
  } catch (err) {
    logger.error('MT connection activate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/mt5/connections/:id
router.delete('/connections/:id', async (req, res) => {
  try {
    const account = req.user.metatraderAccounts.id(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    req.user.metatraderAccounts.pull(req.params.id);
    await req.user.save();
    res.json({ success: true, message: 'Connection removed' });
  } catch (err) {
    logger.error('MT connection delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/status  — connector mode + account summary
router.get('/status', async (req, res) => {
  try {
    if (hasUserMetatraderAccount(req.user)) {
      const account = await metatraderAccountService.getAccount(req.user, req.query.accountId);
      return res.json({ success: true, mode: account.provider, account });
    }

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
    const account = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.getAccount(req.user, req.query.accountId)
      : await mt5Connector.getAccount();
    res.json({ success: true, account });
  } catch (err) {
    logger.error('MT5 account error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/positions
router.get('/positions', async (req, res) => {
  try {
    const positions = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.getPositions(req.user, req.query.accountId)
      : await mt5Connector.getPositions();
    res.json({ success: true, positions });
  } catch (err) {
    logger.error('MT5 positions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mt5/orders
router.get('/orders', async (req, res) => {
  try {
    const orders = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.getOrders(req.user, req.query.accountId)
      : await mt5Connector.getOrders();
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
    const history = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.getHistory(req.user, req.query.accountId, limit)
      : await mt5Connector.getHistory(limit);
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
    const { symbol, side, volume, stopLoss, takeProfit, comment, accountId } = req.body;

    if (!symbol || !side || !volume) {
      return res.status(400).json({ success: false, error: 'symbol, side, and volume are required' });
    }
    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ success: false, error: 'side must be BUY or SELL' });
    }
    if (typeof volume !== 'number' || volume <= 0) {
      return res.status(400).json({ success: false, error: 'volume must be a positive number' });
    }

    const result = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.placeOrder(req.user, accountId, { symbol, side, volume, stopLoss, takeProfit, comment })
      : await mt5Connector.placeOrder({ symbol, side, volume, stopLoss, takeProfit, comment });
    res.json({ success: true, result });
  } catch (err) {
    logger.error('MT5 place order error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/mt5/positions/:id  — close a position
router.delete('/positions/:id', async (req, res) => {
  try {
    const result = hasUserMetatraderAccount(req.user)
      ? await metatraderAccountService.closePosition(req.user, req.query.accountId, req.params.id)
      : await mt5Connector.closePosition(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    logger.error('MT5 close position error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
