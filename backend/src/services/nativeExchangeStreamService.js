import axios from 'axios';
import WebSocket from 'ws';
import { logger } from '../utils/logger.js';

const SUPPORTED_NATIVE_WS_VENUES = new Set([
  'binance',
  'coinbase',
  'kraken',
  'kucoin',
  'bybit',
  'bitfinex'
]);

const QUOTE_SUFFIXES = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'BTC', 'ETH'];

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

  for (const quote of QUOTE_SUFFIXES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }

  return { base: upper.slice(0, 3), quote: upper.slice(3) };
}

function formatVenueSymbol(symbol, venue) {
  const { base, quote } = splitSymbol(symbol);
  const compact = `${base}${quote}`;

  switch (venue) {
    case 'binance':
    case 'bybit':
      return compact;
    case 'coinbase':
    case 'kucoin':
      return `${base}-${quote}`;
    case 'kraken':
      return `${base}/${quote}`;
    case 'bitfinex':
      return `t${compact}`;
    default:
      return compact;
  }
}

function normalizeSymbol(symbol) {
  const { base, quote } = splitSymbol(symbol);
  return `${base}${quote}`;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function connectionKey(venue, isTestnet) {
  return `${venue}:${isTestnet ? 'testnet' : 'mainnet'}`;
}

const venueAdapters = {
  binance: {
    getUrl(state) {
      return state.isTestnet
        ? 'wss://stream.testnet.binance.vision/stream'
        : 'wss://stream.binance.com:9443/stream';
    },
    subscribeMessage(state) {
      const params = [];
      for (const symbol of state.symbols) {
        params.push(`${formatVenueSymbol(symbol, 'binance').toLowerCase()}@ticker`);
        params.push(`${formatVenueSymbol(symbol, 'binance').toLowerCase()}@trade`);
      }
      return { method: 'SUBSCRIBE', params, id: Date.now() };
    },
    unsubscribeMessage(symbols) {
      const params = [];
      for (const symbol of symbols) {
        params.push(`${formatVenueSymbol(symbol, 'binance').toLowerCase()}@ticker`);
        params.push(`${formatVenueSymbol(symbol, 'binance').toLowerCase()}@trade`);
      }
      return { method: 'UNSUBSCRIBE', params, id: Date.now() };
    },
    parseMessage(raw) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const payload = message?.data || message;
      if (!payload?.e) return null;

      if (payload.e === '24hrTicker') {
        return {
          type: 'ticker',
          symbol: normalizeSymbol(payload.s),
          price: numberOrNull(payload.c),
          bid: numberOrNull(payload.b),
          ask: numberOrNull(payload.a),
          volume24h: numberOrNull(payload.v),
          quoteVolume24h: numberOrNull(payload.q),
          change24hPercent: numberOrNull(payload.P),
          timestamp: payload.E || Date.now()
        };
      }

      if (payload.e === 'trade' || payload.e === 'aggTrade') {
        return {
          type: 'trade',
          symbol: normalizeSymbol(payload.s),
          price: numberOrNull(payload.p),
          size: numberOrNull(payload.q),
          side: payload.m ? 'sell' : 'buy',
          tradeId: payload.t || payload.a,
          timestamp: payload.T || payload.E || Date.now()
        };
      }

      return null;
    }
  },
  coinbase: {
    getUrl(state) {
      return state.isTestnet
        ? 'wss://ws-feed-public.sandbox.exchange.coinbase.com'
        : 'wss://ws-feed.exchange.coinbase.com';
    },
    subscribeMessage(state) {
      return {
        type: 'subscribe',
        product_ids: [...state.symbols].map(symbol => formatVenueSymbol(symbol, 'coinbase')),
        channels: ['ticker', 'matches']
      };
    },
    unsubscribeMessage(symbols) {
      return {
        type: 'unsubscribe',
        product_ids: symbols.map(symbol => formatVenueSymbol(symbol, 'coinbase')),
        channels: ['ticker', 'matches']
      };
    },
    parseMessage(raw) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!message?.type || !message.product_id) return null;

      if (message.type === 'ticker') {
        return {
          type: 'ticker',
          symbol: normalizeSymbol(message.product_id),
          price: numberOrNull(message.price),
          bid: numberOrNull(message.best_bid),
          ask: numberOrNull(message.best_ask),
          volume24h: numberOrNull(message.volume_24h),
          timestamp: message.time ? Date.parse(message.time) : Date.now()
        };
      }

      if (message.type === 'match' || message.type === 'last_match') {
        return {
          type: 'trade',
          symbol: normalizeSymbol(message.product_id),
          price: numberOrNull(message.price),
          size: numberOrNull(message.size),
          side: message.side || null,
          tradeId: message.trade_id || null,
          timestamp: message.time ? Date.parse(message.time) : Date.now()
        };
      }

      return null;
    }
  },
  kraken: {
    getUrl() {
      return 'wss://ws.kraken.com/v2';
    },
    subscribeMessages(state) {
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
    parseMessage(raw) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!message?.channel || !Array.isArray(message.data)) return null;

      const item = message.data[0];
      if (!item?.symbol) return null;

      if (message.channel === 'ticker') {
        return {
          type: 'ticker',
          symbol: normalizeSymbol(item.symbol),
          price: numberOrNull(item.last),
          bid: numberOrNull(item.bid),
          ask: numberOrNull(item.ask),
          volume24h: numberOrNull(item.volume),
          change24hPercent: numberOrNull(item.change_pct),
          timestamp: Date.now()
        };
      }

      if (message.channel === 'trade') {
        return {
          type: 'trade',
          symbol: normalizeSymbol(item.symbol),
          price: numberOrNull(item.price),
          size: numberOrNull(item.qty),
          side: item.side || null,
          tradeId: item.trade_id || null,
          timestamp: item.timestamp ? Date.parse(item.timestamp) : Date.now()
        };
      }

      return null;
    }
  },
  kucoin: {
    async getUrl(state) {
      const restBase = state.isTestnet
        ? 'https://openapi-sandbox.kucoin.com'
        : 'https://api.kucoin.com';
      const response = await axios.post(`${restBase}/api/v1/bullet-public`, null, { timeout: 15000 });
      const server = response.data?.data?.instanceServers?.[0];
      const token = response.data?.data?.token;
      if (!server?.endpoint || !token) {
        throw new Error('KuCoin websocket token request failed');
      }

      state.heartbeatMs = Number(server.pingInterval) || 18000;
      return `${server.endpoint}?token=${token}&connectId=${Date.now()}`;
    },
    subscribeMessages(state) {
      return [...state.symbols].flatMap(symbol => {
        const formatted = formatVenueSymbol(symbol, 'kucoin');
        return [
          {
            id: String(Date.now()),
            type: 'subscribe',
            topic: `/market/ticker:${formatted}`,
            privateChannel: false,
            response: true
          },
          {
            id: String(Date.now() + 1),
            type: 'subscribe',
            topic: `/market/match:${formatted}`,
            privateChannel: false,
            response: true
          }
        ];
      });
    },
    heartbeatMessage() {
      return { id: String(Date.now()), type: 'ping' };
    },
    parseMessage(raw) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (message?.type !== 'message' || !message?.topic || !message?.data) return null;

      const topicParts = String(message.topic).split(':');
      const symbol = normalizeSymbol(topicParts[1] || '');

      if (String(message.topic).startsWith('/market/ticker:')) {
        return {
          type: 'ticker',
          symbol,
          price: numberOrNull(message.data.price),
          bid: numberOrNull(message.data.bestBid),
          ask: numberOrNull(message.data.bestAsk),
          volume24h: numberOrNull(message.data.vol),
          quoteVolume24h: numberOrNull(message.data.volValue),
          timestamp: numberOrNull(message.data.time) || Date.now()
        };
      }

      if (String(message.topic).startsWith('/market/match:')) {
        return {
          type: 'trade',
          symbol,
          price: numberOrNull(message.data.price),
          size: numberOrNull(message.data.size),
          side: message.data.side || null,
          tradeId: message.data.tradeId || null,
          timestamp: numberOrNull(message.data.time) || Date.now()
        };
      }

      return null;
    }
  },
  bybit: {
    getUrl(state) {
      return state.isTestnet
        ? 'wss://stream-testnet.bybit.com/v5/public/spot'
        : 'wss://stream.bybit.com/v5/public/spot';
    },
    subscribeMessage(state) {
      return {
        req_id: String(Date.now()),
        op: 'subscribe',
        args: [...state.symbols].flatMap(symbol => [
          `tickers.${formatVenueSymbol(symbol, 'bybit')}`,
          `publicTrade.${formatVenueSymbol(symbol, 'bybit')}`
        ])
      };
    },
    heartbeatMessage() {
      return { req_id: String(Date.now()), op: 'ping' };
    },
    parseMessage(raw) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!message?.topic || !message?.data) return null;

      if (String(message.topic).startsWith('tickers.')) {
        const symbol = normalizeSymbol(String(message.topic).split('.')[1]);
        return {
          type: 'ticker',
          symbol,
          price: numberOrNull(message.data.lastPrice),
          bid: numberOrNull(message.data.bid1Price),
          ask: numberOrNull(message.data.ask1Price),
          volume24h: numberOrNull(message.data.volume24h),
          quoteVolume24h: numberOrNull(message.data.turnover24h),
          change24hPercent: numberOrNull(message.data.price24hPcnt),
          timestamp: Date.now()
        };
      }

      if (String(message.topic).startsWith('publicTrade.')) {
        const symbol = normalizeSymbol(String(message.topic).split('.')[1]);
        const trade = Array.isArray(message.data) ? message.data[0] : message.data;
        if (!trade) return null;

        return {
          type: 'trade',
          symbol,
          price: numberOrNull(trade.p),
          size: numberOrNull(trade.v),
          side: trade.S ? String(trade.S).toLowerCase() : null,
          tradeId: trade.i || null,
          timestamp: numberOrNull(trade.T) || Date.now()
        };
      }

      return null;
    }
  },
  bitfinex: {
    getUrl() {
      return 'wss://api-pub.bitfinex.com/ws/2';
    },
    subscribeMessages(state) {
      return [...state.symbols].flatMap(symbol => {
        const formatted = formatVenueSymbol(symbol, 'bitfinex');
        return [
          { event: 'subscribe', channel: 'ticker', symbol: formatted },
          { event: 'subscribe', channel: 'trades', symbol: formatted }
        ];
      });
    },
    onSubscribed(state, message) {
      if (message?.event === 'subscribed' && message.chanId) {
        state.chanMap.set(message.chanId, {
          channel: message.channel,
          symbol: normalizeSymbol(message.symbol)
        });
      }
    },
    parseMessage(raw, state) {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (message?.event) {
        return null;
      }

      if (!Array.isArray(message) || message.length < 2) return null;
      const [chanId, payload, extra] = message;
      const channelMeta = state.chanMap.get(chanId);
      if (!channelMeta || payload === 'hb') return null;

      if (channelMeta.channel === 'ticker' && Array.isArray(payload)) {
        return {
          type: 'ticker',
          symbol: channelMeta.symbol,
          bid: numberOrNull(payload[0]),
          ask: numberOrNull(payload[2]),
          price: numberOrNull(payload[6]),
          volume24h: numberOrNull(payload[7]),
          change24hPercent: payload[5] != null ? numberOrNull(payload[5]) * 100 : null,
          timestamp: Date.now()
        };
      }

      if (channelMeta.channel === 'trades' && extra && Array.isArray(extra)) {
        return {
          type: 'trade',
          symbol: channelMeta.symbol,
          tradeId: extra[0] || null,
          timestamp: numberOrNull(extra[1]) || Date.now(),
          size: numberOrNull(extra[2]),
          price: numberOrNull(extra[3]),
          side: Number(extra[2]) >= 0 ? 'buy' : 'sell'
        };
      }

      return null;
    }
  }
};

