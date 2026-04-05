# Deployment Guide — AppRanks

**Last updated:** 2026-04-05
**Infrastructure:** GCP Tier 7 Light (4 VMs + Cloud SQL)
**Full architecture docs:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## Quick Start

```bash
# Deploy = just push to main
git push origin main
# GitHub Actions builds images (~30s cached) → deploys to 4 VMs (~40s) → health check
# Total: ~1-2 minutes
```

---

## Infrastructure Overview

| Service | VM | Technology | Domain / Port |
|---------|-----|-----------|---------------|
| **Dashboard** | VM1 (appranks-api) | Next.js 16 (standalone) | `https://appranks.io` / 3000 |
| **API** | VM1 (appranks-api) | Fastify 5 (Node.js 22) | `https://api.appranks.io` / 3001 |
| **Caddy** | VM1 (appranks-api) | Reverse proxy | :80 (Cloudflare handles SSL) |
| **Worker** | VM2 (appranks-scraper) | BullMQ + node-cron + Playwright | Internal only |
| **Worker-Interactive** | VM2 (appranks-scraper) | BullMQ (fast-path) | Internal only |
| **Redis** | VM3 (appranks-email) | Redis 7-alpine | `10.0.1.5:6379` (VPC only) |
| **Email Workers** | VM3 (appranks-email) | BullMQ (instant + bulk + notif) | Internal only |
| **AI Workers** | VM4 (appranks-ai) | Placeholder (Tier 6) | Internal only |
| **PostgreSQL** | Cloud SQL | PostgreSQL 16 (managed) | `10.218.0.3:5432` (private IP) |

**Hosting:** Google Cloud Platform — europe-west1
**Domain:** appranks.io (Namecheap DNS → Cloudflare)
**SSL:** Cloudflare (Flexible mode — CF terminates HTTPS, Caddy serves HTTP)
**CI/CD:** GitHub Actions → GHCR → SSH deploy

---

## Deployment Flow

```
git push main
    │
    ▼
GitHub Actions (.github/workflows/deploy.yml)
    │
    ├── build-and-push (~30s cached, ~10min first time)
    │   ├── Build 5 Docker images (native x86, layer cached)
    │   └── Push to ghcr.io/olcayay/appranks-*
    │
    └── deploy (~40s)
        ├── gcloud SSH (IAP tunnel) to each VM
        ├── docker compose pull + up -d
        └── Health check: curl https://api.appranks.io/health/live
```

### CI/CD Details

- **Auth:** GCP Workload Identity Federation (no SA key needed)
- **Image registry:** GitHub Container Registry (GHCR)
- **GHCR auth:** PAT token (`GHCR_PAT` secret)
- **Deploy method:** `gcloud compute ssh` with IAP tunnel for all 4 VMs
- **Cache:** Docker layer cache via `type=gha` — only changed layers rebuild

### GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `GHCR_PAT` | GitHub PAT with `write:packages` scope for GHCR push |
| `GCP_SSH_PRIVATE_KEY` | SSH key for VM access (legacy, not used in current deploy) |
| `GCP_PROJECT_ID` | `appranks-web-app` |
| `API_VM_IP` | `34.62.80.10` (legacy, not used in current deploy) |

---

## Manual Deploy

```bash
# Full deploy (all VMs)
./infra/scripts/deploy.sh

# Single VM deploy
./infra/scripts/deploy-one.sh api
./infra/scripts/deploy-one.sh scraper
./infra/scripts/deploy-one.sh email
./infra/scripts/deploy-one.sh ai
```

### SSH Access

```bash
# API VM (direct SSH — has external IP)
ssh -i ~/.ssh/appranks-gcp deploy@34.62.80.10
# Or shortcut:
./infra/scripts/ssh.sh api

# Other VMs (IAP tunnel — internal only)
./infra/scripts/ssh.sh scraper
./infra/scripts/ssh.sh email
./infra/scripts/ssh.sh ai
```

### Container Management (on any VM)

```bash
sudo docker ps                                      # list containers
sudo docker logs appranks-api-1 --tail 50           # view logs
sudo docker compose restart api                      # restart one service
sudo docker compose down && docker compose up -d     # full restart
sudo docker stats --no-stream                        # resource usage
```

---

## Dockerfiles

| Dockerfile | Image | VM | Base | Key Features |
|-----------|-------|-----|------|-------------|
| `Dockerfile.api` | appranks-api | VM1 | node:22-bookworm-slim | API + migration runner, Playwright for smoke tests |
| `Dockerfile.dashboard` | appranks-dashboard | VM1 | node:22-alpine | Next.js standalone, build-arg: `NEXT_PUBLIC_API_URL` |
| `Dockerfile.worker` | appranks-worker | VM2 | node:22-bookworm-slim | Playwright browsers, bg+scheduler+email workers |
| `Dockerfile.worker-interactive` | appranks-worker-interactive | VM2 | node:22-bookworm-slim | Playwright, single interactive queue |
| `Dockerfile.worker-email` | appranks-worker-email | VM3 | node:22-alpine | Lightweight, `WORKER_MODE` env selects worker type |

