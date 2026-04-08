import { BaseStrategy } from './baseStrategy.js';

export class ForexProStrategy extends BaseStrategy {
  constructor() {
    super(
      'FOREX Pro',
      'Professional-grade algorithm for currency pairs using multi-timeframe analysis and fundamental trend following.',
      'trend_following',
      ['forex']
    );
    
    this.params = {
      timeframe: '4h',
      rsiPeriod: 14,
      rsiOverbought: 65,
      rsiOversold: 35,
      emaFast: 8,
      emaMedium: 21,
      emaSlow: 55,
      adxPeriod: 14,
      adxThreshold: 25,
      minConfidence: 75
    };
  }

  async generateSignal(marketData) {
    const { symbol, prices, volumes, highs, lows, currentPrice } = marketData;
    
    if (prices.length < 60) return null;
    
    // Multi-timeframe EMA analysis
    const emaFast = this.calculateEMA(prices, this.params.emaFast);
    const emaMedium = this.calculateEMA(prices, this.params.emaMedium);
    const emaSlow = this.calculateEMA(prices, this.params.emaSlow);
    
    const rsi = this.calculateRSI(prices, this.params.rsiPeriod);
    const bb = this.calculateBollingerBands(prices, 20, 2);
    const macd = this.calculateMACD(prices, 12, 26, 9);
    
    // Trend strength
    const trendStrength = Math.abs((emaFast - emaSlow) / emaSlow * 100);
    
    let buyScore = 0;
    let sellScore = 0;
    const indicators = [];
    
    // Triple EMA alignment (strong trend signal)
    if (emaFast > emaMedium && emaMedium > emaSlow) {
      buyScore += 30;
      indicators.push({ name: 'EMA_Trend', value: trendStrength, signal: 'strong_bullish' });
    } else if (emaFast < emaMedium && emaMedium < emaSlow) {
      sellScore += 30;
      indicators.push({ name: 'EMA_Trend', value: trendStrength, signal: 'strong_bearish' });
    } else {
      indicators.push({ name: 'EMA_Trend', value: trendStrength, signal: 'mixed' });
    }
    
    // RSI confirmation
    if (rsi > 50 && rsi < this.params.rsiOverbought) {
      buyScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'bullish_zone' });
    } else if (rsi < 50 && rsi > this.params.rsiOversold) {
      sellScore += 20;
      indicators.push({ name: 'RSI', value: rsi, signal: 'bearish_zone' });
    } else if (rsi < this.params.rsiOversold) {
      buyScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'oversold_bounce' });
    } else if (rsi > this.params.rsiOverbought) {
      sellScore += 15;
      indicators.push({ name: 'RSI', value: rsi, signal: 'overbought_pullback' });
    }
    
    // MACD confirmation
    if (macd.macd > macd.signal && macd.histogram > 0) {
      buyScore += 20;
      indicators.push({ name: 'MACD', value: macd.histogram, signal: 'bullish' });
    } else if (macd.macd < macd.signal && macd.histogram < 0) {
      sellScore += 20;
      indicators.push({ name: 'MACD', value: macd.histogram, signal: 'bearish' });
    }
    
    // Price vs Bollinger Bands
    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (bbPosition > 0.5 && bbPosition < 0.8) {
      buyScore += 15;
      indicators.push({ name: 'BB_Position', value: bbPosition, signal: 'bullish_zone' });
    } else if (bbPosition < 0.5 && bbPosition > 0.2) {
      sellScore += 15;
      indicators.push({ name: 'BB_Position', value: bbPosition, signal: 'bearish_zone' });
    }
    
    // Pullback to EMA (entry opportunity)
    const priceVsEmaFast = (currentPrice - emaFast) / emaFast * 100;
    if (Math.abs(priceVsEmaFast) < 0.2) {
      if (emaFast > emaMedium) {
        buyScore += 15;
        indicators.push({ name: 'Pullback', value: priceVsEmaFast, signal: 'bullish_entry' });
      } else {
        sellScore += 15;
        indicators.push({ name: 'Pullback', value: priceVsEmaFast, signal: 'bearish_entry' });
      }
    }
    
    let side = null;
    let confidence = 0;
    
    if (buyScore >= this.params.minConfidence && emaFast > emaSlow) {
      side = 'buy';
      confidence = buyScore;
    } else if (sellScore >= this.params.minConfidence && emaFast < emaSlow) {
      side = 'sell';
      confidence = sellScore;
    }
    
    if (!side) return null;
    
    // Conservative stop loss for forex (tighter)
    const atr = this.calculateATR(highs, lows, prices, 14);
    const slDistance = atr * 1.5;
    const tpDistance = slDistance * 2;
    
    const stopLoss = side === 'buy' ? currentPrice - slDistance : currentPrice + slDistance;
    const takeProfit = side === 'buy' ? currentPrice + tpDistance : currentPrice - tpDistance;
    
    let confidenceLevel = 'low';
    if (confidence >= 90) confidenceLevel = 'very_high';
    else if (confidence >= 80) confidenceLevel = 'high';
    else if (confidence >= 70) confidenceLevel = 'medium';
    
    return {
      symbol,
      assetType: 'forex',
      side,
      entryPrice: currentPrice,
      stopLoss: Math.round(stopLoss * 10000) / 10000, // 4 decimal places for forex
      takeProfit: Math.round(takeProfit * 10000) / 10000,
      confidence: confidenceLevel,
      confidenceScore: confidence,
      strategy: 'forex_pro',
      timeframe: this.params.timeframe,
      indicators,
      analysis: `FOREX Pro ${side.toUpperCase()} signal with ${confidence}% confidence. ` +
                `Trend: ${trendStrength.toFixed(2)}% strength, RSI: ${rsi.toFixed(2)}, ` +
                `EMA alignment: ${emaFast > emaMedium && emaMedium > emaSlow ? 'Bullish' : 'Bearish'}`,
      metadata: { emaFast, emaMedium, emaSlow, rsi, macd, bb, trendStrength }
    };
  }
}
