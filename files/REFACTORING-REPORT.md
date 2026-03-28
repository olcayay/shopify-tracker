# AppRanks Platform - Refactoring & Improvement Report

**Date:** 2026-03-28
**Scope:** Full codebase review (API, Dashboard, Scraper, Worker, Shared, DB)
**Methodology:** Static analysis, architecture review, pattern consistency audit

---

## Executive Summary

The codebase is **functionally complete and production-serving** with 11 platform integrations, a well-structured monorepo, and good foundational patterns. However, there are **critical security gaps**, **performance time bombs** (N+1 queries), and **maintainability concerns** (god files exceeding 2,000 lines) that need attention before scaling.

**Key Numbers:**
- 4 critical security/performance issues requiring immediate action
- 8 god files (>900 lines) in the dashboard alone
- 296 `any` type casts in the API
- 31 duplicated polling patterns in the dashboard
- 0 error boundary files in the dashboard

---

## Priority Matrix

| Priority | Category | Items | Effort |
|----------|----------|-------|--------|
| P0 - Critical | Security & Data Integrity | 4 items | 1-2 days |
| P1 - High | Performance & Reliability | 6 items | 1-2 weeks |
| P2 - Medium | Code Quality & Maintainability | 8 items | 2-3 weeks |
| P3 - Low | Polish & Best Practices | 6 items | Ongoing |

---

## P0 - Critical (Fix Immediately)

### 1. Missing Auth Guard on `/api/admin/*` Endpoints
**File:** `apps/api/src/routes/admin.ts`
**Risk:** Any authenticated user can modify global tracked apps, keywords, and categories

The admin routes (POST/DELETE tracked-apps, tracked-keywords, categories) have **no authorization middleware**. There is no `requireSystemAdmin()` preHandler.

```
// Current (BROKEN):
app.post("/tracked-apps", async (request, reply) => { ... })

// Required:
app.post("/tracked-apps", { preHandler: [requireSystemAdmin()] }, async (request, reply) => { ... })
```

**Action:** Add `{ preHandler: [requireSystemAdmin()] }` to all 4 endpoints in admin.ts.

---

### 2. SQL Injection Risk via `sql.raw()` in Categories
**File:** `apps/api/src/routes/categories.ts:116-119`
**Risk:** Manual string escaping with `.replace(/'/g, "''")` is error-prone

```typescript
// Current (RISKY):
const queryText = `WHERE regexp_replace(...) = ANY(ARRAY[${slugs.map(s => `'${s.replace(/'/g, "''")}'`).join(",")}])`;
const result = await db.execute(sql.raw(queryText));

// Should be parameterized via Drizzle
```

**Action:** Replace `sql.raw()` with parameterized Drizzle query.

---

### 3. N+1 Query Pattern in `/api/apps`
**File:** `apps/api/src/routes/apps.ts:124-159`
**Risk:** With 50 tracked apps, executes **150+ individual DB queries** per request

For each tracked app, the handler runs separate queries for: latest snapshot, latest field change, keyword count, and ranked keyword count. This is a linear scaling problem.

**Action:** Batch all per-app queries using `WHERE app_id IN (...)` with a single query per data type, then join in JavaScript.

---

### 4. N+1 Query Pattern in Research Data Endpoint
**File:** `apps/api/src/routes/research.ts:779-807`
**Risk:** Same pattern - loops over competitors with individual snapshot + power score queries

**Action:** Same fix - batch queries with `inArray()` and `distinctOn()`.

---

## P1 - High Priority (Next Sprint)

### 5. Dashboard: God Components Need Decomposition

These files are unmaintainable at their current size:

| File | Lines | Recommendation |
|------|-------|----------------|
| `[platform]/research/[id]/page.tsx` | 2,384 | Split into 5-6 section components + data hooks |
| `[platform]/apps/[slug]/compare/page.tsx` | 2,080 | Extract comparison tabs into separate files |
| `[platform]/research/[id]/virtual-apps/[vaId]/page.tsx` | 1,759 | Extract form sections and preview components |
| `[platform]/research/[id]/compare/page.tsx` | 1,103 | Split metrics, charts, and tables |
| `[platform]/apps/[slug]/keywords-section.tsx` | 1,146 | Extract table, filters, and add-keyword dialog |
| `[platform]/apps/[slug]/page.tsx` | 985 | Extract stat cards, change history, overview sections |
| `[platform]/competitors/page.tsx` | 975 | Extract table and competitor management dialogs |
| `[platform]/apps/[slug]/competitors-section.tsx` | 922 | Extract comparison table and add-competitor flow |

