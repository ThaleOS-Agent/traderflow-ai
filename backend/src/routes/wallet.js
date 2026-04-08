import express from 'express';
import { walletConnectService } from '../services/walletConnectService.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, requireTier, requireFounder } from '../middleware/paywall.js';

const router = express.Router();

/**
 * @route POST /api/wallet/connect
 * @desc Create a new WalletConnect session
 * @access Public
 */
router.post('/connect', async (req, res) => {
  try {
    const session = await walletConnectService.createSession();
    
    res.json({
      success: true,
      session: {
        id: session.id,
        uri: session.uri,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/wallet/verify
 * @desc Verify wallet connection and authenticate
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { sessionId, address, chainId, signature, message } = req.body;
    
    if (!sessionId || !address || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const result = await walletConnectService.connectWallet(sessionId, {
      address,
      chainId,
      signature,
      message
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
 * @route GET /api/wallet/session/:sessionId
 * @desc Get session status
 * @access Public
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = walletConnectService.getSessionStatus(sessionId);
    
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
 * @route POST /api/wallet/disconnect
 * @desc Disconnect wallet
 * @access Private
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    await walletConnectService.disconnectWallet(sessionId);
    
    res.json({
      success: true,
      message: 'Wallet disconnected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/wallet/tiers
 * @desc Get all subscription tiers
 * @access Public
 */
router.get('/tiers', async (req, res) => {
  try {
    const tiers = walletConnectService.getSubscriptionTiers();
    
    res.json({
      success: true,
      tiers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/wallet/subscription
 * @desc Get current user subscription
 * @access Private
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      subscription: {
        tier: user.subscription?.tier || 'free',
        status: user.subscription?.status || 'active',
        expiresAt: user.subscription?.expiresAt,
        isFounder: user.isFounder || false,
        features: walletConnectService.getTierFeatures(user.subscription?.tier || 'free')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/wallet/upgrade
 * @desc Upgrade subscription tier
 * @access Private
 */
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { tier, paymentData } = req.body;
    const userId = req.user._id;
    
    const result = await walletConnectService.upgradeSubscription(userId, tier, paymentData);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/wallet/paywall/:feature
 * @desc Check paywall for a feature
 * @access Private
 */
router.get('/paywall/:feature', authenticate, async (req, res) => {
  try {
    const { feature } = req.params;
    const userTier = req.user.subscription?.tier || 'free';
    
    const paywallConfig = walletConnectService.getPaywallConfig(feature, userTier);
    
    res.json({
      success: true,
      paywall: paywallConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/wallet/features
 * @desc Get all available features
 * @access Private
 */
router.get('/features', authenticate, async (req, res) => {
  try {
    const userTier = req.user.subscription?.tier || 'free';
    const features = walletConnectService.getTierFeatures(userTier);
    
    res.json({
      success: true,
      tier: userTier,
      features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/wallet/founder/login
 * @desc Founder full access login
 * @access Private (requires founder wallet)
 */
router.post('/founder/login', authenticate, requireFounder, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      message: 'Founder access granted',
      founder: {
        id: user._id,
        walletAddress: user.walletAddress,
        tier: 'founder',
        access: 'full',
        features: walletConnectService.getTierFeatures('founder')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/wallet/founder/dashboard
 * @desc Founder dashboard with full system access
 * @access Private (Founder only)
 */
router.get('/founder/dashboard', authenticate, requireFounder, async (req, res) => {
  try {
    res.json({
      success: true,
      dashboard: {
        access: 'full',
        sections: [
          'all_strategies',
          'all_exchanges',
          'all_features',
          'user_management',
          'system_config',
          'analytics',
          'revenue',
          'api_keys'
        ],
        message: 'Welcome, Founder. You have unrestricted access to all platform features.'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
