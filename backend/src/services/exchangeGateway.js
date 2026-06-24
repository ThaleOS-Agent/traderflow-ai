import axios from 'axios';
import WebSocket from 'ws';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';
import { logger } from '../utils/logger.js';

const CONNECTION_STATES = {
  CONNECTED: 'CONNECTED',
  DEGRADED: 'DEGRADED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING'
};

const SUPPORTED_GATEWAY_VENUES = ['binance', 'coinbase', 'kraken', 'oanda'];
const SUPPORTED_NATIVE_WS_VENUES = new Set(SUPPORTED_GATEWAY_VENUES);
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
const HEARTBEAT_INTERVAL_MS = 15000;
const PONG_TIMEOUT_MS = 3000;
const DEFAULT_QUEUE_LIMIT = 10000;
const DEFAULT_ORDERBOOK_LIMIT = 100;
const DEFAULT_POLL_INTERVAL_MS = 5000;

const QUOTE_SUFFIXES = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'BTC', 'ETH'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitSymbol(symbol) {
  const upper = String(symbol || '').trim().toUpperCase();
  if (!upper) return { base: '', quote: '' };

  if (upper.includes('/')) {
    const [base, quote] = upper.split('/');
    return { base, quote };
  }

  if (upper.includes('-')) {
    const [base, quote] = upper.split('-');
    return { base, quote };
  }

  if (upper.includes('_')) {
    const [base, quote] = upper.split('_');
    return { base, quote };
  }

  for (const quote of QUOTE_SUFFIXES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }

  return { base: upper.slice(0, 3), quote: upper.slice(3) };
}

function normalizeSymbol(symbol) {
  const upper = String(symbol || '').trim().toUpperCase();
  if (!upper) return '';
  if (upper.includes('_')) return upper;
  const { base, quote } = splitSymbol(upper);
  return `${base}${quote}`;
}

function formatVenueSymbol(symbol, venue) {
  const upper = String(symbol || '').trim().toUpperCase();
  if (!upper) return upper;
  if (upper.includes('_')) return upper;

  const { base, quote } = splitSymbol(upper);
  const compact = `${base}${quote}`;

  switch (venue) {
    case 'binance':
      return compact;
    case 'coinbase':
      return `${base}-${quote}`;
    case 'kraken':
      return `${base}/${quote}`;
    default:
      return compact;
  }
}

function parseRawMessage(raw) {
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return raw;
}

function buildSpread(bid, ask) {
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
  return ask - bid;
}

function average(numbers) {
  if (!numbers.length) return null;
  return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
}

function stddev(numbers) {
  if (numbers.length < 2) return null;
  const mean = average(numbers);
  if (!Number.isFinite(mean)) return null;
  const variance = numbers.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

function computeEma(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));
  for (let index = period; index < values.length; index += 1) {
    ema = ((values[index] - ema) * multiplier) + ema;
  }
  return ema;
}

