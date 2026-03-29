# Observability: Logging & Metrics

## Overview

AppRanks uses **Grafana Cloud (Free Tier)** for centralized log aggregation and metrics visualization. Logs and metrics are collected by **Grafana Alloy** agent running as a Docker container on the production server and shipped to Grafana Cloud's Loki (logs) and Prometheus (metrics) endpoints.

This setup is **hosting-agnostic** — it works regardless of where the containers run (Coolify, Docker Compose, Kubernetes, etc.). Only the Alloy container + env vars are needed.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Production Server (5.78.101.102)                   │
│                                                     │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ │
│  │   API   │ │ Worker │ │Worker-I│ │  Dashboard  │ │
│  │  :3001  │ │        │ │        │ │   :3000     │ │
│  └────┬────┘ └───┬────┘ └───┬────┘ └─────┬───────┘ │
│       │          │          │             │         │
│       │   stdout/stderr (JSON logs)       │         │
│       └──────────┼──────────┼─────────────┘         │
│                  │          │                        │
│            ┌─────▼──────────▼─────┐                  │
│            │    Grafana Alloy     │                  │
│            │  (Docker container)  │                  │
│            └──────────┬───────────┘                  │
│                       │                             │
└───────────────────────┼─────────────────────────────┘
                        │ HTTPS
              ┌─────────▼──────────┐
              │   Grafana Cloud    │
              │  ┌──────┐ ┌─────┐ │
              │  │ Loki │ │Prom │ │
              │  │(logs)│ │(met)│ │
              │  └──────┘ └─────┘ │
              │  ┌──────────────┐ │
              │  │  Dashboards  │ │
              │  └──────────────┘ │
              └────────────────────┘
```

## Components

### 1. Application Logger (`packages/shared/src/logger.ts`)

Custom structured JSON logger used by all services (API, Worker, Worker-Interactive).

```typescript
import { createLogger } from "@appranks/shared";
const log = createLogger("my-module");

log.info("Something happened", { key: "value" });
log.error("Something failed", { error: err.message });
```

**Log format (JSON):**
```json
{"level":"info","time":"2026-03-29T14:00:00.000Z","msg":"Something happened","module":"my-module","key":"value"}
```

**Log levels:** `debug`, `info`, `warn`, `error`
**Configuration:** `LOG_LEVEL` env var (default: `info`)
**Output:** stdout (info/warn/debug), stderr (error)

### 2. Prometheus Metrics (`apps/api/src/utils/metrics.ts`)

API exposes Prometheus-format metrics at `GET /metrics`.

**Available metrics:**

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, route, status | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | — | Request latency |
| `scraper_jobs_total` | Counter | type, status | Scraper job counts |
| `db_query_duration_seconds` | Histogram | — | Database query latency |
| `active_users_total` | Gauge | — | Current active users |

**Auth:** In production, requires either:
- System admin JWT token, or
- `METRICS_BEARER_TOKEN` bearer token (used by Alloy)

### 3. Grafana Alloy (Log & Metrics Shipper)

Lightweight agent that:
- **Logs:** Auto-discovers Docker containers via Docker socket, collects their stdout/stderr, parses JSON, and ships to Grafana Cloud Loki
- **Metrics:** Auto-discovers the API container (port 3001) and scrapes `/metrics` every 60s, remote-writes to Grafana Cloud Prometheus

**Config file:** `config/alloy.river` (in repo, for reference/docker-compose deploys)
**Production config:** `/opt/alloy/config.alloy` (on the server)

**Log processing pipeline:**
1. Docker container discovery (`discovery.docker`)
2. Label extraction: container name, compose service name
3. Filtering: drops Alloy's own logs and Coolify infra containers
4. JSON parsing: extracts `level`, `msg`, `module` fields
5. Label enrichment: adds `level` and `module` as Loki labels
6. Static labels added: `env=production`, `project=appranks`
7. Ships to Grafana Cloud Loki

**Metrics pipeline:**
1. Docker service discovery: finds container with port 3001 (API)
2. Scrapes `GET /metrics` with bearer token auth
3. Remote-writes to Grafana Cloud Prometheus

## Grafana Cloud

**Plan:** Free tier (50GB logs/month, 10K metrics series)
**Stack name:** `appranks`
**Dashboard URL:** https://appranks.grafana.net

### Data Sources

| Name | Type | URL | User ID |
|------|------|-----|---------|
| `grafanacloud-appranks-logs` | Loki | `https://logs-prod-042.grafana.net` | `1533744` |
| `grafanacloud-appranks-prom` | Prometheus | `https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom` | `3076138` |

