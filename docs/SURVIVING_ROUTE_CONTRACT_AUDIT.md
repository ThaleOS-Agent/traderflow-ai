# TraderFlow AI Surviving Route Contract Audit

Date: 2026-06-25

Scope:

- surviving backend route files in `backend/src/routes`
- current frontend wrapper in [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts)
- current dashboard and landing-page consumers in `src/`

Method:

- verified mounted backend routes still present in [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js)
- compared route JSON shapes with `api.ts`
- checked consuming components for field expectations

## Fixed Mismatches

### 1. AI Learning model shape drift

Frontend expectation:

- [src/dashboard/index.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/index.tsx) renders `aiLearning.models` as rows with:
  - `assetType`
  - `opportunityScore`

Backend reality:

- [backend/src/routes/dashboard.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/dashboard.js) returns `models` from `mlPredictor.getPerformance()`.
- after the FastAPI split, the ML service exposes model metadata like `name`, `type`, `version`, and `description`, not the older dashboard-specific `{ assetType, opportunityScore, ... }` shape.

Fix applied:

- [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) now normalizes `/dashboard/ai-learning` into a stable frontend shape.
- this preserves the existing dashboard UI without forcing the backend route to fake old fields.

### 2. MT5 account summary identifier drift

Frontend expectation:

- [src/dashboard/SettingsPage.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/SettingsPage.tsx) expects `account.accountNumber`.
- [src/dashboard/MT5Panel.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/MT5Panel.tsx) expects a stable `connected` flag.

Backend reality:

- [backend/src/routes/mt5.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/mt5.js) returns account shapes that vary by source:
  - bridge
  - MetaAPI
  - mock
  - saved user MT account via `metatraderAccountService`
- account identity may arrive as `login`, `accountId`, or `configuredAccountId`, not `accountNumber`.

Fix applied:

- [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) now normalizes `/mt5/status` into:
  - `account.accountNumber`
  - `account.connected`

This removes source-specific MT5 branching from the UI layer.

### 3. Stale frontend health typing after DEX removal

Frontend expectation:

- `api.getHealth()` previously still typed a removed `dexIntegration` field.

Backend reality:

- the DEX batch was removed from [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js), including health wiring.

Fix applied:

- [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) no longer expects `dexIntegration`.
- optional `accountGatewayFlags` typing was added to align with the current health payload.

### 4. Wallet tiers wrapper typing was weaker than the route contract

Frontend expectation:

- `api.getTiers()` used a generic `Record<string, unknown>` return type.

Backend reality:

- [backend/src/routes/wallet.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/wallet.js) returns `{ success, tiers }`.

Fix applied:

- [src/dashboard/api.ts](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/dashboard/api.ts) now types `getTiers()` against the real route shape.

## Verified Aligned Contracts

These currently line up well enough for the present UI:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/user/trading-settings`
- `PUT /api/user/trading-settings`
- `POST /api/user/toggle-auto-trading`
- `POST /api/user/toggle-paper-trading`
- `GET /api/user/portfolio`
- `GET /api/trades`
- `GET /api/trades/stats/overview`
- `POST /api/trades`
- `POST /api/trades/:id/close`
- `GET /api/signals`
- `GET /api/strategies/available`
- `GET /api/dashboard/live-feed`
- `GET /api/dashboard/strategy-results`
- `GET /api/dashboard/ai-learning`
- `GET /api/agents/status`
- `GET /api/agents/events`
- `GET /api/wallet/connect`
- `GET /api/wallet/session/:sessionId`
- `POST /api/wallet/verify`
- `POST /api/wallet/link`
- `POST /api/wallet/disconnect`
- `GET /api/wallet/subscription`
- `GET /api/mt5/status`
- `GET /api/mt5/positions`
- `GET /api/mt5/connections`
- `POST /api/mt5/connections`
- `POST /api/mt5/connections/:id/activate`
- `DELETE /api/mt5/connections/:id`
- `GET /api/exchange/connections`
- `GET /api/exchange/capabilities`
- `GET /api/exchange/streaming/status`
- `GET /api/exchange/balance`
- `POST /api/exchange/connections`
- `POST /api/exchange/connections/:id/activate`
- `POST /api/exchange/connections/:id/deactivate`
- `DELETE /api/exchange/connections/:id`
- `GET /api/account-connections/monitor`
- `POST /api/account-connections`
- `POST /api/training/start`
- `POST /api/training/apply`
- `POST /api/training/deploy-master`
- `POST /api/training/generate-signal`

## Remaining Lower-Risk Gaps

### 1. `api.ts` still contains some broad `Record<string, unknown>` return types

This is not a runtime bug, but it weakens future refactor safety.

Most obvious candidates:

- `getDashboard`
- `getSignals`
- `getStrategies`
- `getPortfolio`
- `getExchangeConnection`
- `saveExchangeConnection`
- `saveAccountConnection`

### 2. MT5 route contract still varies by provider source

The wrapper now hides the largest UI problem, but the backend MT5 responses are still heterogeneous.

If you want to harden this further, normalize directly in:

- [backend/src/routes/mt5.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/mt5.js)
- [backend/src/services/metatraderAccountService.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/metatraderAccountService.js)

### 3. AI learning metrics are still presentation-derived

The wrapper now maps ML service metadata into dashboard-friendly summary rows, but those per-row percentages are heuristic placeholders, not model-native metrics.

If the dashboard needs true model performance cards, the better fix is:

- extend the FastAPI ML service to return dashboard-ready metrics explicitly
- then simplify the frontend normalization

## Verification

Passed after the wrapper fixes:

- `npm run lint`
- `npm run build`
