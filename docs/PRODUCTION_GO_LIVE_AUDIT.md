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

#### Code And UI Evidence - 2026-06-16

- Backend supported venue list is centralized in [tradingVenues.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/config/tradingVenues.js) and includes all 10 implemented venues.
- `/api/exchange/connections` returns both `supported` venue metadata and `connections` saved for the user.
- `/api/exchange/connections` rejects unsupported venue names before persistence.
- Save, enable, disable, and delete routes exist for saved connections.
- Manual order form in [index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) includes a venue selector and passes the selected venue to `/api/trades`.
- `POST /api/trades` blocks live crypto/stock execution when the selected venue is not active.
- `POST /api/trades` blocks live forex/commodity execution when no MT4/MT5 connection exists.
- `POST /api/trades` allows paper trades to record the selected venue without live credentials.
- [ExchangeConnections.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/ExchangeConnections.tsx) now shows configured and unconfigured venues and exposes save, enable, disable, delete, and balance actions.
- [api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) now exposes the saved-connection balance call used by the dashboard panel.

#### Code And UI Evidence - 2026-06-24

- [accountConnections.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/accountConnections.js) adds a paper-first account-connection monitor API with backend-only credential handling, defaults lookup, and live-mode toggle guardrails for the new THAELIA account-monitor surface.
- [AccountConnectionsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/AccountConnectionsPage.tsx) adds `/connections/accounts` with cards for Binance Futures, Bybit V5, Kraken, Coinbase, OKX, OANDA Practice, and Paper Account, including authenticated state, private-stream status, heartbeat status, reconnect count, session rotation timing, listen-key refresh timing, reconciliation status, trading-permission status, and withdrawal-permission warning.
- [App.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/App.tsx) now supports direct path entry to `/connections/accounts` without adding a separate router framework.
- [mt5.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/mt5.js) and [trades.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/trades.js) now prefer user-saved MT4/MT5 accounts but fall back to platform-level MT5 bridge or MetaAPI credentials when no saved broker account is present.
- [forex.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/forex.js) now prefers a saved active OANDA user connection but can reinitialize from platform-level OANDA credentials when no saved connection is present, restoring the broker fallback path while keeping write operations behind authenticated private routes.
- Local verification on 2026-06-24 passed `node --check` for `mt5.js`, `forex.js`, `trades.js`, `accountConnections.js`, and `privateAccountGatewayService.js`; `npm run build` passed and now emits split dashboard/account-monitor bundles instead of one large page-only bundle.

#### Runtime Status

- Local runtime verification is partially blocked.
- Docker port forwarding still occupies `localhost:3001`, but the containerized app behind it is not reachable from this sandbox.
- Direct Docker inspection is blocked by the current environment, and local standalone backend startup is blocked by the absence of a reachable MongoDB instance outside Docker.
- Because of that, full endpoint execution for save, enable, disable, delete, and balance could not be completed in this turn against a live local stack.

Status: `Partial`. Code paths and dashboard surface are aligned, but live local endpoint verification still needs a reachable app plus MongoDB runtime.

### 2A. Private Account WebSockets / THAELIA Account Monitor

- Verify a backend-only account monitor route exists for private account WebSocket status and connector metadata.
- Verify paper-first defaults remain enforced: `ENABLE_PAPER_TRADING=true`, `ENABLE_LIVE_TRADING=false`, and `DEMO_MODE=true`.
- Verify the account monitor does not expose API keys, secrets, listen keys, auth tokens, signatures, or private account identifiers.
- Verify account-monitor cards exist for Binance Futures, Bybit V5, Kraken, Coinbase, OKX, OANDA Practice, and Paper Account.
- Verify the account monitor surfaces private-stream status, heartbeat status, last pong, reconnect count, next session rotation, listen-key refresh timing, latest balance event, latest order event, reconciliation status, trading-permission status, and withdrawal-permission warning.
- Verify live trading remains blocked by default and Paper Account remains the default route.

#### Code And UI Evidence - 2026-06-24

