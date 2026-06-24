import { z } from 'zod';

export const supportedAccountExchanges = [
  'binance_spot',
  'binance_futures',
  'bybit_v5',
  'kraken_v2',
  'coinbase_advanced_trade',
  'okx_v5',
  'oanda_practice',
  'paper'
] as const;

export const supportedEnvironments = ['testnet', 'mainnet', 'practice', 'paper'] as const;
export const supportedAuthMethods = ['HMAC_SHA256', 'ED25519', 'RSA'] as const;
export const supportedConnectionStates = ['HEALTHY', 'DEGRADED', 'STALE', 'DISCONNECTED', 'RECONNECTING', 'FAILED'] as const;

export const accountConfigSchema = z.object({
  account_config: z.object({
    exchange: z.enum(supportedAccountExchanges),
    environment: z.enum(supportedEnvironments),
    auth_method: z.enum(supportedAuthMethods),
    private_trading: z.boolean().default(false),
    network_tuning: z.object({
      tcp_no_delay: z.boolean().default(true),
      recv_buffer_size_kb: z.number().int().positive().default(8192),
      send_buffer_size_kb: z.number().int().positive().default(1024)
    }),
    rate_limits: z.object({
      max_connections_per_5min: z.number().int().positive().default(300),
      max_inbound_msg_per_second: z.number().int().positive().default(5),
      recv_window_ms: z.number().int().positive().default(5000)
    }),
    heartbeat: z.object({
      ping_interval_seconds: z.number().int().positive().default(30),
      pong_timeout_seconds: z.number().int().positive().default(5),
      listen_key_refresh_interval_minutes: z.number().int().positive().default(25)
    }),
    reconnect_policy: z.object({
      strategy: z.literal('exponential_backoff_with_jitter').default('exponential_backoff_with_jitter'),
      initial_delay_seconds: z.number().positive().default(1),
      max_delay_seconds: z.number().positive().default(60),
      backoff_factor: z.number().positive().default(2),
      jitter_range: z.tuple([z.number().min(0), z.number().max(1)]).default([0.1, 0.5])
    }),
    session_rotation: z.object({
      enabled: z.boolean().default(true),
      rotate_before_hours: z.number().positive().default(23)
    }),
    permissions: z.object({
      read_account: z.boolean().default(true),
      read_orders: z.boolean().default(true),
      trade: z.boolean().default(false),
      withdraw: z.boolean().default(false)
    })
  })
});

export type AccountConfigEnvelope = z.infer<typeof accountConfigSchema>;
export type AccountConfig = AccountConfigEnvelope['account_config'];
export type AccountExchange = AccountConfig['exchange'];
export type AccountEnvironment = AccountConfig['environment'];
export type AuthMethod = AccountConfig['auth_method'];
export type ConnectionState = (typeof supportedConnectionStates)[number];

export type NormalizedAccountEvent = {
  id: string;
  exchange: string;
  accountId?: string;
  eventType:
    | 'ACCOUNT_UPDATE'
    | 'BALANCE_UPDATE'
    | 'ORDER_NEW'
    | 'ORDER_UPDATE'
    | 'ORDER_FILLED'
    | 'ORDER_PARTIAL_FILL'
    | 'ORDER_CANCELLED'
    | 'ORDER_REJECTED'
    | 'POSITION_UPDATE'
    | 'MARGIN_UPDATE'
    | 'RISK_EVENT'
    | 'HEARTBEAT'
    | 'RECONNECT'
    | 'AUTH_FAILURE';
  symbol?: string;
  orderId?: string;
  clientOrderId?: string;
  side?: 'buy' | 'sell';
  orderType?: string;
  status?: string;
  price?: number;
  quantity?: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  fee?: number;
  feeAsset?: string;
  balanceAsset?: string;
  balanceFree?: number;
  balanceLocked?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  timestamp: number;
  receivedAt: number;
  latencyMs: number;
  sequence?: number;
  raw: unknown;
};

export function createDefaultAccountConfig(exchange: AccountExchange = 'paper'): AccountConfigEnvelope {
  const authMethod: AuthMethod = exchange === 'coinbase_advanced_trade'
    ? 'ED25519'
    : exchange === 'kraken_v2'
      ? 'RSA'
      : 'HMAC_SHA256';

  const environment: AccountEnvironment = exchange === 'oanda_practice'
    ? 'practice'
    : exchange === 'paper'
      ? 'paper'
      : 'testnet';

  return accountConfigSchema.parse({
    account_config: {
      exchange,
      environment,
      auth_method: authMethod,
      private_trading: false,
      network_tuning: {
        tcp_no_delay: true,
        recv_buffer_size_kb: 8192,
        send_buffer_size_kb: 1024
      },
      rate_limits: {
        max_connections_per_5min: 300,
        max_inbound_msg_per_second: 5,
        recv_window_ms: 5000
      },
      heartbeat: {
        ping_interval_seconds: 30,
        pong_timeout_seconds: 5,
        listen_key_refresh_interval_minutes: 25
      },
      reconnect_policy: {
        strategy: 'exponential_backoff_with_jitter',
        initial_delay_seconds: 1,
        max_delay_seconds: 60,
        backoff_factor: 2,
        jitter_range: [0.1, 0.5]
      },
      session_rotation: {
        enabled: true,
        rotate_before_hours: 23
      },
      permissions: {
        read_account: true,
        read_orders: true,
        trade: false,
        withdraw: false
      }
    }
  });
}

export function loadFeatureFlags(env: NodeJS.ProcessEnv = process.env) {
  return {
    enablePaperTrading: env.ENABLE_PAPER_TRADING !== 'false',
    enableLiveTrading: env.ENABLE_LIVE_TRADING === 'true',
    demoMode: env.DEMO_MODE !== 'false'
  };
}
