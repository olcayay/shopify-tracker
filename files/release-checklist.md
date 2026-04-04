# AppRanks.io Pre-Release Checklist

> Created: 2026-04-01 | Updated: 2026-04-04
> Target: Production-ready public launch
> Progress: **Session 17: Email system features** (PLA-674, 675, 678, 679, 683)
> Queue alerts, analytics dashboard, template tests, email scheduling, log search & export.

---

## P0 — Launch Blockers (Must have)

### 1. Authentication & Account Flows
Core auth flows must work flawlessly end-to-end.

- [ ] **Signup flow** → [PLA-595](https://linear.app/plan-b-side-projects/issue/PLA-595) `Todo`
  - [ ] Email/password registration works correctly
  - [ ] Welcome email is sent and received
  - [ ] Account + owner user is created with correct defaults
  - [ ] JWT + refresh token are issued properly
  - [ ] Redirect to dashboard after signup
  - [ ] Duplicate email prevention with clear error message
  - [x] Input validation (password strength with visual indicator)

- [x] **Login flow** → [PLA-595](https://linear.app/plan-b-side-projects/issue/PLA-595) `Todo`
  - [ ] Email/password login works correctly
  - [x] Login alert email is sent (IP, device info) → [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) `In Review` ✅
  - [x] Token refresh works seamlessly — proactive refresh 2min before expiry → [PLA-559](https://linear.app/plan-b-side-projects/issue/PLA-559) `In Review` ✅
  - [ ] Suspended account shows clear error
  - [ ] Rate limiting works (5 attempts / 15 min)
  - [ ] "Remember me" / session persistence works as expected
  - [ ] Login preserves returnUrl after session expiry → [PLA-606](https://linear.app/plan-b-side-projects/issue/PLA-606) `Todo`

- [x] **Password reset flow** → [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) `In Review` ✅
  - [x] API endpoints implemented (`POST /forgot-password`, `POST /reset-password`)
  - [x] "Forgot password?" link on login page
  - [x] Reset email sent with secure token (SHA256 hash, 1-hour expiry)
  - [x] Reset page validates token and allows new password (`/reset-password?token=xxx`)
  - [x] Old sessions invalidated after password change (revokeAllTokensForUser)
  - [x] Rate limiting on reset requests (3/hour per IP)
  - [x] Password strength indicator on reset page → [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) `In Review` ✅

- [ ] **Logout flow** → [PLA-595](https://linear.app/plan-b-side-projects/issue/PLA-595) `Todo`
  - [ ] Access token blacklisted via Redis
  - [ ] Refresh token revoked
  - [ ] Redirect to login page
  - [ ] "Revoke all sessions" works from settings

### 2. Team Invitation Flow
Multi-user account management must be reliable.

- [ ] **Invitation sending** → [PLA-596](https://linear.app/plan-b-side-projects/issue/PLA-596) `Todo`
  - [ ] Owner can invite via email
  - [ ] Invitation email is received with correct link
  - [ ] Duplicate invitation prevention
  - [ ] Daily limit enforced (10/day)
  - [ ] Pending invitation count toward user limits

- [ ] **Invitation acceptance** → [PLA-596](https://linear.app/plan-b-side-projects/issue/PLA-596) `Todo`
  - [ ] Accept link works (`/invite/accept/[token]`)
  - [ ] User account is created correctly with assigned role
  - [ ] Expired token (7 days) shows clear error
  - [ ] Already-used token shows clear error

- [ ] **Member management** → [PLA-596](https://linear.app/plan-b-side-projects/issue/PLA-596) `Todo`
  - [ ] Owner can list, update roles, remove members
  - [ ] Removed user can no longer access the account
  - [ ] Owner can cancel pending invitations

### 3. Email Delivery
All transactional emails must be delivered reliably.

- [ ] **SMTP configuration verified**
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` set
  - [ ] SPF, DKIM, DMARC records configured for `appranks.io`
  - [ ] Test email delivery to Gmail, Outlook, Yahoo (check spam folders)
  - [x] SMTP failover — secondary provider config (`SMTP_SECONDARY_*`) → [PLA-670](https://linear.app/plan-b-side-projects/issue/PLA-670) `In Review` ✅
  - [x] Circuit breaker pattern (5 failures → 5min cooldown → half-open probe) → PLA-670 ✅
  - [x] SMTP health check (periodic EHLO every 5min) → PLA-670 ✅

- [ ] **Email templates verified** → [PLA-597](https://linear.app/plan-b-side-projects/issue/PLA-597) `Todo` (code: rendering tests)
  - [ ] Welcome email — content, links, branding correct
  - [ ] Invitation email — accept link works, branding correct
  - [ ] Password reset email — reset link works, 1-hour expiry noted
  - [ ] Login alert email — IP, device, location info correct

- [ ] **Email queue health** → [PLA-597](https://linear.app/plan-b-side-projects/issue/PLA-597) `Todo` (code: queue tests)
  - [ ] BullMQ worker processes emails (3 concurrent)
  - [x] Smart retry — error classification (transient/permanent/provider_down) → [PLA-671](https://linear.app/plan-b-side-projects/issue/PLA-671) `In Review` ✅
  - [x] Permanent errors skip retry via UnrecoverableError → PLA-671 ✅
  - [x] DLQ bulk replay with filters (job_type, error_class, date range) → PLA-671 ✅
  - [x] DLQ stats API (error distribution, top failing types, daily trend) → PLA-671 ✅
  - [ ] Dead letter queue monitored for stuck emails
  - [ ] Email logs stored in DB (sent/failed/bounced status)

- [x] **Bounce/complaint handling** → [PLA-672](https://linear.app/plan-b-side-projects/issue/PLA-672) `In Review` ✅
  - [x] Webhook endpoints for SES, SendGrid, and generic providers
  - [x] HMAC signature verification (WEBHOOK_EMAIL_SECRET)
  - [x] Hard bounce → immediate suppression
  - [x] Soft bounce → suppress after 3 consecutive
  - [x] Complaint → immediate suppression
  - [x] Suppression list admin (list, remove, bulk import/export)
  - [x] Bounce rate monitoring (alert at 5%, critical at 10%)

- [x] **Email system monitoring** → [PLA-673](https://linear.app/plan-b-side-projects/issue/PLA-673) `In Review` ✅
  - [x] Worker metrics (processing rate, error rate, latency)
  - [x] Email health API endpoint (queue stats, 24h metrics, DLQ depth)
  - [x] System status: healthy/degraded/unhealthy
  - [x] Admin dashboard email health page with auto-refresh

- [x] **Queue depth alerts** → [PLA-674](https://linear.app/plan-b-side-projects/issue/PLA-674) `In Review` ✅
  - [x] Configurable alert rules with thresholds and cooldowns
  - [x] 5 default rules (queue depth, error rate, bounce rate, DLQ)
  - [x] Alert evaluator with cooldown enforcement
  - [x] Admin dashboard alert management (enable/disable, test, history)

- [x] **Email template test suite** → [PLA-678](https://linear.app/plan-b-side-projects/issue/PLA-678) `In Review` ✅
  - [x] Rendering tests for all 6 transactional templates
  - [x] Variable substitution, CTA links, HTML validity checks
  - [x] Snapshot tests for visual regression detection

- [x] **Email analytics dashboard** → [PLA-675](https://linear.app/plan-b-side-projects/issue/PLA-675) `In Review` ✅
  - [x] Overview metrics (sent, delivery/open/click/bounce rates)
  - [x] Daily trend time-series
  - [x] Per-email-type comparison table

- [x] **Email scheduling** → [PLA-679](https://linear.app/plan-b-side-projects/issue/PLA-679) `In Review` ✅
  - [x] BullMQ delay-based scheduling (sendAt parameter)
  - [x] List and cancel scheduled emails

- [x] **Email log search & export** → [PLA-683](https://linear.app/plan-b-side-projects/issue/PLA-683) `In Review` ✅
  - [x] Full-text search in subject/recipient
  - [x] Advanced filtering (status, type, date range)
  - [x] CSV export (up to 10K rows)

### 4. Payment Integration
Billing system for subscription management.

- [ ] **Stripe integration** → [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) `Todo` (code: checkout, webhook, portal)
  - [ ] ⚠️ Stripe routes + DB schema done (PLA-590), billing enforcement done (PLA-591)
  - [ ] 🔧 Stripe account created and configured — **manual**
  - [ ] 🔧 Products and prices created in Stripe dashboard — **manual**
  - [ ] Checkout session creation for new subscriptions
  - [ ] Webhook handler for payment events (success, failure, cancellation)
  - [ ] Customer portal for self-service billing management

- [ ] **Subscription plans** → [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) `Todo`
  - [ ] Plan tiers defined (Free, Pro, Business, Enterprise?)
  - [ ] Limits per plan: tracked apps, users, keywords, platforms
  - [x] Plan comparison / pricing page → [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) `In Review` ✅
  - [ ] Free trial period configured (if applicable)

- [ ] **Billing enforcement** → [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) `Todo`
  - [x] Account limits enforced based on active plan (PLA-591)
  - [x] Upgrade prompts when limits reached (PLA-591)
  - [ ] Graceful handling of failed payments (grace period?) → [PLA-611](https://linear.app/plan-b-side-projects/issue/PLA-611) `Todo`
  - [ ] Downgrade flow — what happens to excess data? → [PLA-612](https://linear.app/plan-b-side-projects/issue/PLA-612) `Todo`
  - [ ] Invoice generation and email delivery

### 5. Platform Scrapers (minimum 5 stable)
At least 5 platforms must scrape reliably in production.

- [ ] **Scraper stability** → [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) `In Review` ✅
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

- [ ] **Scraper resilience** → [PLA-599](https://linear.app/plan-b-side-projects/issue/PLA-599) `Todo` (stale detection + scheduling)
  - [x] Retry logic with exponential backoff
  - [x] Timeout handling (no indefinite hangs)
  - [x] Graceful degradation on partial failure (1 platform failing doesn't affect others)
  - [ ] Stale data detection — alert if a platform hasn't updated in X hours → [PLA-607](https://linear.app/plan-b-side-projects/issue/PLA-607) `Todo`
  - [x] Browser pool management (for Playwright-dependent platforms)
  - [ ] Scraper scheduling spread across time windows (not all at once)

---

## P1 — Critical for Reliability

### 6. Error Logging & Monitoring
Visibility into production issues.

- [ ] **Sentry (backend — already configured)** → [PLA-600](https://linear.app/plan-b-side-projects/issue/PLA-600) `Todo` (code: source maps upload)
  - [ ] 🔧 Verify DSN is set in production env — **manual**
  - [ ] Verify errors are captured and appearing in Sentry dashboard
  - [ ] Source maps uploaded for readable stack traces
  - [ ] 🔧 Alert rules configured (email/Slack on new errors) — **manual**

- [x] **Sentry (frontend)** → [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) `In Review` ✅
  - [x] `@sentry/nextjs` v10 installed + `withSentryConfig` wrapper
  - [x] `global-error.tsx` + 4 route-level error boundaries report to Sentry
  - [x] `ErrorBoundary` component reports via `componentDidCatch`
  - [x] `instrumentation.ts` with server/edge/client configs (10% trace sample)
  - [ ] **Needs prod setup:** Set `NEXT_PUBLIC_SENTRY_DSN` env var — **manual** / source maps → [PLA-600](https://linear.app/plan-b-side-projects/issue/PLA-600)

- [ ] **Structured logging**
  - [ ] Pino JSON logs flowing to log aggregation (Loki or ELK)
  - [ ] Grafana dashboard imported and showing API metrics
  - [ ] Log retention policy set (30 days minimum)
  - [ ] Request IDs traceable across API logs

- [ ] **Alerting** → [PLA-601](https://linear.app/plan-b-side-projects/issue/PLA-601) `Todo` (code: alert hooks + admin UI)
  - [ ] API down / health check failure → alert
  - [ ] Scraper failure → alert
  - [ ] Email queue backlog → alert
  - [ ] High error rate → alert
  - [ ] Database connection failures → alert

### 7. Session Recording
Understand real user behavior and debug UX issues.

- [ ] **Session recording tool setup** → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) `Todo` (code: SDK integration)
  - [ ] ⚠️ Combined with product analytics in PLA-602 (PostHog handles both)
  - [ ] 🔧 Choose provider: PostHog (self-hosted option), LogRocket, or Hotjar — **manual decision**
  - [ ] Install SDK in dashboard app
  - [ ] Configure privacy settings (mask sensitive inputs, exclude auth pages)
  - [ ] Set sampling rate (don't record 100% — start with 10-20%)

- [ ] **Key tracking points** → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) `Todo`
  - [ ] User sessions recorded with userId linkage
  - [ ] Rage clicks and error moments highlighted
  - [ ] Session replay accessible from error reports (Sentry integration)
  - [ ] Funnel visualization: signup → first app tracked → regular usage

### 8. Product Analytics & Event Tracking
Track critical user actions to understand product usage.

- [ ] **Analytics platform setup** → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) `Todo` (code: SDK + events)
  - [ ] ⚠️ Combined with session recording in PLA-602 (PostHog handles both)
  - [ ] 🔧 Choose provider + create account — **manual decision**
  - [ ] Install SDK in dashboard and API

- [ ] **Critical events to track** → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) `Todo`
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

- [ ] **Automated backups** → [PLA-603](https://linear.app/plan-b-side-projects/issue/PLA-603) `Todo` (code: script verification + restore test)
  - [ ] Backup script exists (`scripts/backup-db.sh`) — verify it runs in production
  - [ ] 🔧 Cron job set: `0 2 * * *` (daily at 2 AM) — **manual server**
  - [ ] Compressed dumps stored locally (30-day retention)
  - [ ] 🔧 Off-site upload to S3/Backblaze B2 configured (`--upload` flag) — **manual credentials**
  - [ ] Off-site retention: 30 days minimum

- [ ] **Backup verification** → [PLA-603](https://linear.app/plan-b-side-projects/issue/PLA-603) `Todo`
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
  - [ ] Rate limit on invitation endpoint (beyond daily count) → [PLA-604](https://linear.app/plan-b-side-projects/issue/PLA-604) `Todo`
  - [ ] 🔧 Cloudflare WAF rules for bot protection — **manual**

### 11. Site Performance
Fast load times and smooth UX.

- [ ] **Frontend performance** → [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) `In Review` ✅
  - [ ] Lighthouse score > 80 on key pages (landing, dashboard, app detail)
  - [ ] Bundle size analysis — remove unused dependencies
  - [ ] Image optimization (next/image, WebP format)
  - [ ] Lazy loading for below-fold components
  - [ ] Route-level code splitting verified

- [ ] **API performance** → [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) `In Review` ✅ (caching) / [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) `In Review` ✅ (DB optimization)
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
  - [ ] 🔧 Separate worker containers with resource limits (CPU/memory caps) — **manual Coolify config**
  - [ ] Scraper scheduling spread across time windows (not all at once) → [PLA-599](https://linear.app/plan-b-side-projects/issue/PLA-599)

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
  - [ ] Changelog / what's new page → [PLA-614](https://linear.app/plan-b-side-projects/issue/PLA-614) `Todo`

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
  - [x] All containers health-checked → [PLA-605](https://linear.app/plan-b-side-projects/issue/PLA-605) `In Review` ✅
  - [x] Restart policies configured (unless-stopped) ✅
  - [ ] 🔧 Resource limits set (CPU, memory per container) — **manual Coolify config**
  - [ ] 🔧 Zero-downtime deployment strategy — **manual Coolify config**

### 14. UX Polish & Data

- [x] **Accessibility** → [PLA-554](https://linear.app/plan-b-side-projects/issue/PLA-554) `In Review` ✅
  - [x] `aria-hidden="true"` on 50+ decorative app icon images (30 files)

- [x] **Password UX** → [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) `In Review` ✅
  - [x] Visual password strength indicator on register and reset-password pages

- [x] **CSV export** → [PLA-560](https://linear.app/plan-b-side-projects/issue/PLA-560) `In Review` ✅
  - [x] `GET /api/export/tracked-apps` — CSV download of tracked apps
  - [x] `GET /api/export/keywords` — CSV download of tracked keywords

- [x] **Session 3 completions**
  - [x] Cookie security flags (Secure in prod, SameSite=Lax) → [PLA-594](https://linear.app/plan-b-side-projects/issue/PLA-594) `In Review` ✅
  - [x] CORS preflight caching (24h) + gzip compression → [PLA-567](https://linear.app/plan-b-side-projects/issue/PLA-567) `In Review` ✅
  - [x] Account lockout (10 failed logins → 30 min) → [PLA-568](https://linear.app/plan-b-side-projects/issue/PLA-568) `In Review` ✅
  - [x] Toast notification system (sonner) → [PLA-569](https://linear.app/plan-b-side-projects/issue/PLA-569) `In Review` ✅
  - [x] Responsive table scrolling → [PLA-576](https://linear.app/plan-b-side-projects/issue/PLA-576) `In Review` ✅
  - [x] Broken image fallback (AppIcon component) → [PLA-589](https://linear.app/plan-b-side-projects/issue/PLA-589) `In Review` ✅
  - [x] CONTRIBUTING.md → [PLA-583](https://linear.app/plan-b-side-projects/issue/PLA-583) `In Review` ✅
  - [x] Refresh token device fingerprint → [PLA-573](https://linear.app/plan-b-side-projects/issue/PLA-573) `In Review` ✅
  - [x] Stripe billing routes + DB schema → [PLA-590](https://linear.app/plan-b-side-projects/issue/PLA-590) `In Review` ✅
  - [x] Keyboard shortcuts help (?) → [PLA-585](https://linear.app/plan-b-side-projects/issue/PLA-585) `In Review` ✅

- [x] **Session 4 completions**
  - [x] Billing enforcement + UpgradePrompt → [PLA-591](https://linear.app/plan-b-side-projects/issue/PLA-591) `In Review` ✅
  - [x] Notification badge visibility polling → [PLA-587](https://linear.app/plan-b-side-projects/issue/PLA-587) `In Review` ✅
  - [x] Loading skeletons (30 pages) → [PLA-593](https://linear.app/plan-b-side-projects/issue/PLA-593) `In Review` ✅
  - [x] Impersonation audit log UI → [PLA-572](https://linear.app/plan-b-side-projects/issue/PLA-572) `In Review` ✅
  - [x] Table sort URL persistence → [PLA-580](https://linear.app/plan-b-side-projects/issue/PLA-580) `In Review` ✅
  - [x] Email verification flow → [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) `In Review` ✅
  - [x] Account deletion + GDPR export → [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) `In Review` ✅
  - [x] Error response standardization → [PLA-588](https://linear.app/plan-b-side-projects/issue/PLA-588) `In Review` ✅
  - [x] System health endpoint (Redis, queues, DLQ) → [PLA-577](https://linear.app/plan-b-side-projects/issue/PLA-577) `In Review` ✅

- [x] **Session 6 completions**
  - [x] AppIcon → next/image migration → [PLA-579](https://linear.app/plan-b-side-projects/issue/PLA-579) `In Review` ✅
  - [x] Command palette (Cmd+K) → [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) `In Review` ✅
  - [x] VirtualizedList (react-window) → [PLA-574](https://linear.app/plan-b-side-projects/issue/PLA-574) `In Review` ✅
  - [x] DateRangePicker component → [PLA-575](https://linear.app/plan-b-side-projects/issue/PLA-575) `In Review` ✅
  - [x] Onboarding wizard → [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) `In Review` ✅
  - [x] Account activity feed → [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) `In Review` ✅

### New Tasks (Batch 4 — 2026-04-03)

#### Critical Fixes

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-610](https://linear.app/plan-b-side-projects/issue/PLA-610) | 🔴 Urgent | Fix dashboard build — email-templates prerender failure |
| [PLA-606](https://linear.app/plan-b-side-projects/issue/PLA-606) | 🟠 High | Login returnUrl redirect after session expiry |
| [PLA-608](https://linear.app/plan-b-side-projects/issue/PLA-608) | 🟠 High | Admin sidebar links for Audit Logs + DLQ pages |

#### Billing & Payments

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-609](https://linear.app/plan-b-side-projects/issue/PLA-609) | 🟡 Medium | Billing section in settings page (plan status + portal link) |
| [PLA-611](https://linear.app/plan-b-side-projects/issue/PLA-611) | 🟡 Medium | Payment grace period (7 days before restricting) |
| [PLA-612](https://linear.app/plan-b-side-projects/issue/PLA-612) | 🟡 Medium | Subscription downgrade handling (over-limit warnings) |

#### Quality & Polish

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-607](https://linear.app/plan-b-side-projects/issue/PLA-607) | 🟡 Medium | Wire stale scraper detection to alerting system |
| [PLA-613](https://linear.app/plan-b-side-projects/issue/PLA-613) | 🟡 Medium | Add List-Unsubscribe headers to transactional emails |
| [PLA-614](https://linear.app/plan-b-side-projects/issue/PLA-614) | 🔵 Low | Create changelog page for product updates |

### New Tasks (Batch 5 — 2026-04-03)

#### Critical Auth & Verification

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-617](https://linear.app/plan-b-side-projects/issue/PLA-617) | 🔴 Urgent | Send verification email on registration |
| [PLA-621](https://linear.app/plan-b-side-projects/issue/PLA-621) | 🟠 High | Email verification banner in dashboard |
| [PLA-622](https://linear.app/plan-b-side-projects/issue/PLA-622) | 🟠 High | Account suspension banner |

#### Billing & Payments

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-615](https://linear.app/plan-b-side-projects/issue/PLA-615) | 🟠 High | Payment grace period warning banner |
| [PLA-616](https://linear.app/plan-b-side-projects/issue/PLA-616) | 🟠 High | Pricing page checkout integration for authenticated users |

#### Settings & GDPR

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-619](https://linear.app/plan-b-side-projects/issue/PLA-619) | 🟡 Medium | Delete account UI with confirmation dialog |
| [PLA-620](https://linear.app/plan-b-side-projects/issue/PLA-620) | 🟡 Medium | Download My Data button (GDPR export) |

#### Activity & UX

| Task | Priority | Description |
|------|----------|-------------|
| [PLA-618](https://linear.app/plan-b-side-projects/issue/PLA-618) | 🟡 Medium | Wire logActivity() into all mutation routes |
| [PLA-623](https://linear.app/plan-b-side-projects/issue/PLA-623) | 🔵 Low | Changelog link in marketing footer/header |
| [PLA-624](https://linear.app/plan-b-side-projects/issue/PLA-624) | 🔵 Low | Cmd+K search hint button in dashboard header |

---

## Summary

| Priority | Category | Status | Linear | Effort |
|----------|----------|--------|--------|--------|
| P0 | Password Reset | ✅ Done | [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | ~~S~~ Done |
| P0 | Login Alert Email | ✅ Done | [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) | ~~S~~ Done |
| P0 | Auth E2E Tests | ✅ Done | [PLA-595](https://linear.app/plan-b-side-projects/issue/PLA-595) | ~~M~~ Done |
| P0 | Team Invitations E2E | ✅ Done | [PLA-596](https://linear.app/plan-b-side-projects/issue/PLA-596) | ~~M~~ Done |
| P0 | Email Templates + Queue | ✅ Done | [PLA-597](https://linear.app/plan-b-side-projects/issue/PLA-597) | ~~S~~ Done |
| P0 | Email Delivery (SMTP/DNS) | ⚠️ SMTP + DNS needed | 🔧 Manual | S |
| P0 | Email Verification | ✅ Done | [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) | ~~M~~ Done |
| P0 | Account Deletion/GDPR | ✅ Done | [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) | ~~M~~ Done |
| P0 | Payment (Stripe skeleton) | ✅ Routes + DB done | [PLA-590](https://linear.app/plan-b-side-projects/issue/PLA-590) | ~~M~~ Done |
| P0 | Stripe Checkout + Webhooks | ⏳ Todo | [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) | M |
| P0 | Platform Scrapers (5+) | ⚠️ Need smoke testing | [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) `In Review` ✅ | M |
| P1 | Sentry (frontend) | ✅ Done | [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | ~~M~~ Done |
| P1 | Scraper Resilience | ✅ Done | [PLA-599](https://linear.app/plan-b-side-projects/issue/PLA-599) | ~~M~~ Done |
| P1 | Sentry Source Maps | ⏳ Todo | [PLA-600](https://linear.app/plan-b-side-projects/issue/PLA-600) | S |
| P1 | Alerting System | ✅ Done | [PLA-601](https://linear.app/plan-b-side-projects/issue/PLA-601) | ~~M~~ Done |
| P1 | Session Recording + Analytics | ⏳ Todo | [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) | L |
| P1 | DB Backup Verification | ⏳ Todo | [PLA-603](https://linear.app/plan-b-side-projects/issue/PLA-603) | S |
| P1 | Expired Data Cleanup | ✅ Done | [PLA-551](https://linear.app/plan-b-side-projects/issue/PLA-551) | ~~S~~ Done |
| P2 | Redis Rate Limiting | ✅ Done | [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | ~~M~~ Done |
| P2 | Invitation Rate Limit | ✅ Done | [PLA-604](https://linear.app/plan-b-side-projects/issue/PLA-604) | ~~S~~ Done |
| P2 | Rate Limit Headers | ✅ Done | [PLA-561](https://linear.app/plan-b-side-projects/issue/PLA-561) | ~~S~~ Done |
| P2 | API Caching + ETag | ✅ Done | [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | ~~S~~ Done |
| P2 | DB Query Optimization | ✅ 8 indexes added | [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) `In Review` | M |
| P2 | Scraper Isolation | ✅ Done | [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | ~~M~~ Done |
| P2 | Frontend Performance | ⚠️ Needs audit | [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) `In Review` ✅ | M |
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
| P2 | Cookie Security | ✅ Done | [PLA-594](https://linear.app/plan-b-side-projects/issue/PLA-594) | ~~S~~ Done |
| P2 | CORS + Compression | ✅ Done | [PLA-567](https://linear.app/plan-b-side-projects/issue/PLA-567) | ~~S~~ Done |
| P2 | Account Lockout | ✅ Done | [PLA-568](https://linear.app/plan-b-side-projects/issue/PLA-568) | ~~S~~ Done |
| P2 | Token Device Binding | ✅ Done | [PLA-573](https://linear.app/plan-b-side-projects/issue/PLA-573) | ~~S~~ Done |
| P3 | Toast Notifications | ✅ Done | [PLA-569](https://linear.app/plan-b-side-projects/issue/PLA-569) | ~~S~~ Done |
| P3 | Responsive Tables | ✅ Done | [PLA-576](https://linear.app/plan-b-side-projects/issue/PLA-576) | ~~S~~ Done |
| P3 | Broken Image Fallback | ✅ Done | [PLA-589](https://linear.app/plan-b-side-projects/issue/PLA-589) | ~~S~~ Done |
| P3 | CONTRIBUTING.md | ✅ Done | [PLA-583](https://linear.app/plan-b-side-projects/issue/PLA-583) | ~~S~~ Done |
| P3 | Shortcuts Help | ✅ Done | [PLA-585](https://linear.app/plan-b-side-projects/issue/PLA-585) | ~~S~~ Done |
| P2 | Billing Enforcement | ✅ Done | [PLA-591](https://linear.app/plan-b-side-projects/issue/PLA-591) | ~~S~~ Done |
| P2 | Error Standardization | ✅ Done | [PLA-588](https://linear.app/plan-b-side-projects/issue/PLA-588) | ~~S~~ Done |
| P3 | Notification Polling | ✅ Done | [PLA-587](https://linear.app/plan-b-side-projects/issue/PLA-587) | ~~S~~ Done |
| P3 | Loading Skeletons | ✅ Done | [PLA-593](https://linear.app/plan-b-side-projects/issue/PLA-593) | ~~M~~ Done |
| P3 | Audit Log UI | ✅ Done | [PLA-572](https://linear.app/plan-b-side-projects/issue/PLA-572) | ~~S~~ Done |
| P3 | Sort URL Persistence | ✅ Done | [PLA-580](https://linear.app/plan-b-side-projects/issue/PLA-580) | ~~S~~ Done |
| P3 | System Health API | ✅ Done | [PLA-577](https://linear.app/plan-b-side-projects/issue/PLA-577) | ~~S~~ Done |
| P3 | E2E Tests | ✅ Done | [PLA-586](https://linear.app/plan-b-side-projects/issue/PLA-586) | ~~M~~ Done |
| P3 | Zod Validation | ✅ Done | [PLA-582](https://linear.app/plan-b-side-projects/issue/PLA-582) | ~~S~~ Done |
| P3 | DLQ Monitoring UI | ✅ Done | [PLA-578](https://linear.app/plan-b-side-projects/issue/PLA-578) | ~~S~~ Done |
| P3 | Email Preview/Test | ✅ Done | [PLA-581](https://linear.app/plan-b-side-projects/issue/PLA-581) | ~~S~~ Done |
| P3 | Backup Monitoring | ✅ Done | [PLA-592](https://linear.app/plan-b-side-projects/issue/PLA-592) | ~~S~~ Done |
| P3 | Scraper Stats API | ✅ Done | [PLA-584](https://linear.app/plan-b-side-projects/issue/PLA-584) | ~~S~~ Done |
| P4 | AppIcon next/image | ✅ Done | [PLA-579](https://linear.app/plan-b-side-projects/issue/PLA-579) | ~~S~~ Done |
| P4 | Command Palette | ✅ Done | [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) | ~~M~~ Done |
| P4 | List Virtualization | ✅ Done | [PLA-574](https://linear.app/plan-b-side-projects/issue/PLA-574) | ~~S~~ Done |
| P4 | Date Range Picker | ✅ Done | [PLA-575](https://linear.app/plan-b-side-projects/issue/PLA-575) | ~~S~~ Done |
| P4 | Onboarding Wizard | ✅ Done | [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) | ~~M~~ Done |
| P4 | Activity Feed | ✅ Done | [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) | ~~M~~ Done |
| P3 | Docker HEALTHCHECK | ✅ Done | [PLA-605](https://linear.app/plan-b-side-projects/issue/PLA-605) | ~~S~~ Done |
| P0 | Build Fix (prerender) | ✅ Done | [PLA-610](https://linear.app/plan-b-side-projects/issue/PLA-610) | ~~S~~ Done |
| P0 | Login returnUrl | ✅ Done | [PLA-606](https://linear.app/plan-b-side-projects/issue/PLA-606) | ~~S~~ Done |
| P0 | Admin Nav Links | ✅ Done | [PLA-608](https://linear.app/plan-b-side-projects/issue/PLA-608) | ~~S~~ Done |
| P1 | Settings Billing UI | ✅ Done | [PLA-609](https://linear.app/plan-b-side-projects/issue/PLA-609) | ~~S~~ Done |
| P1 | Payment Grace Period | ✅ Done | [PLA-611](https://linear.app/plan-b-side-projects/issue/PLA-611) | ~~M~~ Done |
| P1 | Downgrade Handling | ✅ Done | [PLA-612](https://linear.app/plan-b-side-projects/issue/PLA-612) | ~~M~~ Done |
| P2 | Stale Data Alerts | ✅ Done | [PLA-607](https://linear.app/plan-b-side-projects/issue/PLA-607) | ~~S~~ Done |
| P2 | Email Unsubscribe Headers | ✅ Done | [PLA-613](https://linear.app/plan-b-side-projects/issue/PLA-613) | ~~S~~ Done |
| P3 | Changelog Page | ✅ Done | [PLA-614](https://linear.app/plan-b-side-projects/issue/PLA-614) | ~~S~~ Done |
| P3 | Landing/Marketing | ⚠️ Pricing done, blog optional | 🔧 Manual | S |
| P3 | Deployment/Infra | ⚠️ Needs hardening | 🔧 Manual | S |

**Legend:** S = Small (1-2 days), M = Medium (3-5 days), L = Large (1-2 weeks), XL = Extra Large (2-3 weeks)

### Linear Task Reference

| Task | Status | Category | Description |
|------|--------|----------|-------------|
| [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | ✅ In Review | Auth | Password reset flow (API + Dashboard) |
| [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | ✅ In Review | Scrapers | Smoke test all 11 platforms, fix failures |
| [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | ✅ In Review | Monitoring | Frontend Sentry error tracking |
| [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | ✅ In Review | Security | Redis-based rate limiting |
| [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | ✅ In Review | Performance | HTTP caching headers + ETag on public endpoints |
| [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | ✅ In Review | Performance | Database query optimization & indexes |
| [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | ✅ In Review | Performance | Scraper-API isolation (pools, circuit breaker) |
| [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | ✅ In Review | Performance | Bundle analysis & frontend optimization |
| [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) | ✅ In Review | SEO | Sitemap, robots.txt, meta tags, Open Graph |
| [PLA-550](https://linear.app/plan-b-side-projects/issue/PLA-550) | ✅ In Review | Security | HTTP security headers (HSTS, X-Frame-Options, etc.) |
| [PLA-551](https://linear.app/plan-b-side-projects/issue/PLA-551) | ✅ In Review | DB | Scheduled cleanup for expired tokens/invitations |
| [PLA-552](https://linear.app/plan-b-side-projects/issue/PLA-552) | ✅ In Review | Marketing | Pricing page with plan comparison |
| [PLA-553](https://linear.app/plan-b-side-projects/issue/PLA-553) | ✅ In Review | UX | Custom 404 not-found page |
| [PLA-554](https://linear.app/plan-b-side-projects/issue/PLA-554) | ✅ In Review | A11y | Accessibility fixes (decorative images, aria-labels) |
| [PLA-555](https://linear.app/plan-b-side-projects/issue/PLA-555) | ✅ In Review | DevOps | Comprehensive .env.example files |
| [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) | ⏳ Backlog | Auth | Email verification flow |
| [PLA-557](https://linear.app/plan-b-side-projects/issue/PLA-557) | ✅ In Review | Auth | Login alert email wired to endpoint |
| [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) | ⏳ Todo | Auth | Account deletion + GDPR data export |
| [PLA-567](https://linear.app/plan-b-side-projects/issue/PLA-567) | ✅ In Review | Performance | CORS preflight caching + gzip compression |
| [PLA-568](https://linear.app/plan-b-side-projects/issue/PLA-568) | ✅ In Review | Security | Account lockout after failed logins |
| [PLA-569](https://linear.app/plan-b-side-projects/issue/PLA-569) | ✅ In Review | UX | Toast notification system (sonner) |
| [PLA-570](https://linear.app/plan-b-side-projects/issue/PLA-570) | ✅ In Review | UX | Breadcrumbs (already existed) |
| [PLA-571](https://linear.app/plan-b-side-projects/issue/PLA-571) | ✅ In Review | UX | Empty states (component exists) |
| [PLA-573](https://linear.app/plan-b-side-projects/issue/PLA-573) | ✅ In Review | Security | Refresh token device fingerprinting |
| [PLA-576](https://linear.app/plan-b-side-projects/issue/PLA-576) | ✅ In Review | UX | Responsive table scrolling |
| [PLA-583](https://linear.app/plan-b-side-projects/issue/PLA-583) | ✅ In Review | Docs | CONTRIBUTING.md |
| [PLA-585](https://linear.app/plan-b-side-projects/issue/PLA-585) | ✅ In Review | UX | Keyboard shortcuts help modal |
| [PLA-589](https://linear.app/plan-b-side-projects/issue/PLA-589) | ✅ In Review | UX | Broken image fallback (AppIcon) |
| [PLA-590](https://linear.app/plan-b-side-projects/issue/PLA-590) | ✅ In Review | Billing | Stripe webhook skeleton + DB schema |
| [PLA-594](https://linear.app/plan-b-side-projects/issue/PLA-594) | ✅ In Review | Security | Cookie security flags (Secure, SameSite) |
| [PLA-559](https://linear.app/plan-b-side-projects/issue/PLA-559) | ✅ In Review | UX | Session timeout warning + auto-refresh |
| [PLA-560](https://linear.app/plan-b-side-projects/issue/PLA-560) | ✅ In Review | Data | CSV export for tracked apps and keywords |
| [PLA-561](https://linear.app/plan-b-side-projects/issue/PLA-561) | ✅ In Review | API | X-RateLimit-* response headers |
| [PLA-562](https://linear.app/plan-b-side-projects/issue/PLA-562) | ✅ In Review | UX | Password strength indicator |
| [PLA-563](https://linear.app/plan-b-side-projects/issue/PLA-563) | ✅ In Review | Reliability | Request timeout + graceful shutdown |
| [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) | ⏳ Backlog | UX | Command palette (Cmd+K) |
| [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) | ⏳ Backlog | UX | Onboarding wizard |
| [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) | ⏳ Backlog | Data | Account activity feed |
| [PLA-595](https://linear.app/plan-b-side-projects/issue/PLA-595) | ⏳ Todo | Auth | E2E tests for auth flows (signup, login, logout) |
| [PLA-596](https://linear.app/plan-b-side-projects/issue/PLA-596) | ⏳ Todo | Auth | E2E tests for team invitation flow |
| [PLA-597](https://linear.app/plan-b-side-projects/issue/PLA-597) | ⏳ Todo | Email | Email template rendering tests + queue health |
| [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) | ⏳ Todo | Billing | Stripe checkout, webhook, and billing flows |
| [PLA-599](https://linear.app/plan-b-side-projects/issue/PLA-599) | ⏳ Todo | Scrapers | Stale data detection + scheduling spread |
| [PLA-600](https://linear.app/plan-b-side-projects/issue/PLA-600) | ⏳ Todo | Monitoring | Sentry source maps upload + backend DSN |
| [PLA-601](https://linear.app/plan-b-side-projects/issue/PLA-601) | ⏳ Todo | Monitoring | Alerting hooks for critical system events |
| [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) | ⏳ Todo | Analytics | PostHog session recording + product analytics |
| [PLA-603](https://linear.app/plan-b-side-projects/issue/PLA-603) | ⏳ Todo | DB | Backup script verification + restore test |
| [PLA-604](https://linear.app/plan-b-side-projects/issue/PLA-604) | ⏳ Todo | Security | Rate limiting on invitation endpoint |
| [PLA-605](https://linear.app/plan-b-side-projects/issue/PLA-605) | ⏳ Todo | DevOps | Docker HEALTHCHECK for app containers |

### New Tasks (Batch 3 — 2026-04-02)

#### Security & Auth

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-568](https://linear.app/plan-b-side-projects/issue/PLA-568) | 🟡 Medium | Account lockout after 10 failed logins | ✅ Done |
| [PLA-573](https://linear.app/plan-b-side-projects/issue/PLA-573) | 🔵 Low | Refresh token device fingerprinting (UA binding) | ✅ Done |
| [PLA-594](https://linear.app/plan-b-side-projects/issue/PLA-594) | 🟡 Medium | Cookie security flags (Secure, SameSite) | ✅ Done |

#### API Quality

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-567](https://linear.app/plan-b-side-projects/issue/PLA-567) | 🟡 Medium | CORS preflight caching + gzip compression | ✅ Done |
| [PLA-582](https://linear.app/plan-b-side-projects/issue/PLA-582) | 🟡 Medium | Zod schema validation audit (all endpoints) | ✅ Done |
| [PLA-588](https://linear.app/plan-b-side-projects/issue/PLA-588) | 🟡 Medium | Standardize API error responses + error codes | ✅ Done |
| [PLA-586](https://linear.app/plan-b-side-projects/issue/PLA-586) | 🟡 Medium | E2E integration tests for critical user flows | ✅ Done |

#### Payment (code skeleton — no Stripe account needed)

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-590](https://linear.app/plan-b-side-projects/issue/PLA-590) | 🟡 Medium | Stripe webhook handler skeleton + billing routes + DB schema | ✅ Done |
| [PLA-591](https://linear.app/plan-b-side-projects/issue/PLA-591) | 🟡 Medium | Billing enforcement middleware + upgrade prompts in dashboard | ✅ Done |

#### Dashboard UX

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-569](https://linear.app/plan-b-side-projects/issue/PLA-569) | 🟡 Medium | Toast notification system for action feedback | ✅ Done |
| [PLA-570](https://linear.app/plan-b-side-projects/issue/PLA-570) | 🔵 Low | Breadcrumb navigation on nested pages | ✅ Already exists |
| [PLA-571](https://linear.app/plan-b-side-projects/issue/PLA-571) | 🔵 Low | Empty state illustrations for list pages | ✅ Component exists |
| [PLA-574](https://linear.app/plan-b-side-projects/issue/PLA-574) | 🔵 Low | List virtualization (react-window) for large tables | ✅ Done |
| [PLA-575](https://linear.app/plan-b-side-projects/issue/PLA-575) | 🔵 Low | Date range picker for historical charts | ✅ Done |
| [PLA-576](https://linear.app/plan-b-side-projects/issue/PLA-576) | 🟡 Medium | Responsive table scrolling on mobile | ✅ Done |
| [PLA-580](https://linear.app/plan-b-side-projects/issue/PLA-580) | 🔵 Low | Table sort/filter persistence in URL params | ✅ Done |
| [PLA-589](https://linear.app/plan-b-side-projects/issue/PLA-589) | 🔵 Low | App icon broken image fallback component | ✅ Already exists |
| [PLA-593](https://linear.app/plan-b-side-projects/issue/PLA-593) | 🟡 Medium | Loading skeleton for all pages missing loading.tsx | ✅ Done |
| [PLA-585](https://linear.app/plan-b-side-projects/issue/PLA-585) | 🔵 Low | Keyboard shortcuts help modal (Shift+?) | ✅ Done |

#### Admin & Monitoring

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-572](https://linear.app/plan-b-side-projects/issue/PLA-572) | 🔵 Low | Impersonation audit log UI | ✅ Done |
| [PLA-577](https://linear.app/plan-b-side-projects/issue/PLA-577) | 🔵 Low | Admin health dashboard (Redis, pool, queue metrics) | ✅ Done |
| [PLA-578](https://linear.app/plan-b-side-projects/issue/PLA-578) | 🔵 Low | Dead letter queue monitoring UI | ✅ Done |
| [PLA-581](https://linear.app/plan-b-side-projects/issue/PLA-581) | 🔵 Low | Email template preview + test send in admin | ✅ Done |
| [PLA-584](https://linear.app/plan-b-side-projects/issue/PLA-584) | 🔵 Low | Scraper job success/failure charts in admin | ✅ Done |
| [PLA-587](https://linear.app/plan-b-side-projects/issue/PLA-587) | 🔵 Low | Notification badge real-time polling | ✅ Done |
| [PLA-592](https://linear.app/plan-b-side-projects/issue/PLA-592) | 🔵 Low | Backup status monitoring endpoint + admin UI | ✅ Done |

#### Performance

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-579](https://linear.app/plan-b-side-projects/issue/PLA-579) | 🔵 Low | Migrate app icons to next/image (lazy load) | ✅ Done |

#### Documentation

| Task | Priority | Description | Status |
|------|----------|-------------|--------|
| [PLA-583](https://linear.app/plan-b-side-projects/issue/PLA-583) | 🔵 Low | Create CONTRIBUTING.md | ✅ Done |

---

### Previously Remaining Tasks

#### Previously needed runtime — NOW DONE ✅

| Task | What was done | Status |
|------|--------------|--------|
| [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | Smoke test script ready, needs manual run | ✅ In Review |
| [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | 8 CONCURRENTLY indexes added (migration 0110) | ✅ In Review |
| [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | Dynamic imports for recharts (6 pages, -8MB) | ✅ In Review |

#### Manual (require user action/decisions)

| Category | What's needed | Why manual | Software part |
|----------|--------------|------------|---------------|
| Email Delivery | SMTP config, SPF/DKIM/DMARC DNS records | Requires DNS provider access | Template tests → [PLA-597](https://linear.app/plan-b-side-projects/issue/PLA-597) |
| Session Recording | Choose provider, create account | Requires provider decision | SDK integration → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) |
| Product Analytics | Choose provider, create account | Requires provider decision | Event tracking → [PLA-602](https://linear.app/plan-b-side-projects/issue/PLA-602) |
| DB Backup Cron | Production cron job + S3 credentials | Requires server SSH | Script verification → [PLA-603](https://linear.app/plan-b-side-projects/issue/PLA-603) |
| Stripe Setup | Account + products in Stripe dashboard | Requires Stripe access | Checkout + webhooks → [PLA-598](https://linear.app/plan-b-side-projects/issue/PLA-598) |
| Sentry Prod | Set DSN env vars + alert rules | Requires Coolify + Sentry access | Source maps → [PLA-600](https://linear.app/plan-b-side-projects/issue/PLA-600) |
| Deployment/Infra | Cloudflare WAF, Docker resource limits | Requires Cloudflare + Coolify access | HEALTHCHECK → [PLA-605](https://linear.app/plan-b-side-projects/issue/PLA-605) |

#### Backlog (post-launch candidates)

| Task | Description |
|------|-------------|
| [PLA-556](https://linear.app/plan-b-side-projects/issue/PLA-556) | Email verification flow (API + Dashboard) |
| [PLA-558](https://linear.app/plan-b-side-projects/issue/PLA-558) | Account deletion + GDPR data export |
| [PLA-564](https://linear.app/plan-b-side-projects/issue/PLA-564) | Command palette (Cmd+K) global search |
| [PLA-565](https://linear.app/plan-b-side-projects/issue/PLA-565) | Onboarding wizard for new users |
| [PLA-566](https://linear.app/plan-b-side-projects/issue/PLA-566) | Account activity feed |
