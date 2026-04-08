# SwellStack NUC Setup Guide
## First-Run Checklist for Your Intel NUC

---

## 1. Prerequisites

```bash
# Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Cloudflare tunnel client
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

---

## 2. Cloudflare Tunnel Setup (Free)

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create swellstack
# This prints a tunnel ID — save it

# Create DNS route
cloudflared tunnel route dns swellstack api.yourdomain.com

# Get tunnel token for docker-compose
cloudflared tunnel token swellstack
# Copy this → paste as CLOUDFLARE_TUNNEL_TOKEN in .env
```

---

## 3. Download LLM Model

```bash
# Download Phi-4-mini quantized (2.5GB) — runs on CPU, ~4GB RAM
mkdir -p models
wget -O models/phi-4-mini-q4_k_m.gguf \
  https://huggingface.co/microsoft/Phi-4-mini-instruct-gguf/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf

# Verify
ls -lh models/phi-4-mini-q4_k_m.gguf
# Should show ~2.5GB
```

---

## 4. Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_TUNNEL_TOKEN
# Generate NUC_API_SECRET:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 5. Start Everything

```bash
# First run: build images
docker-compose build

# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f

# Verify health
curl http://localhost:8000/health
# → {"status": "ok", "version": "0.1.0"}

# Test from internet (after tunnel is up)
curl https://api.yourdomain.com/health
```

---

## 6. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Seed initial spot data
supabase db seed
```

---

## 7. Download Historical NDBC Data (one-time, ~30 min)

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run download
cd ml
uv run python download_ndbc_history.py
# Downloads ~2GB of historical buoy data to data/ndbc_historical/
```

---

## 8. Train Initial Models

```bash
cd ml
uv run python train_bias_correction.py --spots all
# Creates models in apps/api/models/ml/
# Restart API container to load new models:
docker-compose restart api
```

---

## 9. Set Up Auto-Restart on Boot

```bash
# Create systemd service for docker-compose
sudo tee /etc/systemd/system/swellstack.service << EOF
[Unit]
Description=SwellStack Surf Forecasting
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/home/YOUR_USER/swellstack
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=always
User=YOUR_USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable swellstack
sudo systemctl start swellstack
```

---

## 10. Monitor Resource Usage

```bash
# Check NUC resource usage
docker stats

# Typical baseline:
# open-meteo: ~200MB RAM, 5-10% CPU (when ingesting)
# api: ~300MB RAM, 1-3% CPU (idle)
# llm: ~3.5GB RAM, 0% CPU (idle, spikes on query)
# cloudflared: ~30MB RAM, 0.1% CPU

# Total: ~4.5GB RAM — NUC needs at least 8GB
```

---

## Troubleshooting

### NUC loses internet / power
```bash
# Services auto-restart via docker-compose restart: unless-stopped
# Cloudflare tunnel reconnects automatically
# No data loss (Supabase is cloud-hosted)
```

### Open-Meteo not pulling new data
```bash
docker-compose logs open-meteo-api
# Check if DWD/ECMWF data is downloading
```

### LLM too slow on old NUC
```bash
# Reduce context size and threads in docker-compose.yml:
# --ctx-size 2048 --threads 2
# Or swap to smaller model: tinyllama-1.1b-q4_k_m.gguf (~700MB, faster)
```

### Emergency fallback if NUC is offline
```bash
# Point NUC_API_BASE_URL in Vercel to open-meteo.com cloud API
# Loses: ML corrections, spectral data, NLQ, SWAN
# Keeps: basic forecasts from Open-Meteo cloud (still accurate for height/period)
```
