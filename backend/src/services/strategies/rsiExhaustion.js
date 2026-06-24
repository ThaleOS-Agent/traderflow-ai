import { BaseStrategy } from './baseStrategy.js';

export class RsiExhaustionStrategy extends BaseStrategy {
  constructor() {
    super(
      'RSI Exhaustion',
      'Short-horizon reversal strategy that fades exhaustion when RSI and Bollinger expansion become extreme.',
      'reversal',
      ['crypto', 'forex']
    );

    this.params = {
      timeframe: '30m',
      rsiPeriod: 5,
      minConfidence: 72
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;
    if (prices.length < 35) return null;

    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const bb = this.calculateBollingerBands(prices, 20, 2.4);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const lastMove = ((prices[prices.length - 1] - prices[prices.length - 4]) / prices[prices.length - 4]) * 100;

    let side = null;
    let confidence = 0;
    const indicators = [];

    if (rsi < 18 && currentPrice < bb.lower && lastMove < -1.2) {
      side = 'buy';
      confidence = 74 + Math.min(16, Math.abs(lastMove) * 4);
      indicators.push({ name: 'RSI', value: rsi, signal: 'capitulation' });
      indicators.push({ name: 'Bollinger', value: currentPrice - bb.lower, signal: 'below_band' });
      indicators.push({ name: 'Impulse', value: lastMove, signal: 'down_exhaustion' });
    } else if (rsi > 82 && currentPrice > bb.upper && lastMove > 1.2) {
      side = 'sell';
      confidence = 74 + Math.min(16, Math.abs(lastMove) * 4);
      indicators.push({ name: 'RSI', value: rsi, signal: 'blowoff' });
      indicators.push({ name: 'Bollinger', value: currentPrice - bb.upper, signal: 'above_band' });
      indicators.push({ name: 'Impulse', value: lastMove, signal: 'up_exhaustion' });
    }

    if (!side || atr <= 0 || confidence < this.params.minConfidence) return null;

    const stopLoss = side === 'buy' ? currentPrice - atr * 1.2 : currentPrice + atr * 1.2;
    const takeProfit = side === 'buy' ? bb.middle : bb.middle;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 84 ? 'high' : 'medium',
      confidenceScore: Math.round(confidence),
      strategy: 'rsi_exhaustion',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `RSI Exhaustion flagged a ${side.toUpperCase()} reversal with ${Math.round(confidence)}% confidence.`,
      metadata: { rsi, bb, atr, lastMove }
    };
  }
}
