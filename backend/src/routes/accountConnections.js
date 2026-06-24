import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { AccountConnection } from '../models/AccountConnection.js';
import { privateAccountGatewayService } from '../services/privateAccountGatewayService.js';

const router = express.Router();

function normalizeExchange(value) {
  return String(value || '').trim().toLowerCase();
}

function buildConfig(exchange, body = {}) {
  const fallback = privateAccountGatewayService.defaultConfig(exchange).account_config;
  return {
    exchange,
    environment: body.environment || fallback.environment,
    authMethod: body.authMethod || fallback.auth_method,
    privateTrading: Boolean(body.privateTrading ?? fallback.private_trading),
    networkTuning: {
      tcpNoDelay: body.networkTuning?.tcpNoDelay ?? fallback.network_tuning.tcp_no_delay,
      recvBufferSizeKb: Number(body.networkTuning?.recvBufferSizeKb ?? fallback.network_tuning.recv_buffer_size_kb),
      sendBufferSizeKb: Number(body.networkTuning?.sendBufferSizeKb ?? fallback.network_tuning.send_buffer_size_kb)
    },
    rateLimits: {
      maxConnectionsPer5Min: Number(body.rateLimits?.maxConnectionsPer5Min ?? fallback.rate_limits.max_connections_per_5min),
      maxInboundMsgPerSecond: Number(body.rateLimits?.maxInboundMsgPerSecond ?? fallback.rate_limits.max_inbound_msg_per_second),
      recvWindowMs: Number(body.rateLimits?.recvWindowMs ?? fallback.rate_limits.recv_window_ms)
    },
    heartbeat: {
      pingIntervalSeconds: Number(body.heartbeat?.pingIntervalSeconds ?? fallback.heartbeat.ping_interval_seconds),
      pongTimeoutSeconds: Number(body.heartbeat?.pongTimeoutSeconds ?? fallback.heartbeat.pong_timeout_seconds),
      listenKeyRefreshIntervalMinutes: Number(body.heartbeat?.listenKeyRefreshIntervalMinutes ?? fallback.heartbeat.listen_key_refresh_interval_minutes)
    },
    reconnectPolicy: {
      strategy: body.reconnectPolicy?.strategy || fallback.reconnect_policy.strategy,
      initialDelaySeconds: Number(body.reconnectPolicy?.initialDelaySeconds ?? fallback.reconnect_policy.initial_delay_seconds),
      maxDelaySeconds: Number(body.reconnectPolicy?.maxDelaySeconds ?? fallback.reconnect_policy.max_delay_seconds),
      backoffFactor: Number(body.reconnectPolicy?.backoffFactor ?? fallback.reconnect_policy.backoff_factor),
      jitterRange: body.reconnectPolicy?.jitterRange || fallback.reconnect_policy.jitter_range
    },
    sessionRotation: {
      enabled: Boolean(body.sessionRotation?.enabled ?? fallback.session_rotation.enabled),
      rotateBeforeHours: Number(body.sessionRotation?.rotateBeforeHours ?? fallback.session_rotation.rotate_before_hours)
    },
    permissions: {
      readAccount: Boolean(body.permissions?.readAccount ?? fallback.permissions.read_account),
      readOrders: Boolean(body.permissions?.readOrders ?? fallback.permissions.read_orders),
      trade: Boolean(body.permissions?.trade ?? fallback.permissions.trade),
      withdraw: Boolean(body.permissions?.withdraw ?? fallback.permissions.withdraw)
    }
  };
}

router.get('/monitor', authenticate, async (req, res) => {
  try {
    const monitor = await privateAccountGatewayService.listForUser(req.userId);
    res.json({ success: true, monitor });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load account monitor' });
  }
});

router.get('/defaults/:exchange', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      config: privateAccountGatewayService.defaultConfig(normalizeExchange(req.params.exchange))
    });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Unsupported exchange' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const exchange = normalizeExchange(req.body.exchange);
    if (!exchange) {
      return res.status(400).json({ success: false, error: 'Exchange is required' });
    }

    const existing = await AccountConnection.findOne({ userId: req.userId, exchange });
    const connection = existing || new AccountConnection({ userId: req.userId, exchange });
    const config = buildConfig(exchange, req.body);

    if (config.permissions.withdraw) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal permission must be disabled before connector can be marked safe.'
      });
    }

    connection.label = req.body.label || connection.label || exchange;
    connection.exchange = exchange;
    connection.environment = config.environment;
    connection.accountId = req.body.accountId || connection.accountId || '';
    connection.apiKey = req.body.apiKey || connection.apiKey || '';
    connection.apiSecret = req.body.apiSecret || connection.apiSecret || '';
    connection.passphrase = req.body.passphrase || connection.passphrase || '';
    connection.authMethod = config.authMethod;
    connection.privateTrading = config.privateTrading;
    connection.tradingEnabled = Boolean(req.body.tradingEnabled) && privateAccountGatewayService.flags().enableLiveTrading;
    connection.authenticated = Boolean(req.body.authenticated ?? connection.authenticated);
    connection.withdrawalPermissionDetected = false;
    connection.ipWhitelistRecommended = true;
    connection.safeForTrading = config.permissions.trade && !config.permissions.withdraw && privateAccountGatewayService.flags().enableLiveTrading;
    connection.stateReconciliationStatus = req.body.stateReconciliationStatus || connection.stateReconciliationStatus;
    connection.config = config;
    connection.nextSessionRotationAt = new Date(Date.now() + (config.sessionRotation.rotateBeforeHours * 60 * 60 * 1000));
    connection.nextListenKeyRefreshAt = ['binance_futures', 'binance_spot'].includes(exchange)
      ? new Date(Date.now() + (config.heartbeat.listenKeyRefreshIntervalMinutes * 60 * 1000))
      : null;
    connection.assistantMessage = connection.safeForTrading
      ? `${connection.label} authenticated. Private stream configured.`
      : 'Live trading blocked because risk controls are incomplete.';

    await connection.save();
    res.status(existing ? 200 : 201).json({
      success: true,
      connection: connection.toSafeJSON()
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Failed to save account connection' });
  }
});

router.post('/:id/toggle-live', authenticate, async (req, res) => {
  try {
    const connection = await AccountConnection.findOne({ _id: req.params.id, userId: req.userId });
    if (!connection) {
      return res.status(404).json({ success: false, error: 'Account connection not found' });
    }

    if (!privateAccountGatewayService.flags().enableLiveTrading) {
      return res.status(400).json({ success: false, error: 'ENABLE_LIVE_TRADING is false' });
    }

    if (connection.withdrawalPermissionDetected) {
      return res.status(400).json({ success: false, error: 'Withdrawal permission warning blocks live mode' });
    }

    connection.tradingEnabled = Boolean(req.body.enabled);
    await connection.save();

    res.json({
      success: true,
      connection: connection.toSafeJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update live trading state' });
  }
});

export default router;
