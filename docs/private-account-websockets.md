# Private Account WebSockets

## Scope

THAELIA private account WebSockets cover:

- Binance Spot / Futures
- Bybit V5
- Kraken WebSocket v2
- Coinbase Advanced Trade
- OKX V5
- OANDA Practice
- Paper Exchange

Paper mode remains the default path.

## Heartbeat strategy

- Send ping every 30 seconds
- Fail pong after 5 seconds
- Mark the stream `STALE` on missed pong
- Reconnect immediately after a missed pong
- Do not rely on TCP keep-alive alone

States:

- `HEALTHY`
- `DEGRADED`
- `STALE`
- `DISCONNECTED`
- `RECONNECTING`
- `FAILED`

## Reconnect policy

- `1s -> 2s -> 4s -> 8s -> 16s -> 32s -> 60s`
- Add jitter between `10%` and `50%`
- Track reconnect count, reason, last error, last successful auth, and last reconnect time

## Listen key lifecycle

For Binance-style private streams:

1. Create listen key through REST
2. Refresh every 25 minutes
3. If refresh fails, create a new listen key
4. Reconnect the private stream
5. Reconcile account state before resuming

Listen keys never reach the frontend.

## 24-hour session rotation

- Rotate sessions before the 24-hour exchange expiry window
- Current standard: rotate before 23 hours
- Pause trading during rotation
- Re-authenticate, reconcile, then resume only if consistent

## Account reconciliation

After reconnect:

1. Pause trading
2. Fetch balances
3. Fetch open orders
4. Fetch positions
5. Fetch recent fills
6. Compare REST snapshot against stream state
7. Log differences
8. Resume only if consistent

Never trade on stale account state.

## Private order execution

When a venue supports WebSocket trading, every order must pass:

- emergency stop
- live trading enabled
- daily drawdown
- max position size
- max open positions
- account stream health
- exchange health
- bot approval

If live trading is disabled, route to Paper Exchange.

## Rate-limit handling

- Respect inbound message caps
- Respect connection creation caps
- Use bounded queues with drop metrics
- Audit any limit pressure or bursts

## Security checklist

- Never expose API keys, secrets, listen keys, auth tokens, or signatures in the frontend
- Block any connector with withdrawal permission
- Recommend IP allowlisting for every live key
- Keep `ENABLE_LIVE_TRADING=false` until explicit approval

## Paper-first activation sequence

1. Create the connector in read-only mode
2. Authenticate the private stream
3. Verify heartbeat stability
4. Run reconciliation
5. Keep routing to paper
6. Explicitly enable live trading later if all controls pass
