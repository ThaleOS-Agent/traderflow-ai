import { BaseStrategy } from './baseStrategy.js';

export class OilTraderStrategy extends BaseStrategy {
  constructor() {
    super(
      'Oil Trader',
      'Algorithm for crude oil (WTI/Brent) trading with breakout detection and supply/demand zone analysis.',
      'breakout',
      ['commodity']
    );
    
    this.params = {
      timeframe: '2h',
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      emaFast: 12,
      emaSlow: 26,
      volumeThreshold: 1.8,
      breakoutThreshold: 1.5,
      minConfidence: 70
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, volumes, highs, lows, currentPrice } = marketData;
    
    if (prices.length < 50) return null;
    
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    const bb = this.calculateBollingerBands(prices, 20, 2);
    const atr = this.calculateATR(highs, lows, prices, 14);
    
    // Volume analysis
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    // Range analysis for breakout detection
    const recentHighs = highs.slice(-20);
    const recentLows = lows.slice(-20);
    const rangeHigh = Math.max(...recentHighs);
    const rangeLow = Math.min(...recentLows);
    const range = rangeHigh - rangeLow;
    
    // Breakout detection
    const nearResistance = (rangeHigh - currentPrice) / range < 0.03;
    const nearSupport = (currentPrice - rangeLow) / range < 0.03;
    const brokeResistance = currentPrice > rangeHigh * 0.995;
    const brokeSupport = currentPrice < rangeLow * 1.005;
    
    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];
    
    // Breakout signals (primary)
    if (brokeResistance && volumeRatio > this.params.volumeThreshold) {
      buyScore += 35;
      indicators.push({ name: 'Breakout', value: currentPrice - rangeHigh, signal: 'resistance_break' });
    } else if (brokeSupport && volumeRatio > this.params.volumeThreshold) {
      sellScore += 35;
      indicators.push({ name: 'Breakout', value: rangeLow - currentPrice, signal: 'support_break' });
    } else if (nearResistance) {
      indicators.push({ name: 'Breakout', value: (rangeHigh - currentPrice) / range, signal: 'near_resistance' });
    } else if (nearSupport) {
      indicators.push({ name: 'Breakout', value: (currentPrice - rangeLow) / range, signal: 'near_support' });
    }
    
    // RSI confirmation
    if (rsi > 50 && rsi < this.params.rsiOverbought) {
      buyScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'bullish_zone' });
    } else if (rsi < 50 && rsi > this.params.rsiOversold) {
      sellScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'bearish_zone' });
    } else if (rsi < this.params.rsiOversold) {
      buyScore += 10;
      indicators.push({ name: 'RSI', value: rsi, signal: 'oversold' });
    } else if (rsi > this.params.rsiOverbought) {
      sellScore += 10;
      indicators.push({ name: 'RSI', value: rsi, signal: 'overbought' });
    }
    
    // EMA trend
    if (emaFast > emaSlow) {
      buyScore += 20;
      indicators.push({ name: 'EMA', value: (emaFast - emaSlow) / emaSlow * 100, signal: 'bullish' });
    } else {
      sellScore += 20;
      indicators.push({ name: 'EMA', value: (emaFast - emaSlow) / emaSlow * 100, signal: 'bearish' });
    }
    
    // Volume confirmation
    if (volumeRatio > this.params.volumeThreshold) {
      const priceChange = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2] * 100;
      if (priceChange > 0.5) {
        buyScore += 20;
        indicators.push({ name: 'Volume', value: volumeRatio, signal: 'bullish_volume' });
      } else if (priceChange < -0.5) {
        sellScore += 20;
        indicators.push({ name: 'Volume', value: volumeRatio, signal: 'bearish_volume' });
      }
    } else {
      indicators.push({ name: 'Volume', value: volumeRatio, signal: 'normal' });
    }
    
    // Bollinger Band squeeze (pre-breakout)
    const bbWidth = (bb.upper - bb.lower) / bb.middle * 100;
    if (bbWidth < 3) {
      indicators.push({ name: 'BB_Squeeze', value: bbWidth, signal: 'potential_breakout' });
      if (currentPrice > bb.middle) {
        buyScore += 10;
      } else {
        sellScore += 10;
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
    
    // Oil-specific stop loss (wider due to volatility)
    const slDistance = atr * 2;
    const tpDistance = slDistance * 2;
    
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
      strategy: 'oil_trader',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `Oil Trader ${side.toUpperCase()} signal with ${confidence}% confidence. ` +
                `${brokeResistance || brokeSupport ? 'Breakout' : 'Setup'} detected with ` +
                `${volumeRatio.toFixed(2)}x volume. Range: $${rangeLow.toFixed(2)} - $${rangeHigh.toFixed(2)}`,
      metadata: { 
        rsi, emaFast, emaSlow, bb, atr, volumeRatio, 
        rangeHigh, rangeLow, bbWidth,
        breakout: brokeResistance || brokeSupport 
      }
    };
  }
}
