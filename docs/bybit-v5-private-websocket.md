# Bybit V5 WebSocket

## Coverage

Bybit V5 connectivity in TraderFlow is split across:

- public market data:
  - `wss://stream.bybit.com/v5/public/spot`
  - `wss://stream.bybit.com/v5/public/linear`
  - `wss://stream.bybit.com/v5/public/inverse`
  - `wss://stream.bybit.com/v5/public/option`
- private account stream:
  - `wss://stream.bybit.com/v5/private`
- trade entry:
  - `wss://stream.bybit.com/v5/trade`

Testnet equivalents use `stream-testnet.bybit.com`.

Private connectivity is designed for:

- wallet updates
- position updates
- order updates
- execution updates

Public connectivity is designed for:

- `tickers.{symbol}`
- `publicTrade.{symbol}`
- `orderbook.1.{symbol}`

## Authentication

Private Bybit WebSocket auth uses:

- `op: "auth"`
- args: `[apiKey, expires, signature]`
- HMAC SHA256 signature over `GET/realtime{expires}`

TraderFlow keeps Bybit credentials server-side and never exposes API keys, secrets, signatures, or auth payloads in the frontend.

## Heartbeats

- Ping every 30 seconds
- Fail pong after 5 seconds
- Reconnect immediately on missed pong
- Bybit also recommends heartbeat maintenance on 20-second cadence; TraderFlow keeps the stricter gateway-wide liveness timeout and supports `max_active_time` on private streams.

## Regional domains

Mainnet private and trade endpoints may need regional hosts:

- Turkey: `stream.bybit.tr`
- Kazakhstan: `stream.bybit.kz`
- Georgia: `stream.bybitgeorgia.ge`

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