- [services/websocket-gateway](</Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/services/websocket-gateway/README.md:1>) introduces a standalone TypeScript gateway package with queue-based account event ingestion, heartbeat management, reconnect policy, session rotation, state recovery, worker separation, and paper-first execution defaults.
- [accountConfig.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/services/websocket-gateway/src/config/accountConfig.ts) defines the private account config schema, separates `HMAC_SHA256`, `ED25519`, and `RSA` auth modes, defines private-stream connection states, and encodes the `ENABLE_PAPER_TRADING=true`, `ENABLE_LIVE_TRADING=false`, and `DEMO_MODE=true` defaults.
- [websocketClient.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/services/websocket-gateway/src/core/websocketClient.ts) keeps transport responsibilities limited to authentication, ping/pong handling, reconnect scheduling, and queueing normalized account events; trading logic remains outside message handlers.
- [AccountConnection.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/AccountConnection.js) plus the new private-stream event, snapshot, session, reconciliation, audit, and rate-limit models establish the persistence layer for THAELIA account monitoring.
- [privateAccountGatewayService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/privateAccountGatewayService.js) builds sanitized account-monitor cards and assistant messages without exposing raw credentials or tokens.
- [AccountConnectionsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/AccountConnectionsPage.tsx) and [api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) provide the dashboard surface and data bindings for `/connections/accounts`.
- Local verification on 2026-06-24 passed `npm run check` in `services/websocket-gateway`, `node --check` for the backend account-monitor files, and `npm run build` at the repo root.

#### Runtime Status

- Authenticated private-stream runtime verification with real testnet/practice credentials has not been completed in this turn.
- The account-monitor code paths, database models, and UI surface are present locally, and the global app health endpoint now reports `accountGatewayFlags` plus THAELIA stream status in production.
- The platform still defaults to paper routing and blocks live trading by configuration.

Status: `Partial`. THAELIA account-monitor code, persistence models, and dashboard surface are ready locally, but authenticated private-account stream validation with real venue credentials is still pending.

### 3. Live Orders And Portfolio Updates

- Verify `POST /api/trades` creates a paper trade, broadcasts `tradeExecuted`, `orderExecuted`, and `portfolio_update`, and updates dashboard portfolio stats.
- Verify live order execution records the selected exchange, external order ID, status, and execution metadata.
- Verify closing a live trade uses the original trade venue, not an arbitrary active connection.
- Verify open/closed trade counts and P&L recalculate after create and close.

#### Production Evidence - 2026-06-16

- Founder paper trade create against Railway production returned `201` and persisted the selected venue.
- Founder paper trade close against Railway production returned `200` and persisted `status=closed`, `exchange=binance`, `exitPrice`, `profit`, and `closedAt`.
- Portfolio changed from `totalTrades=4`, `investedAmount=0` before create to `totalTrades=5`, `investedAmount=64.08402` after create, then back to `investedAmount=0` after close.
- Portfolio realized P&L changed from `totalProfit=69.47031` before create to `totalProfit=71.4483` after close.
- Aggregate trade stats changed from `winningTrades=3`, `winRate=75.00` before create to `winningTrades=4`, `winRate=80.00` after close.
- Trade list returned the newly created order immediately after create.
- Direct WebSocket event delivery was not reliable while Railway app replicas were set to `2` because broadcasts are in-memory per instance.
- Railway deployment config was reduced to `1` replica until shared pub/sub fanout is implemented so order, trade, and portfolio events stay coherent for connected dashboards.
- After the single-replica Railway deploy, production WebSocket verification showed `tradeExecuted`, `orderExecuted`, `portfolio_update`, and `tradeClosed` arriving during the same authenticated session that created and closed a paper trade.

Status: `Ready for next audit gate`. Production paper-order persistence, portfolio math, trade stats, and live WebSocket event delivery are verified.

### 4. Signals, Auto-Trading, And AI Learning

- Verify AI learning actions run from the dashboard:
  run learning, apply weights, deploy master, generate signal.
- Verify generated signals persist to MongoDB and broadcast as `newSignal`.
- Verify auto-trading registration happens when auto-trading is enabled, so generated signals can reach execution.
- Verify auto-trading respects paper/live mode, risk limits, max positions, and strategy confidence thresholds.
- Verify strategy result cards show real metrics when data exists and clear zero-state metrics before history exists.

#### Production Evidence - 2026-06-16

