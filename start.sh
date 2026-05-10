#!/usr/bin/env bash
# Koastcast — launch services. Reads secrets from .env automatically via docker compose.
#
# Usage:
#   ./start.sh              → docker compose up -d (full stack, detached)
#   ./start.sh logs -f      → docker compose logs -f
#   ./start.sh down         → docker compose down
#   ./start.sh restart api  → docker compose restart api
#
#   ./start.sh api-dev      → uvicorn (FastAPI hot-reload, port 8002)
#   ./start.sh web-dev      → pnpm dev (Next.js, port 3001)
#
# Requirements:
#   - .env file with secrets (copy .env.example and fill in values)
#   - docker compose v2

set -euo pipefail

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy .env.example and fill in your secrets." >&2
  exit 1
fi

CMD="${1:-}"

case "$CMD" in
  api-dev)
    echo "→ Starting FastAPI dev server (port 8002)..."
    cd apps/api
    exec uvicorn main:app --reload --port 8002
    ;;
  web-dev)
    echo "→ Starting Next.js dev server (port 3001)..."
    cd apps/web
    exec pnpm dev
    ;;
  "")
    echo "→ Starting full stack via docker compose..."
    exec docker compose up -d
    ;;
  *)
    echo "→ Running: docker compose $*"
    exec docker compose "$@"
    ;;
esac
