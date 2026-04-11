# Peakcast Runbook
## NUC Operations & Incident Response

---

## 1. NUC Goes Offline

### Symptoms
- `https://api.peakcast.app/health` returns timeout or connection refused
- Frontend shows "Forecast unavailable" on all spot pages
- Vercel logs show `fetch` failures to `NUC_API_BASE_URL`

### Immediate response (< 5 min)

```bash
# From any machine with SSH access to the NUC:
ssh user@nuc-local-ip

# Check if Docker is running
docker ps

# If containers are stopped (secrets injected from Bitwarden):
./start.sh
# or: BWS_ACCESS_TOKEN=<token> ./start.sh

# Verify health
curl http://localhost:8000/health
```

### If the NUC has no internet (power cycle, ISP down)

The Cloudflare tunnel reconnects automatically once internet is restored.
No manual action needed — wait up to 2 minutes after connectivity returns.

```bash
# Check tunnel status
docker logs peakcast_tunnel --tail 50
```

### Emergency fallback — point to Open-Meteo cloud

If the NUC will be offline for >1 hour, switch Vercel to use the public
Open-Meteo cloud API as a degraded-mode backend:

1. Go to Vercel dashboard → Peakcast project → Settings → Environment Variables
2. Set `NUC_API_BASE_URL` to `https://api.open-meteo.com`
3. Redeploy (or wait for next deploy)

**Degraded mode loses:** ML bias correction, spectral data, NLQ, SWAN, optimal windows
**Keeps:** basic wave height/period/wind forecasts (still accurate for planning)

Revert when NUC is back online.

---

## 2. Open-Meteo Container Not Pulling Data

### Symptoms
- Forecasts are stale (>6 hours old)
- `docker logs peakcast_open_meteo` shows download errors

```bash
# Check Open-Meteo logs
docker logs peakcast_open_meteo --tail 100

# Restart the container
docker-compose restart open-meteo-api

# Verify it can fetch data
curl "http://localhost:8080/v1/marine?latitude=37.5&longitude=-122.5&hourly=wave_height"
```

If ECMWF data is not available (happens occasionally with 0-day models):
Open-Meteo will fall back to GFS automatically. No action needed.

---

## 3. LLM / AskPeak Not Responding

### Symptoms
- AskPeak returns "rule-based" responses only
- `docker logs peakcast_llm` shows OOM or startup failures

```bash
# Check LLM container
docker logs peakcast_llm --tail 50
docker stats peakcast_llm

# Restart if OOM
docker-compose restart llm

# Check model file exists
ls -lh models/phi-6-mini-q6_k_l.gguf
# Should show ~2.5GB
```

### If NUC RAM is tight (< 1GB free)

Reduce context size in `docker-compose.yml`:
```yaml
command: >
  -m /models/phi-6-mini-q6_k_l.gguf
  --ctx-size 2048    # reduced from 4096
  --threads 2        # reduced from 4
```

Then restart: `docker-compose restart llm`

The rule-based fallback in `services/llm.py` handles all NLQ queries
when llama.cpp is unavailable, so the feature degrades gracefully.

---

## 4. Database / Supabase Issues

