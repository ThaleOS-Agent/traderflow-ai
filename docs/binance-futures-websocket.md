# Binance Futures Private WebSocket

## Private stream model

Binance Futures private streams use a REST-created `listenKey` and a WebSocket URL bound to that key.

## Required lifecycle

1. Create `listenKey`
2. Connect the private stream
3. Refresh the `listenKey` every 25 minutes
4. Recreate the key if refresh fails
5. Reconnect and reconcile

## Session rotation

- Binance sessions should be rotated before the 24-hour expiry window
- THAELIA rotates before 23 hours

## Heartbeats

- Ping every 30 seconds
- Pong timeout after 5 seconds
- Immediate reconnect on missed pong

## Account events

Normalize:

- `ACCOUNT_UPDATE`
- `BALANCE_UPDATE`
- `ORDER_TRADE_UPDATE`
- `HEARTBEAT`
- `RECONNECT`
- `AUTH_FAILURE`

## Recovery flow

- pause trading
- fetch balances
- fetch open orders
- fetch positions
- fetch recent fills
- compare stream state with REST
- log diffs
- resume only if consistent

## Security

- Never expose `listenKey`
- Never expose API secret
- Disable withdrawal permission
- Recommend IP allowlisting
