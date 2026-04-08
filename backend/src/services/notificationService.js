import { logger } from '../utils/logger.js';
import webpush from 'web-push';
import { User } from '../models/User.js';

/**
 * Mobile Notification Service
 * Handles push notifications for trade alerts and opportunities
 */
export class NotificationService {
  constructor() {
    this.subscriptions = new Map();
    this.isInitialized = false;
    
    // VAPID keys for web push (in production, use environment variables)
    this.vapidKeys = {
      publicKey: 'BEl62iSMgVz8Yf0R3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q3x3l1Z9q',
      privateKey: 'YourPrivateKeyHere'
    };
    
    // Notification templates
    this.templates = {
      opportunity: {
        title: '🎯 Trading Opportunity Detected',
        icon: '/icons/opportunity.png',
        badge: '/icons/badge.png',
        requireInteraction: true
      },
      tradeExecuted: {
        title: '✅ Trade Executed',
        icon: '/icons/trade.png',
        badge: '/icons/badge.png'
      },
      tradeClosed: {
        title: '💰 Trade Closed',
        icon: '/icons/profit.png',
        badge: '/icons/badge.png'
      },
      stopLoss: {
        title: '🛑 Stop Loss Triggered',
        icon: '/icons/stop.png',
        badge: '/icons/badge.png'
      },
      takeProfit: {
        title: '🎉 Take Profit Hit',
        icon: '/icons/target.png',
        badge: '/icons/badge.png'
      },
      arbitrage: {
        title: '⚡ Arbitrage Opportunity',
        icon: '/icons/arbitrage.png',
        badge: '/icons/badge.png',
        requireInteraction: true
      },
      pattern: {
        title: '📊 Harmonic Pattern Detected',
        icon: '/icons/pattern.png',
        badge: '/icons/badge.png'
      },
      alert: {
        title: '🔔 Price Alert',
        icon: '/icons/alert.png',
        badge: '/icons/badge.png'
      },
      risk: {
        title: '⚠️ Risk Alert',
        icon: '/icons/risk.png',
        badge: '/icons/badge.png',
        requireInteraction: true
      }
    };
  }

