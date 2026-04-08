import { logger } from '../utils/logger.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';
import { getStrategy } from './strategies/index.js';
import { featureEngineering } from './featureEngineering.js';
import { mlPredictor } from './mlPredictor.js';

/**
 * Enhanced Backtesting Engine
 * Real historical data backtesting with comprehensive metrics
 */
export class EnhancedBacktestEngine {
  constructor() {
    this.results = [];
    this.isRunning = false;
    this.marketData = new Map();
    
    // Default backtest configuration
    this.defaultConfig = {
      initialCapital: 10000,
      startDate: null,
      endDate: null,
      symbols: ['BTC/USDT'],
      timeframes: ['1h'],
      strategies: ['xq_trade_m8'],
      positionSize: 10, // % of capital per trade
      maxPositions: 5,
      stopLoss: 2, // %
      takeProfit: 4, // %
      trailingStop: false,
      trailingDistance: 1, // %
      fees: {
        maker: 0.001,
        taker: 0.002
      },
      slippage: 0.001, // 0.1% slippage
      useRealData: true // Use real historical data
    };
  }

  /**
   * Fetch real historical data from exchange
   */
  async fetchHistoricalData(symbol, timeframe, startDate, endDate) {
    try {
      logger.info(`Fetching historical data for ${symbol} ${timeframe}...`);
      
      // Use Binance for historical data (most reliable and free)
      const connector = new MultiExchangeConnector('binance', true);
      
      // Calculate number of candles needed
      const start = new Date(startDate);
      const end = new Date(endDate);
      const hoursDiff = (end - start) / (1000 * 60 * 60);
      
      const intervalMap = {
        '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600,
        '8h': 28800, '12h': 43200, '1d': 86400
      };
      
      const intervalSeconds = intervalMap[timeframe] || 3600;
      const limit = Math.min(1000, Math.ceil(hoursDiff * 3600 / intervalSeconds));
      
      // Fetch klines from Binance
      const klines = await connector.getKlines(symbol, timeframe, limit);
      
      if (!klines || klines.length < 50) {
        logger.warn(`Insufficient data for ${symbol}: ${klines?.length || 0} candles`);
        return [];
      }
      
      // Format data
      const formattedData = klines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        quoteVolume: parseFloat(k[7]),
        trades: parseInt(k[8])
      }));
      
      logger.info(`Fetched ${formattedData.length} candles for ${symbol}`);
      return formattedData;
      
    } catch (error) {
      logger.error(`Failed to fetch historical data for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Run backtest for a strategy with real historical data
   */
  async runBacktest(config = {}) {
    const backtestConfig = { ...this.defaultConfig, ...config };
    
    logger.info(`Starting enhanced backtest: ${backtestConfig.strategies.join(', ')} on ${backtestConfig.symbols.join(', ')}`);
    logger.info(`Period: ${backtestConfig.startDate} to ${backtestConfig.endDate}`);
    logger.info(`Initial Capital: $${backtestConfig.initialCapital}`);
    
    this.isRunning = true;
    
    const results = {
      config: backtestConfig,
      trades: [],
      equity: [],
      metrics: {},
      startTime: new Date(),
      endTime: null
    };
    
    let capital = backtestConfig.initialCapital;
    let maxCapital = capital;
    let positions = [];
    let trades = [];
    let equity = [{ timestamp: backtestConfig.startDate, value: capital }];
    
    // Fetch historical data for all symbols
    for (const symbol of backtestConfig.symbols) {
      for (const timeframe of backtestConfig.timeframes) {
        try {
          const historicalData = await this.fetchHistoricalData(
            symbol, 
            timeframe, 
            backtestConfig.startDate, 
            backtestConfig.endDate
          );
          
          if (!historicalData || historicalData.length < 100) {
            logger.warn(`Insufficient data for ${symbol} ${timeframe}`);
            continue;
          }
          
          this.marketData.set(`${symbol}_${timeframe}`, historicalData);
          
          // Run strategy on historical data
          for (let i = 50; i < historicalData.length; i++) {
            const currentData = historicalData.slice(0, i + 1);
            const currentCandle = historicalData[i];
            
            // Process features
            const marketData = {
              symbol,
              prices: currentData.map(d => d.close),
              highs: currentData.map(d => d.high),
              lows: currentData.map(d => d.low),
              volumes: currentData.map(d => d.volume),
              currentPrice: currentCandle.close,
              timestamp: currentCandle.timestamp
            };
            
            const enhancedData = featureEngineering.processAllFeatures(marketData);
            
            // Check for signals from each strategy
            for (const strategyName of backtestConfig.strategies) {
              try {
                const strategy = getStrategy(strategyName);
                const signal = await strategy.generateSignal(enhancedData);
                
                if (signal) {
                  // Execute signal
                  const trade = this.executeSignal(
                    signal,
                    currentCandle,
                    capital,
                    positions,
                    backtestConfig
                  );
                  
                  if (trade) {
                    positions.push(trade);
                    capital -= trade.positionSize;
                  }
                }
              } catch (e) {}
            }
            
            // Check existing positions for exits
            const { closedPositions, remainingPositions, pnl } = this.checkExits(
              positions,
              currentCandle,
              backtestConfig
            );
            
            positions = remainingPositions;
            
            for (const closed of closedPositions) {
              capital += closed.exitValue;
              trades.push(closed);
              
              if (capital > maxCapital) maxCapital = capital;
            }
            
            // Record equity
            const unrealizedPnl = positions.reduce((sum, pos) => {
              return sum + (currentCandle.close - pos.entryPrice) * pos.quantity * 
                (pos.side === 'buy' ? 1 : -1);
            }, 0);
            
            equity.push({
              timestamp: currentCandle.timestamp,
              value: capital + unrealizedPnl,
              positions: positions.length
            });
            
            // Progress logging
            if (i % 100 === 0) {
              const progress = ((i - 50) / (historicalData.length - 50) * 100).toFixed(1);
              logger.info(`Backtest progress: ${progress}% - Capital: $${capital.toFixed(2)}`);
            }
          }
          
        } catch (error) {
          logger.error(`Backtest error for ${symbol}:`, error.message);
        }
      }
    }
    
    // Close any remaining positions at last price
    const lastData = Array.from(this.marketData.values()).pop();
    if (lastData && lastData.length > 0) {
      const lastPrice = lastData[lastData.length - 1].close;
      for (const pos of positions) {
        capital += pos.quantity * lastPrice * (1 - backtestConfig.fees.taker);
      }
    }
    
    // Calculate metrics
    results.trades = trades;
    results.equity = equity;
    results.metrics = this.calculateMetrics(trades, equity, backtestConfig, maxCapital);
    results.endTime = new Date();
    results.finalCapital = capital;
    results.totalReturn = ((capital - backtestConfig.initialCapital) / backtestConfig.initialCapital * 100).toFixed(2);
    
    this.results.push(results);
    this.isRunning = false;
    
    logger.info(`Backtest complete. Total Return: ${results.totalReturn}%`);
    logger.info(`Win Rate: ${results.metrics.winRate}%`);
    logger.info(`Sharpe Ratio: ${results.metrics.sharpeRatio}`);
    logger.info(`Max Drawdown: ${results.metrics.maxDrawdown}%`);
    
    return results;
  }

  /**
   * Execute trading signal
   */
  executeSignal(signal, candle, capital, positions, config) {
    // Check position limit
    if (positions.length >= config.maxPositions) return null;
    
    // Check if already in position for this symbol
    if (positions.some(p => p.symbol === signal.symbol)) return null;
    
    // Calculate position size
    const positionValue = capital * (config.positionSize / 100);
    const quantity = positionValue / candle.close;
    
    // Apply slippage
    const entryPrice = signal.side === 'buy' ? 
      candle.close * (1 + config.slippage) : 
      candle.close * (1 - config.slippage);
    
    // Calculate stop loss and take profit
    const stopLoss = signal.stopLoss || 
      (signal.side === 'buy' ? 
        entryPrice * (1 - config.stopLoss / 100) : 
        entryPrice * (1 + config.stopLoss / 100));
    
    const takeProfit = signal.takeProfit || 
      (signal.side === 'buy' ? 
        entryPrice * (1 + config.takeProfit / 100) : 
        entryPrice * (1 - config.takeProfit / 100));
    
    // Calculate fees
    const entryFee = positionValue * config.fees.taker;
    
    return {
      symbol: signal.symbol,
      side: signal.side,
      entryPrice,
      quantity,
      positionSize: positionValue,
      stopLoss,
      takeProfit,
      entryFee,
      entryTime: candle.timestamp,
      strategy: signal.strategy || 'unknown'
    };
  }

  /**
   * Check positions for exits
   */
  checkExits(positions, candle, config) {
    const closed = [];
    const remaining = [];
    let totalPnl = 0;
    
    for (const pos of positions) {
      let exitPrice = null;
      let exitReason = null;
      
      // Check stop loss
      if (pos.side === 'buy') {
        if (candle.low <= pos.stopLoss) {
          exitPrice = pos.stopLoss;
          exitReason = 'stop_loss';
        } else if (candle.high >= pos.takeProfit) {
          exitPrice = pos.takeProfit;
          exitReason = 'take_profit';
        }
      } else {
        if (candle.high >= pos.stopLoss) {
          exitPrice = pos.stopLoss;
          exitReason = 'stop_loss';
        } else if (candle.low <= pos.takeProfit) {
          exitPrice = pos.takeProfit;
          exitReason = 'take_profit';
        }
      }
      
      if (exitPrice) {
        // Apply slippage
        const executedPrice = pos.side === 'buy' ? 
          exitPrice * (1 - config.slippage) : 
          exitPrice * (1 + config.slippage);
        
        const exitValue = pos.quantity * executedPrice;
        const exitFee = exitValue * config.fees.taker;
        
        const pnl = pos.side === 'buy' ?
          (executedPrice - pos.entryPrice) * pos.quantity - pos.entryFee - exitFee :
          (pos.entryPrice - executedPrice) * pos.quantity - pos.entryFee - exitFee;
        
        closed.push({
          ...pos,
          exitPrice: executedPrice,
          exitTime: candle.timestamp,
          exitValue,
          exitFee,
          pnl,
          pnlPercent: (pnl / pos.positionSize * 100).toFixed(2),
          exitReason,
          duration: candle.timestamp - pos.entryTime
        });
        
        totalPnl += pnl;
      } else {
        remaining.push(pos);
      }
    }
    
    return { closedPositions: closed, remainingPositions: remaining, pnl: totalPnl };
  }

  /**
   * Calculate backtest metrics
   */
  calculateMetrics(trades, equity, config, maxCapital) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        avgTrade: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0
      };
    }
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    
    // Calculate returns for Sharpe ratio
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i].value - equity[i - 1].value) / equity[i - 1].value);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = config.initialCapital;
    
    for (const e of equity) {
      if (e.value > peak) peak = e.value;
      const drawdown = (peak - e.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length * 100).toFixed(2),
      profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0',
      sharpeRatio: returnStd > 0 ? (avgReturn / returnStd * Math.sqrt(252)).toFixed(2) : '0',
      maxDrawdown: (maxDrawdown * 100).toFixed(2),
      avgTrade: (trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length).toFixed(2),
      avgWin: winningTrades.length > 0 ? (grossProfit / winningTrades.length).toFixed(2) : '0',
      avgLoss: losingTrades.length > 0 ? (-grossLoss / losingTrades.length).toFixed(2) : '0',
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)).toFixed(2) : '0',
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)).toFixed(2) : '0',
      grossProfit: grossProfit.toFixed(2),
      grossLoss: grossLoss.toFixed(2),
      netProfit: (grossProfit - grossLoss).toFixed(2),
      totalFees: trades.reduce((sum, t) => sum + t.entryFee + (t.exitFee || 0), 0).toFixed(2)
    };
  }

  /**
   * Compare multiple strategies
   */
  async compareStrategies(strategies, config = {}) {
    const results = [];
    
    for (const strategy of strategies) {
      const result = await this.runBacktest({
        ...config,
        strategies: [strategy]
      });
      
      results.push({
        strategy,
        metrics: result.metrics,
        totalReturn: result.totalReturn
      });
    }
    
    // Sort by total return
    results.sort((a, b) => parseFloat(b.totalReturn) - parseFloat(a.totalReturn));
    
    return results;
  }

  /**
   * Get backtest results
   */
  getResults() {
    return this.results;
  }

  /**
   * Get latest backtest result
   */
  getLatestResult() {
    return this.results[this.results.length - 1] || null;
  }

  /**
   * Clear results
   */
  clearResults() {
    this.results = [];
  }

  /**
   * Export results to CSV
   */
  exportToCSV(result) {
    const headers = ['timestamp', 'symbol', 'side', 'entryPrice', 'exitPrice', 'quantity', 'pnl', 'pnlPercent', 'exitReason', 'strategy'];
    
    const rows = result.trades.map(t => [
      new Date(t.entryTime).toISOString(),
      t.symbol,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.pnl,
      t.pnlPercent,
      t.exitReason,
      t.strategy
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const enhancedBacktestEngine = new EnhancedBacktestEngine();