class NativeExchangeStreamService {
  constructor() {
    this.wss = null;
    this.tradingEngine = null;
    this.agentOrchestrator = null;
    this.connections = new Map();
    this.lastEvents = new Map();
    this.maxBufferedEvents = 250;
  }

  attach({ wss = null, tradingEngine = null, agentOrchestrator = null } = {}) {
    this.wss = wss;
    this.tradingEngine = tradingEngine;
    this.agentOrchestrator = agentOrchestrator;
  }

  async initialize({ subscriptions = [] } = {}) {
    const results = await Promise.allSettled(
      subscriptions.map(subscription => this.subscribe(subscription))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const subscription = subscriptions[index];
        logger.warn(
          `Native exchange stream initialization failed for ${subscription?.venue || 'unknown'} (${subscription?.isTestnet ? 'testnet' : 'mainnet'}): ${result.reason?.message || result.reason}`
        );
      }
    });

    return this.getStatus();
  }

  async subscribe({ venue, symbols = [], isTestnet = false } = {}) {
    const normalizedVenue = String(venue || '').trim().toLowerCase();
    if (!SUPPORTED_NATIVE_WS_VENUES.has(normalizedVenue)) {
      throw new Error(`Native WebSocket streaming is not supported for ${normalizedVenue || 'unknown venue'}`);
    }

    const cleanedSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
    if (cleanedSymbols.length === 0) {
      throw new Error('At least one symbol is required');
    }

    const key = connectionKey(normalizedVenue, Boolean(isTestnet));
    const state = this.connections.get(key) || this.createState(normalizedVenue, Boolean(isTestnet));
    cleanedSymbols.forEach(symbol => state.symbols.add(symbol));
    this.connections.set(key, state);

    if (state.socket && state.status === 'connected') {
      const adapter = venueAdapters[state.venue];
      if (adapter.unsubscribeMessage || adapter.subscribeMessage || adapter.subscribeMessages) {
        await this.sendSubscriptionMessages(state);
      }
      return this.serializeState(state);
    }

    await this.connect(state);
    return this.serializeState(state);
  }

  async unsubscribe({ venue, symbols = [], isTestnet = false } = {}) {
    const key = connectionKey(String(venue || '').trim().toLowerCase(), Boolean(isTestnet));
    const state = this.connections.get(key);
    if (!state) {
      return null;
    }

    const cleanedSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
    cleanedSymbols.forEach(symbol => state.symbols.delete(symbol));

    const adapter = venueAdapters[state.venue];
    if (cleanedSymbols.length > 0 && state.socket && state.status === 'connected' && adapter?.unsubscribeMessage) {
      state.socket.send(JSON.stringify(adapter.unsubscribeMessage(cleanedSymbols)));
    }

    if (state.symbols.size === 0) {
      this.closeConnection(state, false);
      this.connections.delete(key);
      return null;
    }

    return this.serializeState(state);
  }

  getStatus() {
    return {
      supportedVenues: [...SUPPORTED_NATIVE_WS_VENUES],
      connections: [...this.connections.values()].map(state => this.serializeState(state))
    };
  }

  createState(venue, isTestnet) {
    return {
      key: connectionKey(venue, isTestnet),
      venue,
      isTestnet,
      status: 'idle',
      symbols: new Set(),
      socket: null,
      reconnectTimer: null,
      heartbeatTimer: null,
      reconnectAttempts: 0,
      connectedAt: null,
      lastMessageAt: null,
      lastError: null,
      heartbeatMs: 20000,
      chanMap: new Map()
    };
  }

  async connect(state) {
    const adapter = venueAdapters[state.venue];
    if (!adapter) {
      throw new Error(`No native streaming adapter for ${state.venue}`);
    }

    this.closeConnection(state, true);
    state.status = 'connecting';

    const url = typeof adapter.getUrl === 'function'
      ? await adapter.getUrl(state)
      : adapter.getUrl;

    const socket = new WebSocket(url);
    state.socket = socket;

    socket.on('open', async () => {
      state.status = 'connected';
      state.connectedAt = Date.now();
      state.reconnectAttempts = 0;
      state.lastError = null;
      logger.info(`Native exchange stream connected: ${state.venue} (${state.isTestnet ? 'testnet' : 'mainnet'})`);

      try {
        await this.sendSubscriptionMessages(state);
      } catch (error) {
        logger.error(`Native exchange subscription error (${state.venue}):`, error.message);
      }

      if (adapter.heartbeatMessage) {
        state.heartbeatTimer = setInterval(() => {
          if (state.socket?.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify(adapter.heartbeatMessage()));
          }
        }, state.heartbeatMs);
      }
    });

    socket.on('message', raw => this.handleMessage(state, raw.toString()));
    socket.on('error', error => {
      state.lastError = error.message;
      logger.warn(`Native exchange stream error (${state.venue}): ${error.message}`);
    });
    socket.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer?.toString?.() || '';
      state.status = 'disconnected';
      state.socket = null;
      this.clearHeartbeat(state);
      logger.warn(`Native exchange stream closed (${state.venue}): ${code} ${reason}`.trim());
      if (state.symbols.size > 0) {
        this.scheduleReconnect(state);
      }
    });
  }

  async sendSubscriptionMessages(state) {
    const adapter = venueAdapters[state.venue];
    const messages = adapter.subscribeMessages
      ? adapter.subscribeMessages(state)
      : [adapter.subscribeMessage?.(state)].filter(Boolean);

    for (const message of messages) {
      state.socket?.send(JSON.stringify(message));
    }
  }

  handleMessage(state, raw) {
    const adapter = venueAdapters[state.venue];

    try {
      const parsed = JSON.parse(raw);
      state.lastMessageAt = Date.now();

      if (adapter.onSubscribed) {
        adapter.onSubscribed(state, parsed);
      }

      const event = adapter.parseMessage(parsed, state);
      if (!event) return;

      const normalizedEvent = {
        ...event,
        venue: state.venue,
        isTestnet: state.isTestnet,
        source: 'native_exchange_ws'
      };

      this.recordEvent(normalizedEvent);
      this.tradingEngine?.ingestNativeMarketData?.(normalizedEvent);
      this.agentOrchestrator?.recordMarketData?.(normalizedEvent, 'native_exchange_ws');
      this.broadcast('nativeMarketData', normalizedEvent);
      if (normalizedEvent.type === 'ticker') {
        this.broadcast('marketData', normalizedEvent);
      }
    } catch (error) {
      logger.warn(`Failed to parse native exchange stream message (${state.venue}): ${error.message}`);
    }
  }

  scheduleReconnect(state) {
    if (state.reconnectTimer) return;

    const delay = Math.min(5000 * Math.max(1, state.reconnectAttempts + 1), 30000);
    state.reconnectAttempts += 1;
    state.reconnectTimer = setTimeout(async () => {
      state.reconnectTimer = null;
      try {
        await this.connect(state);
      } catch (error) {
        state.lastError = error.message;
        logger.warn(`Reconnect failed (${state.venue}): ${error.message}`);
        this.scheduleReconnect(state);
      }
    }, delay);
  }

  closeConnection(state, keepSymbols = true) {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
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

  clearHeartbeat(state) {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  recordEvent(event) {
    const key = `${event.venue}:${event.symbol}:${event.type}`;
    this.lastEvents.set(key, event);
    if (this.lastEvents.size > this.maxBufferedEvents) {
      const firstKey = this.lastEvents.keys().next().value;
      if (firstKey) this.lastEvents.delete(firstKey);
    }
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
    return {
      venue: state.venue,
      isTestnet: state.isTestnet,
      status: state.status,
      symbols: [...state.symbols],
      connectedAt: state.connectedAt,
      lastMessageAt: state.lastMessageAt,
      lastError: state.lastError,
      reconnectAttempts: state.reconnectAttempts
    };
  }
}

export const nativeExchangeStreamService = new NativeExchangeStreamService();
export { SUPPORTED_NATIVE_WS_VENUES };
