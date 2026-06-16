# TraderFlow AI Production Go-Live Audit

This audit uses the Trade-M8 reference reports as a pattern, but keeps TraderFlow readiness evidence-based. A feature is not production-ready until the endpoint, database write, UI surface, live feed, and safety control are verified in the target environment.

## Current Stabilization Status

- Branch: `codex-cicd-setup`
- Deployment path: GitHub Actions to Railway
- Docker files: retained
- Latest local checks: `npm run lint` and `npm run build`
- Known build warning: large frontend chunks after minification

## Go-Live Evidence Gates

### 1. Authentication And Founder Access

- Verify founder login works through `/api/auth/login`.
- Verify founder tier resolves to full access through auth middleware, paywall middleware, wallet subscription, training routes, risk routes, and notification broadcast routes.
- Verify non-founder users still receive expected paywall restrictions.
- Verify no secrets or tokens are emitted in frontend errors, backend logs, or CI output.

#### Local Evidence - 2026-06-16

- Docker app rebuilt successfully with current branch code.
- `GET /api/health` returned `200`.
- Founder login through `/api/auth/login` returned `200` with role `founder`, tier `founder`, and founder flag enabled.
- Demo login through `/api/auth/login` returned `200` with role `user`, tier `gold`, and founder flag disabled.
- Founder `/api/wallet/subscription` returned tier `founder`.
- Demo `/api/wallet/subscription` returned tier `gold`.
- Founder `/api/wallet/features` returned tier `founder`.
- Founder `/api/training/start` returned `200`.
- Demo `/api/training/start` returned `403`.
- Founder no-op `POST /api/risk/limits` returned `200`.
- Demo no-op `POST /api/risk/limits` returned `403`.
- Founder `/api/wallet/founder/dashboard` returned `200` with full access.
- Demo `/api/wallet/founder/dashboard` returned `403` with `FOUNDER_REQUIRED`.
- Smoke test output did not print JWTs, passwords, API keys, or broker credentials.

Status: `Ready for next audit gate` locally. Railway verification remains part of gate 9.

### 2. Exchange And Broker Connections

- Verify `/api/exchange/connections` returns every supported TraderFlow venue:
  `binance`, `coinbase`, `kraken`, `kucoin`, `bybit`, `ftx`, `gemini`, `bitfinex`, `interactive_brokers`, `oanda`.
- Verify dashboard shows configured and unconfigured venues.
- Verify save, enable, disable, delete, and balance flows for saved credentials.
- Verify live crypto/stock orders require an active saved venue and reject unsupported venue names.
- Verify forex/commodity live orders require a saved MT4/MT5 connection.
- Verify paper orders can record selected venue without using live credentials.

### 3. Live Orders And Portfolio Updates

- Verify `POST /api/trades` creates a paper trade, broadcasts `tradeExecuted`, `orderExecuted`, and `portfolio_update`, and updates dashboard portfolio stats.
- Verify live order execution records the selected exchange, external order ID, status, and execution metadata.
- Verify closing a live trade uses the original trade venue, not an arbitrary active connection.
- Verify open/closed trade counts and P&L recalculate after create and close.

### 4. Signals, Auto-Trading, And AI Learning

- Verify AI learning actions run from the dashboard:
  run learning, apply weights, deploy master, generate signal.
- Verify generated signals persist to MongoDB and broadcast as `newSignal`.
- Verify auto-trading registration happens when auto-trading is enabled, so generated signals can reach execution.
- Verify auto-trading respects paper/live mode, risk limits, max positions, and strategy confidence thresholds.
- Verify strategy result cards show real metrics when data exists and clear zero-state metrics before history exists.

### 5. Market Data And Feeds

- Verify live market feed loads crypto, forex, metals, and oil data.
- Verify WebSocket subscribes to `signals`, `trades`, `orders`, `portfolio`, and `marketData`.
- Verify dashboard live feed displays signal, order, trade, market, and portfolio events with last-event status.
- Verify polling fallback still updates portfolio, trades, signals, market feed, strategy results, AI learning, and exchange connections.

### 6. WalletConnect And Wallet Auth

- Verify WalletConnect session creation returns a URI, message, and expiry.
- Verify session polling works and expires cleanly.
- Verify MetaMask signing still verifies wallet ownership when available.
- Verify wallet founder mapping upgrades role, tier, subscription status, and feature set.

### 7. Database And Logs

- Verify Mongo collections exist and contain expected documents for users, exchanges, trades, signals, subscriptions, wallets, notifications, and training output.
- Verify generated runtime logs remain ignored and are not committed.
- Verify no historical user IDs, wallet addresses, trade activity, API keys, or broker credentials are tracked in git.

### 8. Security And Production Controls

- Verify rate limiting does not block normal dashboard boot and endpoint polling.
- Verify CORS, Helmet/security headers, JWT expiry, role checks, and error responses in Railway.
- Verify live trading requires explicit user action and saved credentials.
- Verify exchange API keys are trading-only, withdrawal-disabled, and IP-restricted where supported.
- Verify emergency stop/risk reset routes require founder/admin access.

### 9. CI/CD And Railway

- Verify PR checks pass: build, validation, and CodeQL.
- Verify merge/deploy workflow deploys only from the intended branch/event.
- Verify Railway health endpoint returns success after deploy.
- Verify production frontend can load landing page and dashboard without 429 loops.
- Verify production WebSocket connects over `wss`.

## First Live Trade Runbook

1. Confirm testnet/practice mode credentials first.
2. Enable paper trading and execute a small paper order through the selected venue.
3. Confirm trade, order, portfolio, and live feed updates.
4. Switch to live mode only after risk limits and venue status are verified.
5. Execute minimum-size live order on one venue.
6. Confirm external order ID, trade record, portfolio update, notification, and close flow.
7. Repeat venue-by-venue before enabling multi-exchange automation.

## Readiness Classification

- `Blocked`: build fails, auth fails, secrets leak, live trading bypasses risk, or database writes fail.
- `Partial`: local works but Railway, WebSocket, Mongo, or venue credentials are unverified.
- `Ready for first paper trade`: auth, dashboard, paper order, portfolio, and live feeds verified.
- `Ready for first live trade`: all paper checks plus live credential validation, risk gates, and minimum-size broker execution verified.
- `Ready for go-live`: multiple venues verified, monitoring enabled, rollback path tested, and CI/CD passing.