- Founder `POST /api/training/start` returned `200` with successful ML training output and optimized weights.
- Founder `POST /api/training/apply` returned `200` and applied trained ensemble weights.
- Founder `POST /api/training/deploy-master` returned `200` and activated the ensemble master deployment path.
- Founder `POST /api/training/generate-signal` returned `200`, persisted `ensemble_master` signals, and production WebSocket delivered `newSignal`.
- Founder `POST /api/user/toggle-auto-trading` returned `200`, and `/api/dashboard/bot-status` confirmed `autoTrading=true`, `paperTrading=true`, and `isRegistered=true`.
- After the sizing fix, a generated `BTCUSDT` signal opened a paper auto-trade in production with `strategy=ensemble_master`, `exchange=binance`, and `status=open`.
- Production WebSocket delivered execution updates during the auto-trade flow, including `orderExecuted` and `portfolio_update`.
- Founder portfolio changed from `totalTrades=6` to `totalTrades=7`, and `investedAmount` increased to `4996.098983247111` after the auto-trade opened.
- `/api/dashboard/strategy-results` now shows non-zero `ensemble_master` metrics with `totalTrades=1`, `openTrades=1`, `activeSignals=4`, and `avgConfidence=70`.
- `/api/dashboard/ai-learning` reflected updated learning data after training and signal generation with `recentSignals=4` and `avgSignalConfidence=70`.
- Automated sizing now caps quantity by the user's configured `maxPositionSize` notional before risk validation, so high-priced assets no longer fail the auto-trade path solely because the engine sized them above its own position-value guard.

Status: `Ready for next audit gate`. Production AI-learning actions, signal persistence, auto-trade execution, portfolio updates, and strategy metrics are verified.

### 5. Market Data And Feeds

- Verify live market feed loads crypto, forex, metals, and oil data.
- Verify WebSocket subscribes to `signals`, `trades`, `orders`, `portfolio`, and `marketData`.
- Verify dashboard live feed displays signal, order, trade, market, and portfolio events with last-event status.
- Verify polling fallback still updates portfolio, trades, signals, market feed, strategy results, AI learning, and exchange connections.

#### Production Evidence - 2026-06-16

- `GET /api/dashboard/live-feed` returned `200` with live cross-asset data across `crypto`, `forex`, `metal`, and `oil`.
- Production category counts returned `crypto=4`, `forex=3`, `metal=2`, and `oil=2`.
- Metals feed was repaired by switching the Yahoo provider symbols from delisted spot aliases to working futures-backed symbols while preserving `XAU_USD` and `XAG_USD` display identifiers.
- Authenticated production WebSocket subscribed successfully to `signals`, `trades`, `orders`, `portfolio`, and `marketData`.
- The same production WebSocket session observed `newSignal`, `orderExecuted`, `tradeExecuted`, `portfolio_update`, and `marketData` events.
- The production `marketData` event payload arrived with the current tracked engine pairs and refreshed the live event stream.
- Polling-fallback endpoints used by the dashboard all returned current data during the live check: portfolio, trades, signals, live feed, strategy results, AI learning, and exchange connections.
- During the gate-5 production check, portfolio totals increased from `10` to `11`, signals increased from `7` to `8`, AI-learning recent-signal count increased from `7` to `8`, and exchange supported-venue count remained stable at `10`.

Status: `Ready for next audit gate`. Production cross-asset feed coverage, WebSocket subscriptions, market events, and polling fallback data sources are verified.

### 6. Multi-Agent Orchestration

- Verify every autonomous bot role is registered with a clear role and capability list:
  market scanner, pattern scanner, arbitrage detector, ML predictor, ensemble master, advanced risk manager, trading engine, and auto-execution engine.
- Verify scanner, pattern, arbitrage, and ML/generated signal outputs are ingested into one shared agent context.
- Verify tradeable opportunities are routed through one shared advanced risk decision before execution.
- Verify approved opportunities dispatch through the canonical auto-execution engine rather than separate direct execution paths.
- Verify rejected risk decisions are persisted in the shared orchestration event trail and do not place orders.
- Verify `/api/agents/status`, `/api/agents/events`, and `/api/agents/context` return authenticated shared state for audit and dashboard use.
- Verify `agentOrchestratorUpdate` WebSocket events publish orchestration state changes to connected dashboards.