### Symptoms
- Auth broken (can't log in)
- Session data not saving
- Spots not loading

Supabase is cloud-hosted — most issues are Supabase-side, not ours.

```bash
# Check Supabase status
open https://status.supabase.com

# Test API connection
curl -H "apikey: YOUR_ANON_KEY" \
  "https://YOUR_PROJECT.supabase.co/rest/v1/spots?select=name&limit=1"
```

If Supabase is up but data isn't loading:
```bash
# Check API logs for DB errors
docker logs peakcast_api --tail 100 | grep -i "error\|exception"
```

### TimescaleDB compression issues

If queries are slow (>5s):
```sql
-- Run in Supabase SQL editor
SELECT * FROM timescaledb_information.compression_settings;
-- Re-enable compression if needed
SELECT compress_chunk(i) FROM show_chunks('buoy_observations', older_than => INTERVAL '7 days') i;
```

---

## 5. Forecast Data is Stale

### Symptoms
- Forecast shows same data for >7 hours
- `generated_at` field is old

```bash
# Manually trigger a forecast update
docker exec peakcast_api python -c "
import asyncio
from scheduler.jobs import update_forecasts
asyncio.run(update_forecasts())
"

# Check when last forecast was generated
# (Run in Supabase SQL editor)
# SELECT spot_id, MAX(generated_at) FROM spot_forecasts GROUP BY spot_id ORDER BY 2 DESC;
```

---

## 6. Buoy Data Missing

### Symptoms
- Buoy observations table has gaps
- Spectral data not updating

```bash
# Manually trigger buoy fetch
docker exec peakcast_api python -c "
import asyncio
from scheduler.jobs import update_buoy_data
asyncio.run(update_buoy_data())
"

# Check NDBC directly
curl "https://www.ndbc.noaa.gov/data/realtime2/46026.txt" | head -5
```

NDBC occasionally has delays. Data typically arrives 20–30 minutes past the hour.
If a buoy is offline on NDBC's end, the scheduler logs a warning and moves on.

---

## 7. High Memory Usage on NUC

### Expected baseline (all services running)
| Service | RAM |
|---|---|
| open-meteo | ~200MB |
| api | ~300MB |
| llm (idle) | ~3.5GB |
| cloudflared | ~30MB |
| **Total** | **~4.1GB** |

NUC needs ≥8GB RAM. If memory pressure is causing issues:

```bash
# Check usage
docker stats --no-stream

# Reduce LLM context to free ~500MB
# Edit docker-compose.yml: --ctx-size 2048

# If Open-Meteo is caching too much:
docker-compose restart open-meteo-api
```

---

## 8. Stripe Webhook Failures

### Symptoms
- Users pay but subscription tier doesn't update
- Vercel logs show webhook signature errors

```bash
# Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Check webhook logs in Stripe dashboard
open https://dashboard.stripe.com/webhooks
```

If the webhook secret is wrong, update `STRIPE_WEBHOOK_SECRET` in Vercel env vars
and redeploy.

**Manual tier upgrade** (emergency — user paid but tier not updated):
```sql
-- Run in Supabase SQL editor
UPDATE user_profiles
SET subscription_tier = 'pro'  -- or 'explorer'
WHERE user_id = 'USER_UUID_HERE';
```

---

## 9. Deploy a Frontend Update

```bash
# Deploy is automatic on push to main — Vercel handles it
git push origin main

# Check deploy status
open https://vercel.com/dashboard

# If a deploy needs to be rolled back:
# Vercel dashboard → Deployments → select previous → Promote to Production
```

---

## 10. Run Database Migrations

```bash
# Apply all pending migrations
supabase db push --linked

# Check which migrations have been applied
supabase migration list

# If a migration fails, check for conflicts:
supabase db diff
```

---

## 11. Rotate API Secrets

```bash
# Generate new NUC API secret
python3 -c "import secrets; print(secrets.token_hex(32))"

# Update in:
# 1. NUC .env: NUC_API_SECRET=<new>
# 2. Vercel env vars: NUC_API_SECRET=<new>
# 3. Supabase secrets: supabase secrets set NUC_API_SECRET=<new>
# Restart API: docker-compose restart api
```

---

## 12. Backup Procedures

All critical data is in Supabase (cloud) — no local backup needed for user data.

NDBC historical data (in `data/ndbc_historical/`) can be re-downloaded:
```bash
cd ml && uv run python download_ndbc_history.py
```

Trained models (in `apps/api/models/ml/`) can be retrained:
```bash
cd ml && uv run python train_bias_correction.py --spots all
```

---

## 13. TLS / HTTPS

### How it works

Nginx uses TLS certificates stored in `./nginx/certs/` (bind-mounted into the
container). The **recommended** approach uses **Tailscale** to get a real
Let's Encrypt cert — every tailnet device trusts it automatically with no
rootCA distribution.

Port 80 redirects to HTTPS. Port 443 terminates TLS.

---

### Recommended: Tailscale (real Let's Encrypt cert, zero trust setup)

**Prerequisites (one-time in Tailscale admin console):**
1. Enable MagicDNS: https://login.tailscale.com/admin/dns
2. Enable HTTPS Certificates: same page (toggle below MagicDNS)

```bash
# One-time cert setup (run from repo root on the NUC host)
chmod +x scripts/setup-certs.sh
./scripts/setup-certs.sh
docker compose restart nginx
```

The script writes `nginx/certs/cert.pem` and `nginx/certs/key.pem` (Let's Encrypt,
90-day validity, issued for your `<hostname>.tail12345.ts.net` FQDN).

**Access Peakcast from any tailnet device — no certificate trust steps needed:**
```
https://<nuc-hostname>.tail12345.ts.net:8443
```

**Auto-renewal (weekly cron):**

```bash
chmod +x scripts/renew-certs.sh

# Add to crontab: crontab -e
0 3 * * 1 /home/zach/nSwell/scripts/renew-certs.sh >> /var/log/peakcast-certs.log 2>&1
```

The renewal script is a no-op if the cert has more than 30 days remaining;
it reloads nginx with zero downtime when it does renew.

---

### Fallback: self-signed cert (automatic, "Not Secure" in browsers)

If `./nginx/certs/` is empty when the nginx container starts, `generate-certs.sh`
(the Docker entrypoint hook) automatically generates a self-signed cert so nginx
can start. Browsers will show "Not Secure" until Tailscale certs are in place.

This is intentional — the app always starts, even before `setup-certs.sh` is run.

---

### Public access: Tailscale Funnel (replaces Cloudflare Tunnel)

Tailscale Funnel can expose Peakcast to the public internet:

```bash
# Serve port 8443 publicly (one-shot, stops when you Ctrl-C)
tailscale funnel --bg 8443

# App is now publicly accessible at: https://<hostname>.tail12345.ts.net
# (no port number — Funnel terminates at 443 externally)

# Make it permanent across reboots:
tailscale funnel --bg --set-path / 8443
```

---

### Force regenerate certificates

```bash
# Remove existing certs and restart
docker compose stop nginx
rm -f ./nginx/certs/cert.pem ./nginx/certs/key.pem

# Tailscale (recommended):
./scripts/setup-certs.sh
docker compose up -d nginx

# Self-signed fallback (no Tailscale):
docker compose up -d nginx   # entrypoint regenerates automatically
```

### Check certificate expiry and type

```bash
# View expiry dates
openssl x509 -in ./nginx/certs/cert.pem -noout -dates

# Check issuer (Let's Encrypt certs show "O = Let's Encrypt")
openssl x509 -in ./nginx/certs/cert.pem -noout -issuer

# Full details
openssl x509 -in ./nginx/certs/cert.pem -noout -text | grep -A5 "Issuer\|Validity\|Subject Alternative"
```

---

## 14. Supabase Email (Custom SMTP)

### Why this matters
Supabase's built-in email is rate-limited to **3 emails/hour** on the free tier and frequently lands in spam. Configure custom SMTP so every magic-link login, email verification, and password reset is reliable.

### Option A: Google Workspace (recommended if you have a Google Workspace account)

**Requirements:** A Google Workspace account (paid, ~$6/month). Cannot use personal @gmail.com accounts — Google disabled SMTP for personal Gmail in 2022 unless you use App Passwords.

**Steps:**
1. In Google Admin Console → Apps → Google Workspace → Gmail → End User Access, enable **Allow less secure apps** (Workspace only) OR use an App Password
2. In **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**:
   - Enable custom SMTP
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: `your-workspace-email@yourdomain.com`
   - Password: your Google Workspace password (or App Password)
   - Sender email: `noreply@yourdomain.com`
   - Sender name: Peakcast`
3. Click **Save** and **Send test email**

**App Password method (more secure, works with 2FA):**
1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Generate a new App Password for "Mail" + "Other device" → name it "Supabase"
3. Use the 16-character App Password as the SMTP password

### Option B: Personal Gmail with App Password

**Requirements:** 2-Step Verification enabled on your Google account.

**Steps:**
1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Create an App Password: select "Mail" + "Other (Custom name)" → name it "Supabase SMTP"
3. Copy the 16-character password (shown once)
4. In **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: `your@gmail.com`
   - Password: the 16-character App Password (no spaces)
   - Sender email: `your@gmail.com`
   - Sender name: Peakcast`
5. **Note:** Gmail caps outbound SMTP at 500 emails/day — fine for early-stage apps

### Option C: Resend (best for production / custom domain)

Best deliverability, easiest domain verification, 3,000 emails/month free.

1. Create account at https://resend.com → get an API key
2. Add and verify your domain (or use sandbox for testing)
3. In Supabase SMTP Settings:
   - Host: `smtp.resend.com`, Port: `465`
   - Username: `resend`, Password: your Resend API key
   - Sender: `noreply@yourdomain.com`

### Verify it's working
1. Go to your app's login page, enter your email, request a magic link
2. Check inbox (and spam folder first time)
3. Supabase Dashboard → Authentication → Logs shows email send attempts and errors

### Common issues
| Symptom | Fix |
|---|---|
| "Email rate limit exceeded" | You're on built-in SMTP — configure custom SMTP above |
| Emails in spam | Add SPF/DKIM records (Google/Resend dashboard guides you) |
| "Username and Password not accepted" | For Gmail: you need an App Password, not your regular password |
| "Connection refused" on port 465 | Switch to port 587 with STARTTLS |
| "Invalid login credentials" | Check for trailing spaces in the API key/password |

---

## Quick Reference

```bash
# All services status
docker-compose ps

# Restart everything
docker-compose restart

# Full restart (after config change)
docker-compose down && docker-compose up -d

# View all logs live
docker-compose logs -f

# View specific service
docker-compose logs -f api

# Check API health
curl http://localhost:8000/health
curl https://api.peakcast.app/health

# Force forecast update
docker exec peakcast_api python -c "import asyncio; from scheduler.jobs import update_forecasts; asyncio.run(update_forecasts())"

# Force buoy update
docker exec peakcast_api python -c "import asyncio; from scheduler.jobs import update_buoy_data; asyncio.run(update_buoy_data())"
```
