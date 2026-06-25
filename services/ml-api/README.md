# TradeFlow ML API

This service is the first FastAPI sidecar for AI/ML workloads.

It is intended to stay internal-only. Express remains the public API and system
of record for auth, trades, persistence, WebSockets, and broker/exchange
execution.

## Scope

- price direction inference
- opportunity scoring
- volatility forecasting
- model metadata
- training job lifecycle
- signal generation for ensemble-style workflows

## Run locally

```bash
cd services/ml-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## First integration point

Wire [backend/src/clients/mlApiClient.js](/Users/gee/Documents/Documents_Gee/GitHub/traderflow-ai/backend/src/clients/mlApiClient.js) into:

- `backend/src/services/mlPredictor.js`
- `backend/src/services/mlTrainingService.js`

Keep the existing Express routes stable while moving the ML math behind this
service.
