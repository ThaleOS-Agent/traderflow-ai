# TraderFlow AI

TraderFlow AI is a full-stack AI trading dashboard for market scanning, signals, paper/live trade execution, exchange and broker connections, WalletConnect authentication, MT4/MT5 connectivity, and portfolio monitoring.

The app is deployed as one Docker-backed service: Vite builds the React frontend, and the Express backend serves `/api/*`, `/ws`, and the compiled frontend from `dist/`.

## Features

- Founder, email, and wallet-based authentication flows
- Subscription and paywall-aware dashboard navigation
- Paper/live trading toggle
- Live signals, orders, market data, and portfolio feed over WebSockets
- Auto-execution engine with risk controls and strategy filters
- ML/AI prediction, scoring, training, and signal generation endpoints
- Exchange and broker connections for Binance, Coinbase, Kraken, KuCoin, Bybit, FTX, Gemini, Bitfinex, Interactive Brokers, and OANDA
- WalletConnect session flow plus MetaMask signing and verification
- MT4/MT5 connection management through bridge or MetaAPI providers
- Strategy, scanner, pattern, arbitrage, DEX, risk, backtest, forex, options, and social trading APIs
- Docker Compose local stack with MongoDB
- Railway CI/CD deployment using the included Dockerfile

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Three.js, Recharts, Lightweight Charts
- Backend: Node.js, Express, MongoDB/Mongoose, WebSocket, JWT auth
- Trading services: exchange REST connectors, MT5/MetaAPI integration, scanner, arbitrage, ML, risk, and auto-execution services
- Deployment: Docker, Docker Compose, Railway, GitHub Actions

## Repository Layout

