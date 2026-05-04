#!/bin/bash
# =============================================================================
# generate-certs.sh — Docker entrypoint hook (runs inside the nginx container)
#
# PRIMARY path: Let's Encrypt certs are obtained on the HOST via
#   scripts/setup-certs.sh (uses `tailscale cert`) and bind-mounted into the
#   container at /etc/nginx/certs/. This script validates they exist and prints
#   their expiry and type.
#
# FALLBACK path: If no certs are found (e.g. first boot before setup-certs.sh
#   has been run), this script generates a self-signed cert via openssl so nginx
#   can start. Browsers will show "Not Secure" until Tailscale certs are in place.
# =============================================================================

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

# ── Case 1: Certs already exist — detect type and report ──────────────────────
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2 || echo "unknown")
  ISSUER=$(openssl x509 -issuer -noout -in "$CERT_FILE" 2>/dev/null | grep -o 'O=[^,/]*' | head -1)

  if echo "$ISSUER" | grep -qi "Let's Encrypt"; then
    echo "[certs] Let's Encrypt cert (Tailscale) — browsers will show padlock"
  elif echo "$ISSUER" | grep -qi "mkcert"; then
    echo "[certs] mkcert cert — trusted on devices with rootCA installed"
  else
    echo "[certs] WARNING: Self-signed cert — browsers will show 'Not Secure'"
    echo "[certs]   Run ./scripts/setup-certs.sh to get a trusted cert via Tailscale"
  fi

  echo "[certs] Certificate expires: $EXPIRY"

  # Warn if expiring within 30 days
  if ! openssl x509 -checkend 2592000 -noout -in "$CERT_FILE" 2>/dev/null; then
    echo "[certs] WARNING: Certificate expires in less than 30 days — renew soon!"
    echo "[certs]          Re-run: ./scripts/renew-certs.sh"
  fi

  exit 0
fi

# ── Case 2: No certs found — generate self-signed fallback ────────────────────
echo ""
echo "[certs] ================================================================"
echo "[certs] No TLS certificates found in $CERT_DIR"
echo "[certs] For browser-trusted certs (no 'Not Secure' warning), run:"
echo "[certs]   ./scripts/setup-certs.sh   (on the NUC host, requires Tailscale)"
echo "[certs] Then restart nginx: docker compose restart nginx"
echo "[certs] ================================================================"
echo ""
echo "[certs] Falling back to self-signed cert for now..."

LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "192.168.1.100")
echo "[certs] Detected LAN IP: $LAN_IP"

mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 825 \
  -subj "/CN=nswell.local/O=nSwell/C=US" \
  -addext "subjectAltName=DNS:localhost,DNS:nswell.local,IP:127.0.0.1,IP:$LAN_IP" \
  2>/dev/null

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
echo "[certs] Self-signed cert generated (expires: $EXPIRY)"
echo "[certs] Run ./scripts/setup-certs.sh on the host to replace with a Tailscale cert."
