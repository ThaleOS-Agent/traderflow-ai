import { AccountConnection } from '../models/AccountConnection.js';
import { AccountStreamEvent } from '../models/AccountStreamEvent.js';
import { StateReconciliationLog } from '../models/StateReconciliationLog.js';
import { PrivateStreamAuditLog } from '../models/PrivateStreamAuditLog.js';
import { ConnectionSession } from '../models/ConnectionSession.js';

const ACCOUNT_CARDS = [
  { exchange: 'binance_futures', label: 'Binance Futures' },
  { exchange: 'bybit_v5', label: 'Bybit V5' },
  { exchange: 'kraken_v2', label: 'Kraken' },
  { exchange: 'coinbase_advanced_trade', label: 'Coinbase' },
  { exchange: 'okx_v5', label: 'OKX' },
  { exchange: 'oanda_practice', label: 'OANDA' },
  { exchange: 'paper', label: 'Paper Account' }
];

function envFlags() {
  return {
    enablePaperTrading: process.env.ENABLE_PAPER_TRADING !== 'false',
    enableLiveTrading: process.env.ENABLE_LIVE_TRADING === 'true',
    demoMode: process.env.DEMO_MODE !== 'false'
  };
}

function assistantMessage(connection, session, latestReconciliation, flags) {
  if (connection.withdrawalPermissionDetected) {
    return 'Withdrawal permission must be disabled before connector can be marked safe.';
  }
  if (latestReconciliation && latestReconciliation.consistent === false) {
    return 'Account state mismatch detected. Trading paused until reconciliation completes.';
  }
  if (!flags.enableLiveTrading) {
    return 'Live trading blocked because risk controls are incomplete.';
  }
  if (session?.heartbeatState === 'STALE' || session?.connectionState === 'DEGRADED') {
    return `${connection.label || connection.exchange} private stream degraded. Last pong missed. Reconnecting with backoff.`;
  }
  if (connection.exchange === 'binance_futures' && connection.nextListenKeyRefreshAt) {
    const minutes = Math.max(0, Math.round((new Date(connection.nextListenKeyRefreshAt).getTime() - Date.now()) / 60000));
    return `Binance account stream is healthy. Next listenKey refresh in ${minutes} minutes.`;
  }
  return `${connection.label || connection.exchange} account stream ready in ${flags.enableLiveTrading ? 'live' : 'paper-routed'} mode.`;
}

function tradingPermissionStatus(connection, flags) {
  if (connection.exchange === 'paper') return 'paper_only';
  if (!flags.enableLiveTrading) return 'paper_reroute';
  if (connection.withdrawalPermissionDetected) return 'blocked_withdrawal_permission';
  if (!connection.safeForTrading) return 'blocked_not_safe';
  return connection.tradingEnabled ? 'live_enabled' : 'read_only';
}

