# AppRanks.io Pre-Release Checklist

> Created: 2026-04-01 | Updated: 2026-04-02
> Target: Production-ready public launch
> Progress: **18/49 total tasks done** | 28 new code tasks added | 3 need runtime

---

## P0 — Launch Blockers (Must have)

### 1. Authentication & Account Flows
Core auth flows must work flawlessly end-to-end.

- [ ] **Signup flow**
  - [ ] Email/password registration works correctly
  - [ ] Welcome email is sent and received
  - [ ] Account + owner user is created with correct defaults
  - [ ] JWT + refresh token are issued properly
  - [ ] Redirect to dashboard after signup
  - [ ] Duplicate email prevention with clear error message
  - [x] Input validation (password strength with visual indicator)

- [x] **Login flow**
  - [ ] Email/password login works correctly
  - [x] Login alert email is sent (IP, device info) → [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) `In Review` ✅
  - [x] Token refresh works seamlessly — proactive refresh 2min before expiry → [PLA-559](https://linear.app/plan-b-side-projects/issue/PLA-559) `In Review` ✅
  - [ ] Suspended account shows clear error
  - [ ] Rate limiting works (5 attempts / 15 min)
  - [ ] "Remember me" / session persistence works as expected

- [x] **Password reset flow** → [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) `In Review` ✅
  - [x] API endpoints implemented (`POST /forgot-password`, `POST /reset-password`)
  - [x] "Forgot password?" link on login page
  - [x] Reset email sent with secure token (SHA256 hash, 1-hour expiry)
  - [x] Reset page validates token and allows new password (`/reset-password?token=xxx`)
  - [x] Old sessions invalidated after password change (revokeAllTokensForUser)
  - [x] Rate limiting on reset requests (3/hour per IP)
  - [x] Password strength indicator on reset page → [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) `In Review` ✅

- [ ] **Logout flow**
  - [ ] Access token blacklisted via Redis
  - [ ] Refresh token revoked
  - [ ] Redirect to login page
  - [ ] "Revoke all sessions" works from settings

### 2. Team Invitation Flow
Multi-user account management must be reliable.

- [ ] **Invitation sending**
  - [ ] Owner can invite via email
  - [ ] Invitation email is received with correct link
  - [ ] Duplicate invitation prevention
  - [ ] Daily limit enforced (10/day)
  - [ ] Pending invitation count toward user limits

- [ ] **Invitation acceptance**
  - [ ] Accept link works (`/invite/accept/[token]`)
  - [ ] User account is created correctly with assigned role
  - [ ] Expired token (7 days) shows clear error
  - [ ] Already-used token shows clear error

- [ ] **Member management**
  - [ ] Owner can list, update roles, remove members
  - [ ] Removed user can no longer access the account
  - [ ] Owner can cancel pending invitations

### 3. Email Delivery
All transactional emails must be delivered reliably.

- [ ] **SMTP configuration verified**
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` set
  - [ ] SPF, DKIM, DMARC records configured for `appranks.io`
  - [ ] Test email delivery to Gmail, Outlook, Yahoo (check spam folders)

- [ ] **Email templates verified**
  - [ ] Welcome email — content, links, branding correct
  - [ ] Invitation email — accept link works, branding correct
  - [ ] Password reset email — reset link works, 1-hour expiry noted
  - [ ] Login alert email — IP, device, location info correct

- [ ] **Email queue health**
  - [ ] BullMQ worker processes emails (3 concurrent)
  - [ ] Failed emails retry with exponential backoff
  - [ ] Dead letter queue monitored for stuck emails
  - [ ] Email logs stored in DB (sent/failed/bounced status)

### 4. Payment Integration
Billing system for subscription management.

- [ ] **Stripe integration**
  - [ ] ⚠️ **Needs full implementation** — no payment code exists yet
  - [ ] Stripe account created and configured
  - [ ] Products and prices created in Stripe dashboard
  - [ ] Checkout session creation for new subscriptions
  - [ ] Webhook handler for payment events (success, failure, cancellation)
  - [ ] Customer portal for self-service billing management

- [ ] **Subscription plans**
  - [ ] Plan tiers defined (Free, Pro, Business, Enterprise?)
  - [ ] Limits per plan: tracked apps, users, keywords, platforms
  - [x] Plan comparison / pricing page → [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) `In Review` ✅
  - [ ] Free trial period configured (if applicable)

- [ ] **Billing enforcement**
  - [ ] Account limits enforced based on active plan
  - [ ] Upgrade prompts when limits reached
  - [ ] Graceful handling of failed payments (grace period?)
  - [ ] Downgrade flow — what happens to excess data?
  - [ ] Invoice generation and email delivery

### 5. Platform Scrapers (minimum 5 stable)
At least 5 platforms must scrape reliably in production.

- [ ] **Scraper stability** → [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) `Todo`
  - [ ] Shopify — fully tested, most mature
  - [ ] WordPress — HTTP only, stable
  - [ ] Atlassian — REST API, stable (API deprecated June 2026, plan migration)
  - [ ] HubSpot — CHIRP API, HTTP only, stable
  - [ ] Wix — HTTP only, stable
  - [ ] (Bonus) Zendesk, Salesforce, Google Workspace, Zoom, Zoho, Canva

- [ ] **Per-platform verification**
  - [ ] App search returns results
  - [ ] App detail page data is complete
  - [ ] Category listing works
  - [ ] Reviews fetched (where available)
  - [ ] Featured/trending sections populated
  - [ ] Keyword tracking records rank changes
  - [ ] Run `./scripts/smoke-test.sh --platform <name>` for each

- [ ] **Scraper resilience**
  - [ ] Retry logic with exponential backoff
  - [ ] Timeout handling (no indefinite hangs)
  - [ ] Graceful degradation on partial failure (1 platform failing doesn't affect others)
  - [ ] Stale data detection — alert if a platform hasn't updated in X hours
  - [ ] Browser pool management (for Playwright-dependent platforms)

---

## P1 — Critical for Reliability

### 6. Error Logging & Monitoring
Visibility into production issues.

- [ ] **Sentry (backend — already configured)**
  - [ ] Verify DSN is set in production env
  - [ ] Verify errors are captured and appearing in Sentry dashboard
  - [ ] Source maps uploaded for readable stack traces
  - [ ] Alert rules configured (email/Slack on new errors)

- [x] **Sentry (frontend)** → [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) `In Review` ✅
  - [x] `@sentry/nextjs` v10 installed + `withSentryConfig` wrapper
  - [x] `global-error.tsx` + 4 route-level error boundaries report to Sentry
  - [x] `ErrorBoundary` component reports via `componentDidCatch`
  - [x] `instrumentation.ts` with server/edge/client configs (10% trace sample)
  - [ ] **Needs prod setup:** Set `NEXT_PUBLIC_SENTRY_DSN` env var

- [ ] **Structured logging**
  - [ ] Pino JSON logs flowing to log aggregation (Loki or ELK)
  - [ ] Grafana dashboard imported and showing API metrics
  - [ ] Log retention policy set (30 days minimum)
  - [ ] Request IDs traceable across API logs

- [ ] **Alerting**
  - [ ] API down / health check failure → alert
  - [ ] Scraper failure → alert
  - [ ] Email queue backlog → alert
  - [ ] High error rate → alert
  - [ ] Database connection failures → alert

### 7. Session Recording
Understand real user behavior and debug UX issues.

- [ ] **Session recording tool setup**
  - [ ] ⚠️ **Needs full implementation** — no session recording exists
  - [ ] Choose provider: PostHog (self-hosted option), LogRocket, or Hotjar
  - [ ] Install SDK in dashboard app
  - [ ] Configure privacy settings (mask sensitive inputs, exclude auth pages)
  - [ ] Set sampling rate (don't record 100% — start with 10-20%)

- [ ] **Key tracking points**
  - [ ] User sessions recorded with userId linkage
  - [ ] Rage clicks and error moments highlighted
  - [ ] Session replay accessible from error reports (Sentry integration)
  - [ ] Funnel visualization: signup → first app tracked → regular usage

### 8. Product Analytics & Event Tracking
Track critical user actions to understand product usage.

- [ ] **Analytics platform setup**
  - [ ] ⚠️ **Needs full implementation** — no analytics exists
  - [ ] Choose provider: PostHog (can combine with session recording), Mixpanel, or Amplitude
  - [ ] Install SDK in dashboard and API

- [ ] **Critical events to track**
  - [ ] `user_signed_up` — plan, referral source
  - [ ] `user_logged_in` — frequency, device
  - [ ] `app_tracked` — platform, first vs returning
  - [ ] `keyword_tracked` — platform, keyword count
  - [ ] `competitor_added` — platform, app pair
  - [ ] `report_viewed` — which report, time spent
  - [ ] `plan_upgraded` / `plan_downgraded`
  - [ ] `team_member_invited`
  - [ ] `search_performed` — query, platform, results count

- [ ] **Network operation tracking**
  - [ ] API response times by endpoint
  - [ ] External API call durations (Shopify, Stripe, etc.)
  - [ ] Failed request rates and error types
  - [ ] Slow query identification

### 9. Database Backup & Maintenance
Protect against data loss.

- [ ] **Automated backups**
  - [ ] Backup script exists (`scripts/backup-db.sh`) — verify it runs in production
  - [ ] Cron job set: `0 2 * * *` (daily at 2 AM)
  - [ ] Compressed dumps stored locally (30-day retention)
  - [ ] Off-site upload to S3/Backblaze B2 configured (`--upload` flag)
  - [ ] Off-site retention: 30 days minimum

- [ ] **Backup verification**
  - [ ] Test restore from backup on a separate environment
  - [ ] Verify table counts and data integrity post-restore
  - [ ] Backup completion monitoring (alert on failure)

- [x] **Expired data cleanup** → [PLA-551](https://linear.app/plan-b-side-projects/issue/PLA-551) `In Review` ✅
  - [x] Scheduled job every 6h: expired refresh tokens, password reset tokens, invitations
  - [x] Email log retention (90 days)
  - [x] Idempotent, logs deletion counts

- [ ] **Advanced (post-launch)**
  - [ ] WAL archiving for point-in-time recovery
  - [ ] Automated restore testing (weekly cron)

---

## P2 — Important for Scale & Security

### 10. Rate Limiting & Abuse Prevention
Protect API from abuse and brute force.

- [ ] **Current rate limits (already implemented)**
  - [ ] Login: 5 req / 15 min per IP ✅
  - [ ] Registration: 3 req / 15 min per IP ✅
  - [ ] Authenticated: 100 req / min per user ✅
  - [ ] Unauthenticated: 30 req / min per IP ✅

- [x] **Redis rate limiting** → [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) `In Review` ✅
  - [x] Migrated to Redis-backed rate limiter with in-memory fallback (fail-open)
  - [x] Namespaced keys: `rl:{namespace}:{key}:{windowId}` with TTL
  - [x] Rate limit on password reset endpoint (3/hour per IP)
  - [x] `checkAsync()` for accurate distributed counts from Redis
  - [x] X-RateLimit-* response headers → [PLA-561](https://linear.app/plan-b-side-projects/issue/PLA-561) `In Review` ✅
  - [ ] Rate limit on invitation endpoint (beyond daily count)
  - [ ] Cloudflare WAF rules for bot protection

### 11. Site Performance
Fast load times and smooth UX.

- [ ] **Frontend performance** → [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) `Todo`
  - [ ] Lighthouse score > 80 on key pages (landing, dashboard, app detail)
  - [ ] Bundle size analysis — remove unused dependencies
  - [ ] Image optimization (next/image, WebP format)
  - [ ] Lazy loading for below-fold components
  - [ ] Route-level code splitting verified

- [ ] **API performance** → [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) `In Review` ✅ (caching) / [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) `Todo` (DB optimization)
  - [ ] Response times < 200ms for dashboard endpoints
  - [ ] Database query optimization (check for N+1, missing indexes) — **PLA-546 Todo**
  - [ ] Redis caching for frequently accessed data (app listings, categories)
  - [x] HTTP caching headers (Cache-Control tiered: 1hr/5min/1min/30s + `Vary` for CDN)
  - [x] ETag generation (MD5 hash) + 304 Not Modified responses
  - [x] Connection pooling isolated (API: max 10, Worker: max 5)
  - [x] Request timeout 30s + graceful shutdown → [PLA-563](https://linear.app/plan-b-side-projects/issue/PLA-563) `In Review` ✅

- [x] **Scraper isolation** → [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) `In Review` ✅
  - [x] DB connection pool isolation (API: max 10/30s, Worker: max 5/60s)
  - [x] HTTP-level circuit breaker: failures wired to per-platform circuit (5 failures → 1hr open)
  - [x] Circuit breaker already existed at job level (Redis-backed, per-platform)
  - [ ] Separate worker containers with resource limits (CPU/memory caps) — Docker config
  - [ ] Scraper scheduling spread across time windows (not all at once)

---

## P3 — Nice to Have for Launch

### 12. Landing Page & Marketing
Public-facing pages that drive signups.

- [ ] **Existing pages (verify)**
  - [ ] Landing page (`/`) — hero, features, CTA sections
  - [ ] Public app browsing (`/apps/[platform]`, `/best/[platform]`)
  - [ ] Privacy Policy (`/privacy`) — content reviewed by legal
  - [ ] Terms of Service (`/terms`) — content reviewed by legal

- [x] **Pages added**
  - [x] Pricing page → [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) `In Review` ✅
  - [x] Custom 404 page → [PLA-553](https://linear.app/plan-b-side-projects/issue/PLA-553) `In Review` ✅
  - [ ] Blog / content marketing section (optional for launch)
  - [ ] Changelog / what's new page (optional)

- [x] **SEO** → [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) `In Review` ✅
  - [x] Root layout: `metadataBase`, Open Graph, Twitter Card metadata
  - [x] `sitemap.ts` — dynamic sitemap with ISR (6hr revalidation), includes /privacy, /terms, /pricing
  - [x] `robots.ts` — disallows dashboard/auth/API routes
  - [x] Dynamic OG image (`opengraph-image.tsx`, edge runtime, 1200x630)
  - [x] Auth pages noindex/nofollow
  - [x] `buildMetadata()` helper + JSON-LD components already in use on marketing pages

### 13. Deployment & Infrastructure
Production environment hardened and documented.

- [x] **Environment variables** → [PLA-555](https://linear.app/plan-b-side-projects/issue/PLA-555) `In Review` ✅
  - [x] `.env.example` files for all packages (API, Dashboard, Scraper)
  - [ ] All required env vars set in production
  - [ ] Secrets stored securely (not in git)

- [ ] **SSL & Domain**
  - [ ] `appranks.io` — SSL via Cloudflare
  - [ ] `api.appranks.io` — SSL via Cloudflare
  - [ ] Force HTTPS redirect

- [x] **Security headers** → [PLA-550](https://linear.app/plan-b-side-projects/issue/PLA-550) `In Review` ✅
  - [x] HSTS (Strict-Transport-Security: max-age=31536000)
  - [x] X-Content-Type-Options: nosniff
  - [x] X-Frame-Options: DENY
  - [x] Referrer-Policy, Permissions-Policy
  - [x] Applied to both API (onRequest hook) and Dashboard (next.config.ts headers)

- [ ] **Docker & Coolify**
  - [ ] All containers health-checked
  - [ ] Restart policies configured (always restart)
  - [ ] Resource limits set (CPU, memory per container)
  - [ ] Zero-downtime deployment strategy

### 14. UX Polish & Data

- [x] **Accessibility** → [PLA-554](https://linear.app/plan-b-side-projects/issue/PLA-554) `In Review` ✅
  - [x] `aria-hidden="true"` on 50+ decorative app icon images (30 files)

- [x] **Password UX** → [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) `In Review` ✅
  - [x] Visual password strength indicator on register and reset-password pages

- [x] **CSV export** → [PLA-560](https://linear.app/plan-b-side-projects/issue/PLA-560) `In Review` ✅
  - [x] `GET /api/export/tracked-apps` — CSV download of tracked apps
  - [x] `GET /api/export/keywords` — CSV download of tracked keywords

- [ ] **Remaining (Backlog)**
  - [ ] Email verification flow → [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) `Backlog`
  - [ ] Account deletion + data export (GDPR) → [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) `Backlog`
  - [ ] Command palette (Cmd+K) → [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) `Backlog`
  - [ ] Onboarding wizard → [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) `Backlog`
  - [ ] Account activity feed → [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) `Backlog`

---

## Summary

| Priority | Category | Status | Linear | Effort |
|----------|----------|--------|--------|--------|
| P0 | Password Reset | ✅ Done | [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | ~~S~~ Done |
| P0 | Login Alert Email | ✅ Done | [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) | ~~S~~ Done |
| P0 | Team Invitations | ✅ Implemented | — | — |
| P0 | Email Delivery | ⚠️ SMTP + DNS needed | 🔧 Manual | S |
| P0 | Payment Integration | ❌ Not started | 🔧 Manual | XL |
| P0 | Platform Scrapers (5+) | ⚠️ Need smoke testing | [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) `Todo` | M |
| P1 | Sentry (frontend) | ✅ Done | [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | ~~M~~ Done |
| P1 | Session Recording | ❌ Not started | 🔧 Manual | M |
| P1 | Product Analytics | ❌ Not started | 🔧 Manual | L |
| P1 | DB Backup | ⚠️ Needs prod setup | 🔧 Manual | S |
| P1 | Expired Data Cleanup | ✅ Done | [PLA-551](https://linear.app/plan-b-side-projects/issue/PLA-551) | ~~S~~ Done |
| P2 | Redis Rate Limiting | ✅ Done | [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | ~~M~~ Done |
| P2 | Rate Limit Headers | ✅ Done | [PLA-561](https://linear.app/plan-b-side-projects/issue/PLA-561) | ~~S~~ Done |
| P2 | API Caching + ETag | ✅ Done | [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | ~~S~~ Done |
| P2 | DB Query Optimization | ⚠️ Needs audit | [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) `Todo` | M |
| P2 | Scraper Isolation | ✅ Done | [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | ~~M~~ Done |
| P2 | Frontend Performance | ⚠️ Needs audit | [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) `Todo` | M |
| P2 | Security Headers | ✅ Done | [PLA-550](https://linear.app/plan-b-side-projects/issue/PLA-550) | ~~S~~ Done |
| P2 | Request Timeout | ✅ Done | [PLA-563](https://linear.app/plan-b-side-projects/issue/PLA-563) | ~~S~~ Done |
| P2 | Session Timeout | ✅ Done | [PLA-559](https://linear.app/plan-b-side-projects/issue/PLA-559) | ~~S~~ Done |
| P3 | SEO | ✅ Done | [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) | ~~S~~ Done |
| P3 | Pricing Page | ✅ Done | [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) | ~~M~~ Done |
| P3 | Custom 404 | ✅ Done | [PLA-553](https://linear.app/plan-b-side-projects/issue/PLA-553) | ~~S~~ Done |
| P3 | Accessibility | ✅ Done | [PLA-554](https://linear.app/plan-b-side-projects/issue/PLA-554) | ~~S~~ Done |
| P3 | Env Documentation | ✅ Done | [PLA-555](https://linear.app/plan-b-side-projects/issue/PLA-555) | ~~S~~ Done |
| P3 | Password Strength | ✅ Done | [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) | ~~S~~ Done |
| P3 | CSV Export | ✅ Done | [PLA-560](https://linear.app/plan-b-side-projects/issue/PLA-560) | ~~S~~ Done |
| P3 | Landing/Marketing | ⚠️ Pricing done, blog optional | 🔧 Manual | S |
| P3 | Deployment/Infra | ⚠️ Needs hardening | 🔧 Manual | S |

**Legend:** S = Small (1-2 days), M = Medium (3-5 days), L = Large (1-2 weeks), XL = Extra Large (2-3 weeks)

### Linear Task Reference

| Task | Status | Category | Description |
|------|--------|----------|-------------|
| [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | ✅ In Review | Auth | Password reset flow (API + Dashboard) |
| [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | ⏳ Todo | Scrapers | Smoke test all 11 platforms, fix failures |
| [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | ✅ In Review | Monitoring | Frontend Sentry error tracking |
| [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | ✅ In Review | Security | Redis-based rate limiting |
| [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | ✅ In Review | Performance | HTTP caching headers + ETag on public endpoints |
| [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | ⏳ Todo | Performance | Database query optimization & indexes |
| [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | ✅ In Review | Performance | Scraper-API isolation (pools, circuit breaker) |
| [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | ⏳ Todo | Performance | Bundle analysis & frontend optimization |
| [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) | ✅ In Review | SEO | Sitemap, robots.txt, meta tags, Open Graph |
| [PLA-550](https://linear.app/plan-b-side-projects/issue/PLA-550) | ✅ In Review | Security | HTTP security headers (HSTS, X-Frame-Options, etc.) |
| [PLA-551](https://linear.app/plan-b-side-projects/issue/PLA-551) | ✅ In Review | DB | Scheduled cleanup for expired tokens/invitations |
| [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) | ✅ In Review | Marketing | Pricing page with plan comparison |
| [PLA-553](https://linear.app/plan-b-side-projects/issue/PLA-553) | ✅ In Review | UX | Custom 404 not-found page |
| [PLA-554](https://linear.app/plan-b-side-projects/issue/PLA-554) | ✅ In Review | A11y | Accessibility fixes (decorative images, aria-labels) |
| [PLA-555](https://linear.app/plan-b-side-projects/issue/PLA-555) | ✅ In Review | DevOps | Comprehensive .env.example files |
| [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) | ⏳ Backlog | Auth | Email verification flow |
| [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) | ✅ In Review | Auth | Login alert email wired to endpoint |
| [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) | ⏳ Backlog | Auth | Account deletion + GDPR data export |
| [PLA-559](https://linear.app/plan-b-side-projects/issue/PLA-559) | ✅ In Review | UX | Session timeout warning + auto-refresh |
| [PLA-560](https://linear.app/plan-b-side-projects/issue/PLA-560) | ✅ In Review | Data | CSV export for tracked apps and keywords |
| [PLA-561](https://linear.app/plan-b-side-projects/issue/PLA-561) | ✅ In Review | API | X-RateLimit-* response headers |
| [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) | ✅ In Review | UX | Password strength indicator |
| [PLA-563](https://linear.app/plan-b-side-projects/issue/PLA-563) | ✅ In Review | Reliability | Request timeout + graceful shutdown |
| [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) | ⏳ Backlog | UX | Command palette (Cmd+K) |
| [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) | ⏳ Backlog | UX | Onboarding wizard |
| [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) | ⏳ Backlog | Data | Account activity feed |

### New Tasks (Batch 3 — 2026-04-02)

#### Security & Auth

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-568](https://linear.app/plan-b-side-projects/issue/PLA-568) | 🟡 Medium | Account lockout after 10 failed logins |
| [PLA-573](https://linear.app/plan-b-side-projects/issue/PLA-573) | 🔵 Low | Refresh token device fingerprinting (UA binding) |
| [PLA-594](https://linear.app/plan-b-side-projects/issue/PLA-594) | 🟡 Medium | Cookie security flags (Secure, SameSite) |

#### API Quality

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-567](https://linear.app/plan-b-side-projects/issue/PLA-567) | 🟡 Medium | CORS preflight caching + gzip compression |
| [PLA-582](https://linear.app/plan-b-side-projects/issue/PLA-582) | 🟡 Medium | Zod schema validation audit (all endpoints) |
| [PLA-588](https://linear.app/plan-b-side-projects/issue/PLA-588) | 🟡 Medium | Standardize API error responses + error codes |
| [PLA-586](https://linear.app/plan-b-side-projects/issue/PLA-586) | 🟡 Medium | E2E integration tests for critical user flows |

#### Payment (code skeleton — no Stripe account needed)

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-590](https://linear.app/plan-b-side-projects/issue/PLA-590) | 🟡 Medium | Stripe webhook handler skeleton + billing routes + DB schema |
| [PLA-591](https://linear.app/plan-b-side-projects/issue/PLA-591) | 🟡 Medium | Billing enforcement middleware + upgrade prompts in dashboard |

#### Dashboard UX

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-569](https://linear.app/plan-b-side-projects/issue/PLA-569) | 🟡 Medium | Toast notification system for action feedback |
| [PLA-570](https://linear.app/plan-b-side-projects/issue/PLA-570) | 🔵 Low | Breadcrumb navigation on nested pages |
| [PLA-571](https://linear.app/plan-b-side-projects/issue/PLA-571) | 🔵 Low | Empty state illustrations for list pages |
| [PLA-574](https://linear.app/plan-b-side-projects/issue/PLA-574) | 🔵 Low | List virtualization (react-window) for large tables |
| [PLA-575](https://linear.app/plan-b-side-projects/issue/PLA-575) | 🔵 Low | Date range picker for historical charts |
| [PLA-576](https://linear.app/plan-b-side-projects/issue/PLA-576) | 🟡 Medium | Responsive table scrolling on mobile |
| [PLA-580](https://linear.app/plan-b-side-projects/issue/PLA-580) | 🔵 Low | Table sort/filter persistence in URL params |
| [PLA-589](https://linear.app/plan-b-side-projects/issue/PLA-589) | 🔵 Low | App icon broken image fallback component |
| [PLA-593](https://linear.app/plan-b-side-projects/issue/PLA-593) | 🟡 Medium | Loading skeleton for all pages missing loading.tsx |
| [PLA-585](https://linear.app/plan-b-side-projects/issue/PLA-585) | 🔵 Low | Keyboard shortcuts help modal (Shift+?) |

#### Admin & Monitoring

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-572](https://linear.app/plan-b-side-projects/issue/PLA-572) | 🔵 Low | Impersonation audit log UI |
| [PLA-577](https://linear.app/plan-b-side-projects/issue/PLA-577) | 🔵 Low | Admin health dashboard (Redis, pool, queue metrics) |
| [PLA-578](https://linear.app/plan-b-side-projects/issue/PLA-578) | 🔵 Low | Dead letter queue monitoring UI |
| [PLA-581](https://linear.app/plan-b-side-projects/issue/PLA-581) | 🔵 Low | Email template preview + test send in admin |
| [PLA-584](https://linear.app/plan-b-side-projects/issue/PLA-584) | 🔵 Low | Scraper job success/failure charts in admin |
| [PLA-587](https://linear.app/plan-b-side-projects/issue/PLA-587) | 🔵 Low | Notification badge real-time polling |
| [PLA-592](https://linear.app/plan-b-side-projects/issue/PLA-592) | 🔵 Low | Backup status monitoring endpoint + admin UI |

#### Performance

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-579](https://linear.app/plan-b-side-projects/issue/PLA-579) | 🔵 Low | Migrate app icons to next/image (lazy load) |

#### Documentation

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-583](https://linear.app/plan-b-side-projects/issue/PLA-583) | 🔵 Low | Create CONTRIBUTING.md |

---

### Previously Remaining Tasks

#### Need runtime environment

| Task | What's needed | Blocker |
|------|--------------|---------|
| [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | Run smoke tests, fix broken scrapers | Live network access to marketplace APIs |
| [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | EXPLAIN ANALYZE on slow queries, add indexes | Live database for profiling |
| [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | `@next/bundle-analyzer` build, Lighthouse audit | Runtime build profiling |

#### Manual (require user action/decisions)

| Category | What's needed | Why manual |
|----------|--------------|------------|
| Email Delivery | SMTP config, SPF/DKIM/DMARC DNS records | Requires DNS provider access |
| Session Recording | Choose provider (PostHog/LogRocket/Hotjar) | Requires provider decision + account setup |
| Product Analytics | Choose provider (PostHog/Mixpanel/Amplitude) | Requires provider decision + account setup |
| DB Backup Cron | Production cron job setup | Requires server SSH |
| Deployment/Infra | Cloudflare WAF, Docker resource limits | Requires Cloudflare + Coolify access |

#### Backlog (post-launch candidates)

| Task | Description |
|------|-------------|
| [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) | Email verification flow (API + Dashboard) |
| [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) | Account deletion + GDPR data export |
| [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) | Command palette (Cmd+K) global search |
| [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) | Onboarding wizard for new users |
| [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) | Account activity feed |
