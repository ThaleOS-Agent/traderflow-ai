# TraderFlow AI Backend Route Ownership Audit

Date: 2026-06-24

Scope: every file in `backend/src/routes`

Method:

- Verified each route file is mounted in [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js).
- Mapped each route to its primary models and services.
- Checked current frontend consumers in [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) and dashboard components.
- Distinguished between current product routes and operator-only or externally callable APIs.

Recommendation labels:

- `KEEP`: active product surface or foundational backend API.
- `KEEP / MERGE LATER`: still owned and useful, but could be folded into another domain later.
- `CONDITIONAL DELETE CANDIDATE`: no current frontend consumer was found and the route appears optional or legacy; delete only if external clients and ops workflows confirm it is unused.

## Summary

### Keep

- `auth.js`
- `user.js`
- `trades.js`
- `strategies.js`
- `signals.js`
- `dashboard.js`
- `exchange.js`
- `training.js`
- `wallet.js`
- `mt5.js`
- `agents.js`
- `accountConnections.js`

### Keep / Merge Later

- `execution.js`
- `risk.js`
- `scanner.js`
- `patterns.js`
- `forex.js`
- `ml.js`
- `notifications.js`

### Conditional Delete Candidates

- `arbitrage.js`
- `audit.js`
- `backtest.js`
- `dex.js`
- `options.js`
- `social.js`

## Route-By-Route Findings

### `accountConnections.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/account-connections` in [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js).
- Used by [src/dashboard/AccountConnectionsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/AccountConnectionsPage.tsx) through `getAccountConnectionsMonitor`, `saveAccountConnection`, and `toggleAccountConnectionLive`.
- Owns the THAELIA account-monitor surface and depends on [backend/src/services/privateAccountGatewayService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/privateAccountGatewayService.js) plus [backend/src/models/AccountConnection.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/AccountConnection.js).

### `agents.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/agents`.
- Used by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) through `getAgentStatus` and `getAgentEvents`.
- Sole route-level owner of `agentOrchestrator` status, events, and shared-context audit APIs.

### `arbitrage.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/arbitrage`, but no current frontend consumer was found in `src/`.
- Only depends on [backend/src/services/arbitrageDetector.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/arbitrageDetector.js), which is already initialized independently in the backend runtime.
- Safe deletion is not yet proven because external API clients may still call `/api/arbitrage/opportunities`, `/stats`, or `/execute`.

### `audit.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/audit`, but no current frontend consumer was found.
- Provides one admin database audit endpoint and only depends on Mongoose plus `User`, `Trade`, `Signal`, and `Strategy` models.
- This looks operational rather than product-critical; if no deployment or support workflow uses it, it is a strong cleanup candidate.

### `auth.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/auth` with stricter auth rate limiting.
- Used by [src/dashboard/LoginPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/LoginPage.tsx), [src/hooks/useAuth.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/hooks/useAuth.ts), and [src/App.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/App.tsx).
- Owns register, login, and current-user auth checks. Removing it breaks the entire dashboard login path.

### `backtest.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/backtest`, but no current frontend consumer was found.
- Depends only on [backend/src/services/enhancedBacktestEngine.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/enhancedBacktestEngine.js), after the older backtest engine was already removed.
- If backtesting is no longer part of the production product surface, this route is a plausible next deletion target. If it remains part of founder or operator workflows, keep it.

### `dashboard.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/dashboard`.
- Used broadly by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) and [src/sections/MarketingLanding.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/sections/MarketingLanding.tsx).
- Owns overview, live feed, strategy results, AI learning, performance chart, asset allocation, bot status, and activity APIs.

### `dex.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/dex`, but no current frontend consumer was found.
- Depends on [backend/src/services/dexIntegration.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/dexIntegration.js), which is also initialized in the backend lifecycle.
- If DEX swaps and quotes are not part of the live production scope, this is a strong route-level cleanup candidate.

### `exchange.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/exchange`.
- Used by [src/dashboard/ExchangeConnections.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/ExchangeConnections.tsx) and [src/sections/MarketingLanding.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/sections/MarketingLanding.tsx).
- Owns exchange connection CRUD, balances, capabilities, streaming status, route preview, pairs, and market data access. It is central to live exchange operations.

### `execution.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/execution`.
- No current frontend consumer was found in `src/`, but it owns manual execution control over [backend/src/services/autoExecution.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/autoExecution.js) and [backend/src/services/agentOrchestrator.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/agentOrchestrator.js).
- Keep it while the canonical execution path still needs direct operational control. Later it could be merged into `agents.js` or `risk.js`.

### `forex.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/forex`.
- No current frontend caller was found in the present dashboard, but it owns OANDA forex account, price, order, and history APIs via [backend/src/services/oandaForex.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/oandaForex.js).
- It remains part of the cross-asset trading scope and should stay until forex is explicitly out of product.

