import express from 'express';
import { User } from '../models/User.js';
import { Trade } from '../models/Trade.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { tradingEngine } from '../server.js';
import { getSupportedVenueNames, getTradingVenue, normalizeVenueName } from '../config/tradingVenues.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: user.toJSON() });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, country } = req.body;

    const isValidString = (value) => typeof value === 'string';
    if (
      !isValidString(firstName) ||
      !isValidString(lastName) ||
      !isValidString(phone) ||
      !isValidString(country)
    ) {
      return res.status(400).json({ error: 'Invalid profile fields' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        firstName,
        lastName,
        phone,
        country,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    res.json({ user: user.toJSON() });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get trading settings
router.get('/trading-settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ settings: user.tradingSettings });
  } catch (error) {
    logger.error('Get trading settings error:', error);
    res.status(500).json({ error: 'Failed to get trading settings' });
  }
});

// Update trading settings
router.put('/trading-settings', authenticateToken, async (req, res) => {
  try {
    const settings = req.body;
    
    const user = await User.findById(req.userId);
    user.tradingSettings = { ...user.tradingSettings, ...settings };
    await user.save();
    
    res.json({ settings: user.tradingSettings });
  } catch (error) {
    logger.error('Update trading settings error:', error);
    res.status(500).json({ error: 'Failed to update trading settings' });
  }
});

// Toggle auto-trading
router.post('/toggle-auto-trading', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const result = await tradingEngine.toggleAutoTrading(req.userId, enabled);
    
    if (result.success) {
      res.json({ 
        success: true, 
        autoTrading: result.autoTrading,
        message: `Auto-trading ${enabled ? 'enabled' : 'disabled'}`
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Toggle auto-trading error:', error);
    res.status(500).json({ error: 'Failed to toggle auto-trading' });
  }
});

// Toggle paper trading
router.post('/toggle-paper-trading', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const result = await tradingEngine.togglePaperTrading(req.userId, enabled);
    
    if (result.success) {
      res.json({ 
        success: true, 
        paperTrading: result.paperTrading,
        message: `Paper trading ${enabled ? 'enabled' : 'disabled'}`
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Toggle paper trading error:', error);
    res.status(500).json({ error: 'Failed to toggle paper trading' });
  }
});

// Get portfolio
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Get open positions
    const openPositions = await Trade.find({
      userId: req.userId,
      status: { $in: ['open', 'pending'] }
    }).sort({ openedAt: -1 });
    
    // Get recent trades
    const recentTrades = await Trade.find({
      userId: req.userId,
      status: 'closed'
    }).sort({ closedAt: -1 }).limit(10);
    
    res.json({
      portfolio: user.portfolio,
      openPositions,
      recentTrades
    });
  } catch (error) {
    logger.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// Add/update exchange API keys
router.post('/exchange-keys', authenticateToken, async (req, res) => {
  try {
    const { exchange, apiKey, apiSecret, passphrase = '', isTestnet } = req.body;
    const venueName = normalizeVenueName(exchange);
    const venue = getTradingVenue(venueName);

    if (!venueName || !venue) {
      return res.status(400).json({
        error: `Unsupported exchange. Supported venues: ${getSupportedVenueNames().join(', ')}`
      });
    }

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and API secret are required' });
    }

    if (venue.requiresPassphrase && !passphrase) {
      return res.status(400).json({
        error: `${venue.passphraseLabel || 'Passphrase'} is required for ${venue.label}`
      });
    }
    
    const user = await User.findById(req.userId);
    
    // Find existing exchange config
    const existingIndex = user.exchanges.findIndex(e => e.name === venueName);
    
    const exchangeConfig = {
      name: venueName,
      apiKey,
      apiSecret,
      passphrase,
      isTestnet: isTestnet !== false,
      isActive: true
    };
    
    if (existingIndex >= 0) {
      user.exchanges[existingIndex] = exchangeConfig;
    } else {
      user.exchanges.push(exchangeConfig);
    }
    
    await user.save();
    
    // Re-register user with new credentials
    await tradingEngine.registerUser(req.userId);
    
    res.json({ 
      message: 'Exchange API keys updated',
      exchange: {
        name: venueName,
        label: venue.label,
        isTestnet: exchangeConfig.isTestnet,
        isActive: true,
        requiresPassphrase: venue.requiresPassphrase,
        passphraseLabel: venue.passphraseLabel || 'Passphrase'
      }
    });
  } catch (error) {
    logger.error('Update exchange keys error:', error);
    res.status(500).json({ error: 'Failed to update exchange keys' });
  }
});

// Get exchange connections
router.get('/exchanges', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    const exchanges = user.exchanges.map(e => ({
      name: e.name,
      label: getTradingVenue(e.name)?.label || e.name,
      isTestnet: e.isTestnet,
      isActive: e.isActive,
      hasKeys: !!(e.apiKey && e.apiSecret),
      requiresPassphrase: Boolean(getTradingVenue(e.name)?.requiresPassphrase),
      passphraseConfigured: Boolean(e.passphrase)
    }));
    
    res.json({ exchanges });
  } catch (error) {
    logger.error('Get exchanges error:', error);
    res.status(500).json({ error: 'Failed to get exchanges' });
  }
});

export default router;
