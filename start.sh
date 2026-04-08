#!/usr/bin/env bash
# SwellStack — launch services with secrets injected from Bitwarden Secrets Manager.
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
#   - bws CLI installed and BWS_ACCESS_TOKEN set in shell
#   - docker compose v2 (for docker subcommands)

set -euo pipefail

if ! command -v bws &>/dev/null; then
  echo "ERROR: bws not found. Install from https://bitwarden.com/help/secrets-manager-cli/" >&2
  exit 1
fi

if [[ -z "${BWS_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: BWS_ACCESS_TOKEN is not set." >&2
  echo "  export BWS_ACCESS_TOKEN=<your machine account token>" >&2
  exit 1
fi

CMD="${1:-}"

case "$CMD" in
  api-dev)
    echo "→ Starting FastAPI dev server (port 8002)..."
    cd apps/api
    exec bws run -- uvicorn main:app --reload --port 8002
    ;;
  web-dev)
    echo "→ Starting Next.js dev server (port 3001)..."
    cd apps/web
    exec bws run -- pnpm dev
    ;;
  "")
    echo "→ Starting full stack via docker compose..."
    exec bws run -- docker compose up -d
    ;;
  *)
    echo "→ Running: docker compose $*"
    exec bws run -- docker compose "$@"
    ;;
esac