**Important:** Images must be built with `--platform linux/amd64` when building locally on Mac ARM.

---

## Environment Variables

Each VM has its own `.env` file at `/opt/appranks/.env`. Templates at `infra/compose/env/`.

### Shared across all VMs

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://postgres:PASS@10.218.0.3:5432/appranks` |
| `REDIS_URL` | `redis://10.0.1.5:6379` (Email VM) or `redis://localhost:6379` (on Email VM itself) |
| `NODE_ENV` | `production` |
| `SENTRY_DSN` | Sentry error tracking |
| `DASHBOARD_URL` | `https://appranks.io` |

### VM-specific

| Variable | VM | Description |
|----------|-----|-------------|
| `JWT_SECRET` | VM1 | JWT signing key (min 32 chars) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | VM1 | Auto-seed admin user |
| `OPENAI_API_KEY` | VM1, VM4 | OpenAI API access |
| `SMTP_HOST/PORT/USER/PASS/FROM` | VM1, VM2, VM3 | Gmail SMTP for email delivery |
| `VAPID_*` | VM3 | Web push notification keys |
| `SCRAPER_DELAY_MS` | VM2 | Delay between scrape requests |
| `GRAFANA_*` | All | Grafana Cloud monitoring |

---

## Database

### Cloud SQL (Managed)
- **Instance:** `appranks-db`, PostgreSQL 16, db-f1-micro
- **Access:** Private IP `10.218.0.3` (VPC only, no public IP)
- **Backup:** Daily 03:00 UTC, 7-day retention, PITR enabled
- **Console:** https://console.cloud.google.com/sql/instances/appranks-db?project=appranks-web-app

### Auto-Migration
API container runs pending Drizzle migrations on every startup via the `migrate` service.

### Auto-Seed
On first startup (no accounts), creates default account + admin user from env vars.

### Manual DB Access

```bash
# From API VM (recommended)
ssh -i ~/.ssh/appranks-gcp deploy@34.62.80.10
PGPASSWORD='...' psql 'postgresql://postgres@10.218.0.3:5432/appranks'

# From local (via Cloud SQL proxy)
cloud-sql-proxy appranks-web-app:europe-west1:appranks-db --port=15432 &
PGPASSWORD='...' psql 'postgresql://postgres@127.0.0.1:15432/appranks'
```

---

## Scheduler (Cron Jobs)

Runs on VM2 (Scraper) as part of the `worker` container.

| Job | Schedule (UTC) | Description |
|-----|---------------|-------------|
| category | `0 3 * * *` | Daily at 03:00 |
| app_details | `0 */6 * * *` | Every 6 hours |
| keyword_search | `0 0,12 * * *` | Every 12 hours |
| reviews | `0 6,18 * * *` | Every 12 hours |
| featured_apps | `0 4 * * *` | Daily at 04:00 |
| daily_digest | `0 5 * * *` | Daily at 05:00 (08:00 Istanbul) |

---

## DNS

Managed via Cloudflare (proxied):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `appranks.io` | `34.62.80.10` | Proxied |
| A | `api.appranks.io` | `34.62.80.10` | Proxied |

SSL/TLS mode: **Flexible** (Cloudflare → Caddy HTTP)

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Site down | API VM crash | `gcloud compute instances describe appranks-api` — auto-restart |
| Scraper not running | Spot VM preempted | `gcloud compute instances start appranks-scraper --zone=europe-west1-b` |
| Email delay | Email VM down or SMTP issue | `./infra/scripts/ssh.sh email` → check logs |
| DB connection error | Cloud SQL unreachable | Check GCP Console → SQL → Instance status |
| Redis unreachable | Email VM down | `./infra/scripts/ssh.sh email` → restart Redis |
| Deploy fails | GHCR auth expired | Update `GHCR_PAT` GitHub secret |
| ARM/AMD64 mismatch | Local build on Mac | Use `docker buildx build --platform linux/amd64` |
| Queue backlog | Worker preempted | Start VM + check `redis-cli llen bull:*:wait` |

For detailed troubleshooting: [SYSTEM_ARCHITECTURE.md → Section 7](./SYSTEM_ARCHITECTURE.md)

---

## Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | CI/CD: build → push GHCR → deploy to VMs |
| `infra/terraform/*.tf` | GCP infrastructure definitions |
| `infra/compose/docker-compose-*.yml` | Per-VM container definitions |
| `infra/compose/env/.env.*.example` | Environment variable templates |
| `infra/compose/Caddyfile` | Reverse proxy config (VM1) |
| `infra/scripts/deploy.sh` | Manual full deploy |
| `infra/scripts/ssh.sh` | SSH shortcuts |
| `files/SYSTEM_ARCHITECTURE.md` | Full architecture + troubleshooting |
| `files/GCP_TIER7_LIGHT_MIGRATION.md` | Migration guide + task tracker |
