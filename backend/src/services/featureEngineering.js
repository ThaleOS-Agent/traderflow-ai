import { logger } from '../utils/logger.js';

/**
 * Feature Engineering Service
 * Implements advanced technical indicators and volume profile analysis
 */
export class FeatureEngineering {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Process all features for market data
   */
  processAllFeatures(marketData) {
    try {
      let data = { ...marketData };
      
      // Add technical indicators
      data = this.addTechnicalIndicators(data);
      
      // Detect market regime
      data = this.detectMarketRegime(data);
      
      // Add volume profile
      data = this.addVolumeProfile(data);
      
      // Add support/resistance levels
      data = this.addSupportResistance(data);
      
      return data;
    } catch (error) {
      logger.error('Error in processAllFeatures:', error);
      return marketData;
    }
  }

  /**
   * Add comprehensive technical indicators
   */
  addTechnicalIndicators(data) {
    const { prices, volumes, highs, lows } = data;
    
    if (prices.length < 50) return data;

    // RSI (14 period)
    data.rsi = this.calculateRSI(prices, 14);
    
    // MACD
    data.macd = this.calculateMACD(prices);
    
    // Bollinger Bands
    data.bollingerBands = this.calculateBollingerBands(prices, 20, 2);
    
    // ATR (Average True Range)
    data.atr = this.calculateATR(highs, lows, prices, 14);
    
    // Moving Averages
    data.ema20 = this.calculateEMA(prices, 20);
    data.ema50 = this.calculateEMA(prices, 50);
    data.ema200 = this.calculateEMA(prices, 200);
    data.sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // Volume indicators
    data.volumeSMA20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    data.volumeRatio = volumes[volumes.length - 1] / data.volumeSMA20;
    
    // Momentum
    data.momentum = (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10];
    
    // Volatility
    data.volatility = this.calculateVolatility(prices);
    
    // Price position within day's range
    const dayHigh = Math.max(...highs.slice(-24));
    const dayLow = Math.min(...lows.slice(-24));
    data.dayRangePosition = (prices[prices.length - 1] - dayLow) / (dayHigh - dayLow);
    
    return data;
  }

  /**
   * Detect market regime (trending, ranging, volatile, calm)
   */
  detectMarketRegime(data) {
    const { prices, volatility, rsi, momentum } = data;
    
    const vol = volatility || 0.02;
    const mom = Math.abs(momentum || 0);
    const rsiValue = rsi || 50;
    
    // Regime detection logic
    const isHighVolatility = vol > 0.03;
    const isLowVolatility = vol < 0.015;
    const isStrongMomentum = mom > 0.02;
    const isWeakMomentum = mom < 0.005;
    const isTrending = rsiValue > 70 || rsiValue < 30;
    const isRanging = rsiValue > 40 && rsiValue < 60;
    
    let regime = 'calm';
    if (isHighVolatility) regime = 'volatile';
    else if (isLowVolatility && isWeakMomentum) regime = 'calm';
    else if (isTrending && isStrongMomentum) regime = 'trending';
    else if (isRanging) regime = 'ranging';
    
    data.marketRegime = regime;
    data.regimeScore = {
      trending: isTrending && isStrongMomentum ? 0.8 : 0.2,
      ranging: isRanging ? 0.8 : 0.2,
      volatile: isHighVolatility ? 0.9 : 0.1,
      calm: isLowVolatility && isWeakMomentum ? 0.9 : 0.1
    };
    
    return data;
  }