Other data sources (`alert-state-history`, `usage-insights`, `usage`) are Grafana internal — do not modify.

### Access Policy

- **Policy name:** `alloy-appranks`
- **Token name:** `alloy-appranks-alloy-appranks-token`
- **Scopes:** `metrics:write`, `logs:write`
- **Realm:** `appranks (all stacks)`
- **Manage at:** grafana.com → My Account → Security → Access Policies

## Environment Variables

### Alloy Container

| Variable | Value | Description |
|----------|-------|-------------|
| `GRAFANA_LOKI_URL` | `https://logs-prod-042.grafana.net/loki/api/v1/push` | Loki push endpoint |
| `GRAFANA_LOKI_USER` | `1533744` | Loki instance ID |
| `GRAFANA_PROMETHEUS_URL` | `https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom/push` | Prometheus remote write endpoint |
| `GRAFANA_PROM_USER` | `3076138` | Prometheus instance ID |
| `GRAFANA_CLOUD_TOKEN` | `glc_eyJ...` | Cloud access policy token (shared for Loki + Prometheus) |
| `METRICS_BEARER_TOKEN` | `qpbOExuh...` | Token to authenticate against API `/metrics` endpoint |

### API Container

| Variable | Value | Description |
|----------|-------|-------------|
| `METRICS_BEARER_TOKEN` | `qpbOExuh...` | Same token — API validates this on `/metrics` requests |

## Production Deployment

### Current Setup (Coolify)

Alloy runs as a **standalone Docker container** (not managed by Coolify):

```bash
# Container name: alloy
# Network: coolify (same network as all app containers)
# Config: /opt/alloy/config.alloy
# Memory limit: 256MB
# Restart policy: always
```

### Starting/Restarting Alloy

```bash
ssh root@5.78.101.102

# Check status
docker ps -f name=alloy
docker logs alloy --tail 50

# Restart
docker restart alloy

# Full recreate (if config changed)
docker rm -f alloy
docker run -d \
  --name alloy \
  --restart always \
  --network coolify \
  -v /opt/alloy/config.alloy:/etc/alloy/config.alloy:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e GRAFANA_LOKI_URL=https://logs-prod-042.grafana.net/loki/api/v1/push \
  -e GRAFANA_LOKI_USER=1533744 \
  -e GRAFANA_PROMETHEUS_URL=https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom/push \
  -e GRAFANA_PROM_USER=3076138 \
  -e 'GRAFANA_CLOUD_TOKEN=<token>' \
  -e 'METRICS_BEARER_TOKEN=<token>' \
  --memory 256m \
  grafana/alloy:v1.5.1 \
  run /etc/alloy/config.alloy --stability.level=generally-available
```

### Updating Alloy Config

1. Edit `/opt/alloy/config.alloy` on the server (or update `config/alloy.river` in repo and SCP it)
2. Restart the container: `docker restart alloy`

### After Server Migration

When migrating to a new hosting platform:

1. Copy `config/alloy.river` to the new server as `/opt/alloy/config.alloy`
2. If using Docker Compose (not Coolify), the `alloy` service in `docker-compose.prod.yml` is ready — just set env vars
3. If running standalone, use the `docker run` command above
4. Ensure the Alloy container is on the **same Docker network** as the app containers
5. Update the Alloy config's container discovery rules if the network/naming convention changes

## Querying Logs (Grafana Cloud)

### Basic LogQL Queries

