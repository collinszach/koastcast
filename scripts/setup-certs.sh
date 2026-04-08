#!/bin/bash
# =============================================================================
# setup-certs.sh — Run on the NUC host BEFORE starting docker compose.
# Uses Tailscale to get a real Let's Encrypt cert — no rootCA distribution needed.
# Every device on your tailnet trusts the cert automatically (MagicDNS).
#
# Usage:
#   chmod +x scripts/setup-certs.sh   # only needed once
#   ./scripts/setup-certs.sh
#
# Requirements:
#   - Tailscale installed and running on the NUC host
#   - MagicDNS enabled:          https://login.tailscale.com/admin/dns
#   - HTTPS Certificates enabled: https://login.tailscale.com/admin/dns
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CERT_DIR="$REPO_ROOT/nginx/certs"
mkdir -p "$CERT_DIR"

echo "=== SwellStack Tailscale certificate setup ==="
echo ""

# ── 1. Check tailscale is installed ───────────────────────────────────────────
if ! command -v tailscale &>/dev/null; then
  echo "ERROR: tailscale not installed or not in PATH"
  echo "  Install: https://tailscale.com/download/linux"
  exit 1
fi

# ── 2. Check tailscale is running ─────────────────────────────────────────────
if ! tailscale status &>/dev/null; then
  echo "ERROR: tailscale not running. Run: sudo tailscale up"
  exit 1
fi

# ── 3. Determine this machine's Tailscale FQDN ────────────────────────────────
TS_HOSTNAME=$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
name = d['Self']['DNSName'].rstrip('.')
print(name)
" 2>/dev/null)

if [ -z "$TS_HOSTNAME" ]; then
  echo "ERROR: Could not determine Tailscale hostname."
  echo "  Make sure MagicDNS is enabled in the Tailscale admin console:"
  echo "  https://login.tailscale.com/admin/dns"
  exit 1
fi

echo "Tailscale hostname: $TS_HOSTNAME"
echo ""
echo "Prerequisites (one-time in Tailscale admin console):"
echo "  https://login.tailscale.com/admin/dns"
echo "    → Enable MagicDNS"
echo "    → Enable HTTPS Certificates"
echo ""

# ── 4. Request / renew the Let's Encrypt cert via tailscale cert ──────────────
tailscale cert \
  --cert-file "$CERT_DIR/cert.pem" \
  --key-file  "$CERT_DIR/key.pem" \
  "$TS_HOSTNAME"

chmod 600 "$CERT_DIR/key.pem"
chmod 644 "$CERT_DIR/cert.pem"

EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_DIR/cert.pem" | cut -d= -f2)

echo ""
echo "=== Certs written ==="
echo "  cert: $CERT_DIR/cert.pem"
echo "  key:  $CERT_DIR/key.pem"
echo "  valid until: $EXPIRY"
echo ""
echo "SwellStack is accessible at: https://$TS_HOSTNAME:8443"
echo ""
echo "From any tailnet device — no certificate trust steps needed."
echo ""
echo "=== Next step ==="
echo "  docker compose restart nginx"
echo ""
echo "=== Auto-renewal ==="
echo "  Add to crontab (crontab -e) for weekly auto-renewal:"
echo "  0 3 * * 1 $SCRIPT_DIR/renew-certs.sh >> /var/log/swellstack-certs.log 2>&1"
