import { BaseStrategy } from './baseStrategy.js';

export class DualMomentumStrategy extends BaseStrategy {
  constructor() {
    super(
      'Dual Momentum',
      'Quantopian-inspired momentum rotation that combines trend alignment, relative strength, and breakout confirmation.',
      'momentum',
      ['crypto', 'forex', 'commodity']
    );

    this.params = {
      timeframe: '4h',
      lookback: 30,
      emaFast: 20,
      emaSlow: 50,
      breakoutWindow: 20,
      minConfidence: 70
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, currentPrice, assetType } = marketData;

    if (prices.length < 60) return null;

    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const rsi = this.calculateRSI(prices, 14);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const lookbackPrices = prices.slice(-this.params.lookback);
    const momentum = ((currentPrice - lookbackPrices[0]) / lookbackPrices[0]) * 100;
    const breakoutHigh = Math.max(...highs.slice(-this.params.breakoutWindow));
    const breakoutLow = Math.min(...lows.slice(-this.params.breakoutWindow));

    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];

    if (emaFast > emaSlow) {
      buyScore += 25;
      indicators.push({ name: 'EMA_Trend', value: ((emaFast - emaSlow) / emaSlow) * 100, signal: 'bullish' });
    } else {
      sellScore += 25;
      indicators.push({ name: 'EMA_Trend', value: ((emaFast - emaSlow) / emaSlow) * 100, signal: 'bearish' });
    }

    if (momentum > 4) {
      buyScore += 25;
      indicators.push({ name: 'Momentum', value: momentum, signal: 'positive' });
    } else if (momentum < -4) {
      sellScore += 25;
      indicators.push({ name: 'Momentum', value: momentum, signal: 'negative' });
    } else {
      indicators.push({ name: 'Momentum', value: momentum, signal: 'flat' });
    }

    if (currentPrice >= breakoutHigh * 0.998) {
      buyScore += 20;
      indicators.push({ name: 'Breakout', value: breakoutHigh, signal: 'range_high' });
    } else if (currentPrice <= breakoutLow * 1.002) {
      sellScore += 20;
      indicators.push({ name: 'Breakout', value: breakoutLow, signal: 'range_low' });
    }

    if (rsi > 55 && rsi < 72) {
      buyScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'trend_supportive' });
    } else if (rsi < 45 && rsi > 28) {
      sellScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'trend_supportive' });
    } else {
      indicators.push({ name: 'RSI', value: rsi, signal: 'stretched' });
    }

    const side = buyScore >= this.params.minConfidence
      ? 'buy'
      : sellScore >= this.params.minConfidence
        ? 'sell'
        : null;

    if (!side || atr <= 0) return null;

    const slDistance = atr * 1.75;
    const tpDistance = slDistance * 2.2;
    const stopLoss = side === 'buy' ? currentPrice - slDistance : currentPrice + slDistance;
    const takeProfit = side === 'buy' ? currentPrice + tpDistance : currentPrice - tpDistance;
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
      strategy: 'dual_momentum',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Dual Momentum found a ${side.toUpperCase()} setup with ${confidence}% confidence. ` +
        `30-bar momentum is ${momentum.toFixed(2)}% and the trend is ${emaFast > emaSlow ? 'up' : 'down'}.`,
      metadata: { emaFast, emaSlow, rsi, atr, momentum, breakoutHigh, breakoutLow }
    };
  }
}