  /**
   * Add volume profile analysis with HVN and LVN detection
   */
  addVolumeProfile(data) {
    const { prices, volumes } = data;
    
    if (prices.length < 50) return data;

    // Create price bins for volume profile
    const priceVolumeMap = new Map();
    const binSize = 10;
    
    for (let i = 0; i < prices.length; i++) {
      const bin = Math.floor(prices[i] / binSize) * binSize;
      const currentVolume = priceVolumeMap.get(bin) || 0;
      priceVolumeMap.set(bin, currentVolume + volumes[i]);
    }
    
    // Sort by volume
    const sortedBins = Array.from(priceVolumeMap.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Identify High Volume Nodes (HVN) - top 20%
    const hvnCount = Math.max(1, Math.floor(sortedBins.length * 0.2));
    const hvnLevels = sortedBins.slice(0, hvnCount).map(([price]) => price);
    
    // Identify Low Volume Nodes (LVN) - bottom 20%
    const lvnLevels = sortedBins.slice(-hvnCount).map(([price]) => price);
    
    // Point of Control (POC) - highest volume level
    const poc = sortedBins.length > 0 ? sortedBins[0][0] : prices[prices.length - 1];
    
    // Value Area (70% of volume)
    const totalVolume = sortedBins.reduce((sum, [, vol]) => sum + vol, 0);
    let cumulativeVolume = 0;
    const valueAreaLevels = [];
    
    for (const [price, vol] of sortedBins) {
      cumulativeVolume += vol;
      valueAreaLevels.push(price);
      if (cumulativeVolume >= totalVolume * 0.7) break;
    }
    
    const currentPrice = prices[prices.length - 1];
    const currentBin = Math.floor(currentPrice / binSize) * binSize;
    
    data.volumeProfile = {
      hvnLevels,
      lvnLevels,
      poc,
      valueAreaHigh: Math.max(...valueAreaLevels),
      valueAreaLow: Math.min(...valueAreaLevels),
      isInValueArea: valueAreaLevels.includes(currentBin),
      isAtHVN: hvnLevels.some(hvn => Math.abs(hvn - currentBin) < binSize),
      isAtLVN: lvnLevels.some(lvn => Math.abs(lvn - currentBin) < binSize)
    };
    
    return data;
  }

  /**
   * Add support and resistance levels
   */
  addSupportResistance(data) {
    const { prices, highs, lows } = data;
    
    if (prices.length < 30) return data;

    // Find local maxima (resistance)
    const resistanceLevels = [];
    const supportLevels = [];
    
    for (let i = 5; i < prices.length - 5; i++) {
      // Check for local maximum
      const isLocalMax = highs.slice(i - 5, i).every(h => h <= highs[i]) &&
                         highs.slice(i + 1, i + 6).every(h => h <= highs[i]);
      
      // Check for local minimum
      const isLocalMin = lows.slice(i - 5, i).every(l => l >= lows[i]) &&
                         lows.slice(i + 1, i + 6).every(l => l >= lows[i]);
      
      if (isLocalMax) resistanceLevels.push(highs[i]);
      if (isLocalMin) supportLevels.push(lows[i]);
    }
    
    // Cluster nearby levels
    const clusterTolerance = 0.005; // 0.5%
    const clusteredResistance = this.clusterLevels(resistanceLevels, clusterTolerance);
    const clusteredSupport = this.clusterLevels(supportLevels, clusterTolerance);
    
    const currentPrice = prices[prices.length - 1];
    
    // Find nearest levels
    const nearestResistance = clusteredResistance
      .filter(r => r > currentPrice)
      .sort((a, b) => a - b)[0];
    
    const nearestSupport = clusteredSupport
      .filter(s => s < currentPrice)
      .sort((a, b) => b - a)[0];
    
    data.supportResistance = {
      resistanceLevels: clusteredResistance.slice(0, 5),
      supportLevels: clusteredSupport.slice(0, 5),
      nearestResistance,
      nearestSupport,
      distanceToResistance: nearestResistance ? (nearestResistance - currentPrice) / currentPrice : null,
      distanceToSupport: nearestSupport ? (currentPrice - nearestSupport) / currentPrice : null
    };
    
    return data;
  }

  /**
   * Cluster price levels within tolerance
   */
  clusterLevels(levels, tolerance) {
    if (levels.length === 0) return [];
    
    levels.sort((a, b) => a - b);
    const clusters = [[levels[0]]];
    
    for (let i = 1; i < levels.length; i++) {
      const lastCluster = clusters[clusters.length - 1];
      const clusterAvg = lastCluster.reduce((a, b) => a + b, 0) / lastCluster.length;
      
      if (Math.abs(levels[i] - clusterAvg) / clusterAvg < tolerance) {
        lastCluster.push(levels[i]);
      } else {
        clusters.push([levels[i]]);
      }
    }
    
    return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length);
  }

  // Technical indicator calculations
  calculateRSI(prices, period) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    const emaFast = this.calculateEMA(prices, fast);
    const emaSlow = this.calculateEMA(prices, slow);
    const macdLine = emaFast - emaSlow;
    
    return {
      macd: macdLine,
      signal: macdLine * 0.9,
      histogram: macdLine - (macdLine * 0.9)
    };
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateBollingerBands(prices, period, stdDev) {
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
      bandwidth: (standardDeviation * 2 * stdDev) / sma
    };
  }

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

  calculateVolatility(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / returns.length);
  }
}

export const featureEngineering = new FeatureEngineering();
