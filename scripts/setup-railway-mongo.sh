#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[Railway Mongo]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

APP_SERVICE="${RAILWAY_APP_SERVICE:-traderflow-ai}"
MONGO_SERVICE="${RAILWAY_MONGO_SERVICE:-mongodb}"
PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"

command -v railway >/dev/null 2>&1 || fail "Railway CLI not found. Install with: npm i -g @railway/cli"
command -v jq >/dev/null 2>&1 || fail "jq is required for JSON parsing."

if ! railway whoami >/dev/null 2>&1; then
  fail "Railway CLI is not authenticated. Run: railway login"
fi

PROJECT_ARGS=()
if [[ -n "$PROJECT_ID" ]]; then
  PROJECT_ARGS+=(--project "$PROJECT_ID")
fi

ENV_ARGS=(--environment "$ENVIRONMENT")

log "Ensuring Railway project context is available..."
if [[ -n "$PROJECT_ID" ]]; then
  railway link --project "$PROJECT_ID" --environment "$ENVIRONMENT" >/dev/null 2>&1 || true
  ok "Linked project context using RAILWAY_PROJECT_ID."
else
  railway status >/dev/null 2>&1 || fail "No linked Railway project. Run: railway link --project <project-id> --environment $ENVIRONMENT"
  ok "Using linked Railway project."
fi

log "Checking for existing MongoDB service..."
services_json="$(railway service list "${PROJECT_ARGS[@]}" "${ENV_ARGS[@]}" --json)"
if echo "$services_json" | jq -e --arg name "$MONGO_SERVICE" '.[] | select(.name == $name)' >/dev/null; then
  ok "MongoDB service '$MONGO_SERVICE' already exists."
else
  log "Creating Railway MongoDB service '$MONGO_SERVICE'..."
  railway add --database mongo --service "$MONGO_SERVICE" "${PROJECT_ARGS[@]}" --json >/dev/null
  ok "MongoDB service created."
fi

log "Reading MongoDB service variables..."
mongo_vars="$(railway variable list --service "$MONGO_SERVICE" "${PROJECT_ARGS[@]}" "${ENV_ARGS[@]}" --json)"
source_key="$(echo "$mongo_vars" | jq -r '
  if has("MONGODB_URI") then "MONGODB_URI"
  elif has("MONGO_URL") then "MONGO_URL"
  elif has("MONGO_URI") then "MONGO_URI"
  elif has("DATABASE_URL") then "DATABASE_URL"
  elif has("DATABASE_PUBLIC_URL") then "DATABASE_PUBLIC_URL"
  else empty end
')"

[[ -n "$source_key" ]] || fail "Could not find a Mongo connection variable on service '$MONGO_SERVICE'. Inspect with: railway variable list --service $MONGO_SERVICE"

mongo_uri="$(echo "$mongo_vars" | jq -r --arg key "$source_key" '.[$key] // empty')"
[[ -n "$mongo_uri" && "$mongo_uri" != "null" ]] || fail "Mongo connection variable '$source_key' is empty."

log "Setting MONGODB_URI on app service '$APP_SERVICE' from '$MONGO_SERVICE:$source_key'..."
printf '%s' "$mongo_uri" | railway variable set MONGODB_URI --stdin --service "$APP_SERVICE" "${PROJECT_ARGS[@]}" "${ENV_ARGS[@]}" >/dev/null
ok "MONGODB_URI set on app service."

cat <<EOF

Next Railway variables for the app service:
  JWT_SECRET
  ENCRYPTION_KEY
  FRONTEND_URL
  NODE_ENV=production

Recommended verification:
  railway variable list --service "$APP_SERVICE"
  railway up --service "$APP_SERVICE"
  railway status
EOF
