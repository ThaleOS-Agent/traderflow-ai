# TraderFlow AI Service Ownership Audit For Conditional Delete Candidates

Date: 2026-06-24

Scope:

- `arbitrage.js` / `arbitrageDetector.js`
- `audit.js`
- `backtest.js` / `enhancedBacktestEngine.js`
- `dex.js` / `dexIntegration.js`
- `options.js` / `optionsTrading.js`
- `social.js` / `socialTrading.js`

Purpose:

- decide whether to remove only the route file,
- or retire the underlying service as well,
- based on runtime ownership, current consumers, initialization cost, and implementation quality.

## Decision Summary

### Remove Route Only, Keep Service For Now

- `arbitrage.js`

### Remove Route And Service Together

- `backtest.js` + `enhancedBacktestEngine.js`
- `dex.js` + `dexIntegration.js`
- `options.js` + `optionsTrading.js`
- `social.js` + `socialTrading.js`

### Remove Route Only, No Service Retirement Needed

- `audit.js`

## Candidate Findings

### 1. Arbitrage

Files:

- [arbitrage.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/arbitrage.js)
- [arbitrageDetector.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/arbitrageDetector.js)

Recommendation:

- `Remove route only for now`
- `Keep service if autonomous arbitrage detection remains part of backend runtime`

Proof of continued service ownership:

- [backend/src/server.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/server.js) initializes `arbitrageDetector` during bootstrap.
- The health payload exposes `arbitrageDetector` status and `arbitrageOpportunities` count.
- [backend/src/services/agentOrchestrator.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/agentOrchestrator.js) registers the arbitrage role in orchestration state.
- [src/sections/MarketingLanding.tsx](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/src/sections/MarketingLanding.tsx) shows the health status for arbitrage.

Proof that the route is weak:

- No current React dashboard consumer calls `/api/arbitrage`.
- `POST /api/arbitrage/execute` is explicitly simulated, not real execution.
- `GET /api/arbitrage/exchanges` is a static hardcoded list rather than live service output.

Decision logic:

- The route is optional operational surface.
- The service still has backend runtime ownership because it is initialized, monitored, and tied into orchestration.
- If you later decide arbitrage is out of product scope entirely, then remove both the route and the service and also strip `server.js` bootstrap, health, export, and orchestrator role references.

Status:

- `2026-06-25`: route removal approved; keep `arbitrageDetector.js` in runtime.

### 2. Audit

Files:

- [audit.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/audit.js)

Recommendation:

- `Remove route only`

Proof:

- The route has no dedicated underlying service.
- It exposes one admin-only database audit endpoint over `mongoose`, `User`, `Trade`, `Signal`, and `Strategy`.
- No current frontend consumer was found.
- No runtime bootstrap or orchestration path depends on it.

Decision logic:

- This is the cleanest deletion candidate in the set because removing it does not orphan any service.

### 3. Backtest

Files:

- [backtest.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/backtest.js)
- [enhancedBacktestEngine.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/enhancedBacktestEngine.js)

Recommendation:

- `Remove route and service together`

Proof that service ownership is weak:

- No current frontend consumer calls `/api/backtest`.
- `enhancedBacktestEngine` is imported and re-exported from `server.js`, but it is not initialized in bootstrap and does not contribute to the health endpoint.
- Route ownership is the primary active consumer of the service.

Implementation weakness:

- `POST /api/backtest/run` returns success immediately before the actual backtest completes, which is not a production-grade job contract.
- The route comment says results "could emit" via WebSocket, which confirms the async workflow is unfinished.
- The service pulls historical data ad hoc via `MultiExchangeConnector('binance', true)` rather than through a dedicated historical-data subsystem.

Decision logic:

- This looks like an unfinished operator tool, not a productized subsystem.
- If backtesting is not in the live rollout, retire both files together.
- Also remove the `enhancedBacktestEngine` import/export from `server.js`.

### 4. DEX

Files:

- [dex.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/dex.js)
- [dexIntegration.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/dexIntegration.js)

Recommendation:

