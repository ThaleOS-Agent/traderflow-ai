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
  return strategies[name] || strategies.xq_trade_m8;
}

export function getAllStrategies() {
  return Object.keys(strategies).map(key => ({
    code: key,
    name: strategies[key].name,
    description: strategies[key].description,
    type: strategies[key].type,
    supportedAssets: strategies[key].supportedAssets
  }));
}
