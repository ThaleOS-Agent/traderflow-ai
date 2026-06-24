# THAELIA WebSocket Gateway

Standalone account WebSocket gateway for authenticated exchange connectivity, paper-first trading controls, and worker-based event processing.

## Defaults

- `ENABLE_PAPER_TRADING=true`
- `ENABLE_LIVE_TRADING=false`
- `DEMO_MODE=true`

Live order routing must remain disabled unless explicitly enabled.

## Architecture

```text
Authenticated Exchange Stream
  -> websocketClient
  -> messageQueue
  -> account/order/fill/risk workers
  -> state recovery + audit
  -> execution router / smart router
```

The WebSocket transport layer never executes strategy logic directly in `onmessage`.

## Supported connectors

- Binance Spot / Futures
- Bybit V5
- Kraken WebSocket v2
- Coinbase Advanced Trade
- OKX V5
- OANDA Practice
- Paper Exchange

## Core safety rules

- Paper mode stays default.
- Live trading stays blocked by default.
- Withdrawal permission must remain disabled.
- Account reconciliation is required before trading resumes after reconnect.
- Listen keys and auth secrets never leave the backend.

## Development

```bash
cd services/websocket-gateway
npm install
npm run check
```

## Main exports

- `accountConfigSchema`
- `createDefaultAccountConfig`
- `WebsocketClient`
- `HeartbeatManager`
- `ReconnectManager`
- `SessionRotator`
- `StateRecoveryCoordinator`
- `OrderRouter`
- `SmartRouter`
- `PreTradeChecks`

