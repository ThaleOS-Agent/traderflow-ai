import { useEffect, useRef, useCallback, useState } from 'react';
import type { PortfolioStats } from '../dashboard/api';

const TOKEN_KEY = 'tradeflow_token';

type WsStatus = 'connecting' | 'connected' | 'authenticated' | 'disconnected';

interface WsMessage {
  event: string;
  data?: unknown;
  timestamp?: number;
}

export interface LiveSignal {
  _id: string;
  symbol: string;
  side: string;
  strategy: string;
  confidenceScore: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  createdAt: string;
}

export interface LiveTrade {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'BUY' | 'SELL';
  status: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profit?: number;
  profitLoss?: number;
  strategy: string;
  exchange?: string;
  createdAt: string;
  openedAt?: string;
}

export interface LiveOrderEventPayload {
  userId?: string;
  order: LiveTrade;
  isPaperTrade?: boolean;
  opportunity?: {
    symbol?: string;
    exchange?: string;
    assetType?: string;
    confidenceScore?: number;
    strategy?: string;
  };
}

export interface LiveTradeEventPayload {
  userId?: string;
  trade: LiveTrade;
  isPaperTrade?: boolean;
  opportunity?: LiveOrderEventPayload['opportunity'];
}

export interface LiveMarketData {
  symbol?: string;
  pairs?: string[];
  timestamp?: number;
  price?: number;
  exchange?: string;
  assetType?: string;
}

export interface LivePortfolioUpdate {
  userId?: string;
  portfolio: PortfolioStats;
}

export type LiveWsEvent =
  | { event: 'connected'; data?: { message: string }; timestamp?: number }
  | { event: 'authenticated'; data?: { userId: string }; timestamp?: number }
  | { event: 'subscribed' | 'unsubscribed'; data?: { channels: string[] }; timestamp?: number }
  | { event: 'error'; data?: { message: string }; timestamp?: number }
  | { event: 'signal' | 'newSignal'; data?: LiveSignal; timestamp?: number }
  | { event: 'trade' | 'trade_update' | 'tradeExecuted' | 'tradeClosed' | 'autoTradeExecuted'; data?: LiveTrade | LiveTradeEventPayload; timestamp?: number }
  | { event: 'order' | 'order_update' | 'orderExecuted' | 'orderClosed' | 'mt5_order'; data?: LiveTrade | LiveOrderEventPayload | LiveTradeEventPayload; timestamp?: number }
  | { event: 'marketData'; data?: LiveMarketData; timestamp?: number }
  | { event: 'portfolio_update'; data?: LivePortfolioUpdate; timestamp?: number }
  | { event: string; data?: unknown; timestamp?: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isLiveTrade(value: unknown): value is LiveTrade {
  if (!isObject(value)) return false;
  return (
    typeof value._id === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.side === 'string' &&
    typeof value.status === 'string' &&
    typeof value.entryPrice === 'number' &&
    typeof value.quantity === 'number' &&
    typeof value.strategy === 'string'
  );
}

function isPortfolioStats(value: unknown): value is PortfolioStats {
  if (!isObject(value)) return false;
  return (
    typeof value.totalBalance === 'number' &&
    typeof value.availableBalance === 'number' &&
    typeof value.investedAmount === 'number' &&
    typeof value.totalProfit === 'number' &&
    typeof value.totalLoss === 'number' &&
    typeof value.winRate === 'number' &&
    typeof value.totalTrades === 'number' &&
    typeof value.winningTrades === 'number' &&
    typeof value.losingTrades === 'number'
  );
}

function extractTrade(data: unknown): LiveTrade | null {
  if (isLiveTrade(data)) return data;
  if (isObject(data) && 'trade' in data && isLiveTrade(data.trade)) {
    return data.trade;
  }
  return null;
}

function extractOrder(data: unknown): LiveTrade | null {
  if (isLiveTrade(data)) return data;
  if (isObject(data) && 'order' in data && isLiveTrade(data.order)) {
    return data.order;
  }
  if (isObject(data) && 'trade' in data && isLiveTrade(data.trade)) {
    return data.trade;
  }
  return null;
}

function extractPortfolioUpdate(data: unknown): LivePortfolioUpdate | null {
  if (!isObject(data) || !('portfolio' in data) || !isPortfolioStats(data.portfolio)) {
    return null;
  }
  return {
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    portfolio: data.portfolio,
  };
}

interface UseTradeWebSocketOptions {
  onSignal?: (signal: LiveSignal) => void;
  onTrade?: (trade: LiveTrade) => void;
  onOrder?: (order: LiveTrade) => void;
  onMarketData?: (data: LiveMarketData) => void;
  onPortfolioUpdate?: (data: LivePortfolioUpdate) => void;
  onEvent?: (event: LiveWsEvent) => void;
}

function getWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  // In production the frontend and backend share the same host
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${proto}//${host}/ws`;
}

export function useTradeWebSocket(options: UseTradeWebSocketOptions = {}) {
  const { onSignal, onTrade, onOrder, onMarketData, onPortfolioUpdate, onEvent } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return; // not authenticated yet

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectDelay.current = 1000; // reset backoff on successful connect
      setStatus('connected');
      // Authenticate
      ws.send(JSON.stringify({ event: 'auth', token }));
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data as string) as LiveWsEvent;
        setLastEvent(msg.event);
        onEvent?.(msg);

        switch (msg.event) {
          case 'authenticated':
            setStatus('authenticated');
            // Subscribe to live channels
            ws.send(JSON.stringify({
              event: 'subscribe',
              payload: { channels: ['signals', 'trades', 'orders', 'portfolio', 'marketData'] },
            }));
            break;

          case 'signal':
          case 'newSignal':
            if (msg.data) onSignal?.(msg.data as LiveSignal);
            break;

          case 'trade':
          case 'trade_update':
          case 'tradeExecuted':
          case 'tradeClosed':
          case 'autoTradeExecuted': {
            const trade = extractTrade(msg.data);
            if (trade) onTrade?.(trade);
            break;
          }

          case 'order':
          case 'order_update':
          case 'orderExecuted':
          case 'orderClosed':
          case 'mt5_order': {
            const order = extractOrder(msg.data);
            if (order) onOrder?.(order);
            break;
          }

          case 'marketData':
            if (msg.data) onMarketData?.(msg.data as LiveMarketData);
            break;

          case 'portfolio_update': {
            const update = extractPortfolioUpdate(msg.data);
            if (update) onPortfolioUpdate?.(update);
            break;
          }

          default:
            break;
        }
      } catch {
        // malformed JSON — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      wsRef.current = null;
      // Exponential backoff reconnect (cap at 30s)
      const delay = Math.min(reconnectDelay.current, 30000);
      reconnectDelay.current = delay * 2;
      reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };
  }, [onSignal, onTrade, onOrder, onMarketData, onPortfolioUpdate, onEvent]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    const initialConnectTimer = setTimeout(() => connectRef.current(), 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(initialConnectTimer);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastEvent, send };
}
