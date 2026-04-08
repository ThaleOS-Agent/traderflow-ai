import { logger } from '../utils/logger.js';
import { User } from '../models/User.js';
import crypto from 'crypto';

/**
 * WalletConnect Service
 * Handles crypto wallet authentication and connection
 */
export class WalletConnectService {
  constructor() {
    this.activeSessions = new Map();
    this.pendingRequests = new Map();
    
    // Supported chains
    this.supportedChains = {
      'eip155:1': { name: 'Ethereum', currency: 'ETH' },
      'eip155:56': { name: 'BSC', currency: 'BNB' },
      'eip155:137': { name: 'Polygon', currency: 'MATIC' },
      'eip155:42161': { name: 'Arbitrum', currency: 'ETH' },
      'eip155:10': { name: 'Optimism', currency: 'ETH' },
      'eip155:43114': { name: 'Avalanche', currency: 'AVAX' }
    };
    
    // Subscription pricing in USD
    this.subscriptionTiers = {
      free: {
        name: 'Free',
        price: 0,
        features: ['basic_signals', 'paper_trading', 'limited_strategies'],
        maxStrategies: 2,
        maxPositions: 3,
        apiCallsPerDay: 100
      },
      bronze: {
        name: 'Bronze',
        price: 29,
        features: ['all_free_features', 'live_trading', 'advanced_charts', 'email_alerts'],
        maxStrategies: 5,
        maxPositions: 10,
        apiCallsPerDay: 1000
      },
      silver: {
        name: 'Silver',
        price: 79,
        features: ['all_bronze_features', 'arbitrage_bot', 'harmonic_patterns', 'ml_predictions'],
        maxStrategies: 10,
        maxPositions: 25,
        apiCallsPerDay: 5000
      },
      gold: {
        name: 'Gold',
        price: 199,
        features: ['all_silver_features', 'ensemble_master', 'social_trading', 'options_calculator'],
        maxStrategies: 20,
        maxPositions: 50,
        apiCallsPerDay: 20000
      },
      platinum: {
        name: 'Platinum',
        price: 499,
        features: ['all_gold_features', 'dex_integration', 'yield_farming', 'priority_support'],
        maxStrategies: 50,
        maxPositions: 100,
        apiCallsPerDay: 100000
      },
      diamond: {
        name: 'Diamond',
        price: 999,
        features: ['all_platinum_features', 'custom_strategies', 'white_glove_service', 'api_access'],
        maxStrategies: 100,
        maxPositions: 500,
        apiCallsPerDay: 500000
      }
    };
    
    // Founder access
    this.founderWallets = [
      // Add founder wallet addresses here
      '0x0000000000000000000000000000000000000000' // Placeholder
    ];
  }

  /**
   * Create a new WalletConnect session
   */
  async createSession() {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      uri: `wc:${sessionId}@2?relay-protocol=irn&symKey=${crypto.randomBytes(32).toString('hex')}`
    };
    
    this.activeSessions.set(sessionId, session);
    
    logger.info(`WalletConnect session created: ${sessionId}`);
    
