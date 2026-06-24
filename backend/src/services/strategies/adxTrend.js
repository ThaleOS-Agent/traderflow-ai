import { BaseStrategy } from './baseStrategy.js';

export class AdxTrendStrategy extends BaseStrategy {
  constructor() {
    super(
      'ADX Trend',
      'Trend-strength strategy that favors persistent directional movement with expanding true range and aligned averages.',
      'trend_following',
      ['crypto', 'forex', 'commodity']
    );

    this.params = {
      timeframe: '4h',
      minConfidence: 68
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;
    if (prices.length < 65) return null;

    const ema21 = this.calculateEMA(prices, 21);
    const ema55 = this.calculateEMA(prices, 55);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const recentRange = ((Math.max(...highs.slice(-14)) - Math.min(...lows.slice(-14))) / currentPrice) * 100;
    const trendStrength = Math.abs((ema21 - ema55) / ema55) * 100;
    const rsi = this.calculateRSI(prices, 14);

    let side = null;
    let confidence = 0;
    const indicators = [];

    if (ema21 > ema55 && currentPrice > ema21 && trendStrength > 0.4 && rsi > 54 && rsi < 72) {
      side = 'buy';
      confidence = 69 + Math.min(15, trendStrength * 10 + recentRange);
      indicators.push({ name: 'TrendStrength', value: trendStrength, signal: 'uptrend' });
      indicators.push({ name: 'RangeExpansion', value: recentRange, signal: 'supportive' });
      indicators.push({ name: 'RSI', value: rsi, signal: 'bullish' });
    } else if (ema21 < ema55 && currentPrice < ema21 && trendStrength > 0.4 && rsi < 46 && rsi > 28) {
      side = 'sell';
      confidence = 69 + Math.min(15, trendStrength * 10 + recentRange);
      indicators.push({ name: 'TrendStrength', value: trendStrength, signal: 'downtrend' });
      indicators.push({ name: 'RangeExpansion', value: recentRange, signal: 'supportive' });
      indicators.push({ name: 'RSI', value: rsi, signal: 'bearish' });
    }

    if (!side || atr <= 0 || confidence < this.params.minConfidence) return null;

    const stopLoss = side === 'buy' ? currentPrice - atr * 1.8 : currentPrice + atr * 1.8;
    const takeProfit = side === 'buy' ? currentPrice + atr * 3 : currentPrice - atr * 3;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 82 ? 'high' : 'medium',
      confidenceScore: Math.round(confidence),
      strategy: 'adx_trend',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `ADX Trend favored a ${side.toUpperCase()} continuation with ${Math.round(confidence)}% confidence.`,
      metadata: { ema21, ema55, atr, recentRange, trendStrength, rsi }
    };
  }
}
