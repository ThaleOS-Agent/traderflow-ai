import { walletConnectService } from '../services/walletConnectService.js';
import { logger } from '../utils/logger.js';

/**
 * Paywall Middleware
 * Checks if user has access to premium features based on subscription tier
 */

/**
 * Feature to tier mapping
 */
const FEATURE_TIERS = {
  // Free tier features
  'basic_signals': 'free',
  'paper_trading': 'free',
  'limited_strategies': 'free',
  
  // Bronze tier features
  'live_trading': 'bronze',
  'advanced_charts': 'bronze',
  'email_alerts': 'bronze',
  
  // Silver tier features
  'arbitrage_bot': 'silver',
  'harmonic_patterns': 'silver',
  'ml_predictions': 'silver',
  'multi_exchange': 'silver',
  
  // Gold tier features
  'ensemble_master': 'gold',
  'social_trading': 'gold',
  'options_calculator': 'gold',
  'copy_trading': 'gold',
  
  // Platinum tier features
  'dex_integration': 'platinum',
  'yield_farming': 'platinum',
  'priority_support': 'platinum',
  'forex_trading': 'platinum',
  
  // Diamond tier features
  'custom_strategies': 'diamond',
  'api_access': 'diamond',
  'white_glove_service': 'diamond',
  'unlimited_positions': 'diamond'
};

/**
 * Tier hierarchy (higher index = more access)
 */
const TIER_HIERARCHY = ['free', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'founder'];

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(userTier, feature) {
  // Founder has access to everything
  if (userTier === 'founder') {
    return true;
  }
  
  const requiredTier = FEATURE_TIERS[feature];
  if (!requiredTier) {
    // Feature not found, allow access (might be a new feature)
    return true;
  }
  
  const userTierIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredTierIndex = TIER_HIERARCHY.indexOf(requiredTier);
  
  return userTierIndex >= requiredTierIndex;
}

/**
 * Get required tier for a feature
 */
export function getRequiredTier(feature) {
  return FEATURE_TIERS[feature] || 'free';
}

/**
 * Paywall middleware factory
 * Creates middleware that checks access to a specific feature
 */
export function requireFeature(feature) {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const userTier = user.subscription?.tier || 'free';
      
      // Check if user has access
      if (hasFeatureAccess(userTier, feature)) {
        // Add tier info to request for downstream use
        req.userTier = userTier;
        req.userFeatures = walletConnectService.getTierFeatures(userTier);
        return next();
      }
      
      // User doesn't have access - return paywall response
      const requiredTier = getRequiredTier(feature);
      const paywallConfig = walletConnectService.getPaywallConfig(feature, userTier);
      
      logger.info(`Paywall triggered for user ${user._id}, feature: ${feature}, required: ${requiredTier}`);
      
      return res.status(403).json({
        success: false,
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        feature,
        currentTier: userTier,
        requiredTier,
        paywall: {
          title: 'Upgrade Required',
          message: `This feature requires a ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} subscription`,
          upgradeUrl: paywallConfig.upgradeUrl,
          pricing: paywallConfig.pricing,
          features: walletConnectService.subscriptionTiers[requiredTier]?.features || []
        }
      });
      
    } catch (error) {
      logger.error('Paywall middleware error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Require minimum tier middleware
 */
export function requireTier(minTier) {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const userTier = user.subscription?.tier || 'free';
      const userTierIndex = TIER_HIERARCHY.indexOf(userTier);
      const minTierIndex = TIER_HIERARCHY.indexOf(minTier);
      
      // Founder always has access
      if (userTier === 'founder' || userTierIndex >= minTierIndex) {
        req.userTier = userTier;
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Subscription upgrade required',
        code: 'TIER_UPGRADE_REQUIRED',
        currentTier: userTier,
        requiredTier: minTier,
        upgradeUrl: `/subscription/upgrade?to=${minTier}`
      });
      
    } catch (error) {
      logger.error('Tier requirement error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Check strategy access middleware
 */
export function requireStrategyAccess(strategyName) {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      const userTier = user.subscription?.tier || 'free';
      const maxStrategies = walletConnectService.subscriptionTiers[userTier]?.maxStrategies || 2;
      
      // Check if user can use this strategy
      const strategyTiers = {
        'basic': 'free',
        'trend_following': 'bronze',
        'mean_reversion': 'bronze',
        'breakout': 'silver',
        'arbitrage': 'silver',
        'harmonic_patterns': 'silver',
        'ml_ensemble': 'silver',
        'xq_trade_m8': 'gold',
        'ensemble_master': 'gold',
        'custom': 'diamond'
      };
      
      const requiredTier = strategyTiers[strategyName] || 'free';
      
      if (hasFeatureAccess(userTier, requiredTier)) {
        req.userTier = userTier;
        req.maxStrategies = maxStrategies;
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Strategy not available in your tier',
        code: 'STRATEGY_LOCKED',
        strategy: strategyName,
        requiredTier,
        currentTier: userTier
      });
      
    } catch (error) {
      logger.error('Strategy access error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Rate limit by tier middleware
 */
export function tierRateLimit() {
  return (req, res, next) => {
    try {
      const user = req.user;
      const userTier = user?.subscription?.tier || 'free';
      
      // Get tier limits
      const tierConfig = walletConnectService.subscriptionTiers[userTier];
      const maxApiCalls = tierConfig?.apiCallsPerDay || 100;
      
      // In production, implement actual rate limiting with Redis
      // For now, just attach limits to request
      req.apiLimit = maxApiCalls;
      req.apiRemaining = maxApiCalls; // Would be calculated from actual usage
      
      next();
      
    } catch (error) {
      logger.error('Rate limit error:', error.message);
      next();
    }
  };
}

/**
 * Founder access middleware
 * Ensures only founder can access certain routes
 */
export function requireFounder(req, res, next) {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    if (!user.isFounder && user.subscription?.tier !== 'founder') {
      return res.status(403).json({
        success: false,
        error: 'Founder access required',
        code: 'FOUNDER_REQUIRED'
      });
    }
    
    req.isFounder = true;
    next();
    
  } catch (error) {
    logger.error('Founder check error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default {
  hasFeatureAccess,
  getRequiredTier,
  requireFeature,
  requireTier,
  requireStrategyAccess,
  tierRateLimit,
  requireFounder
};
