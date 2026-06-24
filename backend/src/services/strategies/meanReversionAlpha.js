import { BaseStrategy } from './baseStrategy.js';

export class MeanReversionAlphaStrategy extends BaseStrategy {
  constructor() {
    super(
      'Mean Reversion Alpha',
      'Quantopian-inspired mean reversion model using Bollinger stretch, RSI exhaustion, and snapback confirmation.',
      'mean_reversion',
      ['crypto', 'forex']
    );

    this.params = {
      timeframe: '1h',
      bbPeriod: 20,
      bbStdDev: 2.2,
      rsiPeriod: 7,
      zScoreThreshold: 1.15,
      minConfidence: 70
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;

    if (prices.length < 40) return null;

    const bb = this.calculateBollingerBands(prices, this.params.bbPeriod, this.params.bbStdDev);
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const ema = this.calculateEMA(prices, 20);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const recent = prices.slice(-this.params.bbPeriod);
    const mean = recent.reduce((sum, price) => sum + price, 0) / recent.length;
    const variance = recent.reduce((sum, price) => sum + ((price - mean) ** 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = (currentPrice - mean) / stdDev;
    const lastMove = ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100;

    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];

    if (zScore <= -this.params.zScoreThreshold) {
      buyScore += 30;
      indicators.push({ name: 'ZScore', value: zScore, signal: 'oversold' });
    } else if (zScore >= this.params.zScoreThreshold) {
      sellScore += 30;
      indicators.push({ name: 'ZScore', value: zScore, signal: 'overbought' });
    }

    if (currentPrice <= bb.lower) {
      buyScore += 20;
      indicators.push({ name: 'Bollinger', value: currentPrice - bb.lower, signal: 'below_lower_band' });
    } else if (currentPrice >= bb.upper) {
      sellScore += 20;
      indicators.push({ name: 'Bollinger', value: currentPrice - bb.upper, signal: 'above_upper_band' });
    }

    if (rsi < 30) {
      buyScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'exhausted_down' });
    } else if (rsi > 70) {
      sellScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'exhausted_up' });
    }

    if (lastMove > 0 && currentPrice < ema) {
      buyScore += 10;
      indicators.push({ name: 'Snapback', value: lastMove, signal: 'bullish_reversal' });
    } else if (lastMove < 0 && currentPrice > ema) {
      sellScore += 10;
      indicators.push({ name: 'Snapback', value: lastMove, signal: 'bearish_reversal' });
    }

    const side = buyScore >= this.params.minConfidence
      ? 'buy'
      : sellScore >= this.params.minConfidence
        ? 'sell'
        : null;

    if (!side || atr <= 0) return null;

    const slDistance = atr * 1.25;
    const tpDistance = atr * 1.8;
    const stopLoss = side === 'buy' ? currentPrice - slDistance : currentPrice + slDistance;
    const takeProfit = side === 'buy' ? mean + tpDistance : mean - tpDistance;
    const confidence = side === 'buy' ? buyScore : sellScore;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 85 ? 'high' : 'medium',
      confidenceScore: confidence,
      strategy: 'mean_reversion_alpha',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Mean Reversion Alpha found a ${side.toUpperCase()} snapback with ${confidence}% confidence. ` +
        `Z-score is ${zScore.toFixed(2)} and RSI is ${rsi.toFixed(1)}.`,
      metadata: { bb, rsi, ema, atr, zScore, mean }
    };
  }
}
