# AppRanks Platform Tracking — Risk Analysis V3

**Date:** 2026-03-28
**Prepared by:** Engineering Team
**Version:** 3.0
**Status:** Active
**Last Updated:** 2026-03-28 — Comprehensive audit: 18 new risks added (R-63 to R-80), all existing risks re-evaluated, actionable items linked to Linear tickets

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Risk Matrix Overview](#2-risk-matrix-overview)
3. [Critical Security Vulnerabilities (NEW)](#3-critical-security-vulnerabilities-new)
4. [Scraping & Data Collection Risks](#4-scraping--data-collection-risks)
5. [Legal & Compliance Risks](#5-legal--compliance-risks)
6. [Data Integrity & Quality Risks](#6-data-integrity--quality-risks)
7. [Infrastructure & Availability Risks](#7-infrastructure--availability-risks)
8. [Security Risks](#8-security-risks)
9. [Operational Risks](#9-operational-risks)
10. [Business Continuity Risks](#10-business-continuity-risks)
11. [Monitoring & Observability Gaps](#11-monitoring--observability-gaps)
12. [Dependency & Supply Chain Risks](#12-dependency--supply-chain-risks)
13. [Scalability Risks](#13-scalability-risks)
14. [Race Conditions & Concurrency Risks](#14-race-conditions--concurrency-risks)
15. [Email & Communication Risks](#15-email--communication-risks)
16. [AI & Research Feature Risks](#16-ai--research-feature-risks)
17. [Encoding, Timezone & Edge Case Risks](#17-encoding-timezone--edge-case-risks)
18. [Account & Billing Risks](#18-account--billing-risks)
19. [API Reliability & Validation Risks (NEW)](#19-api-reliability--validation-risks-new)
20. [Worker & Queue Reliability Risks (NEW)](#20-worker--queue-reliability-risks-new)
21. [Action Plan & Priority Matrix](#21-action-plan--priority-matrix)
22. [Linear Task Reference Table](#22-linear-task-reference-table)

---

## 1. Executive Summary

AppRanks is a multi-platform marketplace tracking system that scrapes 11 platforms (Shopify, Salesforce, Canva, Wix, WordPress, Google Workspace, Atlassian, Zoom, Zoho, Zendesk, HubSpot) for app rankings, reviews, categories, and keyword positions.

The system operates with:
- **73 scheduled scraper jobs** running daily or twice daily
- **Single-server deployment** (Docker Compose on one host)
- **~46 tracked apps, ~80 keywords** across platforms
- **Playwright browser automation** for JS-rendered platforms
- **BullMQ job queue** backed by Redis
- **2,362 tests** across 4 packages (3 currently failing in scraper)
- **Multi-user JWT auth** with role-based access control

This document identifies **80 risks** across 20 categories, rates them by likelihood and impact, and provides actionable mitigation strategies. Each actionable mitigation is linked to a Linear task for implementation tracking.

### Changes from V2 (2026-03-27)

| Change | Details |
|--------|---------|
| New risks added | R-63 to R-80 (18 new risks) |
| Risks re-evaluated | R-03, R-14, R-15, R-20, R-22, R-23 scores updated |
| New sections | Section 3 (Critical Security), Section 19 (API Validation), Section 20 (Worker/Queue) |
| Linear integration | All actionable items linked to Linear PLA-xxx tickets |
| Total risks | 62 → 80 |

---

## 2. Risk Matrix Overview

| Severity | Likelihood: High | Likelihood: Medium | Likelihood: Low |
|----------|------------------|---------------------|-----------------|
| **Critical** | R-01, R-05, R-14, R-63 | R-07, R-20, R-64 | R-09, R-22 |
| **High** | R-02, R-03, R-06, R-15, R-65, R-66, R-67, R-72 | R-08, R-10, R-16, R-21, R-68, R-73, R-74 | R-11, R-23, R-75 |
| **Medium** | R-04, R-17, R-30, R-69, R-76 | R-12, R-13, R-18, R-24, R-31, R-70, R-77 | R-19, R-25, R-32, R-71, R-78 |
| **Low** | R-26, R-33, R-79 | R-27, R-28, R-34 | R-29, R-35, R-80 |

**Risk Rating Formula:** Impact (1-5) x Likelihood (1-5) = Risk Score (1-25)

---

## 3. Critical Security Vulnerabilities (NEW)

### R-63: Arbitrary Code Execution via `new Function()` in Zoho Parser (Critical / Medium Likelihood)
**Risk Score: 20** | **Linear:** PLA-173

**Description:** The Zoho app parser (`apps/scraper/src/platforms/zoho/parsers/app-parser.ts`, line 72) uses `new Function()` as a fallback when `JSON.parse()` fails. This is functionally equivalent to `eval()` and allows arbitrary server-side code execution if the scraped JSON string is malicious or tampered with.

**Current State:**
```typescript
// Line 67-76 of zoho/parsers/app-parser.ts
try {
  detailsObj = JSON.parse(jsonStr);
} catch {
  try {
    detailsObj = new Function(`return (${jsonStr})`)();  // CRITICAL!
  } catch (err2) {
    log.warn("failed to parse detailsObject", { slug, error: String(err2) });
  }
}
```

**Impact:**
- **Remote Code Execution (RCE)**: If Zoho's page is compromised, XSS-injected, or returns crafted JavaScript in the JSON position, arbitrary code runs on the server with the worker process's full permissions
- **Data exfiltration**: Attacker could read environment variables (DB credentials, JWT secret, API keys)
- **Server compromise**: Full shell access via spawned processes

**Mitigation:**
- [ ] **IMMEDIATE**: Remove `new Function()` fallback entirely — if JSON.parse fails, treat as parse error (**PLA-173**)
- [ ] Add JSON schema validation after parsing (Zod or ajv)
- [ ] Audit all other parsers for similar patterns

**When task PLA-173 is completed, update this risk status to Fixed.**

---

### R-64: Exposed Secrets in Repository `.env` File (Critical / Medium Likelihood)
**Risk Score: 20** | **Linear:** PLA-174

**Description:** The `.env` file in the repository root contains real credentials including an OpenAI API key (`sk-proj-...`), admin email/password defaults, JWT secret, and database credentials. While `.gitignore` includes `.env`, the file exists in the working directory and could be accidentally committed.

**Current State:**
- `OPENAI_API_KEY=sk-proj-O0cDjju7...` — real, active API key
- `ADMIN_PASSWORD=admin12345` — weak default admin password
- `JWT_SECRET=dev-jwt-secret-change-in-production` — predictable dev secret
- `.env` is in `.gitignore` but the file exists locally

**Impact:**
- **Financial**: Unauthorized OpenAI API usage billed to account
- **Authentication bypass**: Known JWT secret allows forging any token
- **Admin access**: Known admin credentials grant full system access

**Mitigation:**
- [ ] **IMMEDIATE**: Rotate OpenAI API key in OpenAI dashboard (**PLA-174**)
- [ ] Verify `.env` is not in git history (`git log --all --full-history -- .env`)
- [ ] If found in history, use `git filter-repo` to remove
- [ ] Change production JWT_SECRET and ADMIN_PASSWORD
- [ ] Add `.env` scanning to pre-commit hooks (e.g., detect-secrets)
- [ ] Document required env vars in `.env.example` (without real values)

**When task PLA-174 is completed, update this risk status to Mitigated.**

---

## 4. Scraping & Data Collection Risks

### R-01: Platform Rate Limiting & IP Blocking (Critical / High Likelihood)
**Risk Score: 25** | **Linear:** PLA-198 (proxy rotation), PLA-199 (circuit breaker)

**Description:** Target platforms detect automated scraping patterns and block the server's IP address or return HTTP 429.

**Current State:**
- Single IP address for all scraping operations
- HttpClient has 429 retry with 4s/8s/16s/32s/64s exponential backoff
- Concurrent requests per job limited to 2-3
- No global rate limiter across all jobs
- 11 platform workers can run simultaneously

**Impact:**
- Complete data blackout for blocked platforms
- Ranking gaps in historical data
- Customer-visible dashboard showing stale data

**Mitigation:**
- [ ] Implement rotating proxy pool (residential proxies for browser-based platforms) (**PLA-198**)
- [ ] Implement circuit breaker pattern: pause platform for 1h after 5 consecutive failures (**PLA-199**)
- [ ] Add global Redis-based rate limiter across all workers (per-domain)
- [ ] Randomize request intervals with jitter (+-30% variation)
- [ ] Diversify User-Agent rotation with realistic browser fingerprints
- [ ] Monitor response codes and auto-alert on spike of 403/429 responses

---

### R-02: Scraper Breakage Due to HTML/API Changes (High / High Likelihood)
**Risk Score: 20** | **Linear:** PLA-175

**Description:** Target platforms update their HTML structure, CSS selectors, or API schemas without notice.

**Current State:**
- **3 active test failures** in Shopify parser (languages, integrations) — confirms this risk is materializing NOW
- Parsers use CSS selectors and regex patterns tied to specific HTML structure
- Smoke tests exist but run manually
- Fallback mechanism (withFallback) provides secondary scraping path

**Impact:**
- Silent data corruption — wrong rankings, prices, or review counts
- Missing apps from category listings
- Customer decisions based on stale/wrong data

**Mitigation:**
- [ ] **IMMEDIATE**: Fix 3 failing Shopify parser tests (languages, integrations selectors) (**PLA-175**)
- [ ] Add output validation layer: assert parsed data has minimum expected fields
- [ ] Implement data quality checks: compare scraped count vs previous run (>50% drop = alert)
- [ ] Run smoke tests automatically on every scheduled scrape
- [ ] Version parsers and log parser version with each scrape run
- [ ] Set up Slack/email alerts for any platform with >20% item failure rate

---

### R-03: Browser-Based Scraping Failures (High / High Likelihood)
**Risk Score: 20** | **Linear:** PLA-187

**Description:** Platforms requiring Playwright/Chromium fail due to bot detection, JavaScript changes, or browser memory issues.

**Current State:**
- Chromium launched per-job — **no browser pooling**
- Each browser instance uses ~300-500MB RAM
- After 10+ jobs, accumulated browser processes can exceed worker's 3GB memory limit
- Google Workspace fixed (per-request page)
- Browser cleanup exists in `finally` block of process-job.ts

**Impact:**
- Server OOM crashes (already happened — commit `253ff6d` fixed zombie processes)
- Complete failure for browser-dependent platforms (5 of 11 platforms need browser)
- Cascading failures affecting non-browser platforms on same server

**Mitigation:**
- [ ] Implement browser connection pooling (reuse single browser, create pages per context) (**PLA-187**)
- [ ] Set hard memory limit per browser process (512MB max)
- [ ] Add watchdog process that kills browsers exceeding memory or time limits
- [ ] Implement headless detection evasion: stealth plugin, realistic viewport
- [ ] Consider Browserless.io as managed fallback

---

### R-04: Incomplete Data Due to Pagination Failures (Medium / High Likelihood)
**Risk Score: 15**

**Description:** Category or keyword searches with multiple pages fail partway through.

**Current State:** Unchanged from V2.

**Mitigation:**
- [ ] Track total result count from search pages
- [ ] Compare scraped vs reported total — flag discrepancies
- [ ] Implement resume-from-page for interrupted pagination jobs

---

### R-05: Concurrent Page Navigation Crashes (Critical / High Likelihood)
**Risk Score: 25**

**Status:** **Partially Fixed** — Google Workspace per-request page (commit `64f62ad`)

**Remaining:**
- [ ] Audit Zendesk and Canva browser modules for shared page issues
- [ ] Implement browser-level concurrency limit
- [ ] Add retry with fresh browser context on navigation failures

---

## 5. Legal & Compliance Risks

### R-06: Terms of Service Violations (High / High Likelihood)
**Risk Score: 20**

**Status:** Open — requires legal counsel. See V2 for full details.

### R-07: GDPR / Data Privacy Compliance (Critical / Medium Likelihood)
**Risk Score: 20**

**Status:** Open — requires privacy counsel. See V2 for full details.

### R-08: Intellectual Property Claims (High / Medium Likelihood)
**Risk Score: 15**

**Status:** Open — requires legal review. See V2 for full details.

---

## 6. Data Integrity & Quality Risks

### R-09: Ranking Data Corruption — Silent Wrong Data (Critical / Low Likelihood)
**Risk Score: 15**

**Status:** **Partial** — clampRating/clampCount/clampPosition validation on DB insert added.

**Remaining:**
- [ ] Implement "delta alerts": flag >20 position change in one scrape
- [ ] Cross-validate category app counts against platform total
- [ ] Store raw HTML snapshots for last N scrapes for debugging

### R-10: Ranking Data Gaps — Missing Days (High / Medium Likelihood)
**Risk Score: 15**

**Status:** Open. See V2 for full details.

### R-11: Review Data Inconsistency (High / Low Likelihood)
**Risk Score: 10**

**Status:** Open. See V2 for full details.

### R-12: Stale Data Served to Customers (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** **Partial** — DataFreshness component on app detail, rankings, category pages.

### R-13: App Slug Changes Break Tracking (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

---

## 7. Infrastructure & Availability Risks

### R-14: Single Server — Complete Service Outage (Critical / High Likelihood)
**Risk Score: 25** | **Linear:** PLA-200

**Description:** All services (API, Dashboard, Worker, PostgreSQL, Redis) run on a single Hetzner VPS. Any hardware failure, network issue, or OS crash causes complete service outage.

**Current State:**
- Single VPS: Hetzner (Coolify + Docker Compose)
- No failover, no redundancy, no multi-region
- Docker `restart: always` provides basic recovery from container crashes
- No automated failover procedure documented

**Mitigation:**
- [ ] Migrate PostgreSQL to managed service (Hetzner managed DB or external) (**PLA-200**)
- [ ] Set up Redis Sentinel for HA
- [ ] Document disaster recovery runbook with RTO/RPO targets
- [ ] Consider multi-region deployment for critical services

---

### R-15: No Automated Database Backup (Critical / Medium Likelihood)
**Risk Score: 20** | **Linear:** PLA-176

**Description:** PostgreSQL database has no automated backup. A single `docker volume rm`, disk failure, or corrupted write could cause permanent data loss.

**Current State:**
- Docker volume `postgres_data` on local disk
- Manual `pg_dump` documented in DEPLOYMENT.md but not automated
- No off-site backup storage
- No backup verification or restore testing

**Impact:**
- **Permanent data loss** — all historical rankings, reviews, user accounts
- Cannot recover from disk failure, accidental deletion, or ransomware
- No point-in-time recovery capability

**Mitigation:**
- [ ] **IMMEDIATE**: Set up automated daily `pg_dump` to external storage (S3/Backblaze) (**PLA-176**)
- [ ] Implement 30-day rolling backup retention
- [ ] Add monthly restore test (automated)
- [ ] Set up WAL archiving for point-in-time recovery
- [ ] Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective)

**When task PLA-176 is completed, update this risk status to Mitigated.**

---

### R-16: Redis Failure (High / Medium Likelihood)
**Risk Score: 15**

**Status:** **Mitigated** — AOF persistence + maxmemory policy. But see R-72 for new finding about maxmemory being too low.

### R-17: Server Resource Exhaustion (Medium / High Likelihood)
**Risk Score: 15**

**Status:** **Mitigated** — Docker memory limits added.

### R-18: Docker Volume Corruption (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

---

## 8. Security Risks

### R-19: CORS Misconfiguration (Medium / Low Likelihood)
**Risk Score: 10** | **Linear:** PLA-184

**Description:** CORS configuration allows localhost origins even in production.

**Current State (apps/api/src/index.ts:86-99):**
```typescript
const allowedOrigins = [
  "https://appranks.io",
  "https://api.appranks.io",
  process.env.DASHBOARD_URL,
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:3000",  // PROBLEM: allowed in production
  "http://localhost:3001",  // PROBLEM: allowed in production
].filter(Boolean);
```

**Mitigation:**
- [ ] Remove localhost origins in production (env-based conditional) (**PLA-184**)
- [ ] Whitelist only explicit production domains
- [ ] Add `Access-Control-Max-Age` header

**When task PLA-184 is completed, update this risk status to Fixed.**

---

### R-20: Weak Authentication (Critical / Medium Likelihood)
**Risk Score: 20** | **Linear:** PLA-183

**Status:** **Partial** — password complexity, login rate limiting (5/IP/15min), generic error messages.

**NEW FINDING — Password complexity inconsistency:**
- Registration enforces uppercase + lowercase + digit (auth.ts:75-85)
- Password change (PATCH `/api/auth/me`, line 544) only checks length >= 8
- Missing complexity check on password updates

**Mitigation:**
- [ ] Fix password complexity check on password change endpoint (**PLA-183**)
- [ ] Add 2FA for admin accounts (long-term)

**When task PLA-183 is completed, update this risk status to Mitigated.**

---

### R-21: JWT Security Weaknesses (High / Medium Likelihood)
**Risk Score: 15** | **Linear:** PLA-194

**Description:** Access tokens cannot be revoked before 15-minute expiry. No token blacklist.

**Current State:**
- Access token: 15min expiry, no revocation mechanism
- Refresh token: 7 days, revoked on logout via DB delete
- Compromised access token remains valid until expiration
- In-memory rate limiter (not Redis-backed) — fails on horizontal scale

**Mitigation:**
- [ ] Implement Redis-backed token blacklist for immediate access token revocation (**PLA-194**)
- [ ] Consider reducing access token expiry to 5 minutes
- [ ] Migrate rate limiter from in-memory to Redis-backed

**When task PLA-194 is completed, update this risk status to Mitigated.**

---

### R-22: Secrets Management (Critical / Low Likelihood)
**Risk Score: 15**

**Status:** Open — see R-64 for exposed secrets finding.

### R-23: Input Validation Gaps (High / Low Likelihood)
**Risk Score: 10** | **Linear:** PLA-178

**NEW FINDING — Detailed audit results:**
All API routes use TypeScript `as` casts instead of runtime validation:
```typescript
// Example from auth.ts:61-67
const { email, password, name, accountName } = request.body as {
  email?: string;
  password?: string;
  // ...
};
```

**Affected routes (no Zod validation on request bodies):**
- `routes/auth.ts` — login, register, refresh, password change
- `routes/system-admin.ts` — account updates, scraper triggers
- `routes/research.ts` — project creation, AI generation
- `routes/account.ts` — member management, tracked apps

**Mitigation:**
- [ ] Add Zod schema validation to all API request bodies (**PLA-178**)
- [ ] Use Fastify's built-in schema validation (Ajv) as alternative
- [ ] Add request body size limits per endpoint

**When task PLA-178 is completed, update this risk status to Mitigated.**

---

### R-24: No Zero-Downtime Deployment (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

### R-25: Migration Failures (Medium / Low Likelihood)
**Risk Score: 8** | **Linear:** PLA-196

**Description:** Migrations run on API startup. A failed migration prevents the API from starting, with no automated rollback.

**Mitigation:**
- [ ] Separate migration runner from API startup into dedicated service/step (**PLA-196**)
- [ ] Add migration dry-run capability
- [ ] Document manual rollback procedures per migration

**When task PLA-196 is completed, update this risk status to Mitigated.**

---

## 9. Operational Risks

### R-26: No DB Connection Pooling (Low / High Likelihood)
**Risk Score: 10**

**Status:** **Fixed** — pool max=20, idle=30s, max_lifetime=30min.

### R-27: Key Person Dependency (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

### R-28: Platform API Deprecation (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open — Atlassian REST API v2 deprecated, removal after June 2026.

### R-29: Competitor Detection (Low / Low Likelihood)
**Risk Score: 5**

**Status:** Open. See V2 for full details.

---

## 10. Monitoring & Observability Gaps

### R-30: No External Monitoring (Medium / High Likelihood)
**Risk Score: 15 → 5**

**Status:** **Mitigated** — /health endpoint + UptimeRobot monitoring active.

### R-31: No Centralized Logging (Medium / Medium Likelihood)
**Risk Score: 12** | **Linear:** PLA-190

**Description:** Logs are scattered across Docker containers with no aggregation, search, or retention policy.

**Current State:**
- Fastify logger (pino) on API
- Custom createLogger() on scraper/worker
- Docker stdout only
- No log rotation configured
- No correlation IDs for request tracing

**Mitigation:**
- [ ] Set up centralized log aggregation (Loki, Datadog, or ELK) (**PLA-190**)
- [ ] Add request ID correlation across services
- [ ] Configure Docker log rotation (max-size: 10m, max-file: 3)
- [ ] Define log retention policy (30 days minimum)

**When task PLA-190 is completed, update this risk status to Mitigated.**

---

### R-32: No Error Tracking (Medium / Low Likelihood)
**Risk Score: 8** | **Linear:** PLA-188

**Mitigation:**
- [ ] Integrate Sentry for error tracking on API, Dashboard, and Worker (**PLA-188**)
- [ ] Configure alerting for new/regression errors
- [ ] Add source maps for dashboard error reports

**When task PLA-188 is completed, update this risk status to Mitigated.**

---

### R-33: No Performance Metrics (Low / High Likelihood)
**Risk Score: 10** | **Linear:** PLA-189

**Mitigation:**
- [ ] Implement Prometheus metrics endpoint on API and Worker (**PLA-189**)
- [ ] Track: scraper_jobs_total, scraper_job_duration_seconds, redis_queue_depth, database_pool_usage
- [ ] Set up Grafana dashboards for visualization
- [ ] Configure alerts: job failure rate >10%, Redis memory >80%, DB connections >15/20

**When task PLA-189 is completed, update this risk status to Mitigated.**

---

### R-34: Dependency Vulnerabilities (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open — no automated vulnerability scanning. npm audit clean as of 2026-03-28.

### R-35: Node.js EOL (Low / Low Likelihood)
**Risk Score: 5**

**Status:** **Fixed** — migrated to Node 22 LTS.

---

## 11. Dependency & Supply Chain Risks

See V2 for R-34, R-35 details.

---

## 12. Scalability Risks

### R-36: Platform Count Growth (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. 11 platforms currently supported, architecture supports more via platform module pattern.

### R-37: Customer Count Growth (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. Current architecture supports ~100 concurrent users.

### R-38: Data Volume Growth (Low / High Likelihood)
**Risk Score: 10** | **Linear:** PLA-191

**Description:** Snapshot tables (app_snapshots, keyword_snapshots, reviews) grow indefinitely with no retention policy.

**Projection:** 11 platforms x 2 scrapes/day x 365 days = 8k snapshots per app. At 100k apps this is 800GB+ per year.

**Mitigation:**
- [ ] Implement data retention/cleanup job: delete snapshots >12 months (**PLA-191**)
- [ ] Add time-based partitioning on snapshot tables (monthly)
- [ ] Create archive strategy for old data
- [ ] Monitor table sizes with alerts

**When task PLA-191 is completed, update this risk status to Mitigated.**

---

## 13. Race Conditions & Concurrency Risks

### R-39: Concurrent App Upsert Race Condition (High / Medium Likelihood)
**Risk Score: 20**

**Status:** Open. See V2 for full details.

### R-40: Category Ranking TOCTOU Race (Medium / Medium Likelihood)
**Risk Score: 15**

**Status:** **Fixed** — unique index + onConflictDoNothing.

### R-41: Cascade Job Partial Enqueue Failure (Medium / Medium Likelihood)
**Risk Score: 15**

**Status:** **Mitigated** — try/catch per enqueue + success/fail counters + warn logs.

### R-42: Platform Lock Bypass (Multi-Instance) (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

---

## 14. Email & Communication Risks

### R-43: Silent Daily Digest Failures (Medium / Medium Likelihood)
**Risk Score: 15**

**Status:** Open. See V2 for full details.

### R-44: Email Sender Spoofing (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** Open. See V2 for full details.

### R-45: Invitation Email Abuse (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** **Mitigated** — 10 invitations/account/day rate limit.

---

## 15. AI & Research Feature Risks

### R-46: Uncontrolled OpenAI API Costs (High / Medium Likelihood)
**Risk Score: 20**

**Status:** **Mitigated** — max_tokens=4000 added.

### R-47: Prompt Injection via App Names (Low / Low Likelihood)
**Risk Score: 5**

**Status:** Open. See V2 for full details.

### R-48: AI Feature Availability Dependency (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

---

## 16. Encoding, Timezone & Edge Case Risks

### R-49: Unicode Keyword Slug Destruction (Medium / Medium Likelihood)
**Risk Score: 15**

**Status:** Open. See V2 for full details.

### R-50: Timezone Mismatch (Medium / High Likelihood)
**Risk Score: 15**

**Status:** Open. See V2 for full details.

### R-51: Special Characters Break Search URLs (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

### R-52: Numeric Edge Cases (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** **Fixed** — safeParseFloat() replaces raw parseFloat in all parsers.

### R-53: DST Impact on Schedule Display (Low / Medium Likelihood)
**Risk Score: 6**

**Status:** Open. See V2 for full details.

### R-54: Large HTML Response Memory Spikes (Low / High Likelihood)
**Risk Score: 10**

**Status:** **Mitigated** — 20MB response size limit.

---

## 17. Account & Billing Risks

### R-55: Free Tier Abuse — Unlimited Registration (Medium / Medium Likelihood)
**Risk Score: 15**

**Status:** **Partial** — IP-based rate limiting (3/hour).

### R-56: Package Limits Not Enforced at DB Level (Medium / High Likelihood)
**Risk Score: 15**

**Status:** Open. See V2 for full details.

### R-57: No Payment Integration (Medium / Medium Likelihood)
**Risk Score: 12**

**Status:** Open. See V2 for full details.

### R-58: Account Deletion Data Orphaning (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** Open. See V2 for full details.

### R-59: Impersonation Feature Abuse (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** Open. See V2 for full details.

### R-60: Competitor Tracking Cross-Account Leak (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** Open. See V2 for full details.

### R-61: Session Hijacking on Shared Computer (Low / Medium Likelihood)
**Risk Score: 8**

**Status:** Open. See V2 for full details.

### R-62: Cron Schedule Resource Contention (Medium / High Likelihood)
**Risk Score: 15**

**Status:** **Mitigated** — schedules staggered with :00/:15/:30/:45 offsets.

---

## 18. Account & Billing Risks (continued from V2)

See V2 for full R-55 through R-62 details.

---

## 19. API Reliability & Validation Risks (NEW)

### R-65: No API Rate Limiting Beyond Auth Endpoints (High / High Likelihood)
**Risk Score: 20** | **Linear:** PLA-179

**Description:** Rate limiting is only applied to login (5/IP/15min) and registration (3/IP/hour). All data endpoints (`/api/apps`, `/api/keywords`, `/api/categories`, `/api/system-admin/*`) have zero rate limiting.

**Current State:**
- `RateLimiter` class exists at `apps/api/src/utils/rate-limiter.ts` (in-memory)
- Only used in `routes/auth.ts` (lines 28-30)
- No global middleware applying rate limits
- System admin endpoints (scraper triggers, account management) completely unprotected

**Impact:**
- **DoS vulnerability**: A single client can flood the API with unlimited requests
- **Data scraping**: Competitors can scrape our API data without limits
- **Resource exhaustion**: Unbounded queries drain DB connection pool
- **Abuse of system-admin**: Compromised admin token can trigger unlimited scraper jobs

**Mitigation:**
- [ ] Add global API rate limiting middleware (100 req/min for auth users, 20/min for public) (**PLA-179**)
- [ ] Migrate from in-memory to Redis-backed rate limiter for horizontal scaling
- [ ] Add per-endpoint rate limits for expensive operations (scraper triggers: 10/hour)
- [ ] Return `Retry-After` header on 429 responses

**When task PLA-179 is completed, update this risk status to Mitigated.**

---

### R-66: No Database Transactions for Multi-Step Operations (High / High Likelihood)
**Risk Score: 20** | **Linear:** PLA-181

**Description:** Critical multi-step operations (user registration, app tracking, team management) execute multiple database queries without transactions. A failure midway leaves data in an inconsistent state.

**Current State (auth.ts:100-143):**
```typescript
// Registration: 3 separate DB operations, no transaction
const [account] = await db.insert(accounts).values({...}).returning();
// ... platform setup (multiple inserts)
const [user] = await db.insert(users).values({...}).returning();
// ... token insert
await db.insert(refreshTokens).values({...});
```

**Affected operations:**
- User registration (account + user + refresh token + platform setup)
- App tracking (insert app + insert tracking record)
- Team member invitation (insert user + send email)
- Account deletion (cascade across multiple tables)

**Impact:**
- Orphaned accounts without users (registration crash after account insert)
- Orphaned tracking records without apps
- Inconsistent state requiring manual DB cleanup
- Customer unable to re-register with same email (account exists, user doesn't)

**Mitigation:**
- [ ] Wrap registration flow in `db.transaction()` (**PLA-181**)
- [ ] Wrap app tracking CRUD in transactions
- [ ] Wrap team management operations in transactions
- [ ] Add integration tests verifying rollback on mid-operation failure

**When task PLA-181 is completed, update this risk status to Mitigated.**

---

### R-67: Empty Catch Blocks Swallow Errors Silently (High / High Likelihood)
**Risk Score: 16** | **Linear:** PLA-182

**Description:** Multiple files contain empty `catch {}` blocks that swallow errors without any logging, making bugs invisible and debugging impossible.

**Affected Files:**
- `apps/scraper/scripts/canva-auth.ts` — multiple empty catches
- `apps/scraper/scripts/canva-detail-explore.ts` — multiple empty catches
- `apps/scraper/src/platforms/canva/index.ts` — multiple empty catches
- `apps/scraper/src/platforms/zoho/parsers/app-parser.ts` — line 70 after JSON.parse failure

**Impact:**
- Bugs that should be caught and fixed go unnoticed
- Debugging production issues becomes extremely difficult
- Parser failures silently return partial/empty data
- Error patterns can't be detected or alerted on

**Mitigation:**
- [ ] Replace all empty `catch {}` blocks with `catch (err) { log.warn(...) }` (**PLA-182**)
- [ ] Add ESLint rule `no-empty` with `allowEmptyCatch: false`
- [ ] Review all catch blocks for proper error handling

**When task PLA-182 is completed, update this risk status to Fixed.**

---

### R-68: Missing Request ID Correlation/Tracing (High / Medium Likelihood)
**Risk Score: 12** | **Linear:** PLA-192

**Description:** No correlation IDs or request tracing across API, Worker, and Database. When a user reports an issue, tracing the request path through logs is impossible.

**Current State:**
- Fastify assigns internal request IDs but they're not propagated to workers
- Jobs processed by workers have no correlation to the API request that triggered them
- Database queries not tagged with request context
- No distributed tracing headers (X-Request-ID, traceparent)

**Mitigation:**
- [ ] Add request ID middleware to API (generate UUID, include in all log entries) (**PLA-192**)
- [ ] Propagate request ID to BullMQ job data
- [ ] Include request ID in error responses for customer support

**When task PLA-192 is completed, update this risk status to Mitigated.**

---

### R-69: Deep Health Check Missing (Medium / High Likelihood)
**Risk Score: 15** | **Linear:** PLA-180

**Description:** The `/health` endpoint returns `{status: "ok"}` without checking database or Redis connectivity. The API could appear healthy while actually unable to serve requests.

**Current State:**
- API `/health` — returns static JSON, no DB/Redis check
- Dashboard `/app/health` — checks API reachability only
- Worker — no health endpoint at all
- UptimeRobot monitors `/health` — would NOT detect DB/Redis failures

**Mitigation:**
- [ ] Implement deep health checks: DB ping + Redis ping with 5s timeout (**PLA-180**)
- [ ] Add `/health/ready` (deep) vs `/health/live` (shallow) pattern
- [ ] Add worker health signal via Redis key (heartbeat)
- [ ] Monitor deep health endpoint from UptimeRobot

**When task PLA-180 is completed, update this risk status to Mitigated.**

---

### R-70: System Admin Routes Lack Route-Level Authorization (Medium / Medium Likelihood)
**Risk Score: 12**

**Description:** System admin authorization uses URL-prefix matching in middleware (`request.url.startsWith("/api/system-admin")`) rather than route-level `preHandler` hooks. This is fragile if routing is inconsistent.

**Current State (middleware/auth.ts:88-94):**
```typescript
if (request.url.startsWith("/api/system-admin") && !request.user.isSystemAdmin) {
  return reply.code(403).send({ error: "Forbidden" });
}
```

**Mitigation:**
- [ ] Add explicit `preHandler: [requireSystemAdmin]` to each system-admin route
- [ ] Remove URL-based check from middleware
- [ ] Add tests verifying non-admin cannot access any system-admin endpoint

---

## 20. Worker & Queue Reliability Risks (NEW)

### R-71: No Dead Letter Queue for Failed Jobs (Medium / Low Likelihood)
**Risk Score: 8** | **Linear:** PLA-193

**Description:** Failed BullMQ jobs are removed after `removeOnFail: { count: 50 }`. No dead letter queue preserves them for analysis or retry.

**Current State (queue.ts:48-53):**
```typescript
const defaultJobOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};
```

**Impact:**
- Failed jobs lost without audit trail
- Can't analyze failure patterns across time
- No ability to bulk-retry class of failed jobs

**Mitigation:**
- [ ] Implement dead letter queue: move failed jobs to separate `scraper-jobs-dlq` queue (**PLA-193**)
- [ ] Store failure reason, stack trace, and job data in DLQ
- [ ] Add admin UI to inspect and retry DLQ jobs
- [ ] Alert on DLQ depth > 20 jobs

**When task PLA-193 is completed, update this risk status to Mitigated.**

---

### R-72: Redis maxmemory Too Low (256MB) (High / High Likelihood)
**Risk Score: 20** | **Linear:** PLA-177

**Description:** Redis is configured with `--maxmemory 256mb` and `allkeys-lru` eviction policy. Under load, active BullMQ job data can be evicted, causing job loss.

**Current State (docker-compose.prod.yml):**
```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  deploy:
    resources:
      limits:
        memory: 512M
```

**Impact:**
- **Job data eviction**: Active jobs' metadata evicted = BullMQ can't track completion
- **Silent job loss**: Jobs appear to never complete, no error raised
- **Queue corruption**: Evicting BullMQ internal keys causes unpredictable behavior

**Mitigation:**
- [ ] Increase Redis maxmemory to 1GB (**PLA-177**)
- [ ] Change eviction policy to `volatile-lru` (only evict keys with TTL)
- [ ] Increase container memory limit from 512M to 1.5G
- [ ] Monitor Redis memory usage with alerts at 80%

**When task PLA-177 is completed, update this risk status to Mitigated.**

---

### R-73: Worker Graceful Shutdown Missing (High / Medium Likelihood) — MITIGATED
**Risk Score: 15** | **Linear:** PLA-185

**Description:** When the worker container receives SIGTERM (deployment, restart), in-flight jobs are aborted without waiting for completion. Browser instances may not be cleaned up.

**Current State (Mitigated):**
- Worker graceful shutdown implemented with duplicate-call prevention and 60s timeout
- BullMQ `worker.close()` waits for active jobs to finish before stopping
- Browser instances are cleaned up per-job in `process-job.ts` finally blocks
- `cleanupStaleRuns()` marks orphaned runs as failed on worker restart
- Docker `stop_grace_period: 120s` gives workers time to finish before SIGKILL
- Shutdown sequence fully logged (signal, in-flight status, completion/timeout)

**Mitigation (completed):**
- [x] Implement graceful shutdown: wait for in-flight jobs to complete (with 60s timeout) (**PLA-185**)
- [x] Ensure browser cleanup runs on SIGTERM (per-job cleanup in finally blocks)
- [x] Re-queue interrupted jobs after restart (`cleanupStaleRuns` on startup)
- [x] Log shutdown sequence for debugging
- [x] Docker `stop_grace_period` set to 120s for worker containers

---

### R-74: No Idempotency Keys for Critical Operations (High / Medium Likelihood)
**Risk Score: 12** | **Linear:** PLA-197

**Description:** Network failures or retries can cause duplicate operations. No idempotency tokens prevent re-execution.

**Affected Operations:**
- Research project creation (double-click = 2 projects)
- Tracked app addition (race condition = duplicate tracking)
- Invitation sending (network retry = 2 emails)
- Scraper job triggers (admin double-click = 2 jobs)

**Mitigation:**
- [ ] Add idempotency key support to critical POST endpoints (**PLA-197**)
- [ ] Use `Idempotency-Key` header + Redis cache (TTL: 24h)
- [ ] Return cached response for duplicate requests

**When task PLA-197 is completed, update this risk status to Mitigated.**

---

### R-75: Missing Database Indexes on Large Tables (High / Low Likelihood)
**Risk Score: 10** | **Linear:** PLA-186

**Description:** Several large, frequently-queried tables lack optimal indexes, causing slow queries as data grows.

**Missing Indexes Identified:**
- `scrape_runs`: no index on `completedAt` (used in cleanup queries)
- `app_snapshots`: no index on `scrapedAt` alone (used in time-range queries)
- `keyword_snapshots`: no index on `scrapedAt` (same pattern)
- `reviews`: potential benefit from composite index on `(appId, createdAt)`

**Mitigation:**
- [ ] Add missing indexes via new migration (**PLA-186**)
  ```sql
  CREATE INDEX CONCURRENTLY idx_scrape_runs_completed_at ON scrape_runs("completedAt");
  CREATE INDEX CONCURRENTLY idx_app_snapshots_scraped_at ON app_snapshots("scrapedAt");
  CREATE INDEX CONCURRENTLY idx_keyword_snapshots_scraped_at ON keyword_snapshots("scrapedAt");
  ```
- [ ] Use `CONCURRENTLY` to avoid table locks
- [ ] Verify query plans with `EXPLAIN ANALYZE` after adding

**When task PLA-186 is completed, update this risk status to Fixed.**

---

### R-76: Docker Log Rotation Not Configured (Medium / High Likelihood)
**Risk Score: 10** | **Linear:** PLA-195

**Description:** Docker container logs on the VPS have no rotation configuration. Over time, logs fill the disk and eventually crash all services.

**Mitigation:**
- [ ] Configure Docker daemon log rotation (**PLA-195**)
  ```json
  // /etc/docker/daemon.json
  { "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "3" } }
  ```
- [ ] Alternatively, configure per-service in docker-compose.prod.yml

**When task PLA-195 is completed, update this risk status to Fixed.**

---

### R-77: Migration Runner Coupled to API Startup (Medium / Medium Likelihood)
**Risk Score: 10**

**Description:** See R-25. Migrations run on API startup, blocking all requests until complete. Long migrations can cause prolonged downtime.

---

### R-78: No CI/CD Pipeline (Medium / Low Likelihood)
**Risk Score: 8** | **Linear:** PLA-201

**Description:** No documented CI/CD pipeline. Deployments appear to be manual via Coolify. No automated testing before deploy, no rollback automation.

**Mitigation:**
- [ ] Set up GitHub Actions CI: lint + typecheck + test on every PR (**PLA-201**)
- [ ] Add deployment automation via Coolify webhooks or GitHub Actions CD
- [ ] Implement automatic rollback on health check failure

**When task PLA-201 is completed, update this risk status to Mitigated.**

---

### R-79: Stale "Running" Jobs Not Re-queued (Low / High Likelihood)
**Risk Score: 8**

**Description:** `cleanup-stale-runs.ts` marks stuck jobs as failed but doesn't re-enqueue them. Data gaps persist until the next scheduled slot (12-24h).

**Status:** Open. Related to R-10.

---

### R-80: No E2E Test Suite (Low / Low Likelihood)
**Risk Score: 4** | **Linear:** PLA-202

**Description:** 2,362 unit tests exist but no end-to-end tests verify the full user flow (login → track app → view dashboard → see rankings).

**Mitigation:**
- [ ] Create Playwright E2E test suite covering critical user journeys (**PLA-202**)
- [ ] Run E2E tests in CI against staging environment
- [ ] Cover: auth flow, app tracking, keyword tracking, admin panel

**When task PLA-202 is completed, update this risk status to Mitigated.**

---

## 21. Action Plan & Priority Matrix

### P0 — Critical / Immediate (This Week)

| # | Action | Risk | Effort | Linear |
|---|--------|------|--------|--------|
| 1 | Remove `new Function()` from Zoho parser | R-63 | 1h | PLA-173 |
| 2 | Rotate exposed secrets + add pre-commit scanning | R-64 | 2h | PLA-174 |
| 3 | Fix 3 failing Shopify parser tests | R-02 | 2h | PLA-175 |
| 4 | Set up automated daily PostgreSQL backup | R-15 | 4h | PLA-176 |
| 5 | Increase Redis maxmemory to 1GB | R-72 | 30min | PLA-177 |

### P1 — High Priority (Next 2 Weeks)

| # | Action | Risk | Effort | Linear |
|---|--------|------|--------|--------|
| 6 | Add Zod validation to all API request bodies | R-23 | 8h | PLA-178 |
| 7 | Add global API rate limiting | R-65 | 4h | PLA-179 |
| 8 | Implement deep health checks (DB + Redis) | R-69 | 3h | PLA-180 |
| 9 | Wrap multi-step operations in DB transactions | R-66 | 6h | PLA-181 |
| 10 | Fix empty catch blocks (add logging) | R-67 | 2h | PLA-182 |
| 11 | Fix password complexity on password change | R-20 | 1h | PLA-183 |
| 12 | Remove localhost from production CORS | R-19 | 30min | PLA-184 |
| 13 | Worker graceful shutdown | R-73 | 4h | PLA-185 |
| 14 | Add missing database indexes | R-75 | 2h | PLA-186 |

### P2 — Medium Priority (Next Month)

| # | Action | Risk | Effort | Linear |
|---|--------|------|--------|--------|
| 15 | Implement browser connection pooling | R-03 | 8h | PLA-187 |
| 16 | Integrate Sentry error tracking | R-32 | 4h | PLA-188 |
| 17 | Add Prometheus metrics + Grafana | R-33 | 8h | PLA-189 |
| 18 | Set up centralized logging | R-31 | 6h | PLA-190 |
| 19 | Implement data retention/cleanup job | R-38 | 6h | PLA-191 |
| 20 | Add request ID tracing | R-68 | 4h | PLA-192 |
| 21 | Implement dead letter queue | R-71 | 4h | PLA-193 |
| 22 | Implement Redis-backed token blacklist | R-21 | 4h | PLA-194 |
| 23 | Configure Docker log rotation | R-76 | 1h | PLA-195 |
| 24 | Separate migration runner from API startup | R-25 | 4h | PLA-196 |
| 25 | Add idempotency keys to critical endpoints | R-74 | 6h | PLA-197 |

### P3 — Long Term (Next Quarter)

| # | Action | Risk | Effort | Linear |
|---|--------|------|--------|--------|
| 26 | Implement rotating proxy pool | R-01 | 16h | PLA-198 |
| 27 | Implement circuit breaker for platform failures | R-01 | 8h | PLA-199 |
| 28 | Migrate DB to managed service | R-14 | 8h | PLA-200 |
| 29 | Set up GitHub Actions CI/CD | R-78 | 8h | PLA-201 |
| 30 | Create E2E test suite | R-80 | 16h | PLA-202 |

---

## 22. Linear Task Reference Table

This table maps each Linear ticket to its risk(s) and priority. **Update this section as tickets are created.**

| Linear Ticket | Title | Risk(s) | Priority | Status |
|---------------|-------|---------|----------|--------|
| PLA-130 | Fix SQL injection via `sql.raw()` in categories | R-23 | P0 | **Fixed** |
| PLA-173 | Remove `new Function()` from Zoho parser | R-63 | P0 | **Fixed** |
| PLA-174 | Rotate exposed secrets + add pre-commit scanning | R-64 | P0 | Todo |
| PLA-198 | Implement rotating proxy pool for scraping | R-01 | P3 | Todo |
| PLA-199 | Implement circuit breaker for platform failures | R-01 | P3 | Todo |
| PLA-175 | Fix failing Shopify parser tests (languages, integrations) | R-02 | P0 | **Fixed** |
| PLA-187 | Implement browser connection pooling | R-03 | P2 | Todo |
| PLA-200 | Migrate PostgreSQL to managed service | R-14 | P3 | Todo |
| PLA-176 | Set up automated daily PostgreSQL backup | R-15 | P0 | Todo |
| PLA-184 | Remove localhost from production CORS | R-19 | P1 | **Fixed** |
| PLA-183 | Fix password complexity on password change | R-20 | P1 | **Fixed** |
| PLA-194 | Implement Redis-backed token blacklist | R-21 | P2 | Todo |
| PLA-178 | Add Zod validation to all API request bodies | R-23 | P1 | Todo |
| PLA-196 | Separate migration runner from API startup | R-25 | P2 | Todo |
| PLA-190 | Set up centralized logging (Loki/ELK) | R-31 | P2 | Todo |
| PLA-188 | Integrate Sentry error tracking | R-32 | P2 | Todo |
| PLA-189 | Add Prometheus metrics + Grafana dashboards | R-33 | P2 | Todo |
| PLA-191 | Implement data retention/cleanup job | R-38 | P2 | Todo |
| PLA-179 | Add global API rate limiting | R-65 | P1 | **Fixed** |
| PLA-181 | Wrap multi-step operations in DB transactions | R-66 | P1 | **Fixed** |
| PLA-182 | Fix empty catch blocks (add error logging) | R-67 | P1 | **Fixed** |
| PLA-192 | Add request ID correlation/tracing | R-68 | P2 | Todo |
| PLA-180 | Implement deep health checks (DB + Redis) | R-69 | P1 | **Fixed** |
| PLA-193 | Implement dead letter queue for failed jobs | R-71 | P2 | Todo |
| PLA-177 | Increase Redis maxmemory to 1GB | R-72 | P0 | Todo |
| PLA-185 | Implement worker graceful shutdown | R-73 | P1 | **Fixed** |
| PLA-186 | Add missing database indexes on large tables | R-75 | P1 | **Fixed** |
| PLA-197 | Add idempotency keys to critical endpoints | R-74 | P2 | Todo |
| PLA-195 | Configure Docker log rotation | R-76 | P2 | Todo |
| PLA-201 | Set up GitHub Actions CI/CD pipeline | R-78 | P3 | Todo |
| PLA-202 | Create E2E test suite with Playwright | R-80 | P3 | Todo |

---

## Appendix A: Risk Register Summary (Updated)

| ID | Risk | Impact | Likelihood | Score | Status |
|----|------|--------|------------|-------|--------|
| R-01 | Platform rate limiting/IP blocking | 5 | 5 | 25 | **Partial** — 429 retry with backoff |
| R-02 | Scraper breakage (HTML/API changes) | 4 | 5 | 20 | **Active** — 3 failing tests |
| R-03 | Browser scraping failures | 4 | 5 | 20 | **Partial** — GWS fixed, no pooling |
| R-04 | Incomplete pagination data | 3 | 5 | 15 | Open |
| R-05 | Concurrent page navigation | 5 | 5 | 25 | **Partial** — GWS fixed |
| R-06 | Terms of Service violations | 4 | 5 | 20 | Open |
| R-07 | GDPR/privacy compliance | 5 | 4 | 20 | Open |
| R-08 | Intellectual property claims | 3 | 4 | 15 | Open |
| R-09 | Silent ranking data corruption | 5 | 3 | 15 | **Partial** — clamp validation |
| R-10 | Missing ranking days | 5 | 3 | 15 | Open |
| R-11 | Review data inconsistency | 2 | 3 | 10 | Open |
| R-12 | Stale data served to customers | 4 | 3 | 12 | **Partial** — DataFreshness component |
| R-13 | App slug changes break tracking | 4 | 3 | 12 | Open |
| R-14 | Single server failure | 5 | 5 | 25 | Open |
| R-15 | No database backup | 5 | 4 | 20 | Open |
| R-16 | Redis failure | 3 | 4 | 15 | **Mitigated** — AOF + maxmemory |
| R-17 | Server resource exhaustion | 5 | 3 | 15 | **Mitigated** — Docker limits |
| R-18 | Docker volume corruption | 4 | 3 | 12 | Open |
| R-19 | CORS misconfiguration | 5 | 2 | 10 | **Partial** — localhost still allowed |
| R-20 | Weak authentication | 5 | 4 | 20 | **Partial** — password change gap |
| R-21 | JWT security weaknesses | 3 | 4 | 15 | Open |
| R-22 | Secrets management | 5 | 3 | 15 | Open |
| R-23 | Input validation gaps | 5 | 2 | 10 | Open |
| R-24 | No zero-downtime deploy | 3 | 4 | 12 | Open |
| R-25 | Migration failures | 4 | 2 | 8 | Open |
| R-26 | No DB connection pooling | 2 | 5 | 10 | **Fixed** |
| R-27 | Key person dependency | 4 | 3 | 12 | Open |
| R-28 | Platform deprecation | 4 | 3 | 12 | Open |
| R-29 | Competitor detection | 5 | 1 | 5 | Open |
| R-30 | No external monitoring | 5 | 3 | 5 | **Mitigated** |
| R-31 | No centralized logging | 3 | 4 | 12 | Open |
| R-32 | No error tracking | 4 | 2 | 8 | Open |
| R-33 | No performance metrics | 2 | 5 | 10 | Open |
| R-34 | Dependency vulnerabilities | 4 | 3 | 12 | Open |
| R-35 | Node.js EOL | 5 | 1 | 5 | **Fixed** |
| R-36 | Platform count growth | 3 | 4 | 12 | Open |
| R-37 | Customer count growth | 3 | 4 | 12 | Open |
| R-38 | Data volume growth | 2 | 5 | 10 | Open |
| R-39 | Concurrent app upsert race | 5 | 4 | 20 | Open |
| R-40 | Category ranking TOCTOU | 3 | 4 | 15 | **Fixed** |
| R-41 | Cascade job partial enqueue | 3 | 4 | 15 | **Mitigated** |
| R-42 | Platform lock bypass | 4 | 3 | 12 | Open |
| R-43 | Silent digest failures | 3 | 4 | 15 | Open |
| R-44 | Email sender spoofing | 4 | 2 | 8 | Open |
| R-45 | Invitation email abuse | 3 | 3 | 12 | **Mitigated** |
| R-46 | Uncontrolled OpenAI costs | 5 | 4 | 20 | **Mitigated** |
| R-47 | Prompt injection via app names | 5 | 1 | 5 | Open |
| R-48 | AI feature dependency | 3 | 3 | 12 | Open |
| R-49 | Unicode keyword slug | 3 | 4 | 15 | Open |
| R-50 | Timezone mismatch | 3 | 5 | 15 | Open |
| R-51 | Special chars break search | 3 | 3 | 12 | Open |
| R-52 | Numeric edge cases | 2 | 3 | 8 | **Fixed** |
| R-53 | DST impact on schedule | 2 | 3 | 6 | Open |
| R-54 | Large HTML memory spikes | 2 | 5 | 10 | **Mitigated** |
| R-55 | Free tier abuse | 3 | 4 | 15 | **Partial** |
| R-56 | Package limits not enforced | 3 | 5 | 15 | Open |
| R-57 | No payment integration | 3 | 3 | 12 | Open |
| R-58 | Account deletion orphaning | 2 | 3 | 8 | Open |
| R-59 | Impersonation abuse | 4 | 2 | 8 | Open |
| R-60 | Cross-account data leak | 4 | 2 | 8 | Open |
| R-61 | Session hijacking shared PC | 4 | 2 | 8 | Open |
| R-62 | Cron schedule contention | 3 | 5 | 15 | **Mitigated** |
| **R-63** | **`new Function()` RCE in Zoho** | **5** | **4** | **20** | **Open** |
| **R-64** | **Exposed secrets in .env** | **5** | **4** | **20** | **Open** |
| **R-65** | **No API rate limiting** | **4** | **5** | **20** | **Open** |
| **R-66** | **No DB transactions** | **4** | **5** | **20** | **Open** |
| **R-67** | **Empty catch blocks** | **4** | **4** | **16** | **Open** |
| **R-68** | **No request ID tracing** | **3** | **4** | **12** | **Open** |
| **R-69** | **Shallow health checks** | **3** | **5** | **15** | **Open** |
| **R-70** | **URL-based admin auth** | **3** | **3** | **9** | **Open** |
| **R-71** | **No dead letter queue** | **2** | **3** | **8** | **Open** |
| **R-72** | **Redis maxmemory too low** | **4** | **5** | **20** | **Open** |
| **R-73** | **Worker graceful shutdown** | **3** | **4** | **15** | **Mitigated** |
| **R-74** | **No idempotency keys** | **3** | **4** | **12** | **Open** |
| **R-75** | **Missing DB indexes** | **2** | **3** | **10** | **Open** |
| **R-76** | **Docker log rotation** | **2** | **5** | **10** | **Open** |
| **R-77** | **Migration coupled to API** | **3** | **3** | **9** | **Open** |
| **R-78** | **No CI/CD pipeline** | **2** | **3** | **8** | **Open** |
| **R-79** | **Stale jobs not re-queued** | **2** | **4** | **8** | **Open** |
| **R-80** | **No E2E tests** | **2** | **2** | **4** | **Open** |

---

## Appendix B: Statistics

| Metric | V2 | V3 | Change |
|--------|----|----|--------|
| Total risks | 62 | 80 | +18 |
| Critical risks | 5 | 7 | +2 |
| High risks | 12 | 18 | +6 |
| Fixed/Mitigated | 17 | 17 | +0 |
| Open | 45 | 63 | +18 |
| Total risk score | 862 | 1,098 | +236 |
| Avg risk score | 13.9 | 13.7 | -0.2 |
| Linear tickets created | 0 | 30 | +30 |

---

*This document should be reviewed and updated quarterly, or immediately after any incident. When completing a Linear task linked to this document, update the corresponding risk status and mark mitigation items as done.*
