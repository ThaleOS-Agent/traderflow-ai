import { BaseStrategy } from './baseStrategy.js';

export class EmaPullbackStrategy extends BaseStrategy {
  constructor() {
    super(
      'EMA Pullback',
      'Trend continuation strategy that buys or sells controlled pullbacks into the fast EMA after directional expansion.',
      'trend_pullback',
      ['crypto', 'forex', 'commodity']
    );

    this.params = {
      timeframe: '1h',
      emaFast: 21,
      emaSlow: 55,
      rsiPeriod: 14,
      minConfidence: 68
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;
    if (prices.length < 70) return null;

    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const distanceToFast = ((currentPrice - emaFast) / emaFast) * 100;
    const trendGap = ((emaFast - emaSlow) / emaSlow) * 100;

    let side = null;
    let confidence = 0;
    const indicators = [];

    if (emaFast > emaSlow && distanceToFast > -1.2 && distanceToFast < 0.35 && rsi > 48 && rsi < 66) {
      side = 'buy';
      confidence = 70 + Math.min(12, trendGap * 6);
      indicators.push({ name: 'EMA_Trend', value: trendGap, signal: 'bullish' });
      indicators.push({ name: 'PullbackDepth', value: distanceToFast, signal: 'buy_zone' });
      indicators.push({ name: 'RSI', value: rsi, signal: 'trend_supportive' });
    } else if (emaFast < emaSlow && distanceToFast < 1.2 && distanceToFast > -0.35 && rsi < 52 && rsi > 34) {
      side = 'sell';
      confidence = 70 + Math.min(12, Math.abs(trendGap) * 6);
      indicators.push({ name: 'EMA_Trend', value: trendGap, signal: 'bearish' });
      indicators.push({ name: 'PullbackDepth', value: distanceToFast, signal: 'sell_zone' });
      indicators.push({ name: 'RSI', value: rsi, signal: 'trend_supportive' });
    }

    if (!side || atr <= 0 || confidence < this.params.minConfidence) return null;

    const stopLoss = side === 'buy' ? currentPrice - atr * 1.6 : currentPrice + atr * 1.6;
    const takeProfit = side === 'buy' ? currentPrice + atr * 2.6 : currentPrice - atr * 2.6;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 80 ? 'high' : 'medium',
      confidenceScore: Math.round(confidence),
      strategy: 'ema_pullback',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `EMA Pullback aligned a ${side.toUpperCase()} continuation with ${Math.round(confidence)}% confidence.`,
      metadata: { emaFast, emaSlow, rsi, atr, distanceToFast, trendGap }
    };
  }
}