    return session;
  }

  /**
   * Connect wallet and authenticate user
   */
  async connectWallet(sessionId, walletData) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }
      
      const { address, chainId, signature, message } = walletData;
      
      // Verify signature
      const isValid = await this.verifySignature(address, message, signature);
      if (!isValid) {
        throw new Error('Invalid signature');
      }
      
      // Normalize address
      const normalizedAddress = address.toLowerCase();
      
      // Check if user exists
      let user = await User.findOne({ walletAddress: normalizedAddress });
      
      if (!user) {
        // Create new user
        user = await User.create({
          walletAddress: normalizedAddress,
          authMethod: 'wallet',
          chainId,
          subscription: {
            tier: 'free',
            status: 'active',
            expiresAt: null
          },
          createdAt: new Date()
        });
        
        logger.info(`New user created via wallet: ${normalizedAddress}`);
      }
      
      // Check if founder
      const isFounder = this.founderWallets.includes(normalizedAddress);
      if (isFounder) {
        user.subscription.tier = 'founder';
        user.subscription.status = 'lifetime';
        user.isFounder = true;
        await user.save();
        logger.info(`Founder login: ${normalizedAddress}`);
      }
      
      // Update session
      session.status = 'connected';
      session.walletAddress = normalizedAddress;
      session.userId = user._id.toString();
      session.chainId = chainId;
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      return {
        success: true,
        user: {
          id: user._id,
          walletAddress: normalizedAddress,
          tier: user.subscription.tier,
          isFounder: user.isFounder || false,
          features: this.getTierFeatures(user.subscription.tier)
        },
        token,
        session
      };
      
    } catch (error) {
      logger.error('Wallet connect error:', error.message);
      throw error;
    }
  }

  /**
   * Verify wallet signature
   */
  async verifySignature(address, message, signature) {
    try {
      // In production, use ethers.js or web3.js to verify
      // For now, simulate verification
      const expectedMessage = `TradeFlow AI Login\nNonce: ${Date.now()}\nTimestamp: ${new Date().toISOString()}`;
      
      // Simple check - in production use proper EIP-191/EIP-712 verification
      return signature && signature.length === 132 && signature.startsWith('0x');
    } catch (error) {
      logger.error('Signature verification error:', error.message);
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user._id.toString(),
      walletAddress: user.walletAddress,
      tier: user.subscription.tier,
      isFounder: user.isFounder || false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    // In production, use proper JWT signing
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    return token;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get tier features
   */
  getTierFeatures(tier) {
    if (tier === 'founder') {
      return {
        ...this.subscriptionTiers.diamond.features,
        founder: true,
        all_features: true
      };
    }
    
    const tierConfig = this.subscriptionTiers[tier];
    return tierConfig ? tierConfig.features : this.subscriptionTiers.free.features;
  }

  /**
   * Check if user has access to a feature
   */
  checkFeatureAccess(tier, feature) {
    const features = this.getTierFeatures(tier);
    return features.includes(feature) || features.includes('all_features');
  }

  /**
   * Get subscription tiers
   */
  getSubscriptionTiers() {
    return Object.entries(this.subscriptionTiers).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(userId, newTier, paymentData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const tierConfig = this.subscriptionTiers[newTier];
      if (!tierConfig) {
        throw new Error('Invalid tier');
      }
      
      // In production, process crypto payment here
      // For now, simulate successful payment
      
      user.subscription = {
        tier: newTier,
        status: 'active',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentMethod: paymentData.method || 'crypto',
        txHash: paymentData.txHash || null
      };
      
      await user.save();
      
      logger.info(`User ${userId} upgraded to ${newTier} tier`);
      
      return {
        success: true,
        tier: newTier,
        features: this.getTierFeatures(newTier),
        expiresAt: user.subscription.expiresAt
      };
      
    } catch (error) {
      logger.error('Subscription upgrade error:', error.message);
      throw error;
    }
  }

  /**
   * Get paywall config for a feature
   */
  getPaywallConfig(feature, currentTier) {
    const featureTiers = {
      'live_trading': 'bronze',
      'arbitrage_bot': 'silver',
      'harmonic_patterns': 'silver',
      'ml_predictions': 'silver',
      'ensemble_master': 'gold',
      'social_trading': 'gold',
      'options_calculator': 'gold',
      'dex_integration': 'platinum',
      'yield_farming': 'platinum',
      'custom_strategies': 'diamond',
      'api_access': 'diamond'
    };
    
    const requiredTier = featureTiers[feature];
    if (!requiredTier) {
      return null; // Feature not found or free
    }
    
    const tierOrder = ['free', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'founder'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    
    if (currentIndex >= requiredIndex) {
      return { hasAccess: true };
    }
    
    return {
      hasAccess: false,
      requiredTier,
      currentTier,
      upgradeUrl: `/subscription/upgrade?to=${requiredTier}&feature=${feature}`,
      pricing: this.subscriptionTiers[requiredTier]
    };
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'disconnected';
      session.disconnectedAt = new Date();
      logger.info(`Wallet disconnected: ${session.walletAddress}`);
    }
    
    return { success: true };
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { status: 'not_found' };
    }
    
    if (session.expiresAt < new Date()) {
      return { status: 'expired' };
    }
    
    return {
      status: session.status,
      walletAddress: session.walletAddress,
      chainId: session.chainId
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [id, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
    
    return cleaned;
  }
}

export const walletConnectService = new WalletConnectService();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  walletConnectService.cleanupSessions();
}, 5 * 60 * 1000);