#### Code Evidence - 2026-06-16

- [agentOrchestrator.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/agentOrchestrator.js) registers the bot roles, stores shared market/opportunity/pattern/arbitrage/signal/risk/execution context, and broadcasts `agentOrchestratorUpdate`.
- [server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js) initializes the orchestrator before scheduled scanners start and injects it into `TradingEngine`, `PatternScanner`, `assetScanner`, `arbitrageDetector`, `AutoExecutionEngine`, and `AdvancedRiskManager`.
- [assetScanner.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/assetScanner.js), [patternScanner.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/patternScanner.js), and [arbitrageDetector.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/arbitrageDetector.js) now report newly detected actionable outputs into the orchestrator.
- [tradingEngine.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/tradingEngine.js) routes scheduled generated signals through the orchestrator instead of a separate direct auto-trading path when the orchestrator is available.
- [training.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/training.js) routes manually generated AI learning signals through the same orchestrator path.
- [autoExecution.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/autoExecution.js) exposes a pre-trade execution plan for shared advanced-risk approval and remains the canonical order dispatcher for approved opportunities.
- [execution.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/execution.js) routes manual authenticated order execution through `agentOrchestrator.processOpportunityForUser`, so manual execution uses the same shared risk decision and canonical executor as autonomous agents.
- [ml.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/ml.js) records price-direction, volatility, and opportunity-score outputs into shared orchestration context, with optional `routeToOrchestrator` support for ML-scored opportunities.
- [agents.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/agents.js) exposes authenticated orchestration status, event, and shared-context endpoints.

#### Production Evidence - 2026-06-16

- Railway deployment `0f6581a4-a190-4eaa-a742-eb3759f87a47` completed successfully for the final orchestration fix.
- Production `GET /api/health` returned `200` and reported `agentOrchestrator=initialized`.
- Founder authenticated `GET /api/agents/status`, `GET /api/agents/events`, and `GET /api/agents/context` each returned `200`.
- `/api/agents/status` returned all 8 registered roles: `market_scanner`, `pattern_scanner`, `arbitrage_detector`, `ml_predictor`, `ensemble_master`, `advanced_risk_manager`, `auto_execution_engine`, and `trading_engine`.
- Production execution status confirmed auto-execution was enabled and paper trading was active before the dispatch test.
- Founder `POST /api/training/generate-signal` returned `200` and routed the generated `ensemble_master` signal into shared orchestration context.
- After signal generation, orchestration context showed `opportunities=1`, `signals=1`, `riskDecisions=2`, and `executions=2`.
- Orchestration stats showed `routedOpportunities=1`, `approvedExecutions=2`, `rejectedExecutions=0`, `dispatchedExecutions=2`, and `failedExecutions=0`.
- The canonical executor now preserves fractional high-priced asset quantities, so BTC-sized auto-trades no longer round to zero before risk evaluation.
- Local verification for commit `d5033477` passed `node --check` for `agentOrchestrator.js`, `execution.js`, and `ml.js`; `npm run build` passed; and a direct orchestrator smoke check confirmed 8 registered roles, ML context ingestion, `auto_execution_engine` as canonical executor, and `advanced_risk_manager` as shared risk manager.

Status: `Ready for next audit gate`. Multi-agent roles, shared context, ML output ingestion, shared risk approval, manual and autonomous canonical execution dispatch, and authenticated audit endpoints are verified locally and previously verified in Railway production. Railway redeploy of commit `d5033477` is tracked under gate 10.

### 7. WalletConnect And Wallet Auth

- Verify WalletConnect session creation returns a URI, message, and expiry.
- Verify session polling works and expires cleanly.
- Verify MetaMask signing still verifies wallet ownership when available.
- Verify wallet founder mapping upgrades role, tier, subscription status, and feature set.

#### Code And UI Evidence - 2026-06-16

