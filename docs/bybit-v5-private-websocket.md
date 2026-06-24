# Bybit V5 Private WebSocket

## Coverage

Bybit V5 private connectivity is designed for:

- wallet updates
- position updates
- order updates
- execution updates

## Heartbeats

- Ping every 30 seconds
- Fail pong after 5 seconds
- Reconnect immediately on missed pong

## Reconnect policy

- Exponential backoff with jitter
- Track reconnect count, last error, last successful auth, and last reconnect time

## State recovery

On reconnect:

1. pause trading
2. fetch balances
3. fetch open orders
4. fetch positions
5. fetch recent fills
6. compare against the stream state
7. log differences
8. resume only if consistent

## Private trading

Bybit order routing remains blocked unless:

- live trading is explicitly enabled
- risk checks pass
- account stream is healthy
- exchange health is acceptable

Otherwise orders route to paper.
