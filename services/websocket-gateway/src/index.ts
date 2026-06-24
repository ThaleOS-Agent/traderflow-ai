import { createDefaultAccountConfig, loadFeatureFlags, type NormalizedAccountEvent } from './config/accountConfig.js';
import { MessageQueue } from './core/messageQueue.js';
import { WebsocketClient } from './core/websocketClient.js';
import { binanceAccountAdapter } from './exchanges/binanceAccount.js';
import { bybitAccountAdapter } from './exchanges/bybitAccount.js';
import { krakenAccountAdapter } from './exchanges/krakenAccount.js';
import { coinbaseAccountAdapter } from './exchanges/coinbaseAccount.js';
import { okxAccountAdapter } from './exchanges/okxAccount.js';
import { oandaAccountAdapter } from './exchanges/oandaAccount.js';
import { paperAccountAdapter } from './exchanges/paperAccount.js';
import { AccountEventWorker } from './workers/accountEventWorker.js';
import { OrderEventWorker } from './workers/orderEventWorker.js';
import { FillEventWorker } from './workers/fillEventWorker.js';
import { RiskEventWorker } from './workers/riskEventWorker.js';

export * from './config/accountConfig.js';
export * from './core/websocketClient.js';
export * from './core/heartbeatManager.js';
export * from './core/reconnectManager.js';
export * from './core/rateLimitManager.js';
export * from './core/sessionRotator.js';
export * from './core/messageQueue.js';
export * from './core/stateRecovery.js';
export * from './execution/orderRouter.js';
export * from './execution/smartRouter.js';
export * from './execution/preTradeChecks.js';

const adapters = {
  binance_futures: binanceAccountAdapter,
  binance_spot: binanceAccountAdapter,
  bybit_v5: bybitAccountAdapter,
  kraken_v2: krakenAccountAdapter,
  coinbase_advanced_trade: coinbaseAccountAdapter,
  okx_v5: okxAccountAdapter,
  oanda_practice: oandaAccountAdapter,
  paper: paperAccountAdapter
} as const;

export async function createGatewayRuntime(exchange = 'paper') {
  const config = createDefaultAccountConfig(exchange as keyof typeof adapters);
  const flags = loadFeatureFlags();
  const queue = new MessageQueue<NormalizedAccountEvent>('account-events');
  const client = new WebsocketClient(config.account_config, adapters[config.account_config.exchange], queue);

  return {
    flags,
    config,
    client,
    workers: {
      account: new AccountEventWorker(queue),
      order: new OrderEventWorker(queue),
      fill: new FillEventWorker(queue),
      risk: new RiskEventWorker(queue)
    }
  };
}
