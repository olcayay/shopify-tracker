# Performance Analysis & Improvement Recommendations

**Date:** 2026-04-08
**Status:** Analysis complete, pending implementation

---

## Current Infrastructure Overview

| VM | Type | RAM | Role | Status |
|----|------|-----|------|--------|
| appranks-api (VM1) | e2-small | 2GB | API + Dashboard + Caddy + Alloy | On-demand |
| appranks-scraper (VM2) | e2-medium | 4GB | Worker + Interactive Worker + Alloy | Spot |
| appranks-email (VM3) | e2-custom-2-4096 | 4GB | Redis + Email Workers + Notifications + Alloy | On-demand |
| appranks-ai (VM4) | e2-small | 2GB | AI workers (placeholder) | Spot |
| Cloud SQL | db-f1-micro | 614MB | PostgreSQL 16 | Managed |

---

## Critical Issues

### 1. Cloud SQL db-f1-micro is Severely Undersized

**Problem:**
- 614MB RAM, shared vCPU, max ~25 connections
- All services (API, Workers, Email) share this tiny instance
- shared_buffers ~100MB — most queries hit disk instead of cache
- Under load, connection limit reached → new connections rejected

**Current connection usage at peak:**
- API pool: 5 connections
- Worker pool: 5 connections
- Email workers: 6 connections (3 services × 2 each)
- Health check: 1 connection
- **Total: ~17 / 25 max** — only 8 connections headroom

**Recommendation:** Upgrade to `db-custom-1-3840` (1 vCPU, 3.75GB RAM)
- max_connections increases to ~100
- shared_buffers ~1GB (10x improvement in cache hit ratio)
- File: `infra/terraform/cloud-sql.tf` → `tier = "db-custom-1-3840"`
- **Cost impact:** ~$30/ay → ~$50/ay

---

### 2. VM1 (API) Running Out of Memory

**Problem:**
- e2-small has only 2GB RAM
- Container allocations: API(1024M) + Dashboard(512M) + Alloy(256M) = 1.79GB
- Only ~200MB headroom for OS, Caddy, and spikes
- Risk: OOM kills under load, especially during large API responses

**Recommendation:** Upgrade to `e2-medium` (4GB RAM)
- File: `infra/terraform/vm-api.tf` → `machine_type = "e2-medium"`
- **Cost impact:** +~$10/ay

---

### 3. VM2 (Scraper) Memory Over-committed

**Problem:**
- VM has 4GB RAM
- Container allocations: Worker(3072M) + Interactive(1024M) + Alloy(256M) = 4.35GB
- **Allocated > Available** — guaranteed OOM kills
- Worker runs 11 concurrent Playwright browser jobs in 3GB

**Recommendation (Option A — cost neutral):**
- Reduce worker concurrency: 11 → 7
- Reduce worker memory limit: 3072M → 2048M
- Files:
  - `infra/compose/docker-compose-scraper.yml`: memory limit 2048M
  - `apps/scraper/src/constants.ts`: `BACKGROUND_WORKER_CONCURRENCY` → 7

**Recommendation (Option B — if throughput matters):**
- Upgrade VM to `e2-standard-4` (8GB RAM)
- Keep current concurrency settings

---

### 4. DB Connection Pool Too Small (max: 5)

**Problem:**
- API uses only 5 concurrent DB connections
- Under moderate load, requests queue waiting for a free connection
- Worker also limited to 5 connections with 11 concurrent jobs (2.2:1 contention ratio)

**Current configuration:**
```
API pool:    max: 5,  idle: 60s, statement_timeout: 30s
Worker pool: max: 5,  idle: 60s, statement_timeout: 60s
Email pools: max: 2 each (3 services)
```

**Recommendation (after Cloud SQL upgrade):**
- API pool: 5 → 15
- Worker pool: 5 → 8
- Files:
  - `apps/api/src/index.ts` (line ~84): `max: 15`
  - `apps/scraper/src/process-job.ts` (line ~44): `max: 8`

---

### 5. No Compression on Caddy Reverse Proxy