function computeRsi(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function computeMacd(values) {
  const ema12 = computeEma(values, 12);
  const ema26 = computeEma(values, 26);
  if (ema12 == null || ema26 == null) return null;
  return ema12 - ema26;
}

function computeAtr(candles, period = 14) {
  if (candles.length <= period) return null;
  const ranges = [];
  for (let index = Math.max(1, candles.length - period); index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const values = [
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ].filter(Number.isFinite);
    ranges.push(Math.max(...values));
  }
  return average(ranges);
}

function computeVolatility(values, period = 20) {
  if (values.length <= period) return null;
  const window = values.slice(-period);
  const returns = [];
  for (let index = 1; index < window.length; index += 1) {
    if (!window[index - 1]) continue;
    returns.push((window[index] - window[index - 1]) / window[index - 1]);
  }
  const value = stddev(returns);
  return value == null ? null : value * Math.sqrt(returns.length);
}

function detectTrend(values) {
  if (values.length < 20) return 'unknown';
  const fast = average(values.slice(-5));
  const slow = average(values.slice(-20));
  if (fast == null || slow == null) return 'unknown';
  if (fast > slow * 1.0025) return 'uptrend';
  if (fast < slow * 0.9975) return 'downtrend';
  return 'range';
}

function jitteredDelay(baseDelay) {
  const offset = (Math.random() * 0.4) - 0.2;
  return Math.round(baseDelay * (1 + offset));
}

class AsyncQueue {
  constructor(name, limit = DEFAULT_QUEUE_LIMIT) {
    this.name = name;
    this.limit = limit;
    this.items = [];
    this.waiters = [];
    this.dropped = 0;
  }

  push(item) {
    if (this.waiters.length) {
      const waiter = this.waiters.shift();
      waiter(item);
      return true;
    }

    if (this.items.length >= this.limit) {
      this.items.shift();
      this.dropped += 1;
    }

    this.items.push(item);
    return true;
  }

  shift() {
    if (this.items.length) {
      return Promise.resolve(this.items.shift());
    }

    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  size() {
    return this.items.length;
  }

  stats() {
    return {
      name: this.name,
      depth: this.size(),
      dropped: this.dropped
    };
  }
}

const gatewayAdapters = {
  binance: {
    transport: 'websocket',
    getUrl(state) {
      return state.isTestnet
        ? 'wss://stream.testnet.binance.vision/stream'
        : 'wss://stream.binance.com:9443/stream';
    },
    buildSubscriptions(state) {
      const params = [];
      for (const symbol of state.symbols) {
        const formatted = formatVenueSymbol(symbol, 'binance').toLowerCase();
        params.push(`${formatted}@ticker`);
        params.push(`${formatted}@trade`);
        params.push(`${formatted}@depth@100ms`);
      }
      return [{ method: 'SUBSCRIBE', params, id: Date.now() }];
    },
    buildPingMessage() {
      return null;
    },
    parseMessage(raw) {
      const message = parseRawMessage(raw);
      const payload = message?.data || message;
      if (!payload?.e) return null;

      if (payload.e === '24hrTicker') {
        return {
          channel: 'ticker',
          symbol: normalizeSymbol(payload.s),
          bid: normalizeNumber(payload.b),
          ask: normalizeNumber(payload.a),
          last: normalizeNumber(payload.c),
          volume: normalizeNumber(payload.v),
          sequence: null,
          timestamp: payload.E || Date.now(),
          raw: payload
        };
      }

      if (payload.e === 'trade' || payload.e === 'aggTrade') {
        return {
          channel: 'trade',
          symbol: normalizeSymbol(payload.s),
          last: normalizeNumber(payload.p),
          volume: normalizeNumber(payload.q),
          sequence: normalizeNumber(payload.t ?? payload.a),
          side: payload.m ? 'sell' : 'buy',
          timestamp: payload.T || payload.E || Date.now(),
          raw: payload
        };
      }

      if (payload.e === 'depthUpdate') {
        return {
          channel: 'orderbook',
          symbol: normalizeSymbol(payload.s),
          sequence: normalizeNumber(payload.u),
          sequenceStart: normalizeNumber(payload.U),
          bids: toArray(payload.b),
          asks: toArray(payload.a),
          timestamp: payload.E || Date.now(),
          raw: payload
        };
      }

      return null;
    }
  },
  coinbase: {
    transport: 'websocket',
    getUrl(state) {
      return state.isTestnet
        ? 'wss://ws-feed-public.sandbox.exchange.coinbase.com'
        : 'wss://ws-feed.exchange.coinbase.com';
    },
    buildSubscriptions(state) {
      return [{
        type: 'subscribe',
        product_ids: [...state.symbols].map(symbol => formatVenueSymbol(symbol, 'coinbase')),
        channels: ['ticker', 'matches', 'level2']
      }];
    },
    buildPingMessage() {
      return null;
    },
    parseMessage(raw) {
      const message = parseRawMessage(raw);
      if (!message?.type) return null;

      if (message.type === 'subscriptions' || message.type === 'heartbeat') {
        return { control: 'pong' };
      }

      if (message.type === 'ticker' && message.product_id) {
        return {
          channel: 'ticker',
          symbol: normalizeSymbol(message.product_id),
          bid: normalizeNumber(message.best_bid),
          ask: normalizeNumber(message.best_ask),
          last: normalizeNumber(message.price),
          volume: normalizeNumber(message.volume_24h),
          sequence: normalizeNumber(message.sequence),
          timestamp: message.time ? Date.parse(message.time) : Date.now(),
          raw: message
        };
      }

      if ((message.type === 'match' || message.type === 'last_match') && message.product_id) {
        return {
          channel: 'trade',
          symbol: normalizeSymbol(message.product_id),
          last: normalizeNumber(message.price),
          volume: normalizeNumber(message.size),
          sequence: normalizeNumber(message.sequence ?? message.trade_id),
          side: message.side || null,
          timestamp: message.time ? Date.parse(message.time) : Date.now(),
          raw: message
        };
      }

      if (message.type === 'snapshot' && message.product_id) {
        return {
          channel: 'orderbook_snapshot',
          symbol: normalizeSymbol(message.product_id),
          bids: toArray(message.bids),
          asks: toArray(message.asks),
          sequence: normalizeNumber(message.sequence),
          timestamp: Date.now(),
          raw: message
        };
      }

      if (message.type === 'l2update' && message.product_id) {
        return {
          channel: 'orderbook',
          symbol: normalizeSymbol(message.product_id),
          changes: toArray(message.changes),
          sequence: normalizeNumber(message.sequence),
          timestamp: message.time ? Date.parse(message.time) : Date.now(),
          raw: message
        };
      }

      return null;
    }
  },
  kraken: {
    transport: 'websocket',
    getUrl() {
      return 'wss://ws.kraken.com/v2';
    },
    buildSubscriptions(state) {
      return [
        {
          method: 'subscribe',
          params: {
            channel: 'ticker',
            symbol: [...state.symbols].map(symbol => formatVenueSymbol(symbol, 'kraken'))
          }
        },
        {
          method: 'subscribe',
          params: {
            channel: 'trade',
            symbol: [...state.symbols].map(symbol => formatVenueSymbol(symbol, 'kraken'))
          }
        }
      ];
    },
    buildPingMessage() {
      return { method: 'ping' };
    },
    isPongMessage(message) {
      return message?.channel === 'heartbeat' || message?.method === 'pong';
    },
    parseMessage(raw) {
      const message = parseRawMessage(raw);

      if (message?.channel === 'heartbeat' || message?.method === 'pong') {
        return { control: 'pong' };
      }

      if (!message?.channel || !Array.isArray(message.data) || !message.data[0]) return null;
      const item = message.data[0];
      const symbol = normalizeSymbol(item.symbol);

      if (message.channel === 'ticker') {
        return {
          channel: 'ticker',
          symbol,
          bid: normalizeNumber(item.bid),
          ask: normalizeNumber(item.ask),
          last: normalizeNumber(item.last),
          volume: normalizeNumber(item.volume),
          sequence: normalizeNumber(item.sequence),
          timestamp: Date.now(),
          raw: message
        };
      }

      if (message.channel === 'trade') {
        return {
          channel: 'trade',
          symbol,
          last: normalizeNumber(item.price),
          volume: normalizeNumber(item.qty),
          sequence: normalizeNumber(item.trade_id),
          side: item.side || null,
          timestamp: item.timestamp ? Date.parse(item.timestamp) : Date.now(),
          raw: message
        };
      }

      return null;
    }
  },
  oanda: {
    transport: 'poll',
    getPollIntervalMs() {
      return DEFAULT_POLL_INTERVAL_MS;
    },
    async poll(state) {
      if (!state.credentials?.apiKey || !state.credentials?.accountId) {
        throw new Error('OANDA gateway subscriptions require apiKey and accountId');
      }

      const baseUrl = state.isTestnet
        ? 'https://api-fxpractice.oanda.com/v3'
        : 'https://api-fxtrade.oanda.com/v3';
      const instruments = [...state.symbols].join(',');
      const response = await axios.get(
        `${baseUrl}/accounts/${state.credentials.accountId}/pricing`,
        {
          params: { instruments },
          headers: {
            Authorization: `Bearer ${state.credentials.apiKey}`,
            'Accept-Datetime-Format': 'RFC3339'
          },
          timeout: 15000
        }
      );

      return toArray(response.data?.prices).map(item => ({
        channel: 'ticker',
        symbol: normalizeSymbol(item.instrument),
        bid: normalizeNumber(item.bids?.[0]?.price),
        ask: normalizeNumber(item.asks?.[0]?.price),
        last: normalizeNumber(item.closeoutBid ?? item.bids?.[0]?.price),
        volume: null,
        sequence: null,
        timestamp: item.time ? Date.parse(item.time) : Date.now(),
        raw: item
      }));
    }
  }
};

class ExchangeGatewayService {
  constructor() {
    this.wss = null;
    this.tradingEngine = null;
    this.agentOrchestrator = null;
    this.advancedRiskManager = null;

    this.connections = new Map();
    this.marketState = new Map();
    this.signalState = new Map();
    this.auditTrail = [];
    this.lastEvents = new Map();
    this.maxAuditTrail = 500;
    this.maxLastEvents = 500;

    this.marketDataQueue = new AsyncQueue('marketDataQueue');
    this.signalQueue = new AsyncQueue('signalQueue');
    this.riskQueue = new AsyncQueue('riskQueue');
    this.executionQueue = new AsyncQueue('executionQueue');
    this.auditQueue = new AsyncQueue('auditQueue');

    this.running = false;
    this.workerStats = {
      market: { processed: 0, failed: 0, lastProcessedAt: null },
      signal: { processed: 0, failed: 0, lastProcessedAt: null },
      risk: { processed: 0, failed: 0, lastProcessedAt: null },
      execution: { processed: 0, failed: 0, lastProcessedAt: null },
      audit: { processed: 0, failed: 0, lastProcessedAt: null }
    };
  }

  attach({ wss = null, tradingEngine = null, agentOrchestrator = null, advancedRiskManager = null } = {}) {
    this.wss = wss;
    this.tradingEngine = tradingEngine;
    this.agentOrchestrator = agentOrchestrator;
    this.advancedRiskManager = advancedRiskManager;
  }

  async initialize({ subscriptions = [] } = {}) {
    this.startWorkers();

    const results = await Promise.allSettled(
      subscriptions.map(subscription => this.subscribe(subscription))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const subscription = subscriptions[index];
        this.recordAudit('warning', {
          type: 'gateway_init_failure',
          venue: subscription?.venue,
          symbolCount: subscription?.symbols?.length || 0,
          message: result.reason?.message || String(result.reason)
        });
      }
    });

    return this.getStatus();
  }

  startWorkers() {
    if (this.running) return;
    this.running = true;
    void this.runWorker('market', this.marketDataQueue, payload => this.processMarketQueueItem(payload));
    void this.runWorker('signal', this.signalQueue, payload => this.processSignalQueueItem(payload));
    void this.runWorker('risk', this.riskQueue, payload => this.processRiskQueueItem(payload));
    void this.runWorker('execution', this.executionQueue, payload => this.processExecutionQueueItem(payload));
    void this.runWorker('audit', this.auditQueue, payload => this.processAuditQueueItem(payload));
  }

  async runWorker(name, queue, handler) {
    while (this.running) {
      const item = await queue.shift();

      try {
        await handler(item);
        this.workerStats[name].processed += 1;
        this.workerStats[name].lastProcessedAt = Date.now();
      } catch (error) {
        this.workerStats[name].failed += 1;
        this.workerStats[name].lastProcessedAt = Date.now();
        logger.warn(`Exchange gateway ${name} worker error: ${error.message}`);
        this.recordAudit('error', {
          type: 'worker_failure',
          worker: name,
          message: error.message
        });
      }
    }
  }

  async subscribe({ venue, symbols = [], isTestnet = false, credentials = null } = {}) {
    const normalizedVenue = String(venue || '').trim().toLowerCase();
    if (!SUPPORTED_NATIVE_WS_VENUES.has(normalizedVenue)) {
      throw new Error(`Gateway transport is not supported for ${normalizedVenue || 'unknown venue'}`);
    }

    const cleanedSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
    if (!cleanedSymbols.length) {
      throw new Error('At least one symbol is required');
    }

    const key = this.connectionKey(normalizedVenue, Boolean(isTestnet));
    const state = this.connections.get(key) || this.createState(normalizedVenue, Boolean(isTestnet), credentials);
    cleanedSymbols.forEach(symbol => state.symbols.add(symbol));
    if (credentials) state.credentials = { ...state.credentials, ...credentials };
    this.connections.set(key, state);

    if (state.transport === 'poll') {
      this.startPolling(state);
      return this.serializeState(state);
    }

    if (state.socket && state.status === CONNECTION_STATES.CONNECTED) {
      await this.sendSubscriptions(state);
      return this.serializeState(state);
    }

    await this.connect(state);
    return this.serializeState(state);
  }

  async unsubscribe({ venue, symbols = [], isTestnet = false } = {}) {
    const key = this.connectionKey(String(venue || '').trim().toLowerCase(), Boolean(isTestnet));
    const state = this.connections.get(key);
    if (!state) return null;

    const cleanedSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
    cleanedSymbols.forEach(symbol => state.symbols.delete(symbol));

    if (!state.symbols.size) {
      this.closeConnection(state, false);
      this.connections.delete(key);
      return null;
    }

    if (state.transport === 'websocket' && state.status === CONNECTION_STATES.CONNECTED) {
      await this.sendSubscriptions(state);
    }

    return this.serializeState(state);
  }

  queueExecution(orderRequest = {}) {
    this.riskQueue.push({
      type: 'execution_candidate',
      requestId: orderRequest.requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: Date.now(),
      ...orderRequest
    });
  }

  previewRoute(orderRequest = {}) {
    return this.buildRoutePreview(orderRequest);
  }

  getStatus() {
    const connections = [...this.connections.values()].map(state => this.serializeState(state));
    const warnings = connections.flatMap(connection => connection.warnings);
    const recommendations = connections.flatMap(connection => connection.recommendations);
    const recoveryActions = connections.flatMap(connection => connection.recoveryActions);

    return {
      supportedVenues: [...SUPPORTED_GATEWAY_VENUES],
      states: CONNECTION_STATES,
      queues: {
        marketDataQueue: this.marketDataQueue.stats(),
        signalQueue: this.signalQueue.stats(),
        riskQueue: this.riskQueue.stats(),
        executionQueue: this.executionQueue.stats(),
        auditQueue: this.auditQueue.stats()
      },
      workers: this.workerStats,
      connections,
      warnings,
      recommendations,
      recoveryActions,
      recentAudit: this.auditTrail.slice(-25)
    };
  }

  connectionKey(venue, isTestnet) {
    return `${venue}:${isTestnet ? 'testnet' : 'mainnet'}`;
  }

  createState(venue, isTestnet, credentials = null) {
    return {
      key: this.connectionKey(venue, isTestnet),
      venue,
      isTestnet,
      transport: gatewayAdapters[venue]?.transport || 'websocket',
      status: CONNECTION_STATES.DISCONNECTED,
      symbols: new Set(),
      socket: null,
      pollTimer: null,
      reconnectTimer: null,
      heartbeatTimer: null,
      pongTimer: null,
      connectedAt: null,
      lastMessageAt: null,
      lastPingAt: null,
      lastPongAt: null,
      reconnectCount: 0,
      reconnectAttempts: 0,
      lastDisconnectReason: null,
      lastReconnectTime: null,
      latencyMsSamples: [],
      latencyMs: null,
      messageTimestamps: [],
      messageRate: 0,
      missedPings: 0,
      sequenceGaps: 0,
      healthScore: 100,
      healthBand: 'green',
      latestRecommendations: [],
      latestWarnings: [],
      latestRecoveryActions: [],
      orderBooks: new Map(),
      sequenceTracker: new Map(),
      bufferedDeltas: new Map(),
      credentials: credentials || {},
      lastError: null
    };
  }

  async connect(state) {
    const adapter = gatewayAdapters[state.venue];
    if (!adapter) {
      throw new Error(`No gateway adapter for ${state.venue}`);
    }

    this.closeConnection(state, true);
    state.status = CONNECTION_STATES.RECONNECTING;
    state.lastReconnectTime = Date.now();

    const socket = new WebSocket(await adapter.getUrl(state));
    state.socket = socket;

    socket.on('open', async () => {
      state.status = CONNECTION_STATES.CONNECTED;
      state.connectedAt = Date.now();
      state.reconnectAttempts = 0;
      state.lastError = null;
      this.recordPong(state);
      await this.sendSubscriptions(state);
      this.startHeartbeat(state);
      this.recordAudit('info', {
        type: 'connection_open',
        venue: state.venue,
        isTestnet: state.isTestnet,
        symbols: [...state.symbols]
      });
    });

    socket.on('pong', () => this.recordPong(state));
    socket.on('message', raw => {
      this.marketDataQueue.push({
        type: 'transport_message',
        stateKey: state.key,
        receivedAt: Date.now(),
        raw
      });
    });

    socket.on('error', error => {
      state.lastError = error.message;
      state.status = CONNECTION_STATES.DEGRADED;
      this.refreshHealth(state);
    });

    socket.on('close', (code, reasonBuffer) => {
      state.socket = null;
      state.status = CONNECTION_STATES.DISCONNECTED;
      state.lastDisconnectReason = `${code}${reasonBuffer ? ` ${reasonBuffer.toString()}` : ''}`.trim() || 'socket closed';
      this.clearHeartbeat(state);
      this.refreshHealth(state);
      this.recordAudit('warning', {
        type: 'connection_closed',
        venue: state.venue,
        reason: state.lastDisconnectReason
      });
      if (state.symbols.size) {
        this.scheduleReconnect(state);
      }
    });
  }

  startHeartbeat(state) {
    this.clearHeartbeat(state);
    const adapter = gatewayAdapters[state.venue];

    state.heartbeatTimer = setInterval(() => {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      state.lastPingAt = Date.now();

      try {
        const heartbeat = adapter.buildPingMessage?.(state);
        if (heartbeat) {
          state.socket.send(JSON.stringify(heartbeat));
        } else {
          state.socket.ping();
        }
      } catch (error) {
        state.lastError = error.message;
      }

      state.pongTimer = setTimeout(() => {
        if (!state.lastPongAt || state.lastPongAt < state.lastPingAt) {
          state.missedPings += 1;
          state.status = CONNECTION_STATES.DEGRADED;
          state.lastDisconnectReason = 'pong timeout';
          this.refreshHealth(state);
          try {
            state.socket?.close(4000, 'pong timeout');
          } catch {
            // ignore close failures
          }
        }
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  clearHeartbeat(state) {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.pongTimer) {
      clearTimeout(state.pongTimer);
      state.pongTimer = null;
    }
  }

  recordPong(state) {
    state.lastPongAt = Date.now();
    if (state.lastPingAt) {
      const latency = Math.max(0, state.lastPongAt - state.lastPingAt);
      state.latencyMsSamples.push(latency);
      if (state.latencyMsSamples.length > 20) {
        state.latencyMsSamples.shift();
      }
      state.latencyMs = Math.round(average(state.latencyMsSamples) || 0);
    }
    if (state.status === CONNECTION_STATES.DEGRADED) {
      state.status = CONNECTION_STATES.CONNECTED;
    }
    if (state.pongTimer) {
      clearTimeout(state.pongTimer);
      state.pongTimer = null;
    }
    this.refreshHealth(state);
  }

  scheduleReconnect(state) {
    if (state.reconnectTimer) return;

    const step = Math.min(state.reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1);
    const baseDelay = RECONNECT_BACKOFF_MS[step];
    const delay = jitteredDelay(baseDelay);
    state.reconnectAttempts += 1;
    state.reconnectCount += 1;
    state.status = CONNECTION_STATES.RECONNECTING;
    state.lastReconnectTime = Date.now();
    this.refreshHealth(state);

    state.reconnectTimer = setTimeout(async () => {
      state.reconnectTimer = null;
      try {
        await this.connect(state);
      } catch (error) {
        state.lastError = error.message;
        this.recordAudit('warning', {
          type: 'reconnect_failed',
          venue: state.venue,
          delay,
          message: error.message
        });
        this.scheduleReconnect(state);
      }
    }, delay);
  }

  startPolling(state) {
    this.closeConnection(state, true);
    state.status = CONNECTION_STATES.CONNECTED;
    state.connectedAt = Date.now();
    state.lastReconnectTime = Date.now();
    this.recordPong(state);

    const adapter = gatewayAdapters[state.venue];
    const intervalMs = adapter.getPollIntervalMs?.(state) || DEFAULT_POLL_INTERVAL_MS;

    const poll = async () => {
      try {
        const events = await adapter.poll(state);
        const receivedAt = Date.now();
        state.lastMessageAt = receivedAt;
        this.recordPong(state);
        for (const event of events) {
          this.marketDataQueue.push({
            type: 'polled_message',
            stateKey: state.key,
            receivedAt,
            parsed: event
          });
        }
      } catch (error) {
        state.lastError = error.message;
        state.status = CONNECTION_STATES.DEGRADED;
        state.lastDisconnectReason = error.message;
        this.refreshHealth(state);
        this.recordAudit('warning', {
          type: 'poll_failure',
          venue: state.venue,
          message: error.message
        });
      }
    };

    void poll();
    state.pollTimer = setInterval(() => {
      void poll();
    }, intervalMs);
  }

  closeConnection(state, keepSymbols = true) {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    this.clearHeartbeat(state);

    if (state.socket) {
      try {
        state.socket.removeAllListeners();
        state.socket.close();
      } catch {
        // ignore close failures
      }
      state.socket = null;
    }

    if (!keepSymbols) {
      state.symbols.clear();
    }
  }

  async sendSubscriptions(state) {
    const adapter = gatewayAdapters[state.venue];
    if (!adapter?.buildSubscriptions || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const messages = adapter.buildSubscriptions(state);
    for (const message of messages) {
      state.socket.send(JSON.stringify(message));
    }
  }

  async processMarketQueueItem(item) {
    const state = this.connections.get(item.stateKey);
    if (!state) return;

    const adapter = gatewayAdapters[state.venue];
    let parsed = item.parsed || null;

    if (!parsed) {
      parsed = adapter.parseMessage(item.raw, state);
    }

    if (!parsed) return;

    if (parsed.control === 'pong') {
      this.recordPong(state);
      return;
    }

    state.lastMessageAt = item.receivedAt;
    state.messageTimestamps.push(item.receivedAt);
    state.messageTimestamps = state.messageTimestamps.filter(timestamp => timestamp >= item.receivedAt - 60000);
    state.messageRate = state.messageTimestamps.length;

    const normalized = this.normalizeMarketEvent(state, parsed, item.receivedAt);
    this.validateSequence(state, normalized);
    this.updateOrderBook(state, normalized);
    this.refreshHealth(state, normalized.latencyMs);
    normalized.healthScore = state.healthScore;
    this.recordEvent(normalized);

    this.tradingEngine?.ingestNativeMarketData?.({
      venue: normalized.exchange,
      symbol: normalized.symbol,
      type: normalized.channel === 'trade' ? 'trade' : 'ticker',
      price: normalized.last,
      bid: normalized.bid,
      ask: normalized.ask,
      volume24h: normalized.volume,
      timestamp: normalized.timestamp,
      change24hPercent: null,
      latencyMs: normalized.latencyMs,
      healthScore: normalized.healthScore
    });

    this.agentOrchestrator?.recordMarketData?.(normalized, 'exchange_gateway');
    this.broadcast('nativeMarketData', normalized);
    if (normalized.channel === 'ticker') {
      this.broadcast('marketData', normalized);
    }

    this.signalQueue.push({
      type: 'market_event',
      receivedAt: item.receivedAt,
      event: normalized
    });
  }

  normalizeMarketEvent(state, parsed, receivedAt) {
    const bid = normalizeNumber(parsed.bid);
    const ask = normalizeNumber(parsed.ask);
    const last = normalizeNumber(parsed.last);
    const timestamp = normalizeNumber(parsed.timestamp) || receivedAt;
    const latencyMs = Math.max(0, receivedAt - timestamp);

    return {
      exchange: state.venue,
      symbol: normalizeSymbol(parsed.symbol),
      channel: parsed.channel,
      bid,
      ask,
      last,
      spread: buildSpread(bid, ask),
      volume: normalizeNumber(parsed.volume),
      timestamp,
      sequence: normalizeNumber(parsed.sequence),
      latencyMs,
      healthScore: state.healthScore,
      raw: parsed.raw,
      side: parsed.side || null,
      isTestnet: state.isTestnet
    };
  }

  validateSequence(state, event) {
    if (!Number.isFinite(event.sequence)) return;

    const key = `${event.symbol}:${event.channel}`;
    const previous = state.sequenceTracker.get(key);
    if (previous != null && event.sequence > previous + 1) {
      state.sequenceGaps += 1;
      this.recordAudit('warning', {
        type: 'SEQUENCE_RECOVERY',
        venue: state.venue,
        symbol: event.symbol,
        channel: event.channel,
        expected: previous + 1,
        received: event.sequence
      });

      if (event.channel === 'orderbook') {
        void this.recoverOrderBook(state, event.symbol);
      }
    }

    state.sequenceTracker.set(key, event.sequence);
  }

  updateOrderBook(state, event) {
    if (!event.symbol) return;

    if (event.channel === 'orderbook_snapshot') {
      state.orderBooks.set(event.symbol, {
        bids: this.toBookSide(event.raw?.bids || event.raw?.b || []),
        asks: this.toBookSide(event.raw?.asks || event.raw?.a || []),
        sequence: event.sequence,
        updatedAt: event.timestamp
      });
      return;
    }

    if (event.channel !== 'orderbook') return;

    const existing = state.orderBooks.get(event.symbol) || {
      bids: new Map(),
      asks: new Map(),
      sequence: null,
      updatedAt: null
    };

    const raw = event.raw || {};
    const bids = raw.bids || raw.b || raw.changes?.filter(change => change[0] === 'buy').map(change => [change[1], change[2]]) || [];
    const asks = raw.asks || raw.a || raw.changes?.filter(change => change[0] === 'sell').map(change => [change[1], change[2]]) || [];

    this.applyBookUpdates(existing.bids, bids);
    this.applyBookUpdates(existing.asks, asks);
    existing.sequence = event.sequence;
    existing.updatedAt = event.timestamp;
    state.orderBooks.set(event.symbol, existing);
  }

  toBookSide(levels) {
    const side = new Map();
    this.applyBookUpdates(side, levels);
    return side;
  }

  applyBookUpdates(side, levels) {
    for (const level of levels) {
      const price = normalizeNumber(Array.isArray(level) ? level[0] : level?.price);
      const size = normalizeNumber(Array.isArray(level) ? level[1] : level?.size);
      if (!Number.isFinite(price)) continue;
      if (!size) side.delete(price);
      else side.set(price, size);
    }
  }

  async recoverOrderBook(state, symbol) {
    try {
      state.orderBooks.delete(symbol);
      const connector = new MultiExchangeConnector(state.venue, state.isTestnet);
      if (state.credentials?.apiKey) {
        connector.setCredentials(
          state.credentials.apiKey,
          state.credentials.apiSecret || '',
          state.credentials.passphrase || state.credentials.accountId || null
        );
      }

      const snapshot = await connector.getOrderBook(formatVenueSymbol(symbol, state.venue), DEFAULT_ORDERBOOK_LIMIT);
      const normalized = this.normalizeOrderBookSnapshot(state.venue, symbol, snapshot);
      state.orderBooks.set(symbol, normalized);
      state.sequenceTracker.set(`${symbol}:orderbook`, normalized.sequence);

      this.recordAudit('info', {
        type: 'orderbook_recovered',
        venue: state.venue,
        symbol
      });
    } catch (error) {
      state.lastError = error.message;
      this.recordAudit('error', {
        type: 'orderbook_recovery_failed',
        venue: state.venue,
        symbol,
        message: error.message
      });
    }
  }

  normalizeOrderBookSnapshot(venue, symbol, snapshot) {
    if (venue === 'binance') {
      return {
        bids: this.toBookSide(snapshot?.bids || []),
        asks: this.toBookSide(snapshot?.asks || []),
        sequence: normalizeNumber(snapshot?.lastUpdateId),
        updatedAt: Date.now()
      };
    }

    if (venue === 'coinbase') {
      return {
        bids: this.toBookSide(snapshot?.bids || []),
        asks: this.toBookSide(snapshot?.asks || []),
        sequence: normalizeNumber(snapshot?.sequence),
        updatedAt: Date.now()
      };
    }

    if (venue === 'kraken') {
      const result = snapshot?.result || {};
      const pair = Object.keys(result)[0];
      const book = result[pair] || {};
      return {
        bids: this.toBookSide(book?.bids || []),
        asks: this.toBookSide(book?.asks || []),
        sequence: null,
        updatedAt: Date.now()
      };
    }

    return {
      bids: new Map(),
      asks: new Map(),
      sequence: null,
      updatedAt: Date.now(),
      symbol
    };
  }

  async processSignalQueueItem(item) {
    if (item.type !== 'market_event') return;

    const event = item.event;
    const key = `${event.exchange}:${event.symbol}`;
    const state = this.signalState.get(key) || {
      closes: [],
      highs: [],
      lows: [],
      volumes: [],
      candles: [],
      latest: null
    };

    const price = event.last ?? event.bid ?? event.ask;
    if (Number.isFinite(price)) {
      state.closes.push(price);
      if (state.closes.length > 250) state.closes.shift();
    }
    if (Number.isFinite(event.bid)) {
      state.lows.push(event.bid);
      if (state.lows.length > 250) state.lows.shift();
    }
    if (Number.isFinite(event.ask)) {
      state.highs.push(event.ask);
      if (state.highs.length > 250) state.highs.shift();
    }
    if (Number.isFinite(event.volume)) {
      state.volumes.push(event.volume);
      if (state.volumes.length > 250) state.volumes.shift();
    }

    if (Number.isFinite(price)) {
      state.candles.push({
        high: event.ask ?? price,
        low: event.bid ?? price,
        close: price
      });
      if (state.candles.length > 250) state.candles.shift();
    }

    const analytics = {
      exchange: event.exchange,
      symbol: event.symbol,
      timestamp: event.timestamp,
      rsi: computeRsi(state.closes),
      macd: computeMacd(state.closes),
      atr: computeAtr(state.candles),
      trendState: detectTrend(state.closes),
      volatility: computeVolatility(state.closes),
      healthScore: event.healthScore
    };

    state.latest = analytics;
    this.signalState.set(key, state);
    this.broadcast('gatewaySignal', analytics);
  }

  async processRiskQueueItem(item) {
    if (item.type !== 'execution_candidate') return;

    const routePreview = this.buildRoutePreview(item);
    const reasons = [];

    if (this.advancedRiskManager?.emergencyStop) {
      reasons.push('emergency_stop');
    }

    if (routePreview.selectedRoute?.healthScore < 60) {
      reasons.push('exchange_health');
    }

    if (routePreview.selectedRoute?.status !== CONNECTION_STATES.CONNECTED) {
      reasons.push('websocket_health');
    }

    if (item.maxPositionSize && item.quantity > item.maxPositionSize) {
      reasons.push('position_size');
    }

    const blocked = reasons.length > 0;
    this.auditQueue.push({
      level: blocked ? 'warning' : 'info',
      payload: {
        type: blocked ? 'trade_blocked' : 'trade_approved',
        requestId: item.requestId,
        symbol: item.symbol,
        venue: routePreview.selectedRoute?.exchange || null,
        reasons
      }
    });

    if (!blocked) {
      this.executionQueue.push({
        ...item,
        routePreview,
        type: 'execution_request'
      });
    }
  }

  async processExecutionQueueItem(item) {
    if (item.type !== 'execution_request') return;
    const routePreview = item.routePreview || this.buildRoutePreview(item);

    this.broadcast('executionRoute', routePreview);
    this.auditQueue.push({
      level: 'info',
      payload: {
        type: 'execution_routed',
        requestId: item.requestId,
        symbol: item.symbol,
        route: routePreview.selectedRoute || null
      }
    });
  }

  async processAuditQueueItem(item) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: item.level || 'info',
      timestamp: nowIso(),
      ...item.payload
    };

    this.auditTrail.push(entry);
    if (this.auditTrail.length > this.maxAuditTrail) {
      this.auditTrail.shift();
    }
    this.broadcast('gatewayAudit', entry);
  }

  buildRoutePreview(orderRequest = {}) {
    const candidates = [...this.connections.values()]
      .filter(state => state.symbols.has(normalizeSymbol(orderRequest.symbol)))
      .map(state => ({
        exchange: state.venue,
        status: state.status,
        healthScore: state.healthScore,
        latencyMs: state.latencyMs,
        reconnectCount: state.reconnectCount,
        spread: this.getCurrentSpread(state, orderRequest.symbol),
        feeBps: this.estimateFeeBps(state.venue),
        slippageBps: this.estimateSlippageBps(state, orderRequest.symbol)
      }));

    const ranked = candidates
      .map(candidate => ({
        ...candidate,
        routeConfidenceScore: this.computeRouteConfidence(candidate)
      }))
      .sort((left, right) => {
        if (right.healthScore !== left.healthScore) return right.healthScore - left.healthScore;
        if (left.feeBps !== right.feeBps) return left.feeBps - right.feeBps;
        if ((left.spread ?? Infinity) !== (right.spread ?? Infinity)) return (left.spread ?? Infinity) - (right.spread ?? Infinity);
        if ((left.slippageBps ?? Infinity) !== (right.slippageBps ?? Infinity)) return (left.slippageBps ?? Infinity) - (right.slippageBps ?? Infinity);
        return (left.latencyMs ?? Infinity) - (right.latencyMs ?? Infinity);
      });

    return {
      symbol: normalizeSymbol(orderRequest.symbol),
      evaluatedAt: nowIso(),
      candidates: ranked,
      selectedRoute: ranked[0] || null
    };
  }

  getCurrentSpread(state, symbol) {
    const market = this.lastEvents.get(`${state.venue}:${normalizeSymbol(symbol)}:ticker`);
    return market?.spread ?? null;
  }

  estimateFeeBps(venue) {
    return {
      binance: 10,
      coinbase: 40,
      kraken: 26,
      oanda: 15
    }[venue] ?? 50;
  }

  estimateSlippageBps(state, symbol) {
    const book = state.orderBooks.get(normalizeSymbol(symbol));
    if (!book || !book.bids.size || !book.asks.size) return null;

    const bestBid = Math.max(...book.bids.keys());
    const bestAsk = Math.min(...book.asks.keys());
    if (!bestBid || !bestAsk) return null;
    return ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 10000;
  }

  computeRouteConfidence(candidate) {
    const health = candidate.healthScore * 0.5;
    const latency = candidate.latencyMs == null ? 15 : clamp(30 - (candidate.latencyMs / 10), 0, 30);
    const fee = clamp(15 - (candidate.feeBps / 4), 0, 15);
    const spread = candidate.spread == null ? 5 : clamp(10 - (candidate.spread * 100), 0, 10);
    const slippage = candidate.slippageBps == null ? 5 : clamp(10 - (candidate.slippageBps / 2), 0, 10);
    return Math.round(clamp(health + latency + fee + spread + slippage, 0, 100));
  }

  refreshHealth(state, observedLatency = null) {
    const latency = observedLatency ?? state.latencyMs ?? 0;
    const latencyPenalty = clamp(Math.round(latency / 25), 0, 25);
    const reconnectPenalty = clamp(state.reconnectCount * 6, 0, 24);
    const heartbeatPenalty = clamp(state.missedPings * 10, 0, 30);
    const messagePenalty = state.messageRate === 0 && state.status === CONNECTION_STATES.CONNECTED ? 10 : 0;
    const sequencePenalty = clamp(state.sequenceGaps * 8, 0, 24);
    const disconnectPenalty = state.status === CONNECTION_STATES.DISCONNECTED ? 40 : state.status === CONNECTION_STATES.RECONNECTING ? 25 : state.status === CONNECTION_STATES.DEGRADED ? 15 : 0;

    state.healthScore = clamp(
      100 - latencyPenalty - reconnectPenalty - heartbeatPenalty - messagePenalty - sequencePenalty - disconnectPenalty,
      0,
      100
    );

    state.healthBand = state.healthScore >= 80 ? 'green' : state.healthScore >= 55 ? 'amber' : 'red';

    const warnings = [];
    const recommendations = [];
    const recoveryActions = [];

    if (state.status !== CONNECTION_STATES.CONNECTED) {
      warnings.push(`${state.venue} ${state.status.toLowerCase()}`);
      recoveryActions.push(`Reconnect ${state.venue} with exponential backoff`);
    }
    if (state.missedPings > 0) {
      warnings.push(`${state.missedPings} missed heartbeat${state.missedPings === 1 ? '' : 's'}`);
      recommendations.push('Inspect network jitter and exchange heartbeat responsiveness');
    }
    if (state.sequenceGaps > 0) {
      warnings.push(`${state.sequenceGaps} sequence gap${state.sequenceGaps === 1 ? '' : 's'}`);
      recoveryActions.push('Run order book snapshot recovery before routing orders');
    }
    if (state.reconnectCount > 2) {
      recommendations.push('Stagger subscriptions to reduce reconnection storms');
    }
    if ((state.messageRate || 0) < 5 && state.status === CONNECTION_STATES.CONNECTED) {
      recommendations.push('Message rate is low; validate symbol subscriptions and upstream feed quality');
    }

    state.latestWarnings = [...new Set(warnings)];
    state.latestRecommendations = [...new Set(recommendations)];
    state.latestRecoveryActions = [...new Set(recoveryActions)];
  }

  recordEvent(event) {
    const key = `${event.exchange}:${event.symbol}:${event.channel}`;
    this.lastEvents.set(key, event);
    if (this.lastEvents.size > this.maxLastEvents) {
      const firstKey = this.lastEvents.keys().next().value;
      if (firstKey) this.lastEvents.delete(firstKey);
    }
  }

  recordAudit(level, payload) {
    this.auditQueue.push({ level, payload });
  }

  broadcast(event, data) {
    if (!this.wss) return;

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event, data, timestamp: Date.now() }));
      }
    });
  }

  serializeState(state) {
    this.refreshHealth(state);

    return {
      venue: state.venue,
      exchange: state.venue,
      isTestnet: state.isTestnet,
      transport: state.transport,
      status: state.status,
      healthScore: state.healthScore,
      healthBand: state.healthBand,
      symbols: [...state.symbols],
      connectedAt: state.connectedAt,
      lastMessageAt: state.lastMessageAt,
      lastPingAt: state.lastPingAt,
      lastPongAt: state.lastPongAt,
      lastError: state.lastError,
      latencyMs: state.latencyMs,
      reconnectCount: state.reconnectCount,
      reconnectAttempts: state.reconnectAttempts,
      lastDisconnectReason: state.lastDisconnectReason,
      lastReconnectTime: state.lastReconnectTime,
      missedPings: state.missedPings,
      sequenceGaps: state.sequenceGaps,
      messageRate: state.messageRate,
      warnings: state.latestWarnings,
      recommendations: state.latestRecommendations,
      recoveryActions: state.latestRecoveryActions
    };
  }
}

export const exchangeGatewayService = new ExchangeGatewayService();
export { CONNECTION_STATES, SUPPORTED_GATEWAY_VENUES, SUPPORTED_NATIVE_WS_VENUES };
