import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';
import { featureEngineering } from './featureEngineering.js';
import { getStrategy } from './strategies/index.js';
import { harmonicDetector } from './harmonicPatterns.js';

/**
 * Universal Asset Scanner
 * Scans ALL available assets across multiple exchanges for trading opportunities
 */
export class AssetScanner {
  constructor(wss) {
    this.wss = wss;
    this.isRunning = false;
    this.exchanges = new Map();
    this.allAssets = new Map(); // symbol -> { exchange, base, quote, data }
    this.opportunities = [];
    this.scanJobs = [];
    this.activeScans = new Set();
    
    // Configuration
    this.config = {
      minVolume24h: 100000,      // Minimum 24h volume in USD
      minPrice: 0.000001,        // Minimum price to consider
      maxPrice: 100000,          // Maximum price
      scanInterval: 1,           // Minutes between scans
      opportunityThreshold: 75,  // Minimum confidence score
      maxConcurrentScans: 50,    // Limit concurrent API calls
      topAssetsPerExchange: 200  // Focus on top liquid assets
    };
    
    // Performance tracking
    this.stats = {
      totalAssets: 0,
      assetsScanned: 0,
      opportunitiesFound: 0,
      tradesExecuted: 0,
      lastScanTime: null
    };
  }

  /**
   * Initialize scanner with exchange connections
   */
  async initialize(exchangeConfigs) {
    logger.info('Initializing Universal Asset Scanner...');
    
    // Setup exchange connections
    for (const config of exchangeConfigs) {
      try {
        const connector = new MultiExchangeConnector(config.exchange, config.isTestnet);
        
        if (config.apiKey && config.apiSecret) {
          connector.setCredentials(config.apiKey, config.apiSecret, config.passphrase);
        }
        
        this.exchanges.set(config.exchange, {
          connector,
          config,
          assets: [],
          lastScan: null
        });
        
        logger.info(`Exchange connected: ${config.exchange}`);
      } catch (error) {
        logger.error(`Failed to connect ${config.exchange}:`, error.message);
      }
    }
    
    // Discover all available assets
    await this.discoverAllAssets();
    
    // Start continuous scanning
    this.startScanning();
    
    this.isRunning = true;
    logger.info(`Asset Scanner initialized. Tracking ${this.stats.totalAssets} assets across ${this.exchanges.size} exchanges`);
  }

  /**
   * Discover all trading pairs across all exchanges
   */
  async discoverAllAssets() {
    logger.info('Discovering all available assets...');
    
    for (const [exchangeName, exchangeData] of this.exchanges) {
      try {
        const { connector } = exchangeData;
        const pairs = await connector.getTradingPairs();
        
        // Filter and process pairs
        const validPairs = pairs.filter(pair => {
          // Filter by quote currency (focus on major pairs)
          const validQuotes = ['USDT', 'USD', 'USDC', 'BTC', 'ETH', 'EUR'];
          return validQuotes.includes(pair.quote);
        });
        
        // Store assets
        for (const pair of validPairs.slice(0, this.config.topAssetsPerExchange)) {
          const assetKey = `${exchangeName}:${pair.symbol}`;
          
          this.allAssets.set(assetKey, {
            exchange: exchangeName,
            symbol: pair.symbol,
            base: pair.base,
            quote: pair.quote,
            type: pair.type,
            lastPrice: null,
            volume24h: null,
            change24h: null,
            lastScan: null,
            opportunity: null
          });
        }
        
        exchangeData.assets = validPairs;
        logger.info(`${exchangeName}: Discovered ${validPairs.length} trading pairs`);
        
      } catch (error) {
        logger.error(`Failed to discover assets from ${exchangeName}:`, error.message);
      }
    }
    
    this.stats.totalAssets = this.allAssets.size;
  }

  /**
   * Start continuous market scanning
   */
  startScanning() {
    // Scan every minute
    const job = cron.schedule(`*/${this.config.scanInterval} * * * *`, async () => {
      await this.scanAllAssets();
    });
    
    this.scanJobs.push(job);
    logger.info(`Asset scanning started (every ${this.config.scanInterval} minutes)`);
  }

