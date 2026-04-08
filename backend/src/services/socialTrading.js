import { logger } from '../utils/logger.js';
import { User } from '../models/User.js';
import { Trade } from '../models/Trade.js';
import { Signal } from '../models/Signal.js';

/**
 * Social Trading Service
 * Enables copy trading, signal sharing, and trader leaderboards
 */
export class SocialTradingService {
  constructor() {
    this.traderProfiles = new Map();
    this.copyRelationships = new Map();
    this.tradingSignals = new Map();
    this.copiedTrades = new Map();
    
    // Tier requirements
    this.tierRequirements = {
      bronze: { minFollowers: 0, minWinRate: 0, minTrades: 0 },
      silver: { minFollowers: 10, minWinRate: 55, minTrades: 50, maxDrawdown: 20 },
      gold: { minFollowers: 50, minWinRate: 60, minTrades: 100, maxDrawdown: 15, minSharpe: 1.0 },
      platinum: { minFollowers: 200, minWinRate: 65, minTrades: 250, maxDrawdown: 12, minSharpe: 1.5, minReturn: 20 },
      diamond: { minFollowers: 500, minWinRate: 70, minTrades: 500, maxDrawdown: 10, minSharpe: 2.0, minReturn: 50 }
    };
  }

  /**
   * Register a new trader for social trading
   */
  async registerTrader(userId, profileData = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const traderProfile = {
        traderId: userId,
        username: user.username || profileData.username || `trader_${userId.slice(-6)}`,
        displayName: profileData.displayName || user.username,
        tier: 'bronze',
        totalFollowers: 0,
        totalCopiers: 0,
        verified: false,
        bio: profileData.bio || '',
        strategies: profileData.strategies || [],
        
        // Performance metrics
        totalReturn: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        avgHoldingPeriod: 0,
        
        // Risk metrics
        riskScore: 5.0,
        volatility: 0,
        beta: 1.0,
        
        // Activity
        signalsPosted: 0,
        tradesExecuted: 0,
        lastActive: new Date(),
        joinDate: new Date(),
        
        // Ratings
        averageRating: 0,
        totalReviews: 0,
        
        // Visibility
        isPublic: profileData.isPublic !== false,
        allowCopying: profileData.allowCopying !== false
      };

      this.traderProfiles.set(userId, traderProfile);
      
      // Update user record
      await User.findByIdAndUpdate(userId, {
        'socialTrading.isTrader': true,
        'socialTrading.traderProfile': traderProfile
      });

      logger.info(`Registered new trader: ${userId}`);
      return traderProfile;
    } catch (error) {
      logger.error('Error registering trader:', error.message);
      throw error;
    }
  }

  /**
   * Post a trading signal
   */
  async postSignal(providerId, signalData) {
    try {
      const provider = this.traderProfiles.get(providerId);
      if (!provider) {
        throw new Error('Trader not registered for social trading');
      }

      const signal = {
        signalId: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        providerId,
        symbol: signalData.symbol,
        signalType: signalData.signalType, // buy, sell, hold, take_profit, stop_loss
        entryPrice: signalData.entryPrice,
        targetPrice: signalData.targetPrice,
        stopLoss: signalData.stopLoss,
        confidence: signalData.confidence || 0.5,
        timeHorizon: signalData.timeHorizon || 'short', // short, medium, long
        analysis: signalData.analysis || '',
        createdAt: new Date(),
        expiresAt: signalData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
        
        // Performance tracking
        result: null,
        actualReturn: null,
        hitTarget: false,
        hitStopLoss: false
      };

      this.tradingSignals.set(signal.signalId, signal);
      
      // Update provider stats
      provider.signalsPosted++;
      provider.lastActive = new Date();

      // Save to database
      await Signal.create({
        ...signal,
        userId: providerId
      });

      // Execute copy trades for followers
      await this.executeCopyTrades(signal);

      logger.info(`Signal posted: ${signal.signalId} by ${providerId}`);
      return signal;
    } catch (error) {
      logger.error('Error posting signal:', error.message);
      throw error;
    }
  }

  /**
   * Create a copy trading relationship
   */
  async createCopyRelationship(followerId, providerId, settings = {}) {
    try {
      const provider = this.traderProfiles.get(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      if (!provider.allowCopying) {
        throw new Error('This trader does not allow copy trading');
      }

      const relationshipId = `copy_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const relationship = {
        relationshipId,
        followerId,
        providerId,
        status: 'active', // active, paused, stopped
        allocationPercentage: settings.allocationPercentage || 10, // % of portfolio
        maxAllocationAmount: settings.maxAllocationAmount || 1000,
        riskMultiplier: settings.riskMultiplier || 1.0,
        
        // Copy settings
        copyAllTrades: settings.copyAllTrades !== false,
        copySpecificSymbols: settings.copySpecificSymbols || [],
        minSignalConfidence: settings.minSignalConfidence || 0,
        maxPositionSize: settings.maxPositionSize || 500,
        
        // Performance tracking
        totalCopiedTrades: 0,
        successfulTrades: 0,
        totalPnl: 0,
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.copyRelationships.set(relationshipId, relationship);
      
      // Update follower counts
      provider.totalFollowers++;
      provider.totalCopiers++;

      // Update user records
      await User.findByIdAndUpdate(followerId, {
        $push: {
          'socialTrading.copying': {
            providerId,
            relationshipId,
            startedAt: new Date()
          }
        }
      });

      logger.info(`Copy relationship created: ${relationshipId}`);
      return relationship;
    } catch (error) {
      logger.error('Error creating copy relationship:', error.message);
      throw error;
    }
  }

  /**
   * Execute copy trades for a signal
   */
  async executeCopyTrades(signal) {
    try {
      const executedTrades = [];
      
      // Find all active copy relationships for this provider
      const activeRelationships = Array.from(this.copyRelationships.values())
        .filter(rel => rel.providerId === signal.providerId && rel.status === 'active');

      for (const relationship of activeRelationships) {
        try {
          // Check if should copy this signal
          if (!await this.shouldCopySignal(signal, relationship)) {
            continue;
          }

          // Calculate position size
          const positionSize = await this.calculateCopyPositionSize(signal, relationship);
          
          if (positionSize <= 0) {
            continue;
          }

          // Create copied trade record
          const copiedTrade = {
            tradeId: `copy_trade_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            originalSignalId: signal.signalId,
            relationshipId: relationship.relationshipId,
            followerId: relationship.followerId,
            providerId: relationship.providerId,
            symbol: signal.symbol,
            side: signal.signalType,
            quantity: positionSize,
            entryPrice: signal.entryPrice,
            exitPrice: null,
            pnl: 0,
            pnlPercentage: 0,
            openedAt: new Date(),
            closedAt: null,
            status: 'open'
          };

          this.copiedTrades.set(copiedTrade.tradeId, copiedTrade);
          
          // Update relationship stats
          relationship.totalCopiedTrades++;
          relationship.updatedAt = new Date();

          executedTrades.push(copiedTrade);

        } catch (error) {
          logger.error(`Error executing copy trade for ${relationship.followerId}:`, error.message);
        }
      }

      logger.info(`Executed ${executedTrades.length} copy trades for signal ${signal.signalId}`);
      return executedTrades;
    } catch (error) {
      logger.error('Error executing copy trades:', error.message);
      return [];
    }
  }

  /**
   * Check if a signal should be copied
   */
  async shouldCopySignal(signal, relationship) {
    // Check if copying all trades
    if (!relationship.copyAllTrades) {
      if (relationship.copySpecificSymbols.length > 0 && 
          !relationship.copySpecificSymbols.includes(signal.symbol)) {
        return false;
      }
    }

    // Check confidence threshold
    if (signal.confidence < relationship.minSignalConfidence) {
      return false;
    }

    // Check if signal is still valid
    if (signal.expiresAt && new Date(signal.expiresAt) < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Calculate position size for copy trade
   */
  async calculateCopyPositionSize(signal, relationship) {
    try {
      // Get follower's portfolio value
      const follower = await User.findById(relationship.followerId);
      const portfolioValue = follower?.portfolio?.totalValue || 10000;

      // Base position size from allocation percentage
      const baseSize = portfolioValue * (relationship.allocationPercentage / 100);
      
      // Apply risk multiplier
      const adjustedSize = baseSize * relationship.riskMultiplier;
      
      // Apply maximum limits
      let positionSize = Math.min(adjustedSize, relationship.maxPositionSize);
      positionSize = Math.min(positionSize, relationship.maxAllocationAmount);

      return positionSize;
    } catch (error) {
      logger.error('Error calculating copy position size:', error.message);
      return 0;
    }
  }

  /**
   * Get trader leaderboard
   */
  async getTraderLeaderboard(timeframe = 'monthly', limit = 50) {
    try {
      // Get all active traders
      const traders = Array.from(this.traderProfiles.values())
        .filter(t => t.isPublic && t.tradesExecuted >= 10);

      // Sort based on timeframe
      let sortedTraders;
      if (timeframe === 'risk_adjusted') {
        sortedTraders = traders.sort((a, b) => 
          (b.sharpeRatio * b.totalReturn) - (a.sharpeRatio * a.totalReturn)
        );
      } else if (timeframe === 'followers') {
        sortedTraders = traders.sort((a, b) => b.totalFollowers - a.totalFollowers);
      } else {
        // Default: sort by total return
        sortedTraders = traders.sort((a, b) => 
          (b.totalReturn * b.winRate) - (a.totalReturn * a.winRate)
        );
      }

      // Format leaderboard
      const leaderboard = sortedTraders.slice(0, limit).map((trader, index) => ({
        rank: index + 1,
        traderId: trader.traderId,
        username: trader.username,
        displayName: trader.displayName,
        tier: trader.tier,
        verified: trader.verified,
        totalReturn: trader.totalReturn,
        winRate: trader.winRate,
        sharpeRatio: trader.sharpeRatio,
        maxDrawdown: trader.maxDrawdown,
        followers: trader.totalFollowers,
        trades: trader.tradesExecuted,
        riskScore: trader.riskScore
      }));

      return leaderboard;
    } catch (error) {
      logger.error('Error getting trader leaderboard:', error.message);
      return [];
    }
  }

  /**
   * Update trader performance metrics
   */
  async updateTraderMetrics(traderId) {
    try {
      const profile = this.traderProfiles.get(traderId);
      if (!profile) {
        throw new Error('Trader profile not found');
      }

      // Get trade history
      const trades = await Trade.find({ userId: traderId, status: 'closed' })
        .sort({ closedAt: -1 })
        .limit(100);

      if (trades.length < 10) {
        return { error: 'Insufficient trade history' };
      }

      // Calculate metrics
      const winningTrades = trades.filter(t => t.pnl > 0);
      const losingTrades = trades.filter(t => t.pnl <= 0);
      
      const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
      const winRate = (winningTrades.length / trades.length) * 100;
      
      // Calculate max drawdown
      const cumulativePnl = [];
      let runningSum = 0;
      for (const trade of trades) {
        runningSum += trade.pnl;
        cumulativePnl.push(runningSum);
      }
      const maxDrawdown = this.calculateMaxDrawdown(cumulativePnl);

      // Calculate Sharpe ratio (simplified)
      const returns = trades.map(t => t.pnlPercentage);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdReturn = Math.sqrt(returns.reduce((sum, r) => 
        sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

      // Update profile
      profile.totalReturn = totalPnl;
      profile.winRate = winRate;
      profile.maxDrawdown = maxDrawdown;
      profile.sharpeRatio = sharpeRatio;
      profile.tradesExecuted = trades.length;
      profile.lastActive = new Date();

      // Check for tier upgrade
      await this.checkTierUpgrade(traderId);

      return {
        traderId,
        totalReturn: profile.totalReturn,
        winRate: profile.winRate,
        maxDrawdown: profile.maxDrawdown,
        sharpeRatio: profile.sharpeRatio,
        tier: profile.tier
      };
    } catch (error) {
      logger.error('Error updating trader metrics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Calculate max drawdown
   */
  calculateMaxDrawdown(cumulativeReturns) {
    let maxDrawdown = 0;
    let peak = cumulativeReturns[0] || 0;

    for (const value of cumulativeReturns) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / Math.abs(peak);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100;
  }

  /**
   * Check and upgrade trader tier
   */
  async checkTierUpgrade(traderId) {
    try {
      const profile = this.traderProfiles.get(traderId);
      if (!profile) return;

      const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
      const currentIndex = tiers.indexOf(profile.tier);

      if (currentIndex >= tiers.length - 1) return;

      const nextTier = tiers[currentIndex + 1];
      const requirements = this.tierRequirements[nextTier];

      // Check requirements
      const meetsRequirements = 
        profile.totalFollowers >= requirements.minFollowers &&
        profile.winRate >= requirements.minWinRate &&
        profile.tradesExecuted >= requirements.minTrades &&
        (!requirements.maxDrawdown || profile.maxDrawdown <= requirements.maxDrawdown) &&
        (!requirements.minSharpe || profile.sharpeRatio >= requirements.minSharpe) &&
        (!requirements.minReturn || profile.totalReturn >= requirements.minReturn);

      if (meetsRequirements) {
        profile.tier = nextTier;
        logger.info(`Trader ${traderId} upgraded to ${nextTier} tier`);
      }
    } catch (error) {
      logger.error('Error checking tier upgrade:', error.message);
    }
  }

  /**
   * Get copy trading performance
   */
  async getCopyPerformance(relationshipId) {
    try {
      const relationship = this.copyRelationships.get(relationshipId);
      if (!relationship) {
        throw new Error('Copy relationship not found');
      }

      // Get all copied trades
      const copiedTrades = Array.from(this.copiedTrades.values())
        .filter(t => t.relationshipId === relationshipId);

      if (copiedTrades.length === 0) {
        return {
          relationshipId,
          totalTrades: 0,
          message: 'No trades copied yet'
        };
      }

      // Calculate metrics
      const totalTrades = copiedTrades.length;
      const winningTrades = copiedTrades.filter(t => t.pnl > 0);
      const winRate = (winningTrades.length / totalTrades) * 100;
      
      const totalPnl = copiedTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalInvested = copiedTrades.reduce((sum, t) => 
        sum + (t.quantity * t.entryPrice), 0);
      const totalReturn = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      return {
        relationshipId,
        providerId: relationship.providerId,
        followerId: relationship.followerId,
        status: relationship.status,
        performance: {
          totalTrades,
          winningTrades: winningTrades.length,
          winRate: winRate.toFixed(2),
          totalPnl: totalPnl.toFixed(2),
          totalReturn: totalReturn.toFixed(2)
        },
        settings: {
          allocationPercentage: relationship.allocationPercentage,
          riskMultiplier: relationship.riskMultiplier,
          maxPositionSize: relationship.maxPositionSize
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting copy performance:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Stop copy trading relationship
   */
  async stopCopyRelationship(relationshipId) {
    try {
      const relationship = this.copyRelationships.get(relationshipId);
      if (!relationship) {
        throw new Error('Copy relationship not found');
      }

      relationship.status = 'stopped';
      relationship.updatedAt = new Date();

      // Update provider copier count
      const provider = this.traderProfiles.get(relationship.providerId);
      if (provider) {
        provider.totalCopiers = Math.max(0, provider.totalCopiers - 1);
      }

      logger.info(`Copy relationship stopped: ${relationshipId}`);
      return { success: true, relationshipId };
    } catch (error) {
      logger.error('Error stopping copy relationship:', error.message);
      throw error;
    }
  }

  /**
   * Get trader profile
   */
  getTraderProfile(traderId) {
    return this.traderProfiles.get(traderId);
  }

  /**
   * Get active signals for a provider
   */
  getActiveSignals(providerId) {
    return Array.from(this.tradingSignals.values())
      .filter(s => s.providerId === providerId && s.status === 'active');
  }

  /**
   * Get social trading stats
   */
  getStats() {
    return {
      totalTraders: this.traderProfiles.size,
      totalCopyRelationships: this.copyRelationships.size,
      totalSignals: this.tradingSignals.size,
      totalCopiedTrades: this.copiedTrades.size
    };
  }
}

export const socialTradingService = new SocialTradingService();
