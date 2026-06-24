import { BaseStrategy } from './baseStrategy.js';

export class TurtleBreakoutStrategy extends BaseStrategy {
  constructor() {
    super(
      'Turtle Breakout',
      'A modernized breakout system derived from classic turtle-trading ideas in the Quantopian archive.',
      'breakout',
      ['crypto', 'forex', 'commodity']
    );

    this.params = {
      timeframe: '4h',
      breakoutPeriod: 20,
      exitPeriod: 10,
      minConfidence: 65
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;

    if (prices.length < 55) return null;

    const atr = this.calculateATR(highs, lows, prices, 20);
    const rsi = this.calculateRSI(prices, 14);
    const entryHigh = Math.max(...highs.slice(-(this.params.breakoutPeriod + 1), -1));
    const entryLow = Math.min(...lows.slice(-(this.params.breakoutPeriod + 1), -1));
    const exitHigh = Math.max(...highs.slice(-(this.params.exitPeriod + 1), -1));
    const exitLow = Math.min(...lows.slice(-(this.params.exitPeriod + 1), -1));
    const trendEma = this.calculateEMA(prices, 55);

    let side = null;
    let confidence = 0;
    const indicators = [];

    if (currentPrice > entryHigh && currentPrice > trendEma) {
      side = 'buy';
      confidence += 45;
      indicators.push({ name: 'Breakout', value: entryHigh, signal: '20_day_high' });
    } else if (currentPrice < entryLow && currentPrice < trendEma) {
      side = 'sell';
      confidence += 45;
      indicators.push({ name: 'Breakout', value: entryLow, signal: '20_day_low' });
    }

    if (!side || atr <= 0) return null;

    if ((side === 'buy' && rsi > 55) || (side === 'sell' && rsi < 45)) {
      confidence += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'trend_confirmed' });
    } else {
      indicators.push({ name: 'RSI', value: rsi, signal: 'weak_confirmation' });
    }

    const expansion = (atr / currentPrice) * 100;
    if (expansion > 0.4) {
      confidence += 15;
      indicators.push({ name: 'ATR_Expansion', value: expansion, signal: 'active_range' });
    }

    if (confidence < this.params.minConfidence) return null;

    const stopLoss = side === 'buy' ? Math.max(exitLow, currentPrice - atr * 2) : Math.min(exitHigh, currentPrice + atr * 2);
    const takeProfit = side === 'buy' ? currentPrice + atr * 3 : currentPrice - atr * 3;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 80 ? 'high' : 'medium',
      confidenceScore: confidence,
      strategy: 'turtle_breakout',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Turtle Breakout triggered a ${side.toUpperCase()} breakout with ${confidence}% confidence. ` +
        `Price cleared the ${this.params.breakoutPeriod}-bar range with ATR expansion ${expansion.toFixed(2)}%.`,
      metadata: { atr, rsi, trendEma, entryHigh, entryLow, exitHigh, exitLow }
    };
  }
}