export const privateAccountGatewayService = {
  flags: envFlags,

  defaultConfig(exchange) {
    return {
      account_config: {
        exchange,
        environment: exchange === 'paper' ? 'paper' : exchange === 'oanda_practice' ? 'practice' : 'testnet',
        auth_method: exchange === 'coinbase_advanced_trade' ? 'ED25519' : exchange === 'kraken_v2' ? 'RSA' : 'HMAC_SHA256',
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
    };
  },

  async listForUser(userId) {
    const flags = envFlags();
    const [connections, sessions, reconciliations, audits, latestEvents] = await Promise.all([
      AccountConnection.find({ userId }).sort({ exchange: 1 }),
      ConnectionSession.find({ userId }).sort({ updatedAt: -1 }),
      StateReconciliationLog.find({ userId }).sort({ createdAt: -1 }).limit(50),
      PrivateStreamAuditLog.find({ userId }).sort({ createdAt: -1 }).limit(50),
      AccountStreamEvent.find({ userId }).sort({ createdAt: -1 }).limit(100)
    ]);

    const sessionByConnection = new Map(sessions.map(session => [String(session.connectionId), session]));
    const reconciliationByConnection = new Map();
    for (const entry of reconciliations) {
      const key = String(entry.connectionId);
      if (!reconciliationByConnection.has(key)) reconciliationByConnection.set(key, entry);
    }

    const latestEventByConnectionAndType = new Map();
    for (const event of latestEvents) {
      const key = `${String(event.connectionId)}:${event.eventType}`;
      if (!latestEventByConnectionAndType.has(key)) latestEventByConnectionAndType.set(key, event);
    }

    const savedByExchange = new Map(connections.map(connection => [connection.exchange, connection]));

    const cards = ACCOUNT_CARDS.map(card => {
      const connection = savedByExchange.get(card.exchange);
      if (!connection) {
        return {
          exchange: card.exchange,
          label: card.label,
          configured: card.exchange === 'paper',
          authenticated: card.exchange === 'paper',
          privateStreamStatus: card.exchange === 'paper' ? 'HEALTHY' : 'UNAUTHENTICATED',
          heartbeatStatus: card.exchange === 'paper' ? 'HEALTHY' : 'DISCONNECTED',
          lastPong: null,
          reconnectCount: 0,
          nextSessionRotation: null,
          listenKeyRefreshTimer: null,
          latestBalanceEvent: null,
          latestOrderEvent: null,
          stateReconciliationStatus: card.exchange === 'paper' ? 'consistent' : 'pending',
          tradingPermissionStatus: card.exchange === 'paper' ? 'paper_only' : 'paper_reroute',
          withdrawalPermissionWarning: false,
          assistantMessage: card.exchange === 'paper'
            ? 'Paper account is healthy and remains the default execution path.'
            : 'Connector not authenticated. Paper routing remains active.',
          config: this.defaultConfig(card.exchange).account_config
        };
      }

      const session = sessionByConnection.get(String(connection._id));
      const latestReconciliation = reconciliationByConnection.get(String(connection._id));
      const latestBalanceEvent = latestEventByConnectionAndType.get(`${String(connection._id)}:BALANCE_UPDATE`) || null;
      const latestOrderEvent =
        latestEventByConnectionAndType.get(`${String(connection._id)}:ORDER_UPDATE`)
        || latestEventByConnectionAndType.get(`${String(connection._id)}:ORDER_FILLED`)
        || null;

      return {
        ...connection.toSafeJSON(),
        label: connection.label || card.label,
        configured: true,
        authenticated: connection.authenticated,
        privateStreamStatus: session?.connectionState || (connection.authenticated ? 'HEALTHY' : 'UNAUTHENTICATED'),
        heartbeatStatus: session?.heartbeatState || 'DISCONNECTED',
        lastPong: session?.lastPongAt || connection.lastPongAt || null,
        reconnectCount: session?.reconnectCount ?? connection.reconnectCount ?? 0,
        nextSessionRotation: session?.nextSessionRotationAt || connection.nextSessionRotationAt || null,
        listenKeyRefreshTimer: session?.nextListenKeyRefreshAt || connection.nextListenKeyRefreshAt || null,
        latestBalanceEvent,
        latestOrderEvent,
        stateReconciliationStatus: latestReconciliation?.consistent === false ? 'mismatch' : connection.stateReconciliationStatus,
        tradingPermissionStatus: tradingPermissionStatus(connection, flags),
        withdrawalPermissionWarning: Boolean(connection.withdrawalPermissionDetected),
        assistantMessage: assistantMessage(connection, session, latestReconciliation, flags)
      };
    });

    return {
      flags,
      cards,
      warnings: cards.filter(card => card.withdrawalPermissionWarning).map(card => `${card.label}: withdrawal permission warning`),
      recommendations: [
        'Keep live trading disabled until authenticated private streams pass reconciliation.',
        'Use IP whitelisting on every live exchange key.',
        'Never expose listen keys or signatures to the frontend.'
      ],
      recentAudit: audits
    };
  }
};
