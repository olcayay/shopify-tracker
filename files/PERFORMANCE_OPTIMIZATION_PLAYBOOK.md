# Performance Optimization Playbook

**Created:** 2026-04-20
**Last Updated:** 2026-04-20

This document captures lessons learned from optimizing page load times across the AppRanks dashboard. It serves as a reference for diagnosing and fixing slow pages in the future.

---

## Table of Contents

1. [Diagnosis Workflow](#1-diagnosis-workflow)
2. [Common Root Causes](#2-common-root-causes)
3. [Fix Patterns](#3-fix-patterns)
4. [Benchmarking on Production](#4-benchmarking-on-production)
5. [Case Studies](#5-case-studies)
6. [Infrastructure Constraints](#6-infrastructure-constraints)
7. [Prevention Checklist](#7-prevention-checklist)

---

## 1. Diagnosis Workflow

### Step 1: Identify the slow request

Open the browser Network tab and find the slowest request:
- **`?_rsc=` requests** — Next.js RSC (React Server Component) data. These are SSR page loads.
- **`api.appranks.io/api/...` requests** — Direct API calls from client-side components.

### Step 2: Determine if the bottleneck is API or SSR

```bash
# Test API endpoint directly on the server (internal, no Cloudflare)
ssh -i ~/.ssh/appranks-gcp deploy@34.62.80.10
TOKEN=$(docker exec appranks-api-1 node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'test',accountId:'ACCOUNT_ID',role:'admin',isSystemAdmin:true},process.env.JWT_SECRET,{expiresIn:'5m'}))")
curl -s "http://localhost:3001/api/ENDPOINT" -H "Authorization: Bearer $TOKEN" -o /dev/null -w "time: %{time_total}s\n"
```

- If internal API is fast (<500ms) but page is slow → **SSR waterfall** or **network overhead**
- If internal API is slow → **database query issue**

### Step 3: Benchmark individual queries

Create a Node.js script to time each query independently:

```javascript
// /tmp/bench.js — copy to container and run
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL);
async function time(label, fn) {
  const s = Date.now();
  const r = await fn();
  console.log(`${label}: ${Date.now()-s}ms`);
  return r;
}
(async () => {
  await time("query name", () => sql`SELECT ...`);
  await sql.end();
})();
```

```bash
scp -i ~/.ssh/appranks-gcp /tmp/bench.js deploy@34.62.80.10:/tmp/
ssh deploy@34.62.80.10 'docker cp /tmp/bench.js appranks-api-1:/app/bench.js && docker exec -w /app appranks-api-1 node bench.js'
```

### Step 4: Use EXPLAIN ANALYZE for slow queries

```javascript
const explain = await sql`EXPLAIN (ANALYZE, BUFFERS) SELECT ...`;
for (const r of explain) console.log(r['QUERY PLAN']);
```

Look for:
- **Seq Scan** on large tables → needs an index or query rewrite
- **Bitmap Heap Scan with high `read` count** → data not in cache, index not covering
- **Sort Method: external merge Disk** → result too large for memory, spilling to disk
- **Nested Loop** with high `loops` count → correlated subquery executing per-row

---

## 2. Common Root Causes

### 2.1. Network Overhead (SSR going through Cloudflare)

**Symptom:** Internal API is fast (15ms) but page takes seconds.

**Cause:** SSR fetches use `NEXT_PUBLIC_API_URL=https://api.appranks.io` which routes through:
`Dashboard container → Cloudflare → Caddy → API container`
Even though both containers are on the same VM.

**Fix:** Set `API_INTERNAL_URL=http://api:3001` in dashboard container env. Server-side `api.ts` prefers this:
```typescript
const API_BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
```

**Impact:** ~105ms savings per request. A page with 13 API calls saves ~1.4s.

### 2.2. N+1 API Call Pattern

**Symptom:** Page makes 10+ separate API calls for related data.

**Cause:** Fetching data per-item instead of batching. Example: fetching changes for each of 10 competitors separately.

**Fix options:**
- Create a **batch endpoint** that returns all data in one call (e.g., `/changes-feed`)
- Use existing batch parameters (e.g., `includeChanges=true` on competitors endpoint)
- Use `Promise.all` to at least parallelize the calls

### 2.3. SSR Waterfall (Sequential Awaits)

**Symptom:** Page has multiple `await` statements that could run in parallel.

**Example (before):**
```typescript
const showAds = await shouldShowAds(caps);           // 100ms
const features = await Promise.all([...flags]);       // 100ms
const app = await getApp(slug, platform);             // 130ms
const [reviews, rankings, ...] = await Promise.all([...]);  // 465ms
// Total: 795ms sequential
```

**Fix:** Merge into single `Promise.all`:
```typescript
const [app, showAds, ...features, reviews, rankings, ...] = await Promise.all([
  getApp(slug, platform),
  shouldShowAds(caps),
  ...featureFlags,
  getAppReviews(...),
  getAppRankings(...),
]);
// Total: 465ms (slowest single call)
```

### 2.4. DISTINCT ON on Large Tables

**Symptom:** Query takes 10+ seconds on tables with millions of rows.

**Cause:** `DISTINCT ON (app_id, keyword_id) ... ORDER BY scraped_at DESC` forces PostgreSQL to sort the entire filtered result set, often spilling to disk.

**Diagnostic:** Look for `Sort Method: external merge Disk` in EXPLAIN ANALYZE.

**Fix options (in order of effectiveness):**
1. **Remove unnecessary filters** — e.g., `position IS NOT NULL` forces heap access if position isn't in the index. Removing it allows index-only scan (850ms → 107ms).
2. **Use correlated subquery** — `SELECT (SELECT COUNT(DISTINCT kw) FROM rankings WHERE app_id = a.id) FROM apps a WHERE a.id IN (...)` does per-row index scans instead of one massive sort (15s → 427ms).
3. **Replace DISTINCT ON with simple aggregation** — if you only need a count, `COUNT(DISTINCT keyword_id)` avoids the sort entirely (11s → 1.3s).
4. **Scope the query** — filter to only the app IDs you need, not all apps on the platform.

### 2.5. Heavy Endpoint Called for Lightweight Needs

**Symptom:** A page only needs slug strings but calls an endpoint that runs 16 SQL queries.

**Examples:**
- Similar page calling `/account/competitors` (16 queries, 17s) just for slug badges
- Platform overview calling full competitors endpoint just for icon/name/rating

**Fix options:**
- Create a **lightweight endpoint** (e.g., `/competitor-slugs` — single query, returns string[])
- Add a **`fields` parameter** to existing endpoints (e.g., `?fields=basic` skips heavy queries)

### 2.6. DB Connection Pool Exhaustion

**Symptom:** Queries are fast individually but slow when run in parallel. Parallel execution is slower than sequential.

**Cause:** Cloud SQL db-f1-micro has max 25 connections, pool size is 10. Running 11+ queries in Promise.all exhausts the pool — queries queue waiting for a free connection.

**Benchmark pattern:**
```
Wave1 (4 parallel): 670ms ✓
Wave2 (4 parallel): 140ms ✓  
Wave3 (4 parallel): 13,000ms ✗  ← pool exhausted, queries waiting
Wave3 (sequential): 450ms ✓  ← same queries, no contention
```

**Fix:** Split parallel queries into waves of max 3-4 queries. Keep the heaviest queries sequential.

### 2.7. Next.js Link Prefetch Storm

**Symptom:** 50+ `?_rsc=` requests on page load.

**Cause:** Next.js `<Link>` components eagerly prefetch RSC data for all visible links.

**Fix:** Created `@/components/ui/link.tsx` wrapper that defaults `prefetch={false}`. All imports use this wrapper. ESLint rule + vitest lint test prevent direct `next/link` imports.

---

## 3. Fix Patterns

### Pattern: Batch Endpoint

When a page needs data from multiple related items, create a single endpoint:

```typescript
// Instead of: 1 (self) + 10 (competitors) = 11 API calls
// Create: /api/apps/:slug/changes-feed
// Returns: { selfChanges: [...], competitorChanges: { [slug]: [...] } }
// Runs 2-3 SQL queries internally, all in parallel
```

### Pattern: fields=basic Parameter

Add to existing heavy endpoints to skip expensive queries:

```typescript
const isBasic = request.query.fields === "basic";

// Skip when basic:
if (competitorAppIds.length > 0 && !isBasic) {
  // power scores, category rankings, visibility, etc.
}
```

### Pattern: Server-side Cache (cacheGet)

For data that rarely changes but is expensive to compute:

```typescript
import { cacheGet } from "../utils/cache.js";

const result = await cacheGet(
  `cache-key:${accountId}:${platform}`,
  () => expensiveQuery(),
  TTL_SECONDS
);
```

### Pattern: Scoped Queries

Scope queries to only the data the user needs:

```typescript
// Before: scan ALL platform apps (50K rows)
WHERE a2.platform = ${platform}

// After: scan only tracked + competitor apps (~100 rows)
WHERE s.app_id IN (${accountAppIds})
```

---

## 4. Benchmarking on Production

### Quick endpoint timing
```bash
TOKEN=$(docker exec appranks-api-1 node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({...},process.env.JWT_SECRET,{expiresIn:'5m'}))")
curl -s "http://localhost:3001/api/ENDPOINT" -H "Authorization: Bearer $TOKEN" -o /dev/null -w "time: %{time_total}s\n"
```

### Internal vs external comparison
```bash
# Internal (Docker network): ~15ms
curl -s "http://localhost:3001/api/..." -o /dev/null -w "%{time_total}s"
# External (Cloudflare): ~120ms
curl -s "https://api.appranks.io/api/..." -o /dev/null -w "%{time_total}s"
```

### Full SSR page timing
```bash
curl -s "http://localhost:3000/shopify/apps/v1/APP_SLUG" \
  -H "Cookie: access_token=$TOKEN" \
  -o /dev/null -w "total: %{time_total}s  ttfb: %{time_starttransfer}s\n"
```

### Check deployed code
```bash
docker exec appranks-api-1 grep "PATTERN" /app/apps/api/dist/routes/FILE.js
```

### Check DB connections
```bash
docker exec -w /app appranks-api-1 node -e "
  const p=require('postgres');const s=p(process.env.DATABASE_URL);
  s\`SELECT current_setting('max_connections') as mx, (SELECT count(*) FROM pg_stat_activity) as active\`
  .then(r=>{console.log(r[0]);s.end()})
"
```

---

## 5. Case Studies

### Changes Page: 18s → 300ms

| Problem | Fix |
|---------|-----|
| 12 separate API calls (1 self + 1 competitors + 10 per-competitor changes) | Created `/changes-feed` batch endpoint |
| NOT EXISTS subquery on every row | Kept NOT EXISTS (20ms) — LEFT JOIN was slower (130ms) |
| Sequential API calls in SSR | `Promise.all` for parallel fetching |

### Competitors Page: 18s → <1s

| Problem | Fix |
|---------|-----|
| 16 SQL queries running sequentially | Split into 3 waves of parallel queries |
| `DISTINCT ON (app_id, keyword_id)` sorting 69K rows (11s) | Correlated subquery (427ms) |
| `position IS NOT NULL` forcing heap access (850ms) | Removed filter — index-only scan (107ms) |
| 11 queries in single Promise.all exhausting pool (13s) | Wave 3 sequential (450ms) |

### Similar Page: 28s → <1s

| Problem | Fix |
|---------|-----|
| `getAccountCompetitors()` calling heavy aggregate endpoint (17s) | Created `/competitor-slugs` endpoint (10ms) |
| Same DISTINCT ON keyword ranking issue in aggregate endpoint | Same correlated subquery fix |

### All SSR Pages: -1.4s

| Problem | Fix |
|---------|-----|
| SSR fetches routing through Cloudflare (120ms/request) | `API_INTERNAL_URL=http://api:3001` (15ms/request) |

### Overview Page: 3.85s → ~2s

| Problem | Fix |
|---------|-----|
| 4 sequential await stages before data fetch | Merged into single Promise.all |
| Internal URL not set | Set `API_INTERNAL_URL` in docker-compose |

---

## 6. Infrastructure Constraints

| Resource | Limit | Impact |
|----------|-------|--------|
| Cloud SQL db-f1-micro | 614MB RAM, ~25 connections | Max 3-4 parallel queries per request |
| Pool size (postgres.js) | 10 connections | Shared across all concurrent API requests |
| shared_buffers | ~100MB | Most queries hit disk, not cache |
| VM1 (API + Dashboard) | 2GB RAM, e2-small | Limited CPU for SSR rendering |

**Key rule:** Never run more than 4 parallel DB queries in a single request handler. Use sequential waves for additional queries.

---

## 7. Prevention Checklist

When adding a new page or endpoint:

- [ ] **Count API calls** — aim for ≤3 SSR calls per page. Use batch endpoints for more.
- [ ] **Check for DISTINCT ON** — if querying a table with >100K rows, benchmark the query with EXPLAIN ANALYZE.
- [ ] **Use `fields=basic`** — if the page doesn't need all competitor data.
- [ ] **Use `getAccountCompetitorSlugs`** — if you only need competitor slugs for badges.
- [ ] **Parallel, not sequential** — use `Promise.all` for independent fetches. Never `await` in sequence unless there's a dependency.
- [ ] **Max 4 parallel queries** — split into waves to avoid pool exhaustion.
- [ ] **Use `@/components/ui/link`** — never import from `next/link` directly.
- [ ] **Cache expensive computations** — use `cacheGet` for data that changes slowly (developers, category snapshots).
- [ ] **Test on production** — benchmark with `curl` on the server, not just locally.
