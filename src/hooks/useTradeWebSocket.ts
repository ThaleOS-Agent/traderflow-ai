import { useEffect, useRef, useCallback, useState } from 'react';

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
  createdAt: string;
  openedAt?: string;
}

interface UseTradeWebSocketOptions {
  onSignal?: (signal: LiveSignal) => void;
  onTrade?: (trade: LiveTrade) => void;
  onPortfolioUpdate?: (data: unknown) => void;
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
  const { onSignal, onTrade, onPortfolioUpdate } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);

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
        const msg: WsMessage = JSON.parse(evt.data as string);
        setLastEvent(msg.event);

        switch (msg.event) {
          case 'authenticated':
            setStatus('authenticated');
            // Subscribe to live channels
            ws.send(JSON.stringify({
              event: 'subscribe',
              payload: { channels: ['signals', 'trades', 'portfolio'] },
            }));
            break;

          case 'signal':
          case 'newSignal':
            onSignal?.(msg.data as LiveSignal);
            break;

          case 'trade':
          case 'trade_update':
          case 'tradeExecuted':
          case 'tradeClosed': {
            const data = msg.data as LiveTrade | { trade?: LiveTrade };
            onTrade?.(('trade' in data && data.trade ? data.trade : data) as LiveTrade);
            break;
          }

          case 'portfolio_update':
            onPortfolioUpdate?.(msg.data);
            break;

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
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };
  }, [onSignal, onTrade, onPortfolioUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastEvent, send };
}