**Action:** Decompose each file into focused sub-components (<300 lines each). Start with the research page (2,384 lines) as it's the worst offender.

---

### 6. Dashboard: Extract Duplicated Polling Pattern (31 locations)

The same polling pattern is copy-pasted across the codebase:

```typescript
const [pending, setPending] = useState<Set<T>>(new Set());
const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
useEffect(() => {
  if (pending.size > 0) {
    pollRef.current = setInterval(fetchData, 5000);
  } else if (pollRef.current) clearInterval(pollRef.current);
  return () => { if (pollRef.current) clearInterval(pollRef.current); };
}, [pending.size]);
```

**Action:** Create `usePolling(pendingIds, fetchFn, interval?)` custom hook. Also add exponential backoff (currently fixed 5s intervals).

---

### 7. Dashboard: Zero Error Boundaries

There are 0 `error.tsx` files in the entire dashboard. Any component crash takes down the whole page with no recovery UI.

**Action:** Add error boundaries at:
- `app/(dashboard)/error.tsx` (catch-all)
- `app/(dashboard)/[platform]/error.tsx` (platform-level)
- `app/(dashboard)/[platform]/apps/[slug]/error.tsx` (detail page level)

---

### 8. API: God Route Files Need Service Layer

| File | Lines | Concern |
|------|-------|---------|
| `routes/account.ts` | 3,538 | Mixes account info, members, tracking, billing |
| `routes/system-admin.ts` | 2,863 | Mixes UI admin and scraper management |
| `routes/research.ts` | 2,235 | Mixes project CRUD and data aggregation |
| `routes/apps.ts` | 1,439 | Multiple endpoints with complex aggregations |

**Action:** Split each route file by domain (e.g., `account.ts` -> `account-info.ts`, `account-members.ts`, `account-tracking.ts`). Extract shared DB query patterns into a service layer.

---

### 9. Worker: No Dead Letter Queue

Failed jobs after max retries are silently discarded (only 50 kept in Redis). There's no way to inspect, diagnose, or replay failed jobs.

**Action:** Create a `dead_letter_jobs` table in the database. On final failure, persist job type, payload, error, and timestamp. Add a system-admin UI to inspect and replay.

---

### 10. Worker: In-Memory Platform Lock Prevents Scaling

`PlatformLock` in `worker.ts` is in-memory. Running multiple worker containers would cause race conditions (two workers scraping the same platform simultaneously).

**Action:** Replace with Redis-based distributed lock (redlock pattern). This enables horizontal scaling.

---

## P2 - Medium Priority (2-3 Weeks)

### 11. API: 296 `any` Type Casts

Every route file starts with `const db: Db = (app as any).db`. Request bodies use `request.body as { key?: type }` without validation.

**Action:**
1. Extend `FastifyInstance` type declaration to include `db` property
2. Add Zod schemas for request body validation on all POST/PUT/PATCH endpoints
3. Progressively eliminate `any` casts

---

### 12. API: Inconsistent Error Response Formats

| File | Error Format |
|------|--------------|
| auth.ts | `{ error: "message" }` |
| account.ts | `{ error: "message", current: X, max: Y }` |
| system-admin.ts | `{ error: "message", details: "..." }` |
| categories.ts | Leaks `String(err)` to client |

**Action:** Create a standard error response helper:
```typescript
function apiError(reply, status, message, meta?) {
  return reply.code(status).send({ error: message, ...meta });
}
```

---

### 13. API: Duplicated Redis Connection Logic

`getRedisConnection()` is copy-pasted in 3 route files (account.ts, research.ts, system-admin.ts).

**Action:** Move to shared utils module, import everywhere.

---

### 14. Dashboard: No Data Fetching Library

All data fetching is manual `fetch` via `fetchWithAuth` with no caching, deduplication, or automatic refetching. The overview page makes 3 parallel API calls per enabled platform on every mount.

**Action:** Adopt TanStack Query (React Query) for:
- Automatic request deduplication
- Stale-while-revalidate caching
- Background refetching
- Consistent loading/error states

---

### 15. Dashboard: Duplicated Sorting/Filtering Logic

5+ implementations of column sorting with `sortKey` + `sortDir` state across different table pages.

**Action:** Extract `useSortable(defaultKey, defaultDir)` hook.

---

### 16. Scraper: Build Artifacts in Source

`apps/scraper/src/platforms/canva/` has 9 paired `.ts` / `.d.ts` files. The `.d.ts` files are build artifacts that shouldn't be in source control.

