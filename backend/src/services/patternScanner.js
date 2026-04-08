import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { harmonicDetector } from './harmonicPatterns.js';
import { featureEngineering } from './featureEngineering.js';
import { ExchangeConnector } from './exchangeConnector.js';

/**
 * Pattern Scanner Service
 * Continuously scans markets for harmonic patterns and chart formations
 */
export class PatternScanner {
  constructor(wss) {
    this.wss = wss;
    this.isRunning = false;
    this.activePatterns = new Map();
    this.patternHistory = [];
    this.scanJobs = [];
    this.symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    this.timeframes = ['15m', '1h', '4h'];
  }

  /**
   * Initialize the pattern scanner
   */
  initialize() {
    logger.info('Initializing Pattern Scanner...');
    
    // Start continuous scanning
    this.startPatternScanning();
    
    // Start pattern validation (check if patterns complete/fail)
    this.startPatternValidation();
    
    this.isRunning = true;
    logger.info('Pattern Scanner initialized successfully');
  }

  /**
   * Start scanning for patterns across all symbols and timeframes
   */
  startPatternScanning() {
    // Scan every 5 minutes
    const job = cron.schedule('*/5 * * * *', async () => {
      await this.scanAllMarkets();
    });
    
    this.scanJobs.push(job);
    logger.info('Pattern scanning started (every 5 minutes)');
  }

  /**
   * Scan all configured markets for patterns
   */
  async scanAllMarkets() {
    const connector = new ExchangeConnector('binance', true);
    
    for (const symbol of this.symbols) {
      for (const timeframe of this.timeframes) {
        try {
          const klines = await connector.getKlines(symbol, timeframe, 100);
          
          const prices = klines.map(k => parseFloat(k[4]));
          const highs = klines.map(k => parseFloat(k[2]));
          const lows = klines.map(k => parseFloat(k[3]));
          const volumes = klines.map(k => parseFloat(k[5]));
          
          const marketData = {
            symbol,
            timeframe,
            prices,
            highs,
            lows,
            volumes,
            currentPrice: prices[prices.length - 1],
            lastUpdated: Date.now()
          };
          
          // Scan for harmonic patterns
          const patterns = harmonicDetector.scan(prices, highs, lows);
          
          if (patterns.length > 0) {
            for (const pattern of patterns) {
              await this.processPattern(symbol, timeframe, pattern, marketData);
            }
          }
          
        } catch (error) {
          logger.error(`Error scanning ${symbol} ${timeframe}:`, error.message);
        }
      }
    }
  }

  /**
   * Process detected pattern
   */
  async processPattern(symbol, timeframe, pattern, marketData) {
    const patternKey = `${symbol}-${timeframe}-${pattern.pattern}-${pattern.direction}`;
    
    // Check if we already have this pattern active
    if (this.activePatterns.has(patternKey)) {
      return;
    }
    
    const patternData = {
      id: `PAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      timeframe,
      patternType: pattern.pattern,
      direction: pattern.direction,
      confidence: pattern.confidence,
      entryPrice: pattern.entry,
      stopLoss: pattern.stopLoss,
      targets: pattern.targets,
      ratios: pattern.ratios,
      points: pattern.points,
      detectedAt: new Date(),
      status: 'active',
      marketData
    };
    
    // Store pattern
    this.activePatterns.set(patternKey, patternData);
    this.patternHistory.push(patternData);
    
    // Broadcast to connected clients
    this.broadcast('patternDetected', patternData);
    
    logger.info(`Pattern detected: ${pattern.pattern} ${pattern.direction} on ${symbol} (${timeframe}) - Confidence: ${pattern.confidence.toFixed(1)}%`);
  }

  /**
   * Validate active patterns (check if they complete or fail)
   */
  startPatternValidation() {
    const job = cron.schedule('* * * * *', async () => {
      await this.validatePatterns();
    });
    
    this.scanJobs.push(job);
    logger.info('Pattern validation started (every minute)');
  }

  /**
   * Check if active patterns have hit targets or stop loss
   */
  async validatePatterns() {
    const connector = new ExchangeConnector('binance', true);
    
    for (const [key, pattern] of this.activePatterns) {
      try {
        const ticker = await connector.getTicker(pattern.symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        
        let status = pattern.status;
        let result = null;
        
        if (pattern.direction === 'bullish') {
          // Check stop loss
          if (currentPrice <= pattern.stopLoss) {
            status = 'failed';
            result = 'stop_loss';
          }
          // Check targets
          else if (currentPrice >= pattern.targets[2]) {
            status = 'completed';
            result = 'target_3';
          } else if (currentPrice >= pattern.targets[1]) {
            result = 'target_2';
          } else if (currentPrice >= pattern.targets[0]) {
            result = 'target_1';
          }
        } else {
          // Bearish pattern
          // Check stop loss
          if (currentPrice >= pattern.stopLoss) {
            status = 'failed';
            result = 'stop_loss';
          }
          // Check targets
          else if (currentPrice <= pattern.targets[2]) {
            status = 'completed';
            result = 'target_3';
          } else if (currentPrice <= pattern.targets[1]) {
            result = 'target_2';
          } else if (currentPrice <= pattern.targets[0]) {
            result = 'target_1';
          }
        }
        
        // Update pattern status
        if (status !== pattern.status) {
          pattern.status = status;
          pattern.result = result;
          pattern.completedAt = new Date();
          
          this.broadcast('patternUpdate', pattern);
          
          if (status === 'completed' || status === 'failed') {
            this.activePatterns.delete(key);
          }
          
          logger.info(`Pattern ${status}: ${pattern.patternType} on ${pattern.symbol} - ${result}`);
        }
        
      } catch (error) {
        logger.error(`Error validating pattern ${key}:`, error.message);
      }
    }
  }

  /**
   * Get all active patterns
   */
  getActivePatterns() {
    return Array.from(this.activePatterns.values());
  }

  /**
   * Get pattern history
   */
  getPatternHistory(limit = 100) {
    return this.patternHistory.slice(-limit);
  }

  /**
   * Get pattern statistics
   */
  getPatternStats() {
    const completed = this.patternHistory.filter(p => p.status === 'completed');
    const failed = this.patternHistory.filter(p => p.status === 'failed');
    const active = this.patternHistory.filter(p => p.status === 'active');
    
    const byType = {};
    for (const pattern of this.patternHistory) {
      if (!byType[pattern.patternType]) {
        byType[pattern.patternType] = { total: 0, completed: 0, failed: 0 };
      }
      byType[pattern.patternType].total++;
      if (pattern.status === 'completed') {
        byType[pattern.patternType].completed++;
      } else if (pattern.status === 'failed') {
        byType[pattern.patternType].failed++;
      }
    }
    
    return {
      total: this.patternHistory.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      winRate: completed.length + failed.length > 0 
        ? (completed.length / (completed.length + failed.length) * 100).toFixed(2)
        : 0,
      byType
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event, data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            event, 
            data, 
            timestamp: Date.now(),
            source: 'patternScanner'
          }));
        }
      });
    }
  }

  /**
   * Stop the scanner
   */
  stop() {
    this.scanJobs.forEach(job => job.stop());
    this.isRunning = false;
    logger.info('Pattern Scanner stopped');
  }
}

export const patternScanner = new PatternScanner();
