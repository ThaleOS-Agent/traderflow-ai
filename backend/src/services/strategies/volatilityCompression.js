import { BaseStrategy } from './baseStrategy.js';

export class VolatilityCompressionStrategy extends BaseStrategy {
  constructor() {
    super(
      'Volatility Compression',
      'Breakout strategy that waits for range compression, then trades directional expansion with volume support.',
      'volatility_breakout',
      ['crypto', 'forex', 'commodity']
    );

    this.params = {
      timeframe: '1h',
      minConfidence: 69
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, highs, lows, volumes, currentPrice, assetType } = marketData;
    if (prices.length < 40) return null;

    const bb = this.calculateBollingerBands(prices, 20, 2);
    const atr = this.calculateATR(highs, lows, prices, 14);
    const ema = this.calculateEMA(prices, 20);
    const bbWidth = ((bb.upper - bb.lower) / bb.middle) * 100;
    const avgVolume = volumes.slice(-20).reduce((sum, value) => sum + value, 0) / 20 || 1;
    const volumeRatio = (volumes[volumes.length - 1] || 0) / avgVolume;
    const rangeHigh = Math.max(...highs.slice(-12));
    const rangeLow = Math.min(...lows.slice(-12));

    let side = null;
    let confidence = 0;
    const indicators = [];

    if (bbWidth < 4.5 && currentPrice > rangeHigh * 0.999 && currentPrice > ema && volumeRatio > 1.2) {
      side = 'buy';
      confidence = 70 + Math.min(14, volumeRatio * 6);
      indicators.push({ name: 'Compression', value: bbWidth, signal: 'tight_range' });
      indicators.push({ name: 'RangeBreak', value: rangeHigh, signal: 'upside_break' });
      indicators.push({ name: 'Volume', value: volumeRatio, signal: 'confirming' });
    } else if (bbWidth < 4.5 && currentPrice < rangeLow * 1.001 && currentPrice < ema && volumeRatio > 1.2) {
      side = 'sell';
      confidence = 70 + Math.min(14, volumeRatio * 6);
      indicators.push({ name: 'Compression', value: bbWidth, signal: 'tight_range' });
      indicators.push({ name: 'RangeBreak', value: rangeLow, signal: 'downside_break' });
      indicators.push({ name: 'Volume', value: volumeRatio, signal: 'confirming' });
    }

    if (!side || atr <= 0 || confidence < this.params.minConfidence) return null;

    const stopLoss = side === 'buy' ? currentPrice - atr * 1.5 : currentPrice + atr * 1.5;
    const takeProfit = side === 'buy' ? currentPrice + atr * 2.8 : currentPrice - atr * 2.8;

    return {
      symbol,
      assetType,
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      confidence: confidence >= 82 ? 'high' : 'medium',
      confidenceScore: Math.round(confidence),
      strategy: 'volatility_compression',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Volatility Compression identified a ${side.toUpperCase()} expansion with ${Math.round(confidence)}% confidence.`,
      metadata: { bbWidth, volumeRatio, atr, rangeHigh, rangeLow, ema }
    };
  }
}
