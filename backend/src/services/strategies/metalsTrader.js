import { BaseStrategy } from './baseStrategy.js';

export class MetalsTraderStrategy extends BaseStrategy {
  constructor() {
    super(
      'Metals Trader',
      'Specialized algorithm for Gold (XAU/USD) and Silver (XAG/USD) trading with safe-haven flow analysis.',
      'mean_reversion',
      ['commodity']
    );
    
    this.params = {
      timeframe: '1h',
      rsiPeriod: 14,
      rsiOverbought: 72,
      rsiOversold: 28,
      emaFast: 10,
      emaSlow: 30,
      bbPeriod: 20,
      bbStdDev: 2.5,
      minConfidence: 72
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, volumes, highs, lows, currentPrice } = marketData;
    
    if (prices.length < 40) return null;
    
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const bb = this.calculateBollingerBands(prices, this.params.bbPeriod, this.params.bbStdDev);
    const atr = this.calculateATR(highs, lows, prices, 14);
    
    // Calculate price momentum
    const momentum = (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100;
    
    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];
    
    // RSI extreme levels (metals often reach more extreme levels)
    if (rsi < this.params.rsiOversold) {
      buyScore += 30;
      indicators.push({ name: 'RSI', value: rsi, signal: 'extreme_oversold' });
    } else if (rsi < 35) {
      buyScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'oversold' });
    } else if (rsi > this.params.rsiOverbought) {
      sellScore += 30;
      indicators.push({ name: 'RSI', value: rsi, signal: 'extreme_overbought' });
    } else if (rsi > 65) {
      sellScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'overbought' });
    } else {
      indicators.push({ name: 'RSI', value: rsi, signal: 'neutral' });
    }
    
    // Mean reversion from Bollinger Bands
    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (currentPrice < bb.lower * 1.01) {
      buyScore += 25;
      indicators.push({ name: 'BB', value: bbPosition, signal: 'below_lower' });
    } else if (currentPrice > bb.upper * 0.99) {
      sellScore += 25;
      indicators.push({ name: 'BB', value: bbPosition, signal: 'above_upper' });
    } else if (bbPosition < 0.2) {
      buyScore += 10;
      indicators.push({ name: 'BB', value: bbPosition, signal: 'lower_zone' });
    } else if (bbPosition > 0.8) {
      sellScore += 10;
      indicators.push({ name: 'BB', value: bbPosition, signal: 'upper_zone' });
    } else {
      indicators.push({ name: 'BB', value: bbPosition, signal: 'middle_zone' });
    }
    
    // EMA trend filter
    const priceVsEma = (currentPrice - emaSlow) / emaSlow * 100;
    if (emaFast > emaSlow && priceVsEma > -1) {
      buyScore += 20;
      indicators.push({ name: 'Trend', value: priceVsEma, signal: 'bullish_bias' });
    } else if (emaFast < emaSlow && priceVsEma < 1) {
      sellScore += 20;
      indicators.push({ name: 'Trend', value: priceVsEma, signal: 'bearish_bias' });
    }
    
    // Momentum divergence
    if (momentum < -2 && rsi > 35) {
      buyScore += 15;
      indicators.push({ name: 'Momentum', value: momentum, signal: 'bullish_divergence' });
    } else if (momentum > 2 && rsi < 65) {
      sellScore += 15;
      indicators.push({ name: 'Momentum', value: momentum, signal: 'bearish_divergence' });
    }
    
    // Support/Resistance bounce
    const sr = this.calculateSupportResistance(prices, 8);
    if (sr.support && Math.abs(currentPrice - sr.support) / currentPrice < 0.005) {
      buyScore += 10;
      indicators.push({ name: 'Support', value: sr.support, signal: 'bounce' });
    }
    if (sr.resistance && Math.abs(currentPrice - sr.resistance) / currentPrice < 0.005) {
      sellScore += 10;
      indicators.push({ name: 'Resistance', value: sr.resistance, signal: 'rejection' });
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
    
    // Wider stops for metals due to volatility
    const slDistance = atr * 2.5;
    const tpDistance = slDistance * 1.8;
    
    const stopLoss = side === 'buy' ? currentPrice - slDistance : currentPrice + slDistance;
    const takeProfit = side === 'buy' ? currentPrice + tpDistance : currentPrice - tpDistance;
    
    let confidenceLevel = 'low';
    if (confidence >= 90) confidenceLevel = 'very_high';
    else if (confidence >= 80) confidenceLevel = 'high';
    else if (confidence >= 70) confidenceLevel = 'medium';
    
    return {
      symbol,
      assetType: 'commodity',
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidenceLevel,
      confidenceScore: confidence,
      strategy: 'metals_trader',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Metals Trader ${side.toUpperCase()} signal with ${confidence}% confidence. ` +
                `Mean reversion from ${bbPosition < 0.2 ? 'oversold' : 'overbought'} zone. ` +
                `RSI: ${rsi.toFixed(2)}, Momentum: ${momentum.toFixed(2)}%`,
      metadata: { rsi, emaFast, emaSlow, bb, atr, momentum, bbPosition }
    };
  }
}
