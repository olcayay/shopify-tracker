# AppRanks.io Pre-Release Checklist

> Created: 2026-04-01
> Target: Production-ready public launch

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
  - [ ] Input validation (password strength, email format)

- [ ] **Login flow**
  - [ ] Email/password login works correctly
  - [ ] Login alert email is sent (IP, device, location)
  - [ ] Token refresh works seamlessly (15min access, 7-day refresh)
  - [ ] Suspended account shows clear error
  - [ ] Rate limiting works (5 attempts / 15 min)
  - [ ] "Remember me" / session persistence works as expected

- [x] **Password reset flow** → [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) `In Review`
  - [ ] ⚠️ **API endpoint needs implementation** — email template exists, endpoint missing
  - [ ] "Forgot password" link on login page
  - [ ] Reset email sent with secure token (1-hour expiry)
  - [ ] Reset page validates token and allows new password
  - [ ] Old sessions invalidated after password change
  - [ ] Rate limiting on reset requests

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
  - [ ] Plan comparison / pricing page on marketing site
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

- [x] **Sentry (frontend)** → [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) `In Review`
  - [ ] ⚠️ Add `@sentry/nextjs` to dashboard app
  - [ ] Configure error boundary for React errors
  - [ ] Track client-side errors (JS exceptions, failed API calls)

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

### 9. Database Backup
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

- [x] **Improvements needed** → [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) `In Review`
  - [ ] ⚠️ Migrate from in-memory to Redis-based rate limiting (multi-server ready)
  - [ ] Rate limit on password reset endpoint
  - [ ] Rate limit on invitation endpoint (beyond daily count)
  - [ ] API key rate limiting for future public API
  - [ ] Cloudflare WAF rules for bot protection
  - [ ] CAPTCHA on signup/login after repeated failures (optional)

### 11. Site Performance
Fast load times and smooth UX.

- [ ] **Frontend performance** → [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) `Todo`
  - [ ] Lighthouse score > 80 on key pages (landing, dashboard, app detail)
  - [ ] Bundle size analysis — remove unused dependencies
  - [ ] Image optimization (next/image, WebP format)
  - [ ] Lazy loading for below-fold components
  - [ ] Route-level code splitting verified

- [ ] **API performance** → [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) `In Review` (caching) / [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) `Todo` (DB optimization)
  - [ ] Response times < 200ms for dashboard endpoints
  - [ ] Database query optimization (check for N+1, missing indexes)
  - [ ] Redis caching for frequently accessed data (app listings, categories)
  - [ ] HTTP caching headers (ETag, Cache-Control) on public endpoints
  - [ ] Connection pooling configured for PostgreSQL

- [x] **Scraper isolation** → [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) `In Review`
  - [ ] ⚠️ Scraper operations must not affect dashboard/API performance
  - [ ] Separate worker containers with resource limits (CPU/memory caps)
  - [ ] Database connection pool isolation (scraper vs API)
  - [ ] Queue-based job processing prevents burst load
  - [ ] Scraper scheduling spread across time windows (not all at once)
  - [ ] Circuit breaker pattern for external API calls

---

## P3 — Nice to Have for Launch

### 12. Landing Page & Marketing
Public-facing pages that drive signups.

- [ ] **Existing pages (verify)**
  - [ ] Landing page (`/`) — hero, features, CTA sections
  - [ ] Public app browsing (`/apps/[platform]`, `/best/[platform]`)
  - [ ] Privacy Policy (`/privacy`) — content reviewed by legal
  - [ ] Terms of Service (`/terms`) — content reviewed by legal

- [ ] **Missing pages**
  - [ ] Pricing page with plan comparison table
  - [ ] Blog / content marketing section (optional for launch)
  - [ ] Changelog / what's new page (optional)

- [x] **SEO** → [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) `In Review`
  - [ ] Meta tags on all public pages
  - [ ] Sitemap.xml generated
  - [ ] robots.txt configured
  - [ ] Open Graph / Twitter card images
  - [ ] Structured data (JSON-LD) for app listings

### 13. Deployment & Infrastructure
Production environment hardened and documented.

- [ ] **Environment variables**
  - [ ] All required env vars documented and set
  - [ ] Secrets stored securely (not in git)
  - [ ] `DASHBOARD_URL` and `API_URL` set correctly

- [ ] **SSL & Domain**
  - [ ] `appranks.io` — SSL via Cloudflare
  - [ ] `api.appranks.io` — SSL via Cloudflare
  - [ ] HSTS headers enabled
  - [ ] Force HTTPS redirect