**Action:** Remove `.d.ts` files from platforms directory, add to `.gitignore`.

---

### 17. DB: Missing Indexes for Common Queries

| Table | Missing Index | Use Case |
|-------|--------------|----------|
| scrape_runs | `completed_at` | "Latest completed job" queries |
| app_snapshots | `(app_id, scraped_at) DESC` | Latest snapshot per app (N+1 fix) |
| app_keyword_rankings | `position` | Top-10 ranking queries |
| Multiple tables | `(platform, updated_at)` | Platform-scoped time queries |

**Action:** Add composite indexes via migration. Use `CREATE INDEX CONCURRENTLY` for large tables.

---

### 18. Shared: ScraperType Enum Out of Sync

`packages/shared/src/types/scraper.ts` defines only 4 scraper types, but the actual queue in `apps/scraper/src/queue.ts` supports 10+. This causes type safety gaps.

**Action:** Keep ScraperType as single source of truth in shared, update to include all job types.

---

## P3 - Low Priority (Ongoing)

### 19. Dashboard: Accessibility Gaps

Only 3 `aria` attributes found across the entire dashboard. Missing:
- `aria-label` on data tables and interactive elements
- `role="dialog"` on modals
- Focus management on dialog open/close
- Skip-to-content links

**Action:** Incremental accessibility audit, starting with most-used pages.

---

### 20. No Environment Variable Validation

Environment variables are used across 4 apps with no startup validation. Bad configs silently fail.

**Action:** Create `/packages/shared/src/config.ts` with Zod schema. Validate at app startup. Fail fast with clear error messages.

---

### 21. Console Logging Breaks Structured Output

Several files use `console.log/warn/error` instead of the structured JSON logger:
- `apps/api/src/index.ts` (migration logging)
- `apps/scraper/src/utils/with-fallback.ts`
- Various debug scripts

**Action:** Replace all `console.*` calls in production code with logger instance.

---

### 22. Missing Observability

- No correlation IDs for tracing requests across services
- No job duration metrics by type
- No queue depth monitoring
- No HTTP latency histograms

**Action:** Add correlation ID middleware to API, add metrics to job processing.

---

### 23. Hardcoded Magic Numbers

- `30` days in multiple retention/filter queries
- `15m` JWT token expiry
- `5 * 60_000` ms throttle intervals
- Concurrency values (11 background, 1 interactive)

**Action:** Extract to named constants in shared config.

---

### 24. Missing Test Coverage

**API gaps:** No tests for system-admin, research data, or admin endpoints. No E2E tests for N+1 scenarios.

**Dashboard gaps:** No page-level tests for the 8 god components. No integration tests for data fetching + polling flows.

**Scraper gaps:** No integration tests for full scrape pipeline.

**Action:** Prioritize tests for P0/P1 fixes first, then expand coverage.

---

## Architecture Recommendations (Long-term)

### Service Layer Pattern
Currently, business logic lives inside route handlers. Extract into a service layer:
```
routes/ -> calls -> services/ -> calls -> db/
```
This enables: testability, reuse across routes, and cleaner route files.

### API Documentation
No OpenAPI/Swagger documentation exists. Adding it would improve:
- Frontend-backend contract clarity
- Automated client generation
- API discoverability

### Database Query Performance Monitoring
Add query timing to identify slow queries before they become production incidents. Drizzle supports query logging that can be piped to metrics.

---

## Positive Patterns to Preserve

These patterns are well-done and should be replicated:

1. **Platform Module Registry** - Clean factory pattern for adding platforms
2. **Primary/Fallback Strategy** - `withFallback()` in scraper elegantly handles API deprecation
3. **Cascade Job Orchestration** - Multi-stage scrape pipelines with partial failure handling
4. **Zod Schemas for External Data** - All platform data validated before persistence
5. **Per-Platform Mutex** - Prevents marketplace API throttling
6. **Server-Side React Cache** - `cache()` in dashboard API layer
7. **JWT Refresh Token Flow** - Proper access/refresh token separation
8. **Structured JSON Logging** - Consistent log format across services

---

## Implementation Roadmap

```
Week 1:  P0 items (security + N+1 fixes)
Week 2:  P1 items 5-6 (dashboard god components + polling hook)
Week 3:  P1 items 7-10 (error boundaries, API splitting, DLQ, distributed lock)
Week 4:  P2 items 11-14 (type safety, error formats, data fetching)
Week 5+: P2 items 15-18 + P3 items (ongoing improvements)
```

Each P0 item should be a separate commit with tests. P1/P2 items can be grouped into feature branches.
