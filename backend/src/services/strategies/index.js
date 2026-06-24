import { QuantumAIStrategy } from './quantumAI.js';
import { CryptoBotStrategy } from './cryptoBot.js';
import { ForexProStrategy } from './forexPro.js';
import { MetalsTraderStrategy } from './metalsTrader.js';
import { OilTraderStrategy } from './oilTrader.js';
import { XQTradeM8Strategy } from './xqTradeM8.js';
import { DualMomentumStrategy } from './dualMomentum.js';
import { MeanReversionAlphaStrategy } from './meanReversionAlpha.js';
import { TurtleBreakoutStrategy } from './turtleBreakout.js';
import { EmaPullbackStrategy } from './emaPullback.js';
import { RsiExhaustionStrategy } from './rsiExhaustion.js';
import { VolatilityCompressionStrategy } from './volatilityCompression.js';
import { AdxTrendStrategy } from './adxTrend.js';

export const strategies = Object.freeze({
  quantum_ai: QuantumAIStrategy,
  crypto_bot: CryptoBotStrategy,
  forex_pro: ForexProStrategy,
  metals_trader: MetalsTraderStrategy,
  oil_trader: OilTraderStrategy,
  xq_trade_m8: XQTradeM8Strategy,
  dual_momentum: DualMomentumStrategy,
  mean_reversion_alpha: MeanReversionAlphaStrategy,
  turtle_breakout: TurtleBreakoutStrategy,
  ema_pullback: EmaPullbackStrategy,
  rsi_exhaustion: RsiExhaustionStrategy,
  volatility_compression: VolatilityCompressionStrategy,
  adx_trend: AdxTrendStrategy
});

const STRATEGY_CODES = Object.freeze([
  'quantum_ai',
  'crypto_bot',
  'forex_pro',
  'metals_trader',
  'oil_trader',
  'xq_trade_m8',
  'dual_momentum',
  'mean_reversion_alpha',
  'turtle_breakout',
  'ema_pullback',
  'rsi_exhaustion',
  'volatility_compression',
  'adx_trend'
]);

export function getStrategy(name) {
  switch (name) {
    case 'quantum_ai':
      return new QuantumAIStrategy();
    case 'crypto_bot':
      return new CryptoBotStrategy();
    case 'forex_pro':
      return new ForexProStrategy();
    case 'metals_trader':
      return new MetalsTraderStrategy();
    case 'oil_trader':
      return new OilTraderStrategy();
    case 'dual_momentum':
      return new DualMomentumStrategy();
    case 'mean_reversion_alpha':
      return new MeanReversionAlphaStrategy();
    case 'turtle_breakout':
      return new TurtleBreakoutStrategy();
    case 'ema_pullback':
      return new EmaPullbackStrategy();
    case 'rsi_exhaustion':
      return new RsiExhaustionStrategy();
    case 'volatility_compression':
      return new VolatilityCompressionStrategy();
    case 'adx_trend':
      return new AdxTrendStrategy();
    case 'xq_trade_m8':
    default:
      return new XQTradeM8Strategy();
  }
}

export function getStrategyCodes() {
  return [...STRATEGY_CODES];
}

export function getAllStrategies() {
  return STRATEGY_CODES.map(code => {
    const strategy = getStrategy(code);
    return {
      code,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      supportedAssets: strategy.supportedAssets
    };
  });
}
