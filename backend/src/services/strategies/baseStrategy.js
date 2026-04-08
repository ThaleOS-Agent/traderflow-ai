export class BaseStrategy {
  constructor(name, description, type, supportedAssets) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.supportedAssets = supportedAssets;
    this.params = {};
  }

  setParams(params) {
    this.params = { ...this.params, ...params };
  }

  // Calculate RSI
  calculateRSI(prices, period = 14) {
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

  // Calculate EMA
  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  // Calculate MACD
  calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    const emaFast = this.calculateEMA(prices, fast);
    const emaSlow = this.calculateEMA(prices, slow);
    const macdLine = emaFast - emaSlow;
    
    // Simplified signal line calculation
    const signalLine = macdLine * 0.9; // Approximation
    const histogram = macdLine - signalLine;
    
    return { macd: macdLine, signal: signalLine, histogram };
  }

  // Calculate Bollinger Bands
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    const squaredDiffs = prices.slice(-period).map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  // Calculate ATR (Average True Range)
  calculateATR(highs, lows, closes, period = 14) {
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

  // Calculate support and resistance levels
  calculateSupportResistance(prices, window = 10) {
    const highs = [];
    const lows = [];
    
    for (let i = window; i < prices.length - window; i++) {
      const isHigh = prices.slice(i - window, i).every(p => p <= prices[i]) &&
                     prices.slice(i + 1, i + window + 1).every(p => p <= prices[i]);
      const isLow = prices.slice(i - window, i).every(p => p >= prices[i]) &&
                    prices.slice(i + 1, i + window + 1).every(p => p >= prices[i]);
      
      if (isHigh) highs.push(prices[i]);
      if (isLow) lows.push(prices[i]);
    }
    
    return {
      resistance: highs.length > 0 ? Math.max(...highs) : null,
      support: lows.length > 0 ? Math.min(...lows) : null
    };
  }

  // Generate signal (to be implemented by subclasses)
  async generateSignal(marketData) {
    throw new Error('generateSignal must be implemented by subclass');
  }

  // Validate signal
  validateSignal(signal) {
    return signal && 
           signal.symbol && 
           signal.side && 
           signal.entryPrice > 0 && 
           signal.stopLoss > 0 && 
           signal.takeProfit > 0;
  }
}
