import { BaseStrategy } from './baseStrategy.js';

export class QuantumAIStrategy extends BaseStrategy {
  constructor() {
    super(
      'Quantum AI',
      'Advanced machine learning algorithm combining multiple technical indicators with AI-driven pattern recognition for high-accuracy trading signals.',
      'ai_ml',
      ['crypto', 'forex', 'commodity']
    );
    
    this.params = {
      timeframe: '1h',
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      emaFast: 12,
      emaSlow: 26,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      volumeThreshold: 1.5,
      minConfidence: 75
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, volumes, highs, lows, currentPrice, assetType } = marketData;
    
    if (prices.length < 50) return null;
    
    // Calculate indicators
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const macd = this.calculateMACD(prices, this.params.macdFast, this.params.macdSlow, this.params.macdSignal);
    const bb = this.calculateBollingerBands(prices, this.params.bbPeriod, this.params.bbStdDev);
    const atr = this.calculateATR(highs, lows, prices, 14);
    
    // Volume analysis
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeSpike = currentVolume / avgVolume;
    
    // Support/Resistance
    const sr = this.calculateSupportResistance(prices);
    
    // AI Score calculation (0-100)
    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];
    
    // RSI analysis
    if (rsi < this.params.rsiOversold) {
      buyScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'oversold' });
    } else if (rsi > this.params.rsiOverbought) {
      sellScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'overbought' });
    } else {
      indicators.push({ name: 'RSI', value: rsi, signal: 'neutral' });
    }
    
    // EMA crossover
    if (emaFast > emaSlow) {
      buyScore += 20;
      indicators.push({ name: 'EMA', value: emaFast - emaSlow, signal: 'bullish' });
    } else {
      sellScore += 20;
      indicators.push({ name: 'EMA', value: emaFast - emaSlow, signal: 'bearish' });
    }
    
    // MACD analysis
    if (macd.histogram > 0 && macd.macd > macd.signal) {
      buyScore += 20;
      indicators.push({ name: 'MACD', value: macd.histogram, signal: 'bullish' });
    } else if (macd.histogram < 0 && macd.macd < macd.signal) {
      sellScore += 20;
      indicators.push({ name: 'MACD', value: macd.histogram, signal: 'bearish' });
    } else {
      indicators.push({ name: 'MACD', value: macd.histogram, signal: 'neutral' });
    }
    
    // Bollinger Bands
    if (currentPrice < bb.lower) {
      buyScore += 15;
      indicators.push({ name: 'BB', value: currentPrice - bb.lower, signal: 'oversold' });
    } else if (currentPrice > bb.upper) {
      sellScore += 15;
      indicators.push({ name: 'BB', value: currentPrice - bb.upper, signal: 'overbought' });
    } else {
      indicators.push({ name: 'BB', value: (currentPrice - bb.middle) / (bb.upper - bb.lower), signal: 'neutral' });
    }
    
    // Volume confirmation
    if (volumeSpike > this.params.volumeThreshold) {
      if (prices[prices.length - 1] > prices[prices.length - 2]) {
        buyScore += 15;
        indicators.push({ name: 'Volume', value: volumeSpike, signal: 'bullish_spike' });
      } else {
        sellScore += 15;
        indicators.push({ name: 'Volume', value: volumeSpike, signal: 'bearish_spike' });
      }
    } else {
      indicators.push({ name: 'Volume', value: volumeSpike, signal: 'normal' });
    }
    
    // Trend strength (price vs EMA)
    const priceVsEma = (currentPrice - emaSlow) / emaSlow * 100;
    if (priceVsEma > 2) {
      buyScore += 10;
      indicators.push({ name: 'Trend', value: priceVsEma, signal: 'strong_uptrend' });
    } else if (priceVsEma < -2) {
      sellScore += 10;
      indicators.push({ name: 'Trend', value: priceVsEma, signal: 'strong_downtrend' });
    } else {
      indicators.push({ name: 'Trend', value: priceVsEma, signal: 'sideways' });
    }
    
    // Determine signal
    let side = null;
    let confidence = 0;
    
    if (buyScore >= this.params.minConfidence && buyScore > sellScore + 10) {
      side = 'buy';
      confidence = buyScore;
    } else if (sellScore >= this.params.minConfidence && sellScore > buyScore + 10) {
      side = 'sell';
      confidence = sellScore;
    }
    
    if (!side) return null;
    
    // Calculate stop loss and take profit based on ATR
    const atrMultiplier = assetType === 'crypto' ? 2 : 1.5;
    const slDistance = atr * atrMultiplier;
    const tpDistance = slDistance * 2; // 1:2 risk/reward
    
    const stopLoss = side === 'buy' ? currentPrice - slDistance : currentPrice + slDistance;
    const takeProfit = side === 'buy' ? currentPrice + tpDistance : currentPrice - tpDistance;
    
    // Determine confidence level
    let confidenceLevel = 'low';
    if (confidence >= 90) confidenceLevel = 'very_high';
    else if (confidence >= 80) confidenceLevel = 'high';
    else if (confidence >= 70) confidenceLevel = 'medium';
    
    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidenceLevel,
      confidenceScore: confidence,
      strategy: 'quantum_ai',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Quantum AI detected a ${side.toUpperCase()} opportunity with ${confidence}% confidence. ` +
                `RSI: ${rsi.toFixed(2)}, MACD: ${macd.histogram > 0 ? 'Bullish' : 'Bearish'}, ` +
                `Volume: ${volumeSpike.toFixed(2)}x average.`,
      metadata: {
        rsi,
        emaFast,
        emaSlow,
        macd,
        bb,
        atr,
        volumeSpike,
        support: sr.support,
        resistance: sr.resistance
      }
    };
  }
}
