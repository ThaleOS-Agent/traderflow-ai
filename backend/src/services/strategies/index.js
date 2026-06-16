import { QuantumAIStrategy } from './quantumAI.js';
import { CryptoBotStrategy } from './cryptoBot.js';
import { ForexProStrategy } from './forexPro.js';
import { MetalsTraderStrategy } from './metalsTrader.js';
import { OilTraderStrategy } from './oilTrader.js';
import { XQTradeM8Strategy } from './xqTradeM8.js';

export const strategies = Object.freeze({
  quantum_ai: QuantumAIStrategy,
  crypto_bot: CryptoBotStrategy,
  forex_pro: ForexProStrategy,
  metals_trader: MetalsTraderStrategy,
  oil_trader: OilTraderStrategy,
  xq_trade_m8: XQTradeM8Strategy
});

const STRATEGY_CODES = Object.freeze([
  'quantum_ai',
  'crypto_bot',
  'forex_pro',
  'metals_trader',
  'oil_trader',
  'xq_trade_m8'
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
    case 'xq_trade_m8':
    default:
      return new XQTradeM8Strategy();
  }
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
