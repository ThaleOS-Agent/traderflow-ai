import { QuantumAIStrategy } from './quantumAI.js';
import { CryptoBotStrategy } from './cryptoBot.js';
import { ForexProStrategy } from './forexPro.js';
import { MetalsTraderStrategy } from './metalsTrader.js';
import { OilTraderStrategy } from './oilTrader.js';
import { XQTradeM8Strategy } from './xqTradeM8.js';

export const strategies = {
  quantum_ai: QuantumAIStrategy,
  crypto_bot: CryptoBotStrategy,
  forex_pro: ForexProStrategy,
  metals_trader: MetalsTraderStrategy,
  oil_trader: OilTraderStrategy,
  xq_trade_m8: XQTradeM8Strategy
};

export function getStrategy(name) {
  const Strategy = strategies[name] || strategies.xq_trade_m8;
  return new Strategy();
}

export function getAllStrategies() {
  return Object.keys(strategies).map(key => {
    const strategy = new strategies[key]();
    return {
      code: key,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      supportedAssets: strategy.supportedAssets
    };
  });
}