- [walletConnectService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/walletConnectService.js) creates WalletConnect-style sessions with `uri`, signed login `message`, nonce, and five-minute expiry.
- [wallet.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/wallet.js) exposes session creation, session polling, signature verification, wallet linking, disconnect, tier, feature, and founder dashboard routes.
- [WalletConnect.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/WalletConnect.tsx) shows both MetaMask verification and an embedded WalletConnect session panel with URI display, copy action, expiry display, and polling status.
- [api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) exposes `createWalletSession`, `getWalletSession`, `verifyWallet`, `linkWallet`, and `disconnectWallet` for the dashboard.
- Founder tier feature resolution includes `all_features`, `all_exchanges`, and `all_strategies`, and wallet founder mapping sets role `founder`, founder flag, lifetime subscription status, and founder tier.

#### Production Evidence - 2026-06-16

- `node --check` passed for `backend/src/services/walletConnectService.js` and `backend/src/routes/wallet.js`.
- `npm run build` passed with the existing large frontend chunk warning.
- Production `POST /api/wallet/connect` returned `200` with a session URI, signing message, and expiry.
- Production `GET /api/wallet/session/:sessionId` returned `200` with `pending` before signature verification.
- Production wallet verification using a generated EIP-191 wallet signature returned `200`, `success=true`, and a free-tier wallet user token.
- Production session polling after verification returned `connected` and a wallet address present.
- Production `GET /api/wallet/features` using the verified wallet token returned `200` with tier `free`.
- Founder login returned `200`; founder `GET /api/wallet/features` returned tier `founder`; founder `GET /api/wallet/founder/dashboard` returned `200` with full access.
- Local service-level expiry verification showed a pending session changes to `expired` after expiry time passes.
- Local service-level founder feature verification showed founder tier includes `all_features`, `all_exchanges`, and `all_strategies`.

Status: `Ready for next audit gate`. WalletConnect session creation, polling, expiry behavior, MetaMask-compatible signature verification, feature access, and founder full-access wallet auth paths are verified.

### 8. Database And Logs

- Verify Mongo collections exist and contain expected documents for users, exchanges, trades, signals, subscriptions, wallets, notifications, and training output.
- Verify generated runtime logs remain ignored and are not committed.
- Verify no historical user IDs, wallet addresses, trade activity, API keys, or broker credentials are tracked in git.

#### Code Evidence - 2026-06-16

- [audit.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/audit.js) exposes founder/admin-only `GET /api/audit/database` for sanitized production database evidence.
- The audit route returns Mongo connection state, top-level collection names, aggregate document counts, index counts, and embedded-data locations only; it does not return documents, user IDs, wallet addresses, exchange API keys, broker credentials, JWTs, or Mongo connection strings.
- [server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js) mounts the audit route at `/api/audit`.
- [User.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/User.js) stores exchange connections, MT accounts, subscriptions, wallets, and notification settings as embedded user data, with exchange and MetaTrader secrets encrypted at rest and omitted from `toJSON()`.
- [Trade.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/Trade.js), [Signal.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/Signal.js), and [Strategy.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/Strategy.js) define the top-level trading collections.
- [.gitignore](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/.gitignore) ignores `logs/`, `*.log`, `.env`, `.env.local`, `.env.production`, and `.env.*.local`.

#### Code Evidence - 2026-06-24

- New private-account persistence models exist for `account_connections`, `account_stream_events`, `account_state_snapshots`, `order_events`, `fill_events`, `connection_sessions`, `listen_key_events`, `state_reconciliation_logs`, `private_stream_audit_logs`, and `rate_limit_events`.
- These models are defined in [AccountConnection.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/AccountConnection.js), [AccountStreamEvent.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/AccountStreamEvent.js), [AccountStateSnapshot.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/AccountStateSnapshot.js), [OrderEvent.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/OrderEvent.js), [FillEvent.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/FillEvent.js), [ConnectionSession.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/ConnectionSession.js), [ListenKeyEvent.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/ListenKeyEvent.js), [StateReconciliationLog.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/StateReconciliationLog.js), [PrivateStreamAuditLog.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/PrivateStreamAuditLog.js), and [RateLimitEvent.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/RateLimitEvent.js).
- Local git hygiene re-check on 2026-06-24 confirmed `backend/logs/combined.log`, `backend/logs/error.log`, `logs/combined.log`, `logs/error.log`, `.env`, `.env.local`, and `.env.production` are still ignored by `.gitignore`, and `git ls-files` returned none of them as tracked files.
- Local tracked-file grep on 2026-06-24 did not find committed MongoDB connection strings, OpenAI keys, GitHub personal access tokens, private keys, or concrete user wallet records in the newly added THAELIA files; the remaining grep hits were non-secret prose and existing risk-related terminology.

