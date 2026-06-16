#!/usr/bin/env bash
# ── TradeFlow AI — One-command deploy script ──────────────────────────────
# Usage:
#   ./deploy.sh              → Docker Compose (local / self-hosted)
#   ./deploy.sh --railway    → Railway CLI deploy
#   ./deploy.sh --build-only → Build frontend + backend, no deploy
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[TradeFlow]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

MODE="docker"
[[ "${1:-}" == "--railway" ]]    && MODE="railway"
[[ "${1:-}" == "--build-only" ]] && MODE="build"

RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-e53a768b-f8f8-4336-829c-6863c8b88d63}"
RAILWAY_APP_SERVICE="${RAILWAY_APP_SERVICE:-traderflow-ai}"
RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"

# ── Pre-flight checks ──────────────────────────────────────────────────────

log "TradeFlow AI deployment starting (mode: $MODE)"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    warn ".env not found — copying from .env.example"
    cp .env.example .env
    warn "Edit .env and set JWT_SECRET and MONGODB_URI before continuing."
    warn "Press Enter to continue anyway, or Ctrl+C to abort."
    read -r
  else
    fail ".env file required. Copy .env.example and fill in values."
  fi
fi

# Warn if JWT_SECRET is still the default
if grep -q "change-me" .env 2>/dev/null; then
  warn "JWT_SECRET looks like the default value — please change it before production use."
fi

# ── Step 1: Install frontend deps & build ──────────────────────────────────

log "Installing frontend dependencies…"
npm install --no-audit --no-fund --ignore-scripts
ok "Frontend dependencies installed"

log "Building frontend…"
npm run build
ok "Frontend built → dist/"

# ── Step 2: Install backend deps ──────────────────────────────────────────

log "Installing backend dependencies…"
(cd backend && npm install --no-audit --no-fund --omit=dev --ignore-scripts)
ok "Backend dependencies installed"

[[ "$MODE" == "build" ]] && { ok "Build complete. Run 'node backend/src/server.js' to start."; exit 0; }

# ── Step 3a: Docker Compose deploy ─────────────────────────────────────────

if [[ "$MODE" == "docker" ]]; then
  command -v docker >/dev/null 2>&1 || fail "Docker not found. Install Docker first."
  command -v docker-compose >/dev/null 2>&1 || \
    docker compose version >/dev/null 2>&1 || \
    fail "docker-compose not found."

  log "Building Docker image…"
  docker compose build
  ok "Image built"

  log "Starting services…"
  docker compose up -d
  ok "Services started"

  log "Waiting for health check…"
  sleep 5
  if docker compose ps | grep -q "healthy"; then
    ok "App is healthy!"
  else
    warn "Container may still be starting. Check with: docker compose logs -f app"
  fi

  echo ""
  ok "TradeFlow AI is running at http://localhost:3001"
  log "Logs: docker compose logs -f app"
  log "Stop: docker compose down"
  exit 0
fi

# ── Step 3b: Railway deploy ────────────────────────────────────────────────

if [[ "$MODE" == "railway" ]]; then
  command -v railway >/dev/null 2>&1 || fail "Railway CLI not found. Install: npm i -g @railway/cli"

  if ! railway whoami >/dev/null 2>&1; then
    fail "Railway CLI is not authenticated. Run: railway login"
  fi

  if ! grep -q '^MONGODB_URI=' .env 2>/dev/null; then
    warn "MONGODB_URI is not set in .env."
    warn "If Railway will host MongoDB, run: bash scripts/setup-railway-mongo.sh"
  fi

  log "Deploying to Railway…"
  railway link \
    --project "$RAILWAY_PROJECT_ID" \
    --service "$RAILWAY_APP_SERVICE" \
    --environment "$RAILWAY_ENVIRONMENT" >/dev/null
  railway up \
    --project "$RAILWAY_PROJECT_ID" \
    --service "$RAILWAY_APP_SERVICE" \
    --environment "$RAILWAY_ENVIRONMENT"
  ok "Deployed to Railway!"
  log "Check status: railway status"
  exit 0
fi