```logql
# All AppRanks logs
{project="appranks"}

# API logs only
{project="appranks", container=~"skws4sc.*"}

# Error logs only
{project="appranks"} | level="error"

# Worker logs with specific module
{project="appranks"} | module="scheduler"

# Search for specific text
{project="appranks"} |= "database error"

# JSON field extraction and filtering
{project="appranks"} | json | level="error" | msg=~".*timeout.*"

# Log volume over time
sum(rate({project="appranks"}[5m])) by (container)
```

### Useful PromQL Queries (Metrics)

```promql
# Request rate (req/sec)
rate(http_requests_total[5m])

# Error rate (5xx percentage)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request count by status code
sum by (status) (increase(http_requests_total[1h]))

# Scraper job success rate
rate(scraper_jobs_total{status="success"}[1h]) / rate(scraper_jobs_total[1h]) * 100
```

## Grafana Cloud Dashboard Prompt

Use the Grafana Assistant with this prompt to auto-generate a dashboard:

```
I have a Node.js application (AppRanks) sending logs via Grafana Alloy to Loki
and metrics to Prometheus.

Logs are structured JSON with these labels: container, level (debug, info, warn,
error), module, env=production, project=appranks.

Metrics are in Prometheus format: http_requests_total (method, route, status),
http_request_duration_seconds (histogram), scraper_jobs_total,
db_query_duration_seconds, active_users_total.

Please create a dashboard with:
1. Log volume over time (grouped by container and level)
2. Error logs panel (level=error, filterable by container)
3. Request rate (requests/sec from http_requests_total)
4. Error rate (5xx percentage)
5. P95 latency from http_request_duration_seconds
6. Scraper job success/failure counts
```

## Other Observability Components

### Sentry (Error Tracking)

- **Status:** Code ready, needs `SENTRY_DSN` env var to activate
- **Location:** `apps/api/src/index.ts` (init), worker processes
- **Sample rate:** 10% (`tracesSampleRate: 0.1`)

### Health Checks

| Endpoint | Type | Description |
|----------|------|-------------|
| `GET /health/live` | Liveness | Always responds 200 (for load balancer) |
| `GET /health/ready` | Readiness | Checks DB + Redis connectivity |
| `GET /health` | Legacy | Same as `/health/ready` |

## Files Reference

| File | Description |
|------|-------------|
| `packages/shared/src/logger.ts` | Structured JSON logger implementation |
| `apps/api/src/utils/metrics.ts` | Prometheus metrics collection |
| `apps/api/src/utils/logging.ts` | Fastify log config + Grafana dashboard template |
| `apps/api/src/index.ts` | Metrics endpoint, Sentry init |
| `apps/api/src/middleware/auth.ts` | `/metrics` public path config |
| `config/alloy.river` | Alloy config (repo reference copy) |
| `docker-compose.prod.yml` | Alloy service definition |
| `.env.example` | All observability env vars |

## Troubleshooting

### Alloy not sending logs

1. Check Alloy is running: `docker ps -f name=alloy`
2. Check logs: `docker logs alloy --tail 50`
3. Verify network: `docker network inspect coolify` — Alloy must be on the same network
4. Verify Docker socket mount: `docker inspect alloy --format '{{.Mounts}}'`

### "timestamp too old" errors

Normal on first startup — Alloy tries to replay old Docker logs. Grafana Cloud free tier rejects logs older than 7 days. These errors stop once all old logs are processed.

### Metrics not appearing

1. Check API `/metrics` is accessible: `curl -H "Authorization: Bearer <METRICS_BEARER_TOKEN>" http://localhost:3001/metrics`
2. Check Alloy can reach API: they must be on the same Docker network
3. Verify `METRICS_BEARER_TOKEN` matches in both API and Alloy env vars

### Token expired or revoked

1. Go to grafana.com → My Account → Security → Access Policies
2. Find `alloy-appranks` policy → Add new token
3. Update `GRAFANA_CLOUD_TOKEN` in Alloy container env and restart