- [ ] **Docker & Coolify**
  - [ ] All containers health-checked
  - [ ] Restart policies configured (always restart)
  - [ ] Resource limits set (CPU, memory per container)
  - [ ] Zero-downtime deployment strategy

---

## Summary

| Priority | Category | Status | Linear | Effort |
|----------|----------|--------|--------|--------|
| P0 | Signup/Login/Logout | ⚠️ Password reset missing | [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | S |
| P0 | Team Invitations | ✅ Implemented | — | — |
| P0 | Email Delivery | ⚠️ SMTP + DNS verification needed | 🔧 Manual | S |
| P0 | Payment Integration | ❌ Not started | 🔧 Manual | XL |
| P0 | Platform Scrapers (5+) | ✅ 11 platforms exist | [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | M |
| P1 | Error Logging (frontend) | ⚠️ Backend OK, frontend missing | [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | M |
| P1 | Session Recording | ❌ Not started | 🔧 Manual | M |
| P1 | Product Analytics | ❌ Not started | 🔧 Manual | L |
| P1 | DB Backup | ⚠️ Script exists, needs prod setup | 🔧 Manual | S |
| P2 | Rate Limiting (Redis) | ⚠️ Basic exists, needs Redis migration | [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | M |
| P2 | API Caching Headers | ❌ Not started | [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | S |
| P2 | DB Query Optimization | ⚠️ Needs audit | [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | M |
| P2 | Scraper Isolation | ⚠️ Needs improvement | [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | M |
| P2 | Frontend Performance | ⚠️ Needs audit | [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | M |
| P3 | SEO | ❌ Not started | [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) | S |
| P3 | Landing/Marketing | ⚠️ Exists, needs pricing page | 🔧 Manual | S |
| P3 | Deployment/Infra | ⚠️ Needs hardening | 🔧 Manual | S |

**Legend:** S = Small (1-2 days), M = Medium (3-5 days), L = Large (1-2 weeks), XL = Extra Large (2-3 weeks)

### Linear Task Reference (auto-implementable)

| Task | Priority | Category | Description |
|------|----------|----------|-------------|
| [PLA-541](https://linear.app/plan-b-side-projects/issue/PLA-541) | 🔴 Urgent | Auth | Password reset flow (API + Dashboard) |
| [PLA-542](https://linear.app/plan-b-side-projects/issue/PLA-542) | 🟠 High | Scrapers | Smoke test all 11 platforms, fix failures |
| [PLA-543](https://linear.app/plan-b-side-projects/issue/PLA-543) | 🟠 High | Monitoring | Frontend Sentry error tracking |
| [PLA-544](https://linear.app/plan-b-side-projects/issue/PLA-544) | 🟡 Medium | Security | Redis-based rate limiting |
| [PLA-545](https://linear.app/plan-b-side-projects/issue/PLA-545) | 🟡 Medium | Performance | HTTP caching headers on public endpoints |
| [PLA-546](https://linear.app/plan-b-side-projects/issue/PLA-546) | 🟡 Medium | Performance | Database query optimization & indexes |
| [PLA-547](https://linear.app/plan-b-side-projects/issue/PLA-547) | 🟡 Medium | Performance | Scraper-API isolation (pools, circuit breaker) |
| [PLA-548](https://linear.app/plan-b-side-projects/issue/PLA-548) | 🟡 Medium | Performance | Bundle analysis & frontend optimization |
| [PLA-549](https://linear.app/plan-b-side-projects/issue/PLA-549) | 🔵 Low | SEO | Sitemap, robots.txt, meta tags, Open Graph |

### Manual Tasks (require user action/decisions)

| Category | What's needed | Why manual |
|----------|--------------|------------|
| Email Delivery | SMTP config, SPF/DKIM/DMARC DNS records | Requires DNS provider access |
| Payment Integration | Stripe setup, plan/pricing decisions | Requires business decisions + Stripe account |
| Session Recording | Choose provider (PostHog/LogRocket/Hotjar) | Requires provider decision + account setup |
| Product Analytics | Choose provider (PostHog/Mixpanel/Amplitude) | Requires provider decision + account setup |
| DB Backup | Production cron job, S3/B2 bucket config | Requires server SSH + cloud storage account |
| Landing/Marketing | Pricing page content, legal review | Requires business decisions |
| Deployment/Infra | Cloudflare WAF, Docker resource limits | Requires Cloudflare + Coolify access |
