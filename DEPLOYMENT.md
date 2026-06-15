# Deployment

## Recommended: Railway as one Docker service

This app is a full-stack service: Vite builds the frontend, and the Express backend serves both `/api/*`, `/ws`, and the compiled frontend from `dist/`.

Use Railway with the included `Dockerfile` and `railway.json`.

Required Railway variables:

```text
MONGODB_URI=<mongodb atlas or railway mongodb connection string>
JWT_SECRET=<at least 32 random characters>
ENCRYPTION_KEY=<64 hex characters>
FRONTEND_URL=https://<your-railway-domain>
NODE_ENV=production
```

Optional variables:

```text
BINANCE_API_KEY=
BINANCE_SECRET=
OANDA_API_KEY=
OANDA_ACCOUNT_ID=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
MT5_API_URL=
MT5_API_KEY=
MT5_METAAPI_TOKEN=
MT5_METAAPI_ACCOUNT_ID=
```

Do not set `PORT` on Railway unless you have a specific reason. Railway injects it automatically.

## CI/CD

GitHub Actions runs the CI/CD workflow in `.github/workflows/deploy.yml`.

On pull requests and pushes to `main`, it:

- installs frontend dependencies with `npm ci`
- builds the Vite frontend
- installs backend dependencies with `npm --prefix backend ci`
- syntax-checks `backend/src/server.js`
- validates the production backend install
- validates the Docker image build

On pushes to `main`, and manual `workflow_dispatch` runs, it deploys to Railway after CI passes.

Required GitHub repository secret:

```text
RAILWAY_TOKEN=<Railway account or project token>
```

Optional GitHub repository variable:

```text
RAILWAY_SERVICE_NAME=traderflow-ai
```

## Vercel

Vercel is fine for the static Vite frontend only:

```text
Build command: npm run build
Output directory: dist
```

For a split deployment, set the frontend variable:

```text
VITE_API_URL=https://<your-backend-domain>/api
```

The backend should still run on Railway, Render, Fly.io, a VPS, or another long-running Node host because it uses Express, WebSockets, scheduled scanners, and persistent trading services.

## Local checks

```bash
npm run build
npm --prefix backend ci --dry-run --ignore-scripts --no-audit --no-fund --omit=dev
```
