import { BaseStrategy } from './baseStrategy.js';

export class CryptoBotStrategy extends BaseStrategy {
  constructor() {
    super(
      'Crypto Bot',
      'Specialized algorithm for cryptocurrency markets with volatility-based entries and dynamic stop-loss adjustment.',
      'scalping',
      ['crypto']
    );
    
    this.params = {
      timeframe: '15m',
      rsiPeriod: 14,
      rsiOverbought: 75,
      rsiOversold: 25,
      emaFast: 9,
      emaSlow: 21,
      volumeThreshold: 2.0,
      volatilityThreshold: 3.0,
      minConfidence: 70
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, volumes, highs, lows, currentPrice } = marketData;
    
    if (prices.length < 30) return null;
    
    // Calculate volatility
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1] * 100);
    }
    const volatility = Math.sqrt(returns.slice(-20).reduce((a, b) => a + b * b, 0) / 20);
    
    // Skip low volatility periods
    if (volatility < 1) return null;
    
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const bb = this.calculateBollingerBands(prices, 20, 2.5);
    
    // Volume analysis
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volumeSpike = volumes[volumes.length - 1] / avgVolume;
    
    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];
    
    // RSI with crypto-specific thresholds
    if (rsi < this.params.rsiOversold) {
      buyScore += 25;
      indicators.push({ name: 'RSI', value: rsi, signal: 'deep_oversold' });
    } else if (rsi > this.params.rsiOverbought) {
      sellScore += 25;
      indicators.push({ name: 'RSI', value: rsi, signal: 'deep_overbought' });
    }
    
    // EMA crossover - more sensitive for crypto
    const emaDiff = ((emaFast - emaSlow) / emaSlow) * 100;
    if (emaDiff > 0.5) {
      buyScore += 25;
      indicators.push({ name: 'EMA', value: emaDiff, signal: 'bullish_cross' });
    } else if (emaDiff < -0.5) {
      sellScore += 25;
      indicators.push({ name: 'EMA', value: emaDiff, signal: 'bearish_cross' });
    }
    
    // Bollinger Band squeeze/breakout
    const bbWidth = (bb.upper - bb.lower) / bb.middle * 100;
    if (currentPrice < bb.lower && bbWidth < 5) {
      buyScore += 25;
      indicators.push({ name: 'BB_Squeeze', value: bbWidth, signal: 'bullish_breakout' });
    } else if (currentPrice > bb.upper && bbWidth < 5) {
      sellScore += 25;
      indicators.push({ name: 'BB_Squeeze', value: bbWidth, signal: 'bearish_breakout' });
    }
    
    // Volume spike
    if (volumeSpike > this.params.volumeThreshold) {
      const priceChange = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2] * 100;
      if (priceChange > 1) {
        buyScore += 25;
        indicators.push({ name: 'Volume', value: volumeSpike, signal: 'bullish_volume' });
      } else if (priceChange < -1) {
        sellScore += 25;
        indicators.push({ name: 'Volume', value: volumeSpike, signal: 'bearish_volume' });
      }
    }
    
    let side = null;
    let confidence = 0;
    
    if (buyScore >= this.params.minConfidence) {
      side = 'buy';
      confidence = buyScore;
    } else if (sellScore >= this.params.minConfidence) {
      side = 'sell';
      confidence = sellScore;
    }
    
    if (!side) return null;
    
    // Dynamic stop loss based on volatility
    const slPercent = Math.max(2, volatility * 0.8);
    const tpPercent = slPercent * 1.5;
    
    const stopLoss = side === 'buy' 
      ? currentPrice * (1 - slPercent / 100) 
      : currentPrice * (1 + slPercent / 100);
    const takeProfit = side === 'buy' 
      ? currentPrice * (1 + tpPercent / 100) 
      : currentPrice * (1 - tpPercent / 100);
    
    let confidenceLevel = 'low';
    if (confidence >= 90) confidenceLevel = 'very_high';
    else if (confidence >= 80) confidenceLevel = 'high';
    else if (confidence >= 70) confidenceLevel = 'medium';
    
    return {
      symbol,
      assetType: 'crypto',
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidenceLevel,
      confidenceScore: confidence,
      strategy: 'crypto_bot',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Crypto Bot detected ${side.toUpperCase()} signal with ${confidence}% confidence. ` +
                `Volatility: ${volatility.toFixed(2)}%, Volume: ${volumeSpike.toFixed(2)}x, RSI: ${rsi.toFixed(2)}`,
      metadata: { rsi, emaFast, emaSlow, bb, volatility, volumeSpike }
    };
  }
}
