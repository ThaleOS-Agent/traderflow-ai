import { logger } from '../utils/logger.js';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { Signal } from '../models/Signal.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';
import { RiskManager } from './riskManager.js';

/**
 * Auto-Execution Engine
 * Automatically executes trades when opportunities are detected
 */
export class AutoExecutionEngine {
  constructor(wss) {
    this.wss = wss;
    this.isRunning = false;
    this.userEngines = new Map(); // userId -> execution config
    this.pendingExecutions = [];
    this.executionHistory = [];
    
    // Default execution config
    this.defaultConfig = {
      enabled: false,
      paperTrading: true,
      minConfidence: 75,
      maxDailyTrades: 10,
      maxConcurrentPositions: 5,
      positionSizePercent: 10, // % of available balance per trade
      strategies: ['xq_trade_m8', 'harmonic', 'breakout', 'volume_spike'],
      exchanges: ['binance'],
      autoClose: true, // Auto close on target/SL
      trailingStop: false
    };
  }

  /**
   * Initialize auto-execution for a user
   */
  async initializeUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.error(`User not found: ${userId}`);
        return false;
      }

      // Get user trading settings
      const config = {
        ...this.defaultConfig,
        enabled: user.tradingSettings?.autoTrading || false,
        paperTrading: user.tradingSettings?.paperTrading !== false,
        strategies: [user.tradingSettings?.defaultStrategy || 'xq_trade_m8'],
        riskLevel: user.tradingSettings?.riskLevel || 'medium'
      };

      // Setup exchange connectors
      const exchanges = new Map();
      
      for (const exchangeConfig of user.exchanges || []) {
        if (!exchangeConfig.isActive) continue;
        
        const connector = new MultiExchangeConnector(
          exchangeConfig.name,
          exchangeConfig.isTestnet
        );
        
        if (exchangeConfig.apiKey && exchangeConfig.apiSecret) {
          connector.setCredentials(
            exchangeConfig.apiKey,
            exchangeConfig.apiSecret,
            exchangeConfig.passphrase
          );
        }
        
        exchanges.set(exchangeConfig.name, connector);
      }

      // Setup risk manager
      const riskManager = new RiskManager({
        maxRiskPerTrade: user.tradingSettings?.stopLossPercent || 2,
        maxDailyRisk: user.tradingSettings?.maxDailyLoss || 6,
        maxPositions: config.maxConcurrentPositions,
        maxLeverage: user.tradingSettings?.leverage || 1
      });

      this.userEngines.set(userId, {
        config,
        exchanges,
        riskManager,
        todayTrades: 0,
        lastReset: new Date().toDateString()
      });

      logger.info(`Auto-execution initialized for user ${userId}`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to initialize auto-execution for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Execute opportunity for all users with auto-trading enabled
   */
  async executeOpportunity(opportunity) {
    const { symbol, exchange, side, entryPrice, stopLoss, takeProfit, confidenceScore, strategy } = opportunity;
    
    logger.info(`Processing opportunity: ${symbol} ${side} (${strategy}, ${confidenceScore}%)`);
    
    // Find users with auto-trading enabled
    const users = await User.find({
      'tradingSettings.autoTrading': true
    });
    
    for (const user of users) {
      try {
        await this.executeForUser(user._id.toString(), opportunity);
      } catch (error) {
        logger.error(`Auto-execution failed for user ${user._id}:`, error.message);
      }
    }
  }

  /**
   * Execute trade for specific user
   */
  async executeForUser(userId, opportunity) {
    // Initialize user engine if not exists
    if (!this.userEngines.has(userId)) {
      const initialized = await this.initializeUser(userId);
      if (!initialized) return;
    }

    const engine = this.userEngines.get(userId);
    const { config, exchanges, riskManager } = engine;

    // Check if auto-execution is enabled
    if (!config.enabled) return;

    // Check daily trade limit
    if (engine.todayTrades >= config.maxDailyTrades) {
      logger.warn(`User ${userId} daily trade limit reached`);
      return;
    }

    // Reset daily counter if new day
    if (new Date().toDateString() !== engine.lastReset) {
      engine.todayTrades = 0;
      engine.lastReset = new Date().toDateString();
    }

    // Check confidence threshold
    if (opportunity.confidenceScore < config.minConfidence) {
      logger.info(`Opportunity confidence (${opportunity.confidenceScore}%) below threshold for user ${userId}`);
      return;
    }

    // Check if strategy is allowed
    if (!config.strategies.includes(opportunity.strategy?.toLowerCase().replace(' ', '_'))) {
      return;
    }

    // Get exchange connector
    const exchangeName = opportunity.exchange || 'binance';
    const connector = exchanges.get(exchangeName);
    
    if (!connector) {
      logger.warn(`Exchange ${exchangeName} not configured for user ${userId}`);
      return;
    }

    // Get user account info
    const user = await User.findById(userId);
    const accountBalance = user.portfolio?.availableBalance || 10000;

    // Get open positions
    const openPositions = await Trade.find({
      userId,
      status: { $in: ['open', 'pending'] }
    });

    // Check position limit
    if (openPositions.length >= config.maxConcurrentPositions) {
      logger.warn(`User ${userId} max positions reached`);
      return;
    }

    // Calculate position size
    const positionSize = this.calculatePositionSize(
      accountBalance,
      config.positionSizePercent,
      opportunity.entryPrice,
      opportunity.stopLoss
    );

    // Validate with risk manager
    const validation = riskManager.validateTrade(
      {
        symbol: opportunity.symbol,
        side: opportunity.side,
        entryPrice: opportunity.entryPrice,
        stopLoss: opportunity.stopLoss,
        takeProfit: opportunity.takeProfit,
        quantity: positionSize
      },
      accountBalance,
      openPositions
    );

    if (!validation.isValid) {
      logger.warn(`Risk validation failed for user ${userId}:`, validation.errors);
      return;
    }

    // Execute the trade
    const isPaperTrade = config.paperTrading;
    
    let orderResult;
    try {
      if (isPaperTrade) {
        orderResult = await this.simulateOrder({
          symbol: opportunity.symbol,
          side: opportunity.side,
          quantity: positionSize,
          entryPrice: opportunity.entryPrice,
          stopLoss: opportunity.stopLoss,
          takeProfit: opportunity.takeProfit
        });
      } else {
        orderResult = await connector.createOrder({
          symbol: opportunity.symbol,
          side: opportunity.side,
          type: 'market',
          quantity: positionSize,
          stopLoss: opportunity.stopLoss,
          takeProfit: opportunity.takeProfit
        });
      }

      // Save trade record
      const trade = new Trade({
        userId,
        symbol: opportunity.symbol,
        assetType: opportunity.assetType || 'crypto',
        side: opportunity.side,
        entryPrice: orderResult.price || opportunity.entryPrice,
        stopLoss: opportunity.stopLoss,
        takeProfit: opportunity.takeProfit,
        quantity: positionSize,
        status: 'open',
        exchangeOrderId: orderResult.orderId,
        exchange: exchangeName,
        strategy: opportunity.strategy?.toLowerCase().replace(' ', '_') || 'auto',
        isAutoTrade: true,
        isPaperTrade,
        notes: `Auto-executed: ${opportunity.analysis || ''}`
      });

      await trade.save();

      // Save signal record
      const signal = new Signal({
        signalId: `SIG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        symbol: opportunity.symbol,
        assetType: opportunity.assetType || 'crypto',
        side: opportunity.side,
        entryPrice: opportunity.entryPrice,
        stopLoss: opportunity.stopLoss,
        takeProfit: opportunity.takeProfit,
        confidence: opportunity.confidence,
        confidenceScore: opportunity.confidenceScore,
        strategy: opportunity.strategy?.toLowerCase().replace(' ', '_') || 'auto',
        analysis: opportunity.analysis,
        status: 'executed',
        executedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await signal.save();

      // Update user stats
      engine.todayTrades++;
      
      // Update risk manager
      riskManager.updateDailyStats({
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        quantity: trade.quantity,
        accountBalance,
        profit: 0
      });

      // Broadcast execution
      this.broadcast('autoTradeExecuted', {
        userId,
        trade: trade.toJSON(),
        opportunity,
        isPaperTrade
      });

      this.executionHistory.push({
        userId,
        tradeId: trade._id,
        symbol: opportunity.symbol,
        side: opportunity.side,
        timestamp: new Date(),
        isPaperTrade
      });

      logger.info(`Auto-trade executed for user ${userId}: ${opportunity.symbol} ${opportunity.side} @ ${orderResult.price || opportunity.entryPrice}`);

    } catch (error) {
      logger.error(`Order execution failed for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(accountBalance, positionSizePercent, entryPrice, stopLoss) {
    const riskAmount = accountBalance * (positionSizePercent / 100);
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    if (priceRisk === 0) return 0;
    
    const quantity = riskAmount / priceRisk;
    
    // Round based on price magnitude
    if (entryPrice < 1) {
      return Math.floor(quantity * 10000) / 10000; // 4 decimals
    } else if (entryPrice < 100) {
      return Math.floor(quantity * 100) / 100; // 2 decimals
    }
    
    return Math.floor(quantity * 10) / 10; // 1 decimal
  }

  /**
   * Simulate order for paper trading
   */
  async simulateOrder(orderParams) {
    const { symbol, side, quantity, entryPrice, stopLoss, takeProfit } = orderParams;
    
    // Simulate slippage
    const slippage = (Math.random() * 0.002 - 0.001); // ±0.1%
    const executedPrice = entryPrice * (1 + slippage);
    
    const orderId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`Paper trade executed: ${side} ${quantity} ${symbol} @ ${executedPrice.toFixed(8)}`);
    
    return {
      orderId,
      symbol,
      side,
      quantity,
      price: executedPrice,
      status: 'FILLED',
      paperTrade: true,
      stopLoss,
      takeProfit,
      executedAt: new Date().toISOString()
    };
  }

  /**
   * Update auto-execution config for user
   */
  async updateConfig(userId, newConfig) {
    const engine = this.userEngines.get(userId);
    if (!engine) {
      await this.initializeUser(userId);
      return this.updateConfig(userId, newConfig);
    }

    engine.config = {
      ...engine.config,
      ...newConfig
    };

    // Update user in database
    await User.findByIdAndUpdate(userId, {
      'tradingSettings.autoTrading': engine.config.enabled,
      'tradingSettings.paperTrading': engine.config.paperTrading
    });

    logger.info(`Auto-execution config updated for user ${userId}`);
    return engine.config;
  }

  /**
   * Get execution config for user
   */
  getConfig(userId) {
    const engine = this.userEngines.get(userId);
    return engine?.config || null;
  }

  /**
   * Get execution statistics
   */
  getStats(userId) {
    const engine = this.userEngines.get(userId);
    if (!engine) return null;

    const userExecutions = this.executionHistory.filter(e => e.userId === userId);
    
    return {
      enabled: engine.config.enabled,
      paperTrading: engine.config.paperTrading,
      todayTrades: engine.todayTrades,
      maxDailyTrades: engine.config.maxDailyTrades,
      totalExecutions: userExecutions.length,
      recentExecutions: userExecutions.slice(-10)
    };
  }

  /**
   * Enable/disable auto-execution
   */
  async toggle(userId, enabled) {
    return this.updateConfig(userId, { enabled });
  }

  /**
   * Broadcast message
   */
  broadcast(event, data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            event, 
            data, 
            timestamp: Date.now(),
            source: 'autoExecution'
          }));
        }
      });
    }
  }

  /**
   * Stop engine
   */
  stop() {
    this.isRunning = false;
    this.userEngines.clear();
    logger.info('Auto-Execution Engine stopped');
  }
}

export const autoExecution = new AutoExecutionEngine();