```text
.
|-- src/                         # React frontend and dashboard
|   |-- dashboard/               # Auth, dashboard, exchange, MT5, wallet UI
|   |-- hooks/                   # WebSocket and frontend hooks
|   `-- sections/                # Landing page sections
|-- backend/
|   |-- src/routes/              # Express API routes
|   |-- src/services/            # Trading, ML, exchange, scanner, wallet services
|   |-- src/models/              # Mongoose models
|   `-- src/server.js            # Backend entrypoint
|-- Dockerfile                   # Production full-stack image
|-- docker-compose.yml           # Local app + MongoDB stack
|-- railway.json                 # Railway Docker deployment config
`-- DEPLOYMENT.md                # Deployment notes
```

## Prerequisites

- Node.js `>=20.19.0`
- npm `>=10.8.2`
- Docker and Docker Compose for the local full-stack stack
- MongoDB connection string for non-Docker development or production

## Environment Variables

Create a local `.env` for Docker Compose or backend runtime. Do not commit real secrets.

Required for production:

```text
MONGODB_URI=<mongodb connection string>
JWT_SECRET=<at least 32 random characters>
ENCRYPTION_KEY=<64 hex characters>
FRONTEND_URL=https://<your-domain>
NODE_ENV=production
```

Common optional variables:

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

Railway injects `PORT`; do not set it in Railway unless there is a specific reason.

## Local Development

Install frontend dependencies:

```bash
npm ci
```

Install backend dependencies:

```bash
npm --prefix backend ci
```

Run the frontend dev server:

```bash
npm run dev
```

Run the backend dev server:

```bash
npm run dev:backend
```

Build the frontend:

```bash
npm run build
```

Check the backend entrypoint:

```bash
node --check backend/src/server.js
```

## Docker Local Stack

Start the app and MongoDB:

```bash
docker compose up -d --build
```

Local app:

```text
http://localhost:3001
```

Health check:

```bash
curl http://localhost:3001/api/health
```

Stop the stack:

```bash
docker compose down
```

MongoDB data is stored on the host in `./.data/mongodb` and `./.data/mongodb-config` by default.
That makes local data survive container recreation and lets you move the storage paths with
`MONGODB_DATA_DIR` and `MONGODB_CONFIG_DIR`.

For a clean wipe of local Mongo data, remove those directories explicitly.

## Deployment

The supported production path is Railway using the Dockerfile.

For 24/7 reachability, production should use a managed persistent MongoDB service such as:

- Railway MongoDB attached to the app service
- MongoDB Atlas
- Another remotely hosted MongoDB cluster with backups and monitoring

Do not point production `MONGODB_URI` at `localhost`. The backend now rejects that configuration.

Required Railway service variables:

```text
MONGODB_URI=<mongodb atlas or railway mongodb connection string>
JWT_SECRET=<at least 32 random characters>
ENCRYPTION_KEY=<64 hex characters>
FRONTEND_URL=https://<your-railway-domain>
NODE_ENV=production
```

If Railway is hosting MongoDB for the app, create or attach it with:

```bash
railway login
RAILWAY_PROJECT_ID=e53a768b-f8f8-4336-829c-6863c8b88d63 \
RAILWAY_APP_SERVICE=traderflow-ai \
RAILWAY_MONGO_SERVICE=MongoDB \
bash scripts/setup-railway-mongo.sh
```

The helper script creates the Railway MongoDB service if needed and copies its connection string into the app service `MONGODB_URI` variable without echoing the secret value.

Recommended production posture for MongoDB:

- use a managed service, not a local file-backed database on the app host
- enable provider backups or snapshots
- keep connection strings in Railway variables, not in the repo
- verify the app service and Mongo service are in the same Railway project/environment

The current production Railway target is project `Tradeflow AI`, service `traderflow-ai`, environment `production`, with the database service named `MongoDB`.

Required GitHub secret for CI/CD:

```text
RAILWAY_TOKEN=<Railway project token>
```

Required GitHub repository variable:

```text
RAILWAY_PROJECT_ID=<Railway project id>
```

Optional GitHub repository variables:

```text
RAILWAY_SERVICE_NAME=traderflow-ai
RAILWAY_ENVIRONMENT=production
```

GitHub Actions validates frontend build, backend install, backend syntax, production dependency install, and Docker image build before deployment. See `DEPLOYMENT.md` for more details.

## API Surface

Major backend route groups:

- `/api/auth` - email auth and user session handling
- `/api/user` - profile, trading settings, portfolio, toggles
- `/api/dashboard` - dashboard overview, live feed, strategy and AI data
- `/api/exchange` - exchange/broker connection and market data helpers
- `/api/wallet` - WalletConnect, wallet verification, subscription helpers
- `/api/mt5` - MT4/MT5 account, order, position, and connection management
- `/api/signals` - generated signals and one-click execution
- `/api/trades` - trade CRUD, close/cancel, stats
- `/api/execution` - auto-execution config and manual opportunity execution
- `/api/ml` and `/api/training` - AI/ML prediction, scoring, training, and signal generation
- `/api/scanner`, `/api/patterns`, `/api/arbitrage`, `/api/risk`, `/api/backtest`, `/api/dex`, `/api/forex`, `/api/options`, `/api/social`

WebSocket clients connect to `/ws` for live events such as market data, signals, orders, trades, and portfolio updates.

## Trading Notes

- Paper trading is enabled by default and should be used for testing.
- Live trading requires active saved credentials for the selected exchange or broker.
- API keys are encrypted at rest before storage.
- Supported venue keys include `binance`, `coinbase`, `kraken`, `kucoin`, `bybit`, `ftx`, `gemini`, `bitfinex`, `interactive_brokers`, and `oanda`.
- Some legacy venues or third-party APIs may require their own account setup, sandbox access, account IDs, passphrases, or bridge services.

## Security

- Never commit `.env`, `.env.production`, private keys, API secrets, wallet secrets, or exchange credentials.
- Use strong `JWT_SECRET` and `ENCRYPTION_KEY` values in production.
- Keep paper trading on until live credentials and risk settings are validated.
- Review Railway and MongoDB access controls before production use.

## Disclaimer

TraderFlow AI is software for automation, research, and dashboard workflows. It is not financial advice. Trading involves risk, including loss of capital. Use paper trading and independent validation before enabling live execution.