**Problem:**
- API uses `@fastify/compress` for API responses (good)
- But Dashboard (Next.js standalone) responses pass through Caddy without compression
- Static assets (JS bundles, CSS) served uncompressed = slower page loads

**Recommendation:** Enable compression in Caddyfile
- File: `infra/compose/Caddyfile` → add `encode gzip zstd`

---

## Code-Level Performance Issues (Future Phase)

These require code changes and should be addressed after infra fixes:

### 6. Loop-Based INSERT in Scraper (Biggest DB Bottleneck)

**Problem:**
- `apps/scraper/src/scrapers/category-scraper.ts` (lines 1072-1270)
- Functions `recordFeaturedSightings`, `recordFeaturedSightingsFromApps`, `recordNormalizedFeaturedSections`
- Each app is inserted individually in a loop: 100 apps = 300+ DB round trips

**Recommendation:** Use Drizzle batch insert: `db.insert(table).values([...array])`
- Expected improvement: 50-70% reduction in scrape duration

### 7. Missing Database Indexes

| Table | Missing Index | Benefit |
|-------|--------------|---------|
| app_snapshots | `(app_id, scraped_at DESC)` | Faster DISTINCT ON queries |
| categories | `(platform, is_listing_page)` | Faster category list queries |
| keyword_ad_sightings | `(app_id, seen_date DESC)` | Faster overview highlights |

### 8. No Caching for Authenticated Endpoints

**Problem:**
- Account-specific queries (tracked apps, keywords, overview) hit DB on every request
- Same user refreshing dashboard = repeated identical queries

**Recommendation:** Redis cache-aside with 5-15 minute TTL per account
- Files: `apps/api/src/routes/account-extras.ts`, `apps/api/src/routes/overview-highlights.ts`

### 9. Next.js Default SSR (No ISR)

**Problem:**
- All dashboard pages re-rendered on every request
- No Incremental Static Regeneration configured

**Recommendation:** Enable ISR for slow-changing pages (categories, public app profiles)

### 10. Repeated DISTINCT ON Queries for Latest Snapshot

**Problem:**
- `SELECT DISTINCT ON (app_id) ... FROM app_snapshots ORDER BY app_id, scraped_at DESC` repeated across many endpoints

**Recommendation:** Pre-computed `app_latest_snapshots` table updated after each scrape

---

## Impact & Cost Summary

### Infra Changes (Immediate)

| # | Change | Expected Impact | Monthly Cost |
|---|--------|----------------|--------------|
| 1 | Cloud SQL upgrade | DB throughput 3-5x, cache hit ratio 10x | +$20 |
| 2 | VM1 upgrade | API stability, no OOM risk | +$10 |
| 3 | VM2 memory fix | Eliminate OOM kills | $0 |
| 4 | Pool increase | Request latency 30-50% reduction | $0 |
| 5 | Caddy compression | Dashboard TTFB 15-25% reduction | $0 |
| | **Total** | | **+$30/ay** |

### Code Changes (Future)

| # | Change | Expected Impact | Cost |
|---|--------|----------------|------|
| 6 | Batch inserts | Scrape duration 50-70% reduction | $0 |
| 7 | DB indexes | Query latency 20-40% reduction | $0 |
| 8 | Auth caching | Eliminate repeated queries | $0 |
| 9 | Next.js ISR | Dashboard TTFB reduction | $0 |
| 10 | Latest snapshot table | Eliminate DISTINCT ON overhead | $0 |

---

## Verification Checklist

After infra changes:
- [ ] `/health/ready` returns healthy pool stats (idle > 0, active < max)
- [ ] `docker stats` on VM1 shows <70% memory usage
- [ ] `docker stats` on VM2 shows <90% memory usage
- [ ] `curl -H 'Accept-Encoding: gzip' -I https://appranks.io` returns `Content-Encoding: gzip`
- [ ] Grafana dashboard: request latency p95 < 500ms
- [ ] Grafana dashboard: DB connection pool utilization < 60%
- [ ] No OOM kills in `dmesg` or Docker logs for 24 hours
