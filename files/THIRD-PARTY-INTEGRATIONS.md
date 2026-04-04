# 3rd Party Tool & Service Integrations Report

> Last updated: 2026-04-03

Bu dokuman projede kullanilan tum 3rd party tool ve servislerin durumunu, konfigurasyonlarini ve tamamlanmasi gereken islemleri detaylica anlatir.

---

## Table of Contents

1. [Sentry — Error Tracking](#1-sentry--error-tracking)
2. [Stripe — Billing & Subscriptions](#2-stripe--billing--subscriptions)
3. [OpenAI — AI Content & Sentiment](#3-openai--ai-content--sentiment)
4. [PostHog — Product Analytics](#4-posthog--product-analytics)
5. [Google Analytics 4 — Web Analytics](#5-google-analytics-4--web-analytics)
6. [Microsoft Clarity — Session Recording](#6-microsoft-clarity--session-recording)
7. [Nodemailer / SMTP — Email Delivery](#7-nodemailer--smtp--email-delivery)
8. [BullMQ + Redis — Job Queue & Cache](#8-bullmq--redis--job-queue--cache)
9. [Grafana Cloud — Logging & Metrics](#9-grafana-cloud--logging--metrics)
10. [Linear — Issue Tracking](#10-linear--issue-tracking)
11. [Google Search Console — SEO Analytics](#11-google-search-console--seo-analytics)
12. [Web Push (VAPID) — Browser Notifications](#12-web-push-vapid--browser-notifications)
13. [Playwright — Browser Automation](#13-playwright--browser-automation)
14. [Coolify — Deployment Platform](#14-coolify--deployment-platform)
15. [GitHub Actions — CI/CD](#15-github-actions--cicd)
16. [Mailhog — Dev Email Testing](#16-mailhog--dev-email-testing)
17. [Summary Table](#17-summary-table)
18. [Priority Roadmap](#18-priority-roadmap)

---

## 1. Sentry — Error Tracking

| Field | Value |
|-------|-------|
| **Packages** | `@sentry/node` v10.46.0, `@sentry/nextjs` v10.47.0 |
| **Env Vars** | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| API (Fastify) | `apps/api/src/index.ts` | Server-side error + performance tracking |
| Dashboard (Client) | `apps/dashboard/sentry.client.config.ts` | Browser error tracking, session replay on error (%100 sample) |
| Dashboard (Server) | `apps/dashboard/sentry.server.config.ts` | SSR error tracking |
| Dashboard (Edge) | `apps/dashboard/sentry.edge.config.ts` | Edge function error tracking |
| Scraper Worker | `apps/scraper/src/worker.ts` | Worker process error tracking |
| Email Worker | `apps/scraper/src/email-instant-worker.ts` | Email worker error tracking |
| Notification Worker | `apps/scraper/src/notification-worker.ts` | Notification worker error tracking |

### Configuration

- Traces sample rate: **10%** (0.1)
- Session replay on error: **100%** (1.0)
- Source map upload: CI pipeline'da otomatik (`@sentry/cli`)
- Conditional: DSN set degilse tamamen deaktif

### Completed Tasks

- PLA-543: Dashboard frontend Sentry entegrasyonu
- PLA-600: Source map upload + backend DSN verification
- PLA-648: Dashboard Docker build fix (Sentry config files)
- PLA-656: Sentry source map upload to CI + Dockerfile build args

---

## 2. Stripe — Billing & Subscriptions

| Field | Value |
|-------|-------|
| **Package** | `stripe` v21.0.1 |
| **Env Vars** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Status** | :warning: PARTIALLY COMPLETE — Core skeleton ready, full pipeline expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Billing Routes | `apps/api/src/routes/billing.ts` | Checkout, portal, webhooks |
| DB Schema | `packages/db/src/schema/` | Account billing fields |

### Current Implementation

- Checkout session creation (subscription flow)
- Stripe billing portal redirect
- Webhook handler for `checkout.session.completed`
- Subscription status tracking in DB
- Customer ID management

### DB Fields (accounts table)

```
stripeCustomerId, stripeSubscriptionId, subscriptionStatus,
subscriptionPlan, subscriptionPeriodEnd, pastDueSince
```

### Remaining Work — Step by Step

#### Step 1: Webhook Handler Completion (PLA-654)
- **What:** Implement full Stripe webhook handler with signature verification
- **Details:** Handle all critical events: `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
- **Files:** `apps/api/src/routes/billing.ts`

#### Step 2: Checkout Session Wiring (PLA-655)
- **What:** Wire Stripe checkout session creation to frontend pricing page
- **Details:** Create proper checkout sessions with correct price IDs, success/cancel URLs, customer email prefill
- **Files:** `apps/api/src/routes/billing.ts`, dashboard pricing components

#### Step 3: Pricing Page CTA Buttons (PLA-616)
- **What:** Connect pricing page CTA buttons to Stripe checkout for authenticated users
- **Details:** "Get Started" / "Upgrade" buttons should create checkout sessions and redirect to Stripe
- **Files:** Dashboard pricing page components

#### Step 4: Billing Settings Page (PLA-609)
- **What:** Add billing section to user settings with plan status and portal link
- **Details:** Show current plan, next billing date, usage stats, "Manage Subscription" button → Stripe portal
- **Files:** Dashboard settings page

#### Step 5: Payment Grace Period (PLA-611, PLA-615)
- **What:** Implement 7-day grace period before restricting access on failed payment
- **Details:** When `invoice.payment_failed` fires, set `pastDueSince` timestamp. Show warning banner in dashboard. After 7 days, restrict access.
- **Files:** API billing routes, dashboard layout (banner component)

#### Step 6: Grace Period Access Restriction (PLA-660)
- **What:** Middleware that checks `pastDueSince` and blocks access after 7-day grace period
- **Details:** Return 402 for API calls, show upgrade prompt in dashboard
- **Files:** API middleware, dashboard error handling

#### Step 7: Subscription Downgrade Warning (PLA-662, PLA-612)
- **What:** When user downgrades, check if current usage exceeds new plan limits
- **Details:** Show warning with what they'll lose (tracked apps, team members, etc.). Enforce limits after downgrade completes.
- **Files:** API billing routes, dashboard billing components

#### Step 8: Plan Enforcement Middleware (PLA-591)
- **What:** Middleware that checks subscription plan limits on every API request
- **Details:** Track usage (apps tracked, team members, API calls) against plan limits. Return 403 with upgrade prompt when exceeded.
- **Files:** API middleware, dashboard upgrade prompts

#### Step 9: Admin Plan Management (PLA-638)
- **What:** Admin panel page to create and edit subscription plans
- **Details:** CRUD for plans (name, price, limits, features). Sync with Stripe products/prices.
- **Files:** Dashboard admin pages, API admin routes

#### Step 10: Pricing Page (PLA-552)
- **What:** Create public pricing page with plan comparison table
- **Details:** Feature comparison matrix, pricing tiers, FAQ section
- **Files:** Dashboard public pages

---

## 3. OpenAI — AI Content & Sentiment

| Field | Value |
|-------|-------|
| **Package** | `openai` v6.27.0 |
| **Env Var** | `OPENAI_API_KEY` |
| **Model** | `gpt-4o` ($2.50/1M prompt, $10/1M completion tokens) |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Feature | File | Details |
|---------|------|---------|
| FAQ Generation | `apps/api/src/services/faq-generator.ts` | Auto-generate FAQ from app descriptions |
| AI Content | `apps/api/src/services/ai-content.ts` | Comparison articles, category overviews, listicle intros, app profiles |
| Sentiment Analysis | `apps/api/src/services/review-sentiment.ts` | Extract pros/cons from reviews |
| Research | `apps/api/src/routes/research.ts` | Research endpoint AI features |

### Configuration

- **DB Table:** `aiLogs` — tracks every API call (tokens, cost, duration, type, userId, accountId)
- **Cost Tracking:** Built-in per-request cost calculation
- **Graceful degradation:** API key yoksa feature'lar otomatik deaktif

---

## 4. PostHog — Product Analytics

| Field | Value |
|-------|-------|
| **Package** | `posthog-js` v1.364.7 |
| **Env Vars** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| **Status** | :warning: PARTIALLY COMPLETE — SDK integrated, full event coverage expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| PostHog Client | `apps/dashboard/src/lib/posthog.ts` | SDK initialization, event capture, user identification |
| Provider | `apps/dashboard/src/components/posthog-provider.tsx` | React context provider |

### Current Implementation

- SDK initialization with lazy loading
- Session recording (input masking enabled for privacy)
- Pageview capture + page leave events
- Autocapture (clicks, form submissions)
- User identification (`identifyUser(userId, properties)`)
- Custom event capture (`captureEvent(eventName, properties)`)

### Remaining Work — Step by Step

#### Step 1: Event Tracking Infrastructure (PLA-657)
- **What:** Define and implement comprehensive event taxonomy
- **Details:** Track key user actions: app tracking added/removed, keyword searches, report generation, settings changes, team invitations, billing events
- **Files:** Dashboard components (add `captureEvent` calls at key interaction points)

#### Step 2: Session Replay + Product Analytics (PLA-602)
- **What:** Configure session replay settings and build analytics dashboards in PostHog
- **Details:** Set up funnels (signup → first app tracked → daily active), retention cohorts, feature usage heatmaps
- **Where:** PostHog dashboard configuration (external)

---

## 5. Google Analytics 4 — Web Analytics

| Field | Value |
|-------|-------|
| **Env Var** | `NEXT_PUBLIC_GA_ID` |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Analytics Script | `apps/dashboard/src/components/analytics.tsx` | Google Tag Manager script injection |
| Analytics Lib | `apps/dashboard/src/lib/analytics.ts` | Pageview tracking, event tracking, data layer init |

### Configuration

- Script: Google Tag Manager (`gtag.js`)
- Tracking: Page views + custom events
- Conditional: GA ID yoksa script inject edilmez

---

## 6. Microsoft Clarity — Session Recording

| Field | Value |
|-------|-------|
| **Env Var** | `NEXT_PUBLIC_CLARITY_ID` |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Analytics Script | `apps/dashboard/src/components/analytics.tsx` | Clarity script injection |

### Configuration

- User behavior tracking, heatmaps, session recordings
- Privacy policy'de belirtilmis
- Conditional: Clarity ID yoksa deaktif

---

## 7. Nodemailer / SMTP — Email Delivery

| Field | Value |
|-------|-------|
| **Package** | `nodemailer` v8.0.1 |
| **Env Vars** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| **Status** | :warning: PARTIALLY COMPLETE — Core done, pipeline expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Mailer | `apps/scraper/src/email/mailer.ts` | SMTP transport setup |
| Email Templates | `apps/scraper/src/email/templates/` | HTML email templates |
| Email Instant Worker | `apps/scraper/src/email-instant-worker.ts` | Transactional emails |
| Email Bulk Worker | `apps/scraper/src/email-bulk-worker.ts` | Rate-limited bulk sending |

### Current Email Templates

| Category | Templates |
|----------|-----------|
| **Transactional** | Email verification, password reset, login alert, 2FA code, team invitation |
| **Promotional** | Welcome, re-engagement, win celebration |
| **Alerts** | Ranking change, competitor alert, review alert |
| **Digests** | Weekly digest, opportunity alert |

### Current Implementation

- SMTP transport with Nodemailer
- HTML email templates with inline CSS
- Email instant worker (transactional — immediate delivery)
- Email bulk worker (promotional — rate-limited)
- Email eligibility checking
- Timezone-aware scheduling
- Tracking pixel support

### Remaining Work — Step by Step

#### Step 1: Email Verification Flow (PLA-617, PLA-556)
- **What:** Send verification token on registration + verification endpoint + dashboard page
- **Details:** Generate token, send email, create `/verify-email?token=xxx` page, API endpoint to validate
- **Files:** API auth routes, email templates, dashboard verify page

#### Step 2: Email Verification Banner (PLA-621)
- **What:** Show persistent banner when user email is not verified
- **Details:** Yellow warning banner at top of dashboard: "Please verify your email address"
- **Files:** Dashboard layout component

#### Step 3: Block Disposable Emails (PLA-625)
- **What:** Reject registration with disposable email domains (mailinator, guerrillamail, etc.)
- **Details:** Maintain blocklist of disposable domains, check on registration
- **Files:** API auth routes, shared validation

#### Step 4: Login Alert Email (PLA-557)
- **What:** Send email on new login with device/location info
- **Details:** Detect new device/IP, send "New login detected" email with browser, OS, location, time
- **Files:** API auth routes, email template

#### Step 5: List-Unsubscribe Headers (PLA-613)
- **What:** Add RFC-compliant List-Unsubscribe headers to all emails
- **Details:** Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers for one-click unsubscribe
- **Files:** Email sending utility, all email templates

#### Step 6: Email Preferences Page (PLA-633)
- **What:** Create settings page for users to manage email notification preferences
- **Details:** Toggle per email type (alerts, digests, promotional, transactional). Respect preferences in workers.
- **Files:** Dashboard settings page, API user preferences routes

#### Step 7: Email Template Variable Registry (PLA-432)
- **What:** Build registry of all available template variables with preview API
- **Details:** Define `{{userName}}`, `{{appName}}`, `{{rankChange}}` etc. for each template type. Preview API renders template with sample data.
- **Files:** API template routes, shared template variable definitions

#### Step 8: TipTap Email Template Editor (PLA-446)
- **What:** Admin page to edit email templates using TipTap rich text editor
- **Details:** WYSIWYG editor for HTML email templates, variable insertion, preview
- **Files:** Dashboard admin pages

#### Step 9: Email Template Preview & Test Send (PLA-581)
- **What:** Admin panel feature to preview rendered templates and send test emails
- **Details:** Select template, fill sample data, preview in browser, send test to any email
- **Files:** Dashboard admin pages, API template routes

#### Step 10: DB Template Integration (PLA-447)
- **What:** Migrate from file-based templates to DB-stored templates
- **Details:** Store templates in DB, load at send time, allow admin edits without deploy
- **Files:** DB schema, email workers, API template CRUD

#### Step 11: Expired Token Cleanup (PLA-551)
- **What:** Scheduled job to clean up expired verification tokens, invitations, email logs
- **Details:** Cron job to delete expired records periodically
- **Files:** Scraper cron jobs, DB queries

#### Step 12: Alert Email Data Builders (PLA-426)
- **What:** Build data transformation layer for alert emails
- **Details:** Transform raw tracking data into email-friendly format: ranking changes, competitor movements, new reviews, win celebrations
- **Files:** Scraper email builders

---

## 8. BullMQ + Redis — Job Queue & Cache

| Field | Value |
|-------|-------|
| **Packages** | `bullmq` v5.0.0, `ioredis` v5.0.0 |
| **Env Var** | `REDIS_URL` |
| **Status** | :white_check_mark: CORE COMPLETE — monitoring/admin features expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Queue Setup | `apps/scraper/src/queue.ts` | Queue definitions and connections |
| Worker | `apps/scraper/src/worker.ts` | Main scraper job processor |
| Email Instant | `apps/scraper/src/email-instant-worker.ts` | Transactional email processor |
| Email Bulk | `apps/scraper/src/email-bulk-worker.ts` | Bulk email processor |
| Notification | `apps/scraper/src/notification-worker.ts` | Notification processor |
| Rate Limiting | `apps/api/src/` | Redis-backed rate limiting |
| Token Blacklist | `apps/api/src/` | JWT token blacklist (logout) |
| Cache | `apps/api/src/` | Response caching |

### Queue Types

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| Scraper | App details, categories, keywords, reviews | 1 |
| Email Instant | Transactional emails (verification, reset, etc.) | — |
| Email Bulk | Promotional/digest emails with rate limiting | — |
| Notifications | In-app + web push notifications | — |
| Interactive | Playwright-based browser scraping | 1 |

### Remaining Work — Step by Step

#### Step 1: Event Dispatcher (PLA-422)
- **What:** Fan-out events to email + notification queues
- **Details:** When tracking detects a change (rank up/down, new review, competitor move), dispatch events to relevant queues
- **Files:** Scraper event system, queue producers

#### Step 2: Queue Monitoring Dashboard (PLA-427)
- **What:** Admin dashboard page showing all 5 queue statuses
- **Details:** Show waiting/active/completed/failed counts, job details, retry/remove controls
- **Files:** Dashboard admin pages, API queue status routes

#### Step 3: DLQ Monitoring Page (PLA-578)
- **What:** Dead letter queue monitoring in admin dashboard
- **Details:** List failed jobs, show error details, retry/dismiss controls
- **Files:** Dashboard admin pages, API DLQ routes

#### Step 4: Enhanced Health Dashboard Metrics (PLA-577)
- **What:** Add Redis connection pool, queue depth, memory usage to admin health page
- **Details:** Show Redis info (memory, connections, keys), per-queue metrics
- **Files:** Dashboard admin health page, API health routes

---

## 9. Grafana Cloud — Logging & Metrics

| Field | Value |
|-------|-------|
| **Components** | Loki (logs), Prometheus (metrics), Alloy (collector) |
| **Env Vars** | `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER`, `GRAFANA_PROMETHEUS_URL`, `GRAFANA_PROM_USER`, `GRAFANA_CLOUD_TOKEN`, `METRICS_BEARER_TOKEN` |
| **Config File** | `config/alloy.river` |
| **Docker Image** | `grafana/alloy:v1.5.1` |
| **Status** | :white_check_mark: COMPLETE (optional) |

### Architecture

```
Docker Containers → stdout/stderr
       ↓
Grafana Alloy (collector agent)
       ↓                    ↓
   Loki (logs)      Prometheus (metrics)
       ↓                    ↓
        Grafana Cloud Dashboards
```

### Configuration Details

- **Alloy** discovers Docker containers and collects their logs
- **Loki** receives JSON structured logs (from Pino logger) with level/module extraction
- **Prometheus** scrapes API `/metrics` endpoint (port 3001) with bearer token auth
- **Memory limit:** Alloy container capped at 256MB
- All optional — services run fine without Grafana config

---

## 10. Linear — Issue Tracking

| Field | Value |
|-------|-------|
| **Env Var** | `LINEAR_API_KEY` |
| **API** | GraphQL `https://api.linear.app/graphql` |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Linear Client | `apps/scraper/src/utils/linear-client.ts` | GraphQL API client |
| Error Task Creator | `apps/scraper/src/utils/create-linear-error-task.ts` | Auto-create issues on scraper errors |
| Job Failure Creator | `apps/scraper/src/utils/create-linear-job-failure-task.ts` | Auto-create issues on job failures |

### Configuration

- **Team ID:** `13127a86-8941-4c00-9031-9efb4a4fb91b`
- **Project ID:** `ee05a847-f284-4134-974f-6f3cfc7cec7a`
- **Auto-label:** `scraping-error` (created automatically if missing)
- **Graceful degradation:** API key yoksa sessizce skip eder

---

## 11. Google Search Console — SEO Analytics

| Field | Value |
|-------|-------|
| **Env Vars** | `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL` |
| **Status** | :white_check_mark: COMPLETE |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Search Console Service | `apps/api/src/services/search-console.ts` | Google OAuth2 + Search Analytics API |

### Features

- Search analytics queries (clicks, impressions, CTR, position)
- Indexing status
- Top pages ranking
- Search query performance
- Service account authentication (no user OAuth needed)

---

## 12. Web Push (VAPID) — Browser Notifications

| Field | Value |
|-------|-------|
| **Env Vars** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| **Status** | :warning: PARTIALLY COMPLETE — core ready, notification pipeline expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Web Push Service | `apps/api/src/services/web-push.ts` | Push message delivery |
| Push Client | `apps/dashboard/src/lib/push-notifications.ts` | Service worker registration, subscription management |
| Notification Worker | `apps/scraper/src/notification-worker.ts` | Process notification queue |

### DB Tables

- `pushSubscriptions` — browser push subscription endpoints
- `notifications` — in-app notification records

### Remaining Work — Step by Step

#### Step 1: Notification Worker Full Implementation (PLA-420)
- **What:** Complete notification worker with in-app + web push delivery
- **Details:** Process notification queue, create in-app notification record, send web push if subscription exists
- **Files:** `apps/scraper/src/notification-worker.ts`

#### Step 2: Event Dispatcher → Notification Queue (PLA-422)
- **What:** Wire tracking events to notification queue
- **Details:** Ranking changes, new reviews, competitor alerts → notification queue → worker
- **Files:** Scraper event system

#### Step 3: Notification Template Editor (PLA-445)
- **What:** Admin page to create/edit notification templates with TipTap
- **Details:** Define title/body templates with variables, preview
- **Files:** Dashboard admin pages

#### Step 4: Notification Management Dashboard (PLA-493)
- **What:** Admin page to view/manage all notifications
- **Details:** List sent notifications, delivery status, open rates
- **Files:** Dashboard admin pages, API notification routes

#### Step 5: Notification Templates Separate Page (PLA-516)
- **What:** Split notification templates into dedicated page
- **Details:** Separate from notification management for cleaner UX
- **Files:** Dashboard admin pages

#### Step 6: Template Integration into Pipeline (PLA-447)
- **What:** Use DB-stored templates in notification + email pipelines
- **Details:** Load template from DB, render with variables, deliver
- **Files:** Notification worker, email workers

#### Step 7: Stale Data → Alert Notifications (PLA-665, PLA-607)
- **What:** Wire stale scraper data detection to alerting system
- **Details:** When scraper data becomes stale (no updates for X hours), trigger admin notification
- **Files:** Scraper monitoring, notification system

#### Step 8: Alerting Hooks (PLA-601)
- **What:** Implement alerting hooks for critical system events
- **Details:** DB connection failures, queue overflows, worker crashes → admin notifications
- **Files:** API/worker error handlers, notification system

#### Step 9: Real-time Badge Updates (PLA-587)
- **What:** Show unread notification count in dashboard header
- **Details:** Poll or SSE for unread count, update badge in real-time
- **Files:** Dashboard header component, API notification count endpoint

#### Step 10: Toast Notification System (PLA-569)
- **What:** In-app toast notifications for user action feedback
- **Details:** Success/error/info toasts for actions like "App tracked", "Settings saved"
- **Files:** Dashboard toast provider component

---

## 13. Playwright — Browser Automation

| Field | Value |
|-------|-------|
| **Package** | `playwright` v1.58.2 |
| **Status** | :white_check_mark: COMPLETE (scraping), E2E tests expanding |

### Where it's used

| Component | File | Details |
|-----------|------|---------|
| Browser Client | `apps/scraper/src/clients/browser-client.ts` | Playwright browser management |
| Interactive Worker | `apps/scraper/src/interactive-worker.ts` | JS-heavy site scraping |
| Platform Scrapers | Various platform modules | Zendesk, etc. (Cloudflare bypass) |

### Configuration

- Docker image: `node:22-bookworm-slim` (requires glibc for Chromium)
- Headless Chromium with stealth settings
- Max 1 concurrent browser instance

### Remaining Work

#### Step 1: E2E Test Infrastructure (PLA-666)
- **What:** Set up Playwright E2E test infrastructure + auth and invitation test suites
- **Details:** Configure Playwright test runner for dashboard, create login/register/invite test flows
- **Files:** New `e2e/` directory, Playwright config, test files

---

## 14. Coolify — Deployment Platform

| Field | Value |
|-------|-------|
| **Server** | Hetzner VPS `5.78.101.102` |
| **Env Vars** | `COOLIFY_WEBHOOK_URL`, `COOLIFY_API_TOKEN` (GitHub Secrets) |
| **Status** | :white_check_mark: COMPLETE |

### Architecture

```
GitHub Push (main) → GitHub Actions CI
       ↓
  Tests + Build + Lint
       ↓
  Coolify Webhook Trigger
       ↓
  Coolify builds Docker images
       ↓
  Traefik reverse proxy
       ↓
  Docker containers (API, Dashboard, Workers, DB, Redis)
       ↓
  Cloudflare CDN/Proxy
       ↓
  appranks.io / api.appranks.io
```

### Containers (Production)

| Container | Port | Memory Limit |
|-----------|------|--------------|
| API | 3001 | 1GB |
| Dashboard | 3000 | 512MB |
| Worker | — | 3GB |
| Worker Interactive | — | 3GB |
| Worker Email | — | 512MB |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| Grafana Alloy | — | 256MB |

### Remaining Work (CI Hardening)

#### Step 1: Docker Image Build Validation (PLA-649)
- **What:** Validate all Docker images build successfully in CI
- **Details:** `docker build` for each Dockerfile in CI pipeline

#### Step 2: Container Startup + Healthcheck Test (PLA-652)
- **What:** Start containers in CI and verify healthcheck passes
- **Details:** `docker compose up` → wait → check `/health/live`

#### Step 3: Dockerfile Lint (PLA-653)
- **What:** Add hadolint Dockerfile linting to CI
- **Details:** Catch common Dockerfile issues (missing `--no-cache`, etc.)

#### Step 4: Worker Healthchecks (PLA-659)
- **What:** HEALTHCHECK instruction in worker Dockerfiles
- **Details:** Already completed for main containers, verify workers

---

## 15. GitHub Actions — CI/CD

| Field | Value |
|-------|-------|
| **Config** | `.github/workflows/ci.yml` |
| **Status** | :white_check_mark: COMPLETE |

### Pipeline Steps

1. Checkout code
2. Setup Node.js
3. Install dependencies (`npm ci`)
4. Lint (`turbo lint`)
5. Type check (`turbo type-check`)
6. Run tests (`turbo test`)
7. Build all packages (`turbo build`)
8. Sentry source map upload (dashboard)
9. Coolify webhook deploy trigger
10. Health check verification (`/health/live`)

### Secrets Required

| Secret | Service |
|--------|---------|
| `COOLIFY_WEBHOOK_URL` | Coolify deploy trigger |
| `COOLIFY_API_TOKEN` | Coolify API auth |
| `SENTRY_AUTH_TOKEN` | Sentry source map upload |
| `SENTRY_ORG` | Sentry organization |
| `SENTRY_PROJECT` | Sentry project |

---

## 16. Mailhog — Dev Email Testing

| Field | Value |
|-------|-------|
| **Docker Image** | `mailhog/mailhog:latest` |
| **Profile** | `docker-compose.yml` (email profile) |
| **Status** | :white_check_mark: COMPLETE (dev only) |

### Usage

```bash
docker compose --profile email up
```

- Web UI: `http://localhost:8025`
- SMTP: `localhost:1025`
- Catches all outgoing emails in development

---

## 17. Summary Table

| # | Service | Category | Status | Remaining Tasks |
|---|---------|----------|--------|-----------------|
| 1 | Sentry | Error Tracking | :white_check_mark: Complete | 0 |
| 2 | Stripe | Billing | :warning: Partial | 10 steps |
| 3 | OpenAI | AI/LLM | :white_check_mark: Complete | 0 |
| 4 | PostHog | Product Analytics | :warning: Partial | 2 steps |
| 5 | Google Analytics | Web Analytics | :white_check_mark: Complete | 0 |
| 6 | Microsoft Clarity | Session Recording | :white_check_mark: Complete | 0 |
| 7 | Nodemailer/SMTP | Email | :warning: Partial | 12 steps |
| 8 | BullMQ + Redis | Queue & Cache | :white_check_mark: Core done | 4 steps (monitoring) |
| 9 | Grafana Cloud | Logging & Metrics | :white_check_mark: Complete | 0 |
| 10 | Linear | Issue Tracking | :white_check_mark: Complete | 0 |
| 11 | Google Search Console | SEO | :white_check_mark: Complete | 0 |
| 12 | Web Push (VAPID) | Notifications | :warning: Partial | 10 steps |
| 13 | Playwright | Browser Automation | :white_check_mark: Complete | 1 step (E2E tests) |
| 14 | Coolify | Deployment | :white_check_mark: Complete | 4 steps (CI hardening) |
| 15 | GitHub Actions | CI/CD | :white_check_mark: Complete | 0 |
| 16 | Mailhog | Dev Email Test | :white_check_mark: Complete | 0 |

**Totals:** 16 services, 10 complete, 6 with remaining work (~43 steps total)

---

## 18. Priority Roadmap

### HIGH PRIORITY (Revenue-blocking)

1. **Stripe Billing** — 10 steps remaining
   - Webhook completion → checkout wiring → pricing page → grace period → enforcement
   - **Why:** No billing = no revenue. Must be complete before public launch.

2. **Email Pipeline** — 12 steps remaining
   - Email verification → disposable block → login alerts → preferences → template system
   - **Why:** Email verification is security-critical. Alerts drive user engagement.

### MEDIUM PRIORITY (User experience)

3. **Web Push Notifications** — 10 steps remaining
   - Notification worker → event dispatcher → templates → management dashboard
   - **Why:** Push notifications drive re-engagement and feature value.

4. **BullMQ Monitoring** — 4 steps remaining
   - Event dispatcher → queue dashboard → DLQ monitoring → health metrics
   - **Why:** Operational visibility for debugging and scaling.

### LOW PRIORITY (Nice to have)

5. **PostHog Full Coverage** — 2 steps remaining
   - Event taxonomy → dashboard configuration
   - **Why:** Product analytics for growth optimization.

6. **CI Hardening** — 4 steps remaining
   - Docker build validation → container startup test → Dockerfile lint
   - **Why:** Prevents deployment failures.

7. **Playwright E2E Tests** — 1 step
   - Test infrastructure setup
   - **Why:** Automated regression testing for critical user flows.

---

## Environment Variable Reference

### Required (App won't function without these)

| Variable | Service | Where |
|----------|---------|-------|
| `DATABASE_URL` | PostgreSQL | Root `.env` |
| `JWT_SECRET` | Auth | Root `.env` |
| `REDIS_URL` | Redis | Root `.env` |

### Required for specific features

| Variable | Service | Feature |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | Stripe | Billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhooks |
| `SMTP_HOST/PORT/USER/PASS/FROM` | SMTP | Email |
| `OPENAI_API_KEY` | OpenAI | AI features |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | Web Push | Notifications |

### Optional (Graceful degradation)

| Variable | Service | Feature |
|----------|---------|---------|
| `SENTRY_DSN` | Sentry | Error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog | Analytics |
| `NEXT_PUBLIC_GA_ID` | Google Analytics | Web analytics |
| `NEXT_PUBLIC_CLARITY_ID` | Clarity | Session recording |
| `LINEAR_API_KEY` | Linear | Auto-issue creation |
| `GSC_CLIENT_EMAIL/PRIVATE_KEY` | Google Search Console | SEO |
| `GRAFANA_*` | Grafana Cloud | Logging/metrics |