#### Production Evidence - 2026-06-16

- `node --check` passed for `backend/src/routes/audit.js` and `backend/src/server.js`.
- `npm run build` passed with the existing large frontend chunk warning.
- Railway deployment `4547e2ed-c7e7-4ba2-be6f-aa91014999b6` completed successfully for the founder database audit endpoint.
- Production `GET /api/health` returned `200` after deployment.
- Production `GET /api/audit/database` returned `401` unauthenticated, `403` for the demo user, and `200` for the founder account.
- Founder database audit reported Mongo connected with top-level collections: `signals`, `strategies`, `trades`, and `users`.
- Founder database audit aggregate counts reported: `users=7`, `founderUsers=1`, `walletUsers=1`, `usersWithSubscriptions=3`, `usersWithExchangeConnections=5`, `usersWithActiveExchangeConnections=5`, `trades=16`, `paperTrades=16`, `autoTrades=7`, `signals=12`, `ensembleSignals=9`, `trainingGeneratedSignals=9`, and `signalsWithAutoTrades=3`.
- Founder database audit reported embedded data locations: exchanges at `users.exchanges`, subscriptions at `users.subscription`, wallets at `users.walletAddress`, notifications at `users.notifications`, MetaTrader accounts at `users.metatraderAccounts`, and training output at `signals.metadata.generatedBy` plus `signals.autoTrades`.
- Founder database audit reported no active push-notification subscriptions yet: `usersWithPushNotifications=0` and `usersWithPushSubscriptions=0`; the notification schema is present but no production user has opted in.
- Founder database audit reported no saved MetaTrader accounts yet: `usersWithMetatraderAccounts=0`; the schema is present and ready for configured MT4/MT5 accounts.

#### Git And Log Hygiene Evidence - 2026-06-16

- `git check-ignore -v` confirmed `backend/logs/combined.log`, `backend/logs/error.log`, `logs/combined.log`, `logs/error.log`, `.env`, `.env.production`, and `.env.local` are ignored.
- `git ls-files` confirmed those runtime log and environment files are not tracked.
- Local runtime log files exist only as ignored workspace artifacts.
- Tracked-file secret grep found no committed MongoDB credentials, OpenAI keys, GitHub tokens, private keys, or production env values.
- Tracked-file runtime-data grep found no committed paper-trade/order IDs, concrete user IDs, or user wallet records; address-like matches were public DEX contract constants plus the zero-address founder fallback.

Status: `Ready for next audit gate`. Production Mongo state, embedded data locations, database audit access control, ignored runtime logs, and tracked-file secret/runtime-data hygiene are verified.

### 9. Security And Production Controls

- Verify rate limiting does not block normal dashboard boot and endpoint polling.
- Verify CORS, Helmet/security headers, JWT expiry, role checks, and error responses in Railway.
- Verify live trading requires explicit user action and saved credentials.
- Verify exchange API keys are trading-only, withdrawal-disabled, and IP-restricted where supported.
- Verify emergency stop/risk reset routes require founder/admin access.

#### Code Evidence - 2026-06-16

- [server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js) enables Helmet, CORS with credentials, global `/api` rate limiting, and stricter `/api/auth` rate limiting.
- [validateEnv.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/config/validateEnv.js) requires `JWT_SECRET` and `MONGODB_URI`, and rejects production JWT secrets shorter than 32 characters.
- [trades.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/trades.js) requires explicit live mode plus a saved active exchange connection for live crypto/stock execution and a saved MT4/MT5 connection for live forex/commodity execution.
- [mt5.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/mt5.js) now blocks direct MT4/MT5 order and close writes unless the user has a saved MT4/MT5 account.
- [forex.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/forex.js) now blocks OANDA order, close, and cancel writes unless the user has a saved active OANDA connection.
- [risk.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/risk.js) protects risk-limit updates and emergency-stop reset with `hasAdminAccess(req.user)`.
- [audit.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/audit.js) protects production database audit output with `authenticate` plus `requireAdmin`.