### `ml.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/ml`.
- No current frontend caller was found, but it exposes the direct ML inferencing API over [backend/src/services/mlPredictor.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/mlPredictor.js).
- The route still matters for backend-adjacent clients, manual operator calls, and future UI surfaces. It can be merged later with `training.js` if one AI API surface is preferred.

### `mt5.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/mt5`.
- Used by [src/dashboard/MT5Panel.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/MT5Panel.tsx) and [src/dashboard/SettingsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/SettingsPage.tsx).
- Owns saved MT5 connection CRUD plus status, account, positions, orders, history, and order placement.

### `notifications.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/notifications`.
- No current frontend caller was found in `src/`, but the route owns push-subscription CRUD, broadcast, and stats over [backend/src/services/notificationService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/notificationService.js).
- Keep it until push notifications are either removed from product scope or fully integrated into the UI. Later it could merge into a broader user-preferences surface.

### `options.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/options`, but no current frontend consumer was found.
- Depends on [backend/src/services/optionsTrading.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/optionsTrading.js) for pricing, greeks, IV, chain, and strategy analysis.
- This is a sizeable specialist surface with no visible product consumer. If options trading is not part of the current live plan, it should be trimmed.

### `patterns.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/patterns`.
- No current frontend consumer was found, but it owns manual access to [backend/src/services/patternScanner.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/patternScanner.js) and [backend/src/services/harmonicPatterns.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/harmonicPatterns.js).
- Keep it as an operator and test surface while scanners remain a first-class backend capability.

### `risk.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/risk`.
- No current frontend caller was found, but it owns portfolio-risk, position-sizing, pre-trade, limits, emergency-stop, and alert APIs over [backend/src/services/advancedRiskManager.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/advancedRiskManager.js).
- This is operationally important even if the present UI does not call it directly.

### `scanner.js`

Recommendation: `KEEP / MERGE LATER`

Proof:

- Mounted at `/api/scanner`.
- No current frontend caller was found, but it owns manual and read-only access to the live `assetScanner` instance exported from [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js).
- Keep it while scanner-driven opportunities remain part of the autonomous trading architecture. Later it could merge into `agents.js`.

### `signals.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/signals`.
- Used by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) through `getSignals`.
- Owns active and historical signal retrieval plus execution/copy actions around the [backend/src/models/Signal.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/Signal.js) model.

### `social.js`

Recommendation: `CONDITIONAL DELETE CANDIDATE`

Proof:

- Mounted at `/api/social`, but no current frontend consumer was found.
- Depends on [backend/src/services/socialTrading.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/socialTrading.js) for trader registration, copy relationships, provider signals, leaderboard, and stats.
- If social trading is not in the live rollout scope, this route is a cleanup candidate.

### `strategies.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/strategies`.
- Used by [src/dashboard/SettingsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/SettingsPage.tsx) through `getAvailableStrategies`, and exposed in [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts).
- Owns persisted strategy performance and strategy catalog exposure over [backend/src/services/strategies/index.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/strategies/index.js) and [backend/src/models/Strategy.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/models/Strategy.js).

### `trades.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/trades`.
- Used heavily by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) through trade listing, stats, create, and close flows.
- It is the core order and portfolio mutation surface, integrating `Trade`, `User`, `tradingEngine`, `MultiExchangeConnector`, MT5 services, and venue validation.

### `training.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/training`.
- Used by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) through start, apply, deploy-master, and generate-signal actions.
- Owns the current AI learning control surface over [backend/src/services/mlTrainingService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/mlTrainingService.js) and [backend/src/services/ensembleMasterStrategy.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/ensembleMasterStrategy.js).

### `user.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/user`.
- Used by [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) and [src/dashboard/SettingsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/SettingsPage.tsx).
- Owns profile, trading settings, auto-trading, paper-trading, exchange-key, and portfolio APIs backed by `User`, `Trade`, and portfolio recalculation utilities.

### `wallet.js`

Recommendation: `KEEP`

Proof:

- Mounted at `/api/wallet`.
- Used by [src/dashboard/WalletConnect.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/WalletConnect.tsx) and [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx).
- Owns WalletConnect-style session creation, signature verification, linking, tiers, subscription, paywall checks, features, and founder dashboard access.

## Deletion Guidance

Routes that are safe to remove immediately were not identified in this pass.

The six conditional delete candidates share the same blocker:

- they are mounted and syntactically live,
- they have domain-specific service dependencies,
- but no current frontend consumer was found in the present React app.

Before deleting any of them, verify:

1. no external clients call the endpoint,
2. no operator runbook or founder workflow depends on it,
3. the underlying service is also out of scope or has another owning route.
