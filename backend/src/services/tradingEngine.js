import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { Signal } from '../models/Signal.js';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { getStrategy } from './strategies/index.js';
import { ExchangeConnector } from './exchangeConnector.js';
import { RiskManager } from './riskManager.js';
import { featureEngineering } from './featureEngineering.js';

export class TradingEngine {
  constructor(wss) {
    this.wss = wss;
    this.isRunning = false;
    this.activeStrategies = new Map();
    this.exchangeConnectors = new Map();
    this.riskManagers = new Map();
    this.userBots = new Map(); // Track which users have auto-trading enabled
    this.marketData = new Map();
    this.jobs = [];
    
    // Default trading pairs
    this.tradingPairs = {
      crypto: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
      forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'],
      commodity: ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL']
    };
  }

  initialize() {
    logger.info('Initializing Trading Engine...');
    
    // Start market data collection
    this.startMarketDataCollection();
    
    // Start signal generation
    this.startSignalGeneration();
    
    // Start auto-trading monitor
    this.startAutoTradingMonitor();
    
    // Start position monitor
    this.startPositionMonitor();
    
    this.isRunning = true;
    logger.info('Trading Engine initialized successfully');
  }

  // Register user for auto-trading
  async registerUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.error(`User not found: ${userId}`);
        return false;
      }

      // Create exchange connector
      const isTestnet = user.tradingSettings?.paperTrading !== false;
      const connector = new ExchangeConnector('binance', isTestnet);
      
      // Set API credentials if available
      const binanceConfig = user.exchanges?.find(e => e.name === 'binance');
      if (binanceConfig?.apiKey && binanceConfig?.apiSecret) {
        connector.setCredentials(binanceConfig.apiKey, binanceConfig.apiSecret);
      }
      
      this.exchangeConnectors.set(userId, connector);
      
      // Create risk manager
      const riskManager = new RiskManager({
        maxRiskPerTrade: user.tradingSettings?.stopLossPercent || 2,
        maxDailyRisk: user.tradingSettings?.maxDailyLoss || 6,
        maxPositions: user.tradingSettings?.maxPositionSize ? Math.floor(user.tradingSettings.maxPositionSize / 100) : 5,
        maxLeverage: user.tradingSettings?.leverage || 1
      });
      
      this.riskManagers.set(userId, riskManager);
      
      // Track auto-trading status
      this.userBots.set(userId, {
        autoTrading: user.tradingSettings?.autoTrading || false,
        paperTrading: user.tradingSettings?.paperTrading !== false,
        defaultStrategy: user.tradingSettings?.defaultStrategy || 'quantum_ai',
        lastSignal: null
      });
      
      logger.info(`User registered for trading: ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error registering user ${userId}:`, error);
      return false;
    }
  }

  // Start market data collection
  startMarketDataCollection() {
    // Collect data every minute
    const job = cron.schedule('* * * * *', async () => {
      await this.collectMarketData();
    });
    
    this.jobs.push(job);
    logger.info('Market data collection started');
  }

  // Collect market data for all pairs
  async collectMarketData() {
    const connector = new ExchangeConnector('binance', true);
    
    for (const [assetType, symbols] of Object.entries(this.tradingPairs)) {
      for (const symbol of symbols) {
        try {
          // Skip forex and commodities for Binance (they don't have all pairs)
          if (assetType === 'forex' || assetType === 'commodity') continue;
          
          const data = await connector.getMarketData(symbol, '1h', 100);
          this.marketData.set(symbol, {
            ...data,
            assetType,
            lastUpdated: Date.now()
          });
        } catch (error) {
          logger.warn(`Failed to get market data for ${symbol}:`, error.message);
        }
      }
    }
    
    // Broadcast market data update
    this.broadcast('marketData', {
      timestamp: Date.now(),
      pairs: Array.from(this.marketData.keys())
    });
  }

  // Start signal generation
  startSignalGeneration() {
    // Generate signals every 5 minutes
    const job = cron.schedule('*/5 * * * *', async () => {
      await this.generateSignals();
    });
    
    this.jobs.push(job);
    logger.info('Signal generation started');
  }

  // Generate trading signals
  async generateSignals() {
    logger.info('Generating trading signals with XQ Trade M8 ensemble...');
    
    for (const [symbol, data] of this.marketData) {
      try {
        // Apply feature engineering
        const enhancedData = featureEngineering.processAllFeatures(data);
        
        // Use XQ Trade M8 ensemble strategy (primary)
        const strategies = ['xq_trade_m8', 'quantum_ai', 'crypto_bot'];
        
        for (const strategyName of strategies) {
          const strategy = getStrategy(strategyName);
          const signal = await strategy.generateSignal({
            symbol,
            ...enhancedData
          });
          
          if (signal && this.validateSignal(signal)) {
            // Add feature engineering metadata
            signal.metadata = {
              ...signal.metadata,
              rsi: enhancedData.rsi,
              macd: enhancedData.macd,
              marketRegime: enhancedData.marketRegime,
              volumeProfile: enhancedData.volumeProfile,
              supportResistance: enhancedData.supportResistance,
              volatility: enhancedData.volatility
            };
            
            await this.saveSignal(signal);
            
            // Broadcast new signal
            this.broadcast('newSignal', signal);
            
            // Check for auto-trading
            await this.checkAutoTrading(signal);
            
            logger.info(`Signal generated: ${symbol} ${signal.side} (${strategyName}, confidence: ${signal.confidenceScore}%)`);
            
            // Only use the first successful strategy per symbol
            break;
          }
        }
      } catch (error) {
        logger.error(`Error generating signal for ${symbol}:`, error);
      }
    }
  }

  // Validate signal
  validateSignal(signal) {
    return signal && 
           signal.symbol && 
           signal.side && 
           signal.entryPrice > 0 && 
           signal.stopLoss > 0 && 
           signal.takeProfit > 0 &&
           signal.confidenceScore >= 70;
  }

  // Save signal to database
  async saveSignal(signalData) {
    try {
      const signal = new Signal({
        signalId: `SIG_${uuidv4().substr(0, 8).toUpperCase()}`,
        ...signalData,
        currentPrice: signalData.entryPrice,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      await signal.save();
      return signal;
    } catch (error) {
      logger.error('Error saving signal:', error);
      return null;
    }
  }

  // Check auto-trading for all users
  async checkAutoTrading(signal) {
    for (const [userId, botConfig] of this.userBots) {
      if (!botConfig.autoTrading) continue;
      
      // Check if signal matches user's preferred strategy
      if (signal.strategy !== botConfig.defaultStrategy && botConfig.defaultStrategy !== 'all') {
        continue;
      }
      
      // Execute trade
      await this.executeAutoTrade(userId, signal);
    }
  }

  // Execute auto-trade for a user
  async executeAutoTrade(userId, signal) {
    try {
      const connector = this.exchangeConnectors.get(userId);
      const riskManager = this.riskManagers.get(userId);
      const botConfig = this.userBots.get(userId);
      
      if (!connector || !riskManager) {
        logger.warn(`User ${userId} not properly registered for trading`);
        return;
      }

      // Get user account info
      const user = await User.findById(userId);
      if (!user) return;

      // Check risk limits
      const haltCheck = riskManager.shouldHaltTrading();
      if (haltCheck.halted) {
        logger.warn(`Auto-trading halted for user ${userId}: ${haltCheck.reason}`);
        return;
      }

      // Get open positions
      const openPositions = await Trade.find({ 
        userId, 
        status: { $in: ['open', 'pending'] } 
      });

      // Calculate position size
      const accountBalance = user.portfolio?.availableBalance || 10000;
      const quantity = riskManager.calculatePositionSize(
        signal.entryPrice,
        signal.stopLoss,
        accountBalance,
        user.tradingSettings?.stopLossPercent || 2
      );

      // Validate trade
      const validation = riskManager.validateTrade(
        {
          symbol: signal.symbol,
          side: signal.side,
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          quantity
        },
        accountBalance,
        openPositions
      );

      if (!validation.isValid) {
        logger.warn(`Auto-trade validation failed for user ${userId}:`, validation.errors);
        return;
      }

      // Execute trade
      const isPaperTrade = botConfig.paperTrading;
      
      let orderResult;
      if (isPaperTrade) {
        orderResult = await connector.simulateOrder({
          symbol: signal.symbol,
          side: signal.side,
          quantity,
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        });
      } else {
        orderResult = await connector.createOrder({
          symbol: signal.symbol,
          side: signal.side,
          type: 'market',
          quantity,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        });
      }

      // Save trade
      const trade = new Trade({
        userId,
        signalId: signal._id,
        symbol: signal.symbol,
        assetType: signal.assetType,
        side: signal.side,
        entryPrice: orderResult.price || signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        quantity,
        status: 'open',
        exchangeOrderId: orderResult.orderId,
        strategy: signal.strategy,
        isAutoTrade: true,
        isPaperTrade
      });

      await trade.save();

      // Update signal with auto-trade info
      await Signal.findByIdAndUpdate(signal._id, {
        $push: {
          autoTrades: {
            userId,
            tradeId: trade._id,
            executedAt: new Date()
          }
        }
      });

      // Update risk manager
      riskManager.updateDailyStats({
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        quantity: trade.quantity,
        accountBalance,
        profit: 0
      });

      // Broadcast trade execution
      this.broadcast('tradeExecuted', {
        userId,
        trade: trade.toJSON(),
        isPaperTrade
      });

      logger.info(`Auto-trade executed for user ${userId}: ${signal.symbol} ${signal.side}`);

    } catch (error) {
      logger.error(`Error executing auto-trade for user ${userId}:`, error);
    }
  }

  // Start auto-trading monitor
  startAutoTradingMonitor() {
    // Check every 30 seconds
    const job = cron.schedule('*/30 * * * * *', async () => {
      await this.monitorAutoTrading();
    });
    
    this.jobs.push(job);
    logger.info('Auto-trading monitor started');
  }

  // Monitor auto-trading status
  async monitorAutoTrading() {
    // Refresh user bot configurations
    for (const [userId, botConfig] of this.userBots) {
      try {
        const user = await User.findById(userId);
        if (user) {
          botConfig.autoTrading = user.tradingSettings?.autoTrading || false;
          botConfig.paperTrading = user.tradingSettings?.paperTrading !== false;
        }
      } catch (error) {
        logger.error(`Error monitoring user ${userId}:`, error);
      }
    }
  }

  // Start position monitor
  startPositionMonitor() {
    // Check positions every minute
    const job = cron.schedule('* * * * *', async () => {
      await this.monitorPositions();
    });
    
    this.jobs.push(job);
    logger.info('Position monitor started');
  }

  // Monitor open positions for SL/TP hits
  async monitorPositions() {
    try {
      const openTrades = await Trade.find({ 
        status: { $in: ['open', 'pending'] }
      });

      for (const trade of openTrades) {
        const marketData = this.marketData.get(trade.symbol);
        if (!marketData) continue;

        const currentPrice = marketData.currentPrice;
        
        // Check stop loss
        if (trade.side === 'buy' && currentPrice <= trade.stopLoss) {
          await this.closeTrade(trade, currentPrice, 'stop_loss');
        } else if (trade.side === 'sell' && currentPrice >= trade.stopLoss) {
          await this.closeTrade(trade, currentPrice, 'stop_loss');
        }
        
        // Check take profit
        else if (trade.side === 'buy' && currentPrice >= trade.takeProfit) {
          await this.closeTrade(trade, currentPrice, 'take_profit');
        } else if (trade.side === 'sell' && currentPrice <= trade.takeProfit) {
          await this.closeTrade(trade, currentPrice, 'take_profit');
        }
      }
    } catch (error) {
      logger.error('Error monitoring positions:', error);
    }
  }

  // Close a trade
  async closeTrade(trade, exitPrice, reason) {
    try {
      trade.exitPrice = exitPrice;
      trade.status = 'closed';
      trade.closedAt = new Date();
      trade.notes = `Closed by ${reason}`;
      
      await trade.save();

      // Update user portfolio
      const user = await User.findById(trade.userId);
      if (user && user.portfolio) {
        user.portfolio.totalTrades++;
        if (trade.profit > 0) {
          user.portfolio.winningTrades++;
          user.portfolio.totalProfit += trade.profit;
        } else {
          user.portfolio.losingTrades++;
          user.portfolio.totalLoss += Math.abs(trade.profit);
        }
        user.portfolio.winRate = (user.portfolio.winningTrades / user.portfolio.totalTrades) * 100;
        await user.save();
      }

      // Broadcast trade closure
      this.broadcast('tradeClosed', {
        trade: trade.toJSON(),
        reason
      });

      logger.info(`Trade closed: ${trade.symbol} @ ${exitPrice} (${reason})`);
    } catch (error) {
      logger.error('Error closing trade:', error);
    }
  }

  // Execute one-click trade from signal
  async executeOneClickTrade(userId, signalId, customParams = {}) {
    try {
      const signal = await Signal.findById(signalId);
      if (!signal || signal.status !== 'active') {
        return { success: false, error: 'Signal not found or expired' };
      }

      // Ensure user is registered
      if (!this.userBots.has(userId)) {
        await this.registerUser(userId);
      }

      // Override with custom params if provided
      const tradeParams = {
        ...signal.toObject(),
        ...customParams
      };

      await this.executeAutoTrade(userId, tradeParams);

      // Update signal status
      signal.status = 'executed';
      signal.executedAt = new Date();
      await signal.save();

      return { success: true };
    } catch (error) {
      logger.error(`Error executing one-click trade:`, error);
      return { success: false, error: error.message };
    }
  }

  // Toggle auto-trading for user
  async toggleAutoTrading(userId, enabled) {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, error: 'User not found' };

      user.tradingSettings.autoTrading = enabled;
      await user.save();

      // Update local cache
      if (this.userBots.has(userId)) {
        this.userBots.get(userId).autoTrading = enabled;
      }

      logger.info(`Auto-trading ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
      return { success: true, autoTrading: enabled };
    } catch (error) {
      logger.error(`Error toggling auto-trading:`, error);
      return { success: false, error: error.message };
    }
  }

  // Toggle paper/live trading
  async togglePaperTrading(userId, enabled) {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, error: 'User not found' };

      user.tradingSettings.paperTrading = enabled;
      await user.save();

      // Update local cache
      if (this.userBots.has(userId)) {
        this.userBots.get(userId).paperTrading = enabled;
      }

      // Recreate exchange connector
      await this.registerUser(userId);

      logger.info(`Paper trading ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
      return { success: true, paperTrading: enabled };
    } catch (error) {
      logger.error(`Error toggling paper trading:`, error);
      return { success: false, error: error.message };
    }
  }

  // Broadcast message to all connected clients
  broadcast(event, data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ event, data, timestamp: Date.now() }));
        }
      });
    }
  }

  // Get engine status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeUsers: this.userBots.size,
      autoTradingUsers: Array.from(this.userBots.values()).filter(u => u.autoTrading).length,
      marketDataPairs: this.marketData.size,
      tradingPairs: this.tradingPairs
    };
  }

  // Stop the engine
  stop() {
    this.jobs.forEach(job => job.stop());
    this.isRunning = false;
    logger.info('Trading Engine stopped');
  }
}