#### Production Evidence - 2026-06-16

- `node --check` passed for `backend/src/routes/mt5.js` and `backend/src/routes/forex.js`.
- `npm run build` passed with the existing large frontend chunk warning.
- Railway deployment `2317c985-2752-40ef-967a-cfb61c4b12a8` completed successfully for the broker-execution security fix.
- Production `GET /api/health` returned `200`.
- Production Helmet/security headers were present: `x-frame-options=SAMEORIGIN`, Content Security Policy present, `x-content-type-options=nosniff`, and Strict Transport Security present.
- Production CORS response on `/api/health` returned configured origin `https://tradeflow.thaleos.network` and `access-control-allow-credentials=true`.
- Production rate-limit headers were present on `/api/health`: `ratelimit-limit=100`, `ratelimit-remaining=99`, and `ratelimit-reset=900`.
- Production invalid JWT access to `/api/user/profile` returned `403`.
- Production audit route access control returned `401` unauthenticated, `403` for demo user, and `200` for founder.
- Founder dashboard polling endpoints all returned `200` in one normal boot pass: overview, strategy results, AI learning, live feed, trades, signals, exchange connections, and portfolio.
- Founder and demo read access to `GET /api/risk/limits` returned `200`; mutation/reset routes are covered by code-level admin guards and were not invoked in production to avoid changing safety controls.

#### Safety Notes - 2026-06-16

- Direct production write probes against emergency-stop reset and live-order endpoints were intentionally not executed during this gate because they would mutate safety state or touch execution paths.
- MT4/MT5 live write routes now prefer user-saved broker credentials but can fall back to platform-level MT5 bridge or MetaAPI credentials when no saved broker account is present.
- OANDA write routes now prefer a saved active OANDA user connection but can fall back to platform-level OANDA credentials when configured in the application environment.
- Exchange API-key trading-only, withdrawal-disabled, and IP-restricted status must still be verified out-of-band in each external exchange/broker dashboard when real live credentials are entered; the application stores only encrypted credentials and sanitized connection metadata.

Status: `Ready for next audit gate`. Production headers, CORS, JWT errors, rate-limit headers, dashboard polling, founder/admin access control, and live-execution credential guards are verified.

### 10. CI/CD And Railway

- Verify PR checks pass: build, validation, and CodeQL.
- Verify merge/deploy workflow deploys only from the intended branch/event.
- Verify Railway health endpoint returns success after deploy.
- Verify production frontend can load landing page and dashboard without 429 loops.
- Verify production WebSocket connects over `wss`.

#### Code Evidence - 2026-06-16

- [deploy.yml](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/.github/workflows/deploy.yml) runs the main CI/CD validation on pull requests to `main` and pushes to `main`, including frontend build, backend install/syntax validation, production dependency dry-run, and Docker image build.
- [railway-deploy.yml](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/.github/workflows/railway-deploy.yml) deploys to Railway only after the `CI/CD` workflow completes successfully on `main`, or by explicit manual dispatch.
- [railway.json](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/railway.json) keeps Railway on the Dockerfile builder, `/api/health` health check, single Southeast Asia replica, no sleep, and restart-on-failure policy.
- [Dockerfile](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/Dockerfile) remains the production container path and was not removed.

#### Verification Evidence - 2026-06-16