  /**
   * Scan all assets for opportunities
   */
  async scanAllAssets() {
    if (this.activeScans.size > 0) {
      logger.warn('Previous scan still running, skipping...');
      return;
    }

    logger.info(`Starting scan of ${this.allAssets.size} assets...`);
    this.stats.lastScanTime = new Date();
    
    // Group assets by exchange for efficient scanning
    const assetsByExchange = new Map();
    
    for (const [key, asset] of this.allAssets) {
      if (!assetsByExchange.has(asset.exchange)) {
        assetsByExchange.set(asset.exchange, []);
      }
      assetsByExchange.get(asset.exchange).push({ key, ...asset });
    }
    
    // Scan each exchange
    for (const [exchangeName, assets] of assetsByExchange) {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) continue;
      
      // Process in batches to avoid rate limits
      const batches = this.chunkArray(assets, this.config.maxConcurrentScans);
      
      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(asset => this.scanAsset(asset, exchange.connector))
        );
        
        // Small delay between batches
        await this.sleep(100);
      }
    }
    
    this.stats.assetsScanned = this.allAssets.size;
    logger.info(`Scan complete. Found ${this.opportunities.length} opportunities`);
    
    // Broadcast scan complete
    this.broadcast('scanComplete', {
      assetsScanned: this.stats.assetsScanned,
      opportunitiesFound: this.opportunities.length,
      timestamp: Date.now()
    });
  }

  /**
   * Scan a single asset for trading opportunities
   */
  async scanAsset(asset, connector) {
    const scanKey = `${asset.exchange}:${asset.symbol}`;
    
    if (this.activeScans.has(scanKey)) return;
    this.activeScans.add(scanKey);
    
    try {
      // Get market data
      const klines = await connector.getKlines(asset.symbol, '1h', 100);
      
      if (!klines || klines.length < 50) {
        this.activeScans.delete(scanKey);
        return;
      }
      
      // Parse data based on exchange format
      const prices = klines.map(k => parseFloat(k[4] || k.close));
      const highs = klines.map(k => parseFloat(k[2] || k.high));
      const lows = klines.map(k => parseFloat(k[3] || k.low));
      const volumes = klines.map(k => parseFloat(k[5] || k.volume));
      const currentPrice = prices[prices.length - 1];
      
      // Get 24h stats
      const ticker = await connector.getTicker(asset.symbol);
      const volume24h = parseFloat(ticker.volume || ticker.v || 0);
      const change24h = parseFloat(ticker.priceChangePercent || ticker.P || 0);
      
      // Filter by volume
      if (volume24h * currentPrice < this.config.minVolume24h) {
        this.activeScans.delete(scanKey);
        return;
      }
      
      // Build market data
      const marketData = {
        symbol: asset.symbol,
        exchange: asset.exchange,
        prices,
        highs,
        lows,
        volumes,
        currentPrice,
        volume24h,
        change24h,
        assetType: this.getAssetType(asset.base)
      };
      
      // Apply feature engineering
      const enhancedData = featureEngineering.processAllFeatures(marketData);
      
      // Check for opportunities using multiple strategies
      const opportunities = await this.findOpportunities(enhancedData);
      
      // Update asset data
      const storedAsset = this.allAssets.get(asset.key);
      if (storedAsset) {
        storedAsset.lastPrice = currentPrice;
        storedAsset.volume24h = volume24h;
        storedAsset.change24h = change24h;
        storedAsset.lastScan = new Date();
        storedAsset.opportunity = opportunities.length > 0 ? opportunities[0] : null;
      }
      
      // Process opportunities
      for (const opp of opportunities) {
        if (opp.confidenceScore >= this.config.opportunityThreshold) {
          await this.processOpportunity(opp, marketData);
        }
      }
      
    } catch (error) {
      // Silently fail for individual assets
      // logger.debug(`Scan failed for ${scanKey}:`, error.message);
    } finally {
      this.activeScans.delete(scanKey);
    }
  }

  /**
   * Find trading opportunities using multiple strategies
   */
  async findOpportunities(marketData) {
    const opportunities = [];
    
    // Strategy 1: XQ Trade M8 Ensemble
    try {
      const strategy = getStrategy('xq_trade_m8');
      const signal = await strategy.generateSignal(marketData);
      if (signal) {
        opportunities.push({
          ...signal,
          strategy: 'XQ Trade M8',
          priority: 1
        });
      }
    } catch (e) {}
    
    // Strategy 2: Harmonic Patterns
    try {
      const patterns = harmonicDetector.scan(marketData.prices, marketData.highs, marketData.lows);
      for (const pattern of patterns) {
        if (pattern.confidence >= 70) {
          opportunities.push({
            symbol: marketData.symbol,
            exchange: marketData.exchange,
            assetType: marketData.assetType,
            side: pattern.direction === 'bullish' ? 'buy' : 'sell',
            entryPrice: pattern.entry,
            stopLoss: pattern.stopLoss,
            takeProfit: pattern.targets[1],
            confidence: pattern.confidence >= 90 ? 'very_high' : pattern.confidence >= 80 ? 'high' : 'medium',
            confidenceScore: pattern.confidence,
            strategy: `Harmonic ${pattern.pattern}`,
            priority: 2,
            analysis: `${pattern.pattern} ${pattern.direction} pattern detected`,
            metadata: { pattern }
          });
        }
      }
    } catch (e) {}
    
    // Strategy 3: Breakout Detection
    try {
      const breakout = this.detectBreakout(marketData);
      if (breakout) {
        opportunities.push({
          ...breakout,
          strategy: 'Breakout',
          priority: 3
        });
      }
    } catch (e) {}
    
    // Strategy 4: Volume Spike
    try {
      const volumeSpike = this.detectVolumeSpike(marketData);
      if (volumeSpike) {
        opportunities.push({
          ...volumeSpike,
          strategy: 'Volume Spike',
          priority: 4
        });
      }
    } catch (e) {}
    
    return opportunities.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Detect breakout patterns
   */
  detectBreakout(marketData) {
    const { prices, highs, lows, currentPrice, volumes } = marketData;
    
    // Find resistance/support levels
    const period = 20;
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const resistance = Math.max(...recentHighs);
    const support = Math.min(...recentLows);
    
    // Check for breakout
    const breakoutThreshold = 0.005; // 0.5%
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    // Bullish breakout
    if (currentPrice > resistance * (1 + breakoutThreshold) && currentVolume > avgVolume * 1.5) {
      const atr = this.calculateATR(highs, lows, prices, 14);
      return {
        symbol: marketData.symbol,
        exchange: marketData.exchange,
        assetType: marketData.assetType,
        side: 'buy',
        entryPrice: currentPrice,
        stopLoss: currentPrice - atr * 2,
        takeProfit: currentPrice + (currentPrice - support) * 1.5,
        confidence: 'high',
        confidenceScore: 80,
        analysis: `Breakout above resistance at $${resistance.toFixed(4)}`,
        metadata: { resistance, support }
      };
    }
    
    // Bearish breakdown
    if (currentPrice < support * (1 - breakoutThreshold) && currentVolume > avgVolume * 1.5) {
      const atr = this.calculateATR(highs, lows, prices, 14);
      return {
        symbol: marketData.symbol,
        exchange: marketData.exchange,
        assetType: marketData.assetType,
        side: 'sell',
        entryPrice: currentPrice,
        stopLoss: currentPrice + atr * 2,
        takeProfit: currentPrice - (resistance - currentPrice) * 1.5,
        confidence: 'high',
        confidenceScore: 80,
        analysis: `Breakdown below support at $${support.toFixed(4)}`,
        metadata: { resistance, support }
      };
    }
    
    return null;
  }

  /**
   * Detect volume spike opportunities
   */
  detectVolumeSpike(marketData) {
    const { prices, volumes, currentPrice } = marketData;
    
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    if (volumeRatio < 3) return null; // Need 3x volume spike
    
    // Price momentum
    const priceChange = (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5];
    
    if (priceChange > 0.02) {
      // Bullish volume spike
      return {
        symbol: marketData.symbol,
        exchange: marketData.exchange,
        assetType: marketData.assetType,
        side: 'buy',
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.97,
        takeProfit: currentPrice * 1.06,
        confidence: 'medium',
        confidenceScore: 75,
        analysis: `Volume spike ${volumeRatio.toFixed(1)}x average with ${(priceChange * 100).toFixed(2)}% price increase`,
        metadata: { volumeRatio }
      };
    } else if (priceChange < -0.02) {
      // Bearish volume spike
      return {
        symbol: marketData.symbol,
        exchange: marketData.exchange,
        assetType: marketData.assetType,
        side: 'sell',
        entryPrice: currentPrice,
        stopLoss: currentPrice * 1.03,
        takeProfit: currentPrice * 0.94,
        confidence: 'medium',
        confidenceScore: 75,
        analysis: `Volume spike ${volumeRatio.toFixed(1)}x average with ${(priceChange * 100).toFixed(2)}% price decrease`,
        metadata: { volumeRatio }
      };
    }
    
    return null;
  }

  /**
   * Process discovered opportunity
   */
  async processOpportunity(opportunity, marketData) {
    // Check if opportunity already exists
    const existingIndex = this.opportunities.findIndex(
      o => o.symbol === opportunity.symbol && o.exchange === opportunity.exchange
    );
    
    if (existingIndex >= 0) {
      // Update existing opportunity
      this.opportunities[existingIndex] = {
        ...opportunity,
        detectedAt: new Date(),
        occurrences: (this.opportunities[existingIndex].occurrences || 1) + 1
      };
    } else {
      // Add new opportunity
      this.opportunities.push({
        ...opportunity,
        id: `OPP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        detectedAt: new Date(),
        occurrences: 1
      });
      
      this.stats.opportunitiesFound++;
      
      // Broadcast to connected clients
      this.broadcast('opportunity', opportunity);
      
      logger.info(`Opportunity found: ${opportunity.symbol} on ${opportunity.exchange} - ${opportunity.side.toUpperCase()} (${opportunity.strategy}, ${opportunity.confidenceScore}%)`);
    }
    
    // Keep only recent opportunities
    this.opportunities = this.opportunities
      .filter(o => new Date() - new Date(o.detectedAt) < 3600000) // 1 hour
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 100); // Keep top 100
  }

  /**
   * Get asset type from symbol
   */
  getAssetType(base) {
    const crypto = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'DOT', 'XRP', 'DOGE', 'AVAX', 'MATIC'];
    const forex = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
    const commodities = ['XAU', 'XAG', 'USOIL', 'UKOIL', 'GOLD', 'SILVER'];
    
    if (crypto.includes(base)) return 'crypto';
    if (forex.includes(base)) return 'forex';
    if (commodities.includes(base)) return 'commodity';
    return 'crypto'; // Default
  }

  /**
   * Calculate ATR
   */
  calculateATR(highs, lows, closes, period) {
    if (highs.length < period) return 0;
    
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trs.push(Math.max(tr1, tr2, tr3));
    }
    
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Chunk array for batch processing
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all tracked assets
   */
  getAllAssets() {
    return Array.from(this.allAssets.values());
  }

  /**
   * Get active opportunities
   */
  getOpportunities(minConfidence = 0) {
    return this.opportunities.filter(o => o.confidenceScore >= minConfidence);
  }

  /**
   * Get scanner statistics
   */
  getStats() {
    return {
      ...this.stats,
      exchanges: this.exchanges.size,
      activeScans: this.activeScans.size,
      queueSize: 0
    };
  }

  /**
   * Broadcast message
   */
  broadcast(event, data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ event, data, timestamp: Date.now() }));
        }
      });
    }
  }

  /**
   * Stop scanner
   */
  stop() {
    this.scanJobs.forEach(job => job.stop());
    this.isRunning = false;
    logger.info('Asset Scanner stopped');
  }
}

export const assetScanner = new AssetScanner();