  /**
   * Initialize notification service
   */
  async initialize() {
    try {
      // Setup web push with VAPID keys
      webpush.setVapidDetails(
        'mailto:admin@tradeflow.ai',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );
      
      this.isInitialized = true;
      logger.info('Notification Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Notification Service:', error.message);
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(userId, subscription) {
    try {
      // Validate subscription
      if (!subscription || !subscription.endpoint) {
        throw new Error('Invalid subscription');
      }
      
      // Store subscription
      this.subscriptions.set(userId, {
        ...subscription,
        subscribedAt: new Date(),
        lastActive: new Date()
      });
      
      // Update user in database
      await User.findByIdAndUpdate(userId, {
        'notifications.pushEnabled': true,
        'notifications.pushSubscription': subscription
      });
      
      // Send welcome notification
      await this.sendNotification(userId, {
        type: 'welcome',
        title: 'Welcome to TradeFlow AI',
        body: 'You will now receive trading alerts and notifications.',
        data: { action: 'welcome' }
      });
      
      logger.info(`User ${userId} subscribed to push notifications`);
      return { success: true };
      
    } catch (error) {
      logger.error(`Failed to subscribe user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId) {
    try {
      this.subscriptions.delete(userId);
      
      await User.findByIdAndUpdate(userId, {
        'notifications.pushEnabled': false,
        'notifications.pushSubscription': null
      });
      
      logger.info(`User ${userId} unsubscribed from push notifications`);
      return { success: true };
      
    } catch (error) {
      logger.error(`Failed to unsubscribe user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, notification) {
    try {
      const subscription = this.subscriptions.get(userId);
      
      if (!subscription) {
        // Try to get from database
        const user = await User.findById(userId);
        if (user?.notifications?.pushSubscription) {
          this.subscriptions.set(userId, user.notifications.pushSubscription);
        } else {
          return { success: false, error: 'No subscription found' };
        }
      }
      
      const template = this.templates[notification.type] || this.templates.alert;
      
      const payload = JSON.stringify({
        notification: {
          title: notification.title || template.title,
          body: notification.body,
          icon: notification.icon || template.icon,
          badge: template.badge,
          tag: notification.tag || `tradeflow-${Date.now()}`,
          requireInteraction: template.requireInteraction || false,
          actions: notification.actions || [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: {
            userId,
            ...notification.data,
            url: notification.url || '/dashboard'
          }
        }
      });
      
      await webpush.sendNotification(subscription, payload);
      
      // Log notification
      await this.logNotification(userId, notification);
      
      return { success: true };
      
    } catch (error) {
      logger.error(`Failed to send notification to ${userId}:`, error.message);
      
      // Remove invalid subscription
      if (error.statusCode === 410) {
        this.subscriptions.delete(userId);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Send opportunity notification
   */
  async sendOpportunityNotification(userId, opportunity) {
    const { symbol, side, confidenceScore, strategy, entryPrice, exchange } = opportunity;
    
    return this.sendNotification(userId, {
      type: 'opportunity',
      title: `🎯 ${symbol} ${side.toUpperCase()} Opportunity`,
      body: `${strategy} detected with ${confidenceScore}% confidence at $${entryPrice} on ${exchange}`,
      data: {
        symbol,
        side,
        entryPrice,
        exchange,
        opportunityId: opportunity.id,
        action: 'view_opportunity'
      },
      actions: [
        { action: 'trade', title: 'Trade Now' },
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      url: `/dashboard/signals?opportunity=${opportunity.id}`
    });
  }

  /**
   * Send trade executed notification
   */
  async sendTradeExecutedNotification(userId, trade) {
    const { symbol, side, quantity, entryPrice, isPaperTrade } = trade;
    
    return this.sendNotification(userId, {
      type: 'tradeExecuted',
      title: `✅ ${isPaperTrade ? '📄 ' : ''}${symbol} ${side.toUpperCase()} Executed`,
      body: `${quantity} ${symbol} @ $${entryPrice}`,
      data: {
        symbol,
        side,
        quantity,
        entryPrice,
        tradeId: trade._id,
        isPaperTrade,
        action: 'view_trade'
      },
      url: '/dashboard/positions'
    });
  }

  /**
   * Send trade closed notification
   */
  async sendTradeClosedNotification(userId, trade) {
    const { symbol, pnl, pnlPercent, exitReason } = trade;
    const isProfit = pnl > 0;
    
    return this.sendNotification(userId, {
      type: isProfit ? 'takeProfit' : 'stopLoss',
      title: isProfit ? '🎉 Profit Taken!' : '🛑 Stop Loss Hit',
      body: `${symbol}: $${Math.abs(pnl).toFixed(2)} (${pnlPercent}%) - ${exitReason}`,
      data: {
        symbol,
        pnl,
        pnlPercent,
        exitReason,
        tradeId: trade._id,
        action: 'view_trade'
      },
      url: '/dashboard/history'
    });
  }

  /**
   * Send arbitrage notification
   */
  async sendArbitrageNotification(userId, arbitrage) {
    const { symbol, buyExchange, sellExchange, netProfit, potentialProfit } = arbitrage;
    
    return this.sendNotification(userId, {
      type: 'arbitrage',
      title: '⚡ Arbitrage Opportunity',
      body: `${symbol}: Buy on ${buyExchange}, Sell on ${sellExchange} for ${netProfit}% profit ($${potentialProfit})`,
      data: {
        symbol,
        buyExchange,
        sellExchange,
        netProfit,
        potentialProfit,
        arbitrageId: arbitrage.id,
        action: 'view_arbitrage'
      },
      actions: [
        { action: 'execute', title: 'Execute' },
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      url: `/dashboard/arbitrage?id=${arbitrage.id}`
    });
  }

  /**
   * Send pattern detection notification
   */
  async sendPatternNotification(userId, pattern) {
    const { symbol, pattern: patternName, direction, confidence } = pattern;
    
    return this.sendNotification(userId, {
      type: 'pattern',
      title: `📊 ${patternName} Pattern on ${symbol}`,
      body: `${direction.toUpperCase()} pattern detected with ${confidence}% confidence`,
      data: {
        symbol,
        pattern: patternName,
        direction,
        confidence,
        action: 'view_pattern'
      },
      url: '/dashboard/patterns'
    });
  }

  /**
   * Send risk alert notification
   */
  async sendRiskAlert(userId, alert) {
    return this.sendNotification(userId, {
      type: 'risk',
      title: '⚠️ Risk Alert',
      body: alert.message,
      data: {
        alertType: alert.type,
        severity: alert.severity,
        action: 'view_risk'
      },
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'acknowledge', title: 'Acknowledge' }
      ],
      url: '/dashboard/risk'
    });
  }

  /**
   * Broadcast notification to all subscribed users
   */
  async broadcast(notification, filter = null) {
    const results = [];
    
    for (const [userId] of this.subscriptions) {
      try {
        // Apply filter if provided
        if (filter && !filter(userId)) continue;
        
        const result = await this.sendNotification(userId, notification);
        results.push({ userId, ...result });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Log notification to database
   */
  async logNotification(userId, notification) {
    try {
      // Could store in a Notification collection
      logger.info(`Notification sent to ${userId}: ${notification.title}`);
    } catch (error) {
      logger.error('Failed to log notification:', error.message);
    }
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      isInitialized: this.isInitialized,
      vapidPublicKey: this.vapidKeys.publicKey
    };
  }

  /**
   * Get VAPID public key for client subscription
   */
  getVapidPublicKey() {
    return this.vapidKeys.publicKey;
  }
}

export const notificationService = new NotificationService();