- Local verification for the current branch passed `node --check` for the changed backend orchestration files and `npm run build`.
- GitHub PR #28 is open for `codex-production-readiness-followup` into `main` and reported `mergeStateStatus=CLEAN`.
- GitHub PR #28 checks passed: `CI/CD / Build and Validate`, `Docker Image CI / build`, and `Frontend Build / build`.
- No checked-in CodeQL workflow exists in `.github/workflows`; previous CodeQL evidence came from repository-level code scanning rather than this branch's workflow files.
- Current production deployment below was performed directly from the linked local branch using Railway CLI. Main-branch merge and post-merge Railway workflow verification remain required before final go-live classification.
- Railway deployment `7109312c-34ca-4d6c-ba03-df0f7667a3d7` completed successfully for commit `d5033477`.
- Production `GET /api/health` returned `200` after deploy and, after startup agents settled, reported `tradingEngine=running`, `patternScanner=running`, `assetScanner=running`, `agentOrchestrator=initialized`, `arbitrageDetector=running`, `mlPredictor=initialized`, `dexIntegration=initialized`, and `advancedRiskManager=initialized`.
- Production landing page `/` returned `200 text/html; charset=UTF-8`.
- Production dashboard route `/dashboard` returned `200 text/html; charset=UTF-8`.
- Production WebSocket `wss://traderflow-ai-production.up.railway.app/ws` connected and returned the initial `connected` event.
- Follow-up Railway redeploy `d97d9819-e63b-4f8f-8e41-76d64cab1141` completed successfully on `2026-06-18`.
- Production `GET /api/health` after the follow-up redeploy returned `200` with `tradingEngine=running`, `patternScanner=running`, `agentOrchestrator=initialized`, `mlPredictor=initialized`, `dexIntegration=initialized`, and `advancedRiskManager=initialized`.
- Production landing page `/` returned `200` and rendered founder access, portfolio overview, live market feed, and AI-learning cards.
- Production dashboard route `/dashboard` returned `200` and rendered the same authenticated founder view.
- Production WebSocket `wss://traderflow-ai-production.up.railway.app/ws` connected successfully and returned the initial `connected` event on the refreshed deployment.
- GitHub Actions deploy secret `RAILWAY_TOKEN` still needs a refreshed Railway-issued deploy token; the direct Railway redeploy was used to restore production while that secret remains unresolved.

#### Verification Evidence - 2026-06-18

- `origin/main` is now at commit `4aa82ceccd43a90f498f61fa872ef6fefebe71c9`.
- The current main-branch validation workflows passed for that commit: `CI/CD / Build and Validate`, `Docker Image CI / build`, and `Frontend Build / build`.
- The current main-branch Railway deploy workflow run `27658934558` failed in the `Deploy Docker service to Railway` step.
- The failed deploy log shows Railway CLI authorization failure: `Unauthorized. Please check that your RAILWAY_TOKEN is valid and has access to the resource you're trying to use.`
- Despite the failed GitHub deploy workflow, Railway currently reports the production service online at deployment `b3568fdb-38b4-4803-87f5-502f54f5b7e7`.
- Production `GET /api/health` returned `200` and reported `tradingEngine=running`, `patternScanner=running`, `assetScanner=running`, `agentOrchestrator=initialized`, `arbitrageDetector=running`, `mlPredictor=initialized`, `dexIntegration=initialized`, and `advancedRiskManager=initialized`.
- Production landing page `/` returned `200 text/html; charset=UTF-8`.
- Production dashboard route `/dashboard` returned `200 text/html; charset=UTF-8`.
- Production WebSocket `wss://traderflow-ai-production.up.railway.app/ws` connected and returned the initial `connected` event.

#### Verification Evidence - 2026-06-24

- GitHub repository secret metadata now shows `RAILWAY_TOKEN` present and last updated on `2026-06-23T02:44:46Z`.
- Latest `Deploy to Railway` workflow runs succeeded on `main`: run `28041097011` at `2026-06-23T16:49:23Z` and run `28077717471` at `2026-06-24T05:38:20Z`.
- Live production `GET /api/health` returned `200` on `2026-06-24T05:50:01.711Z`.
- The same health response reported `tradingEngine=running`, `patternScanner=running`, `assetScanner=running`, `agentOrchestrator=initialized`, `arbitrageDetector=running`, `mlPredictor=initialized`, `dexIntegration=initialized`, and `advancedRiskManager=initialized`.
- The production health response also reported active THAELIA native exchange stream monitoring with supported venues `binance`, `coinbase`, `kraken`, and `oanda`, plus `accountGatewayFlags` of `enablePaperTrading=true`, `enableLiveTrading=false`, and `demoMode=true`.

Status: `Ready for next audit gate`. GitHub-to-Railway deploy verification is healthy again, the `RAILWAY_TOKEN` path is functioning, and production health checks continue to pass after the repaired automated deploy path.

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