- `Remove route and service together`

Proof of current ownership pattern:

- `server.js` bootstraps `dexIntegration` and exposes its initialization state in `/api/health`.
- No current React dashboard consumer calls `/api/dex`.
- Outside `server.js` health/bootstrap and `dex.js`, no other backend service uses `dexIntegration`.

Implementation weakness:

- Ethereum RPC URLs are hardcoded with `YOUR_INFURA_KEY` placeholders.
- Pool info is a simplified stub rather than real on-chain state.
- The route accepts `walletConfig` for swaps, which conflicts with the repo’s stronger backend-side credential handling patterns elsewhere.

Decision logic:

- This service adds startup work and dependency surface without a current product owner.
- Because the implementation still contains placeholder infrastructure and partial stubs, it is better to retire the service with the route than keep a half-live subsystem in production.
- If DEX support returns later, it should be rebuilt around proper secret management and explicit chain provider config.

Required follow-up if removed:

- Remove the `dexIntegration` import, health field, bootstrap initialization, and export from `server.js`.

### 5. Options

Files:

- [options.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/options.js)
- [optionsTrading.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/optionsTrading.js)

Recommendation:

- `Remove route and service together`

Proof of current ownership pattern:

- No current frontend consumer calls `/api/options`.
- `optionsTradingService` is imported and re-exported from `server.js`, but it is not initialized in bootstrap and does not appear in health.
- No other backend service depends on it.

Implementation character:

- The service is self-contained math tooling for Black-Scholes, Greeks, IV, chain generation, and strategy payoff analysis.
- It behaves like a calculator library rather than a core production trading subsystem.

Decision logic:

- If options analytics is not in the current shipped product, carrying both the route and singleton service adds maintenance cost for no active value.
- If you want to preserve the code for future reuse, it would be cleaner to archive it out of the production service surface rather than keep it mounted.

Required follow-up if removed:

- Remove the `optionsTradingService` import/export from `server.js`.

### 6. Social

Files:

- [social.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/routes/social.js)
- [socialTrading.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/services/socialTrading.js)

Recommendation:

- `Remove route and service together`

Proof of current ownership pattern:

- No current frontend consumer calls `/api/social`.
- `socialTradingService` is only referenced by `social.js` plus `server.js` import/export.
- No bootstrap initialization, health reporting, or orchestrator ownership exists for it.

Implementation weakness:

- Core state is held in in-memory `Map` objects for trader profiles, copy relationships, signals, and copied trades.
- Only some operations persist to MongoDB; much of the feature state is process-local and would not survive restart or multi-instance deployment.
- That makes it a poor fit for live production without a persistence redesign.

Decision logic:

- This is the strongest route-plus-service retirement candidate after `options`.
- The absence of frontend ownership plus the in-memory state model means keeping it in the production repo creates false surface area and operational risk.

Required follow-up if removed:

- Remove the `socialTradingService` import/export from `server.js`.

## Final Recommended Action Order

1. Remove `audit.js`.
2. Remove `backtest.js` and `enhancedBacktestEngine.js`.
3. Remove `options.js` and `optionsTrading.js`.
4. Remove `social.js` and `socialTrading.js`.
5. Remove `dex.js` and `dexIntegration.js`, then strip DEX bootstrap and health wiring from `server.js`.
6. Decide whether arbitrage remains part of the autonomous runtime.

If `yes`:

- keep `arbitrageDetector.js`
- remove only `arbitrage.js`

If `no`:

- remove both `arbitrage.js` and `arbitrageDetector.js`
- strip arbitrage bootstrap, health fields, export, and orchestrator role plumbing

## Safe Deletion Boundaries

The following can be removed without first replacing a current React UI surface:

- `audit.js`
- `backtest.js`
- `enhancedBacktestEngine.js`
- `options.js`
- `optionsTrading.js`
- `social.js`
- `socialTrading.js`
- `dex.js`
- `dexIntegration.js`

The following should not be removed unless the autonomous arbitrage capability itself is explicitly dropped:

- `arbitrageDetector.js`
