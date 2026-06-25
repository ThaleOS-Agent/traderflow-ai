# Deployment

## Recommended: Railway as one Docker service

This app is a full-stack service: Vite builds the frontend, and the Express backend serves both `/api/*`, `/ws`, and the compiled frontend from `dist/`.

Use Railway with the included `Dockerfile` and `railway.json`.

Current production target:

```text
Project: Tradeflow AI
Project ID: e53a768b-f8f8-4336-829c-6863c8b88d63
Environment: production
App service: traderflow-ai
MongoDB service: MongoDB
URL: https://traderflow-ai-production.up.railway.app
```

Current production replica policy:

```text
App replicas: 1
Reason: WebSocket order, trade, and portfolio events currently use in-memory broadcast only.
Increase replicas again only after shared pub/sub fanout is added.
```

Required Railway service variables:

```text
MONGODB_URI=<mongodb atlas or railway mongodb connection string>
JWT_SECRET=<at least 32 random characters>
ENCRYPTION_KEY=<64 hex characters>
FRONTEND_URL=https://<your-railway-domain>
NODE_ENV=production
```

Production MongoDB policy:

- `MONGODB_URI` must point to a persistent managed MongoDB service
- do not use `localhost`, `127.0.0.1`, or `::1` in production
- prefer Railway MongoDB or MongoDB Atlas for 24/7 availability
- ensure backups/snapshots are enabled at the provider level

### Railway MongoDB helper

If you want Railway to host MongoDB for this app, use the included helper after Railway CLI login:

```bash
railway login
RAILWAY_PROJECT_ID=e53a768b-f8f8-4336-829c-6863c8b88d63 \
RAILWAY_APP_SERVICE=traderflow-ai \
RAILWAY_MONGO_SERVICE=MongoDB \
bash scripts/setup-railway-mongo.sh
```

What it does:

- verifies Railway auth and project context
- creates a Railway MongoDB service if one does not already exist
- reads the Mongo connection variable from that service
- sets `MONGODB_URI` on the app service without printing the raw secret

What it does not do:

- it does not create backups for you
- it does not make a localhost Mongo deployment production-safe
- it does not override the app if `MONGODB_URI` is later replaced with a non-persistent value

After that, make sure the app service also has:

```text
JWT_SECRET
ENCRYPTION_KEY
FRONTEND_URL
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
RAILWAY_TOKEN=<Railway project token>
```

The workflow reads Railway's project token variable, `RAILWAY_TOKEN`.
If you use an account or workspace token instead, configure the workflow and
secret name explicitly for that token type before deploying.

Required GitHub repository variable:

```text
RAILWAY_PROJECT_ID=<Railway project id>
```

Optional GitHub repository variables:

```text
RAILWAY_SERVICE_NAME=traderflow-ai
RAILWAY_ENVIRONMENT=production
```

## Production Domain

Use Cloudflare DNS to point the production hostname to the Railway service domain.
The app is deployed as one Railway Docker service so the frontend, `/api/*`,
`/ws`, scheduled scanners, and persistent trading services stay on the same
long-running Node host.

## Local checks

```bash
npm run build
npm --prefix backend ci --dry-run --ignore-scripts --no-audit --no-fund --omit=dev
```

## Local Docker Mongo persistence

`docker-compose.yml` stores MongoDB data on the host by default:

```text
./.data/mongodb
./.data/mongodb-config
```

Override those paths with:

```text
MONGODB_DATA_DIR=/absolute/path/to/mongodb-data
MONGODB_CONFIG_DIR=/absolute/path/to/mongodb-config
```

This is suitable for local durability, but it is not the recommended 24/7 production path.
