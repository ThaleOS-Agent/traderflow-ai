import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { Signal } from '../models/Signal.js';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { getStrategy } from './strategies/index.js';
import { rankStrategySignals, buildRecommendationPayload } from './strategySelector.js';
import { ExchangeConnector } from './exchangeConnector.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';
import { RiskManager } from './riskManager.js';
import { featureEngineering } from './featureEngineering.js';
import { recalculatePortfolio } from '../utils/portfolio.js';
import {
  SUPPORTED_TRADING_VENUES,
  normalizeStrategyName,
  normalizeTradingVenue
} from '../config/tradingVenues.js';

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

      // Create exchange connectors for every supported venue. Paper trading can
      // route to all venues immediately; live trading uses saved credentials.
      const isTestnet = user.tradingSettings?.paperTrading !== false;
      const connectors = new Map(
        SUPPORTED_TRADING_VENUES.map(exchange => [
          exchange,
          new MultiExchangeConnector(exchange, isTestnet)
        ])
      );

      for (const exchangeConfig of user.getDecryptedExchanges()) {
        if (!exchangeConfig.isActive) continue;

        const exchangeName = normalizeTradingVenue(exchangeConfig.name);
        const connector = new MultiExchangeConnector(exchangeName, exchangeConfig.isTestnet);

        if (exchangeConfig.apiKey) {
          connector.setCredentials(
            exchangeConfig.apiKey,
            exchangeConfig.apiSecret || '',
            exchangeConfig.passphrase
          );
        }

        connectors.set(exchangeName, connector);
      }
      
      this.exchangeConnectors.set(userId, connectors);
      
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
        defaultStrategy: user.tradingSettings?.defaultStrategy || 'all',
        enabledStrategies: ['all'],
        supportedExchanges: [...SUPPORTED_TRADING_VENUES],
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
    this.agentOrchestrator?.recordMarketData?.({
      timestamp: Date.now(),
      pairs: Array.from(this.marketData.keys())
    }, 'trading_engine');
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
    logger.info('Generating trading signals with ranked multi-strategy selection...');
    
    for (const [symbol, data] of this.marketData) {
      try {
        // Apply feature engineering
        const enhancedData = featureEngineering.processAllFeatures(data);
        const ranking = await rankStrategySignals({
          symbol,
          ...enhancedData
        });
        const recommendation = buildRecommendationPayload(ranking);
        const topCandidate = ranking.ranked[0];
        if (!topCandidate) continue;

        const signal = topCandidate.signal;
        if (!this.validateSignal(signal)) continue;

        signal.metadata = {
          ...signal.metadata,
          rsi: enhancedData.rsi,
          macd: enhancedData.macd,
          marketRegime: enhancedData.marketRegime,
          volumeProfile: enhancedData.volumeProfile,
          supportResistance: enhancedData.supportResistance,
          volatility: enhancedData.volatility,
          strategySelection: {
            ...recommendation,
            ranked: ranking.ranked.slice(0, 5).map((item) => ({
              strategy: item.code,
              score: item.compositeScore,
              confidenceScore: item.confidenceScore,
              riskReward: item.riskReward
            }))
          }
        };
        signal.analysis = `${signal.analysis} Decision bot recommendation: ${recommendation.recommendation}`;

        const savedSignal = await this.saveSignal(signal);
        this.broadcast('newSignal', savedSignal?.toJSON?.() || signal);

        if (this.agentOrchestrator) {
          await this.agentOrchestrator.processSignal(savedSignal?.toObject?.() || signal, 'trading_engine');
        } else {
          await this.checkAutoTrading(savedSignal?.toObject?.() || signal);
        }

        logger.info(`Signal generated: ${symbol} ${signal.side} (${signal.strategy}, composite: ${topCandidate.compositeScore}, confidence: ${signal.confidenceScore}%)`);
      } catch (error) {
        logger.error(`Error generating signal for ${symbol}:`, error);
      }
    }
  }

  ingestNativeMarketData(update) {
    const symbol = update?.symbol?.toUpperCase?.();
    if (!symbol) return null;

    const existing = this.marketData.get(symbol) || {
      symbol,
      assetType: 'crypto',
      prices: [],
      highs: [],
      lows: [],
      volumes: []
    };

    const currentPrice = Number(update.price ?? existing.currentPrice ?? 0) || existing.currentPrice || 0;
    const volumePoint = Number(update.size ?? update.volume24h ?? 0);

    const next = {
      ...existing,
      symbol,
      exchange: update.venue,
      currentPrice,
      bid: Number(update.bid ?? existing.bid ?? 0) || existing.bid,
      ask: Number(update.ask ?? existing.ask ?? 0) || existing.ask,
      volume24h: Number(update.volume24h ?? existing.volume24h ?? 0) || existing.volume24h,
      change24hPercent: Number(update.change24hPercent ?? existing.change24hPercent ?? 0) || existing.change24hPercent,
      lastTrade: update.type === 'trade' ? {
        price: Number(update.price ?? 0) || null,
        size: Number(update.size ?? 0) || null,
        side: update.side || null,
        timestamp: update.timestamp || Date.now()
      } : existing.lastTrade,
      lastUpdated: update.timestamp || Date.now(),
      source: update.source || 'native_exchange_ws'
    };

    if (currentPrice > 0) {
      next.prices = Array.isArray(existing.prices) ? existing.prices.slice(-199) : [];
      next.highs = Array.isArray(existing.highs) ? existing.highs.slice(-199) : [];
      next.lows = Array.isArray(existing.lows) ? existing.lows.slice(-199) : [];
      next.volumes = Array.isArray(existing.volumes) ? existing.volumes.slice(-199) : [];

      if (next.prices.length === 0 || next.lastUpdated - (existing.lastUpdated || 0) >= 60000) {
        next.prices.push(currentPrice);
        next.highs.push(currentPrice);
        next.lows.push(currentPrice);
        next.volumes.push(volumePoint || 0);
      } else {
        next.prices[next.prices.length - 1] = currentPrice;
        next.highs[next.highs.length - 1] = Math.max(next.highs[next.highs.length - 1] || currentPrice, currentPrice);
        next.lows[next.lows.length - 1] = Math.min(next.lows[next.lows.length - 1] || currentPrice, currentPrice);
        next.volumes[next.volumes.length - 1] = volumePoint || next.volumes[next.volumes.length - 1] || 0;
      }
    }

    this.marketData.set(symbol, next);
    return next;
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

  capQuantityByPositionValue(quantity, entryPrice, maxPositionValue) {
    const normalizedQuantity = Number(quantity) || 0;
    const normalizedPrice = Number(entryPrice) || 0;
    const normalizedMaxPositionValue = Number(maxPositionValue) || 0;

    if (normalizedQuantity <= 0 || normalizedPrice <= 0) return 0;
    if (normalizedMaxPositionValue <= 0) return normalizedQuantity;

    const maxQuantity = normalizedMaxPositionValue / normalizedPrice;
    const capped = Math.min(normalizedQuantity, maxQuantity);

    return Math.floor(capped * 10000) / 10000;
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
      
      const signalStrategy = normalizeStrategyName(signal.strategy);
      const enabledStrategies = botConfig.enabledStrategies || ['all'];
      const defaultStrategy = normalizeStrategyName(botConfig.defaultStrategy || 'all');

      // Default auto-trading behavior is all built-in strategies. If a future UI
      // narrows enabledStrategies, this still honors that explicit selection.
      if (!enabledStrategies.includes('all') &&
          !enabledStrategies.includes(signalStrategy) &&
          defaultStrategy !== 'all' &&
          signalStrategy !== defaultStrategy) {
        continue;
      }
      
      // Execute trade
      await this.executeAutoTrade(userId, signal);
    }
  }

  // Execute auto-trade for a user
  async executeAutoTrade(userId, signal) {
    try {
      const connectors = this.exchangeConnectors.get(userId);
      const riskManager = this.riskManagers.get(userId);
      const botConfig = this.userBots.get(userId);
      
      if (!riskManager || !botConfig) {
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
      const rawQuantity = riskManager.calculatePositionSize(
        signal.entryPrice,
        signal.stopLoss,
        accountBalance,
        user.tradingSettings?.stopLossPercent || 2
      );
      const quantity = this.capQuantityByPositionValue(
        rawQuantity,
        signal.entryPrice,
        user.tradingSettings?.maxPositionSize || 0
      );

      if (quantity <= 0) {
        logger.warn(`Auto-trade quantity resolved to zero for user ${userId}`);
        return;
      }

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
      const exchangeName = normalizeTradingVenue(signal.exchange || signal.provider);
      const connector = connectors?.get(exchangeName);

      if (!isPaperTrade && (!connector || !connector.apiKey)) {
        logger.warn(`Live exchange ${exchangeName} not configured for user ${userId}`);
        return;
      }
      
      let orderResult;
      if (isPaperTrade) {
        orderResult = await this.simulatePaperOrder({
          symbol: signal.symbol,
          side: signal.side,
          exchange: exchangeName,
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
        exchange: exchangeName,
        strategy: signal.strategy,
        isAutoTrade: true,
        isPaperTrade
      });

      await trade.save();
      const portfolio = await recalculatePortfolio(userId);

      // Update signal with auto-trade info
      const signalId = signal?._id?.toString?.() || signal?._id;
      if (!signalId) {
        throw new Error('Missing signal id for auto-trade update');
      }
      await Signal.findByIdAndUpdate(signalId, {
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
      this.broadcast('orderExecuted', {
        userId,
        order: trade.toJSON(),
        isPaperTrade
      });
      this.broadcast('portfolio_update', {
        userId,
        portfolio
      });
      this.agentOrchestrator?.recordExecution?.(trade.toJSON(), 'trading_engine');

      logger.info(`Auto-trade executed for user ${userId}: ${signal.symbol} ${signal.side} on ${exchangeName}`);

    } catch (error) {
      logger.error(`Error executing auto-trade for user ${userId}:`, error);
    }
  }

  simulatePaperOrder(orderParams) {
    const { symbol, side, exchange, quantity, entryPrice, stopLoss, takeProfit } = orderParams;
    const slippage = (Math.random() * 0.002 - 0.001);
    const executedPrice = entryPrice * (1 + slippage);

    return {
      orderId: `PAPER_${exchange}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side,
      exchange,
      quantity,
      price: executedPrice,
      status: 'FILLED',
      paperTrade: true,
      stopLoss,
      takeProfit,
      executedAt: new Date().toISOString()
    };
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
        userId: trade.userId?.toString?.() || trade.userId,
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

      // Only allow safe execution overrides from user input
      const allowedCustomParams = {};
      if (customParams && typeof customParams === 'object' && !Array.isArray(customParams)) {
        const allowedKeys = ['entryPrice', 'stopLoss', 'takeProfit', 'quantity'];
        for (const key of allowedKeys) {
          if (customParams[key] !== undefined) {
            allowedCustomParams[key] = customParams[key];
          }
        }
      }

      // Override execution params while preserving trusted signal identity/metadata
      const tradeParams = {
        ...signal.toObject(),
        ...allowedCustomParams,
        _id: signal._id
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

      // Keep the in-memory execution registry aligned with the persisted user setting.
      if (!this.userBots.has(userId)) {
        await this.registerUser(userId);
      } else {
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
        const userId = data?.userId?.toString?.() || data?.userId;
        if (userId && client.userId !== userId) return;
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
