#!/bin/bash
# =============================================================================
# renew-certs.sh — Cron-friendly Tailscale cert renewal.
#
# Checks if the cert expires within 30 days; renews it if so, then reloads
# nginx with zero downtime.
#
# Recommended crontab entry (crontab -e):
#   0 3 * * 1 /home/zach/nSwell/scripts/renew-certs.sh >> /var/log/swellstack-certs.log 2>&1
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_FILE="$SCRIPT_DIR/../nginx/certs/cert.pem"

# ── Check if renewal is needed (skip if cert is good for >30 days) ────────────
if [ -f "$CERT_FILE" ]; then
  if openssl x509 -checkend 2592000 -noout -in "$CERT_FILE" 2>/dev/null; then
    echo "$(date): Cert valid for >30 days, skipping renewal"
    exit 0
  fi
  echo "$(date): Cert expires soon, renewing..."
else
  echo "$(date): No cert found, running initial setup..."
fi

# ── Renew via setup-certs.sh ──────────────────────────────────────────────────
"$SCRIPT_DIR/setup-certs.sh"

# ── Reload nginx (zero-downtime — no full container restart) ──────────────────
if docker exec swellstack_nginx nginx -s reload 2>/dev/null; then
  echo "$(date): nginx reloaded with new cert"
else
  echo "$(date): WARNING: nginx reload failed — restart manually:"
  echo "$(date):   docker compose restart nginx"
fi
