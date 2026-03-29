# Email & Notification System — Unified Implementation Plan

> AppRanks.io Email Workers + Notification Worker + Queue Architecture + Admin Dashboards
> Created: 2026-03-29
> Source docs: `email-system-design.md`, `email-system-implementation-guide.md`, `notification-system-design.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State](#2-current-state)
3. [Target Architecture](#3-target-architecture)
4. [Worker Definitions](#4-worker-definitions)
5. [Queue Architecture](#5-queue-architecture)
6. [Database Schema](#6-database-schema)
7. [Shared Infrastructure](#7-shared-infrastructure)
8. [Implementation Steps](#8-implementation-steps)
9. [Frequency & Throttling Rules](#9-frequency--throttling-rules)
10. [Admin Dashboard Pages](#10-admin-dashboard-pages)
11. [User-Facing Pages](#11-user-facing-pages)
12. [Docker & Deployment](#12-docker--deployment)
13. [Testing Strategy](#13-testing-strategy)
14. [Metrics & Success Criteria](#14-metrics--success-criteria)
15. [Risk Analysis](#15-risk-analysis)
16. [Task Dependency Graph](#16-task-dependency-graph)

---

## 1. Executive Summary

### What We're Building

3 new workers + 3 new BullMQ queues + 11 new DB tables + admin/user dashboard pages to handle:

| Worker | Queue | Purpose | SLA |
|--------|-------|---------|-----|
| **Email Instant Worker** | `email-instant` | Transactional emails (password reset, verification, welcome, invitations) | < 30 seconds |
| **Email Bulk Worker** | `email-bulk` | Marketing/notification emails (digests, alerts, cold outreach, onboarding series) | < 5 min (alerts), < 30 min (bulk) |
| **Notification Worker** | `notifications` | Web Push (VAPID) + In-App notification center | < 10 seconds |

### Why 3 Separate Workers & Queues

1. **Isolation** — A bulk email campaign should never delay a password reset
2. **Different concurrency** — Instant: fast & few (3), Bulk: many & throttled (5), Notifications: fast & many (5)
3. **Different retry strategies** — Instant: aggressive retry (3x, 5s), Bulk: patient retry (2x, 30s)
4. **Independent monitoring** — Each queue has its own health metrics
5. **Independent scaling** — Can scale bulk worker during campaigns without touching instant

### Email Type Inventory

| # | Type | Category | Queue | Trigger | Frequency |
|---|------|----------|-------|---------|-----------|
| 1 | Password Reset | Transactional | email-instant | User action | On demand |
| 2 | Email Verification | Transactional | email-instant | Registration | Once |
| 3 | Welcome | Transactional | email-instant | Registration | Once |
| 4 | Team Invitation | Transactional | email-instant | Admin action | On demand |
| 5 | Login Alert | Transactional | email-instant | New device | On demand |
| 6 | 2FA Code | Transactional | email-instant | Login | On demand |
| 7 | Daily Digest | Member | email-bulk | Cron (8 AM local) | Daily |
| 8 | Weekly Summary | Member | email-bulk | Cron (Mon 8 AM local) | Weekly |
| 9 | Ranking Alert | Member | email-bulk | Scraper event | Real-time (batched) |
| 10 | Competitor Alert | Member | email-bulk | Scraper event | Real-time (batched) |
| 11 | Review Alert | Member | email-bulk | Scraper event | Real-time (batched) |
| 12 | Win Celebration | Member | email-bulk | Scraper event | Event-driven |
| 13 | Opportunity Alert | Member | email-bulk | Cron (Sat morning) | Weekly |
| 14 | Onboarding Day 1 | Lifecycle | email-bulk | 24h post-reg | Once |
| 15 | Onboarding Day 3 | Lifecycle | email-bulk | 72h post-reg | Once |
| 16 | Onboarding Day 7 | Lifecycle | email-bulk | 168h post-reg | Once |
| 17 | Re-engagement | Lifecycle | email-bulk | Inactivity 14d+ | Max 1/14d |
| 18 | Cold First Contact | Cold | email-bulk | Admin/campaign | Once per prospect |
| 19 | Cold Follow-up | Cold | email-bulk | Auto (3-7d after) | Once per prospect |
| 20 | Cold Competitive Alert | Cold | email-bulk | Competitor move | Max 1/prospect |

### Notification Type Inventory

| # | Type | Category | Default Push | Default In-App |
|---|------|----------|-------------|----------------|
| 1 | `ranking_top3_entry` | Ranking | ON | ON |
| 2 | `ranking_top3_exit` | Ranking | ON | ON |
| 3 | `ranking_significant_change` | Ranking | ON | ON |
| 4 | `ranking_new_entry` | Ranking | OFF | ON |
| 5 | `ranking_dropped_out` | Ranking | ON | ON |
| 6 | `category_rank_change` | Ranking | OFF | ON |
| 7 | `competitor_overtook` | Competitor | ON | ON |
| 8 | `competitor_featured` | Competitor | OFF | ON |
| 9 | `competitor_review_surge` | Competitor | OFF | ON |
| 10 | `competitor_pricing_change` | Competitor | OFF | ON |
| 11 | `review_new_positive` | Review | OFF | ON |
| 12 | `review_new_negative` | Review | ON | ON |
| 13 | `review_milestone` | Review | ON | ON |
| 14 | `milestone_rank_first` | Milestone | ON | ON |
| 15 | `milestone_rating_threshold` | Milestone | ON | ON |
| 16 | `milestone_best_week` | Milestone | ON | ON |
| 17 | `featured_added` | Featured | ON | ON |
| 18 | `featured_removed` | Featured | ON | ON |
| 19 | `system_welcome` | System | OFF | ON |
| 20 | `system_scrape_complete` | System | OFF | ON |
| 21 | `system_account_limit` | System | OFF | ON |
| 22 | `system_app_added` | System | OFF | ON |
| 23 | `system_member_joined` | System | OFF | ON |

---

## 2. Current State

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| SMTP Transport | Working | `apps/scraper/src/email/mailer.ts` |
| Email Pipeline | Working | `apps/scraper/src/email/pipeline.ts` (6-step) |
| Email Eligibility | Working | `apps/scraper/src/email/eligibility.ts` |
| Email Tracking | Working | `apps/scraper/src/email/tracking.ts` |
| Email Logger | Working | `apps/scraper/src/email/email-logger.ts` |
| Daily Digest Builder | Working | `apps/scraper/src/email/digest-builder.ts` |
| Weekly Summary Builder | Working | `apps/scraper/src/email/weekly-builder.ts` |
| Digest HTML Template | Working | `apps/scraper/src/email/digest-template.ts` |
| Weekly HTML Template | Working | `apps/scraper/src/email/weekly-template.ts` |
| Ranking Alert Template | Working | `apps/scraper/src/email/ranking-alert-template.ts` |
| Competitor Alert Template | Working | `apps/scraper/src/email/competitor-alert-template.ts` |
| Review Alert Template | Working | `apps/scraper/src/email/review-alert-template.ts` |
| Opportunity Alert Template | Working | `apps/scraper/src/email/opportunity-alert-template.ts` |
| Win Celebration Template | Working | `apps/scraper/src/email/win-celebration-template.ts` |
| Welcome Template | Working | `apps/scraper/src/email/welcome-template.ts` |
| Re-engagement Template | Working | `apps/scraper/src/email/re-engagement-template.ts` |
| Cold Email Templates | Working | `apps/scraper/src/email/cold-email-templates.ts` |
| Deliverability Config | Working | `apps/scraper/src/email/deliverability.ts` |
| Dry Run System | Working | `apps/scraper/src/email/dry-run.ts` |
| Cron Scheduler | Working | `apps/scraper/src/scheduler.ts` (node-cron) |
| BullMQ Queues | Working | `apps/scraper/src/queue.ts` (2 queues: bg + interactive) |
| Background Worker | Working | `apps/scraper/src/worker.ts` (concurrency: 11) |
| Interactive Worker | Working | `apps/scraper/src/interactive-worker.ts` (concurrency: 1) |
| Circuit Breaker | Working | `apps/scraper/src/circuit-breaker.ts` |
| Dead Letter Queue | Working | `dead_letter_jobs` table |
| User fields | Partial | `emailDigestEnabled`, `lastDigestSentAt`, `timezone` |
| Queue admin API | Working | `/api/system-admin/scraper/queue` (status, pause, resume, trigger) |

### Key Gaps

1. **No separate email workers** — Emails sent inline in scraper worker
2. **No transactional email queue** — Password reset etc. don't exist yet
3. **No notification system at all** — No Web Push, no in-app notifications, no bell icon
4. **No event dispatcher** — Scraper events don't fan out to email + notification queues
5. **No alert batching** — Multiple events could spam users
6. **No quiet hours** — Emails can arrive at 3 AM
7. **Email runs in scraper worker** — Should be isolated in its own worker
8. **No cold email campaign management** — No prospect tracking, no campaign lifecycle
9. **Limited admin visibility** — No email dashboard, no notification dashboard, no queue monitoring page

### What We Keep & Extend

- **BullMQ** — Proven queue infrastructure, just add 3 new queues
- **Redis** — Same instance, add new keys for batching/rate-limiting
- **SMTP config** (`mailer.ts`) — Same transporter, both workers share it
- **Email pipeline** (`pipeline.ts`) — 6-step process, extend for transactional (skip eligibility) vs bulk
- **Existing templates** — All template files stay, add transactional templates
- **Eligibility checks** — Extend with quiet hours and batching
- **Tracking system** — Already handles pixel + link rewriting + unsubscribe
- **Scheduler** — Add new cron entries for email-bulk queue
- **Process job router** — Extend to route new job types

---

## 3. Target Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TRIGGER LAYER                                       │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │ User Action  │  │ Cron        │  │ Scraper     │  │ Admin Manual     │    │
│  │              │  │ Scheduler   │  │ Results     │  │                  │    │
│  │ · Register   │  │             │  │             │  │ · Campaign send  │    │
│  │ · Forgot pwd │  │ · Daily 8AM │  │ · Ranking   │  │ · Test email     │    │
│  │ · Invite     │  │ · Weekly Mon│  │   change    │  │ · Manual trigger │    │
│  │ · Login      │  │ · Onboarding│  │ · Competitor│  │ · Re-send        │    │
│  │              │  │ · Re-engage │  │   move      │  │                  │    │
│  │              │  │ · Opportunity│  │ · New review│  │                  │    │
│  │              │  │ · Cold auto │  │ · Milestone │  │                  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘    │
│         │                │                │                   │              │
│         ▼                ▼                ▼                   ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                     EVENT DISPATCHER                              │       │
│  │                                                                   │       │
│  │  1. Determine event type                                          │       │
│  │  2. Find affected users (account → tracked apps → users)         │       │
│  │  3. Route to correct queue(s):                                    │       │
│  │     · Transactional → email-instant                               │       │
│  │     · Scheduled/alert/cold → email-bulk                           │       │
│  │     · Push + in-app → notifications                               │       │
│  │  4. Same event can fan out to BOTH email-bulk AND notifications   │       │
│  └────┬───────────────────┬───────────────────┬─────────────────────┘       │
│       │                   │                   │                              │
│       ▼                   ▼                   ▼                              │
│  ┌──────────┐       ┌──────────┐       ┌──────────────┐                    │
│  │ email-   │       │ email-   │       │ notifications │                    │
│  │ instant  │       │ bulk     │       │ queue         │                    │
│  │ queue    │       │ queue    │       │               │                    │
│  └────┬─────┘       └────┬─────┘       └──────┬───────┘                    │
│       │                  │                     │                             │
│       ▼                  ▼                     ▼                             │
│  ┌──────────┐       ┌──────────┐       ┌──────────────┐                    │
│  │ INSTANT  │       │ BULK     │       │ NOTIFICATION │                    │
│  │ WORKER   │       │ WORKER   │       │ WORKER       │                    │
│  │          │       │          │       │              │                    │
│  │ Conc: 3  │       │ Conc: 5  │       │ Conc: 5      │                    │
│  │ Mem: 512M│       │ Mem: 1GB │       │ Mem: 512MB   │                    │
│  └──────────┘       └──────────┘       └──────────────┘                    │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow: Scraper → Email + Notification (Dual Fan-Out)

```
Scraper Job (bg worker) completes
  ↓
  ↓ writes to DB (rankings, snapshots, reviews, etc.)
  ↓
Event Detector (inline in scraper process-job.ts)
  ↓ checkRankingAlerts()    → { type: 'ranking_significant_change', data: {...} }
  ↓ checkCompetitorMoves()  → { type: 'competitor_overtook', data: {...} }
  ↓ checkNewReviews()       → { type: 'review_new_negative', data: {...} }
  ↓ detectMilestones()      → { type: 'milestone_rank_first', data: {...} }
  ↓
  ↓ For EACH detected event:
  ↓
Event Dispatcher
  ↓
  ├──▶ email-bulk queue    → { jobType: 'email_ranking_alert', userId, eventData }
  │                           (goes through full 6-step pipeline with eligibility)
  │
  └──▶ notifications queue → { type: 'ranking_significant_change', userId, eventData }
                              (creates in-app + optional web push)
```

### Transactional Email Flow (Separate Path — No Eligibility)

```
API Route (e.g., POST /api/auth/forgot-password)
  ↓
  ↓ Generate token, save to DB
  ↓
  ├──▶ email-instant queue → { jobType: 'email_password_reset', email, token, name }
  │
  ↓ Return 200 OK to user immediately


Email Instant Worker picks up job:
  ↓
  1. Build template (simple, minimal DB queries)
  2. Log to email_logs (status: pending)
  3. Send via SMTP (same transporter as bulk)
  4. Update email_logs (status: sent/failed)

  NO eligibility check (user explicitly requested it)
  NO frequency cap (transactional = always send)
  NO quiet hours (password reset at 3 AM is fine)
  NO batching (send immediately)
  NO tracking pixel (transactional emails don't track opens)
  YES unsubscribe header (required by RFC, but points to "manage preferences" not type-unsubscribe)
```

---

## 4. Worker Definitions

### 4.1 Email Instant Worker

**Entry point:** `apps/scraper/src/email-instant-worker.ts`
**Dockerfile:** `Dockerfile.worker-email-instant`
**Queue:** `email-instant`
**Concurrency:** 3
**Memory:** 512MB
**Grace period:** 30s

**Job types handled:**
```typescript
type InstantEmailJobType =
  | 'email_password_reset'
  | 'email_verification'
  | 'email_welcome'
  | 'email_invitation'
  | 'email_login_alert'
  | 'email_2fa_code';
```

**Job data interface:**
```typescript
interface InstantEmailJobData {
  type: InstantEmailJobType;
  recipientEmail: string;
  recipientName?: string;
  userId?: string;           // null for pre-registration emails
  accountId?: string;
  templateData: Record<string, any>;  // Type-specific data (token, code, etc.)
}
```

**Processing logic:**
```typescript
// Simplified — no eligibility, no batching
async function processInstantEmail(job: Job<InstantEmailJobData>) {
  const { type, recipientEmail, recipientName, templateData } = job.data;

  // 1. Render template
  const { subject, html } = renderTransactionalTemplate(type, templateData);

  // 2. Log attempt
  const logId = await emailLogger.create({
    emailType: type,
    recipientEmail,
    recipientName,
    subject,
    htmlBody: html,
    status: 'pending',
    isTransactional: true,
  });

  // 3. Send
  try {
    const messageId = await mailer.send({ to: recipientEmail, subject, html });
    await emailLogger.update(logId, { status: 'sent', messageId });
  } catch (error) {
    await emailLogger.update(logId, { status: 'failed', errorMessage: error.message });
    throw error; // BullMQ will retry
  }
}
```

**Retry config:**
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },  // 5s, 10s, 20s
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 },
}
```

### 4.2 Email Bulk Worker

**Entry point:** `apps/scraper/src/email-bulk-worker.ts`
**Dockerfile:** `Dockerfile.worker-email-bulk`
**Queue:** `email-bulk`
**Concurrency:** 5
**Memory:** 1GB
**Grace period:** 120s

**Job types handled:**
```typescript
type BulkEmailJobType =
  // Scheduled
  | 'email_daily_digest'
  | 'email_weekly_summary'
  | 'email_opportunity_alert'
  // Event-driven alerts
  | 'email_ranking_alert'
  | 'email_competitor_alert'
  | 'email_review_alert'
  | 'email_win_celebration'
  // Lifecycle
  | 'email_onboarding_day1'
  | 'email_onboarding_day3'
  | 'email_onboarding_day7'
  | 'email_reengagement'
  // Cold outreach
  | 'email_cold_first_contact'
  | 'email_cold_followup'
  | 'email_cold_competitive';
```

**Job data interface:**
```typescript
interface BulkEmailJobData {
  type: BulkEmailJobType;
  // For scheduled emails (digest, weekly): process all eligible users
  platform?: string;
  // For event-driven alerts: specific user + event data
  userId?: string;
  accountId?: string;
  appId?: string;
  eventData?: Record<string, any>;
  // For cold emails: specific prospect + campaign
  prospectId?: string;
  campaignId?: string;
}
```

**Processing logic:**
```typescript
async function processBulkEmail(job: Job<BulkEmailJobData>) {
  const { type } = job.data;

  // Route to appropriate handler
  switch (type) {
    case 'email_daily_digest':
      return processDigest(job);        // Fan-out: find eligible users, send each
    case 'email_weekly_summary':
      return processWeeklySummary(job);  // Fan-out: find eligible users, send each
    case 'email_ranking_alert':
      return processRankingAlert(job);   // Single user, goes through full pipeline
    case 'email_competitor_alert':
      return processCompetitorAlert(job);
    case 'email_review_alert':
      return processReviewAlert(job);
    case 'email_win_celebration':
      return processWinCelebration(job);
    case 'email_cold_first_contact':
      return processColdFirstContact(job);
    // ... etc
  }
}

// Each handler runs through the 6-step pipeline:
// 1. Build Data → 2. Check Eligibility → 3. Render Template → 4. Log to DB → 5. Inject Tracking → 6. Send SMTP
```

**Retry config:**
```typescript
{
  attempts: 2,
  backoff: { type: 'exponential', delay: 30000 },  // 30s, 60s
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}
```

**Rate limiting:**
- BullMQ rate limiter: max 50 jobs per minute (prevents SMTP overload)
- Cold emails: max 50 per day (separate counter in Redis)
- Per-user: max 10 emails per day (all types combined)

### 4.3 Notification Worker

**Entry point:** `apps/scraper/src/notification-worker.ts`
**Dockerfile:** `Dockerfile.worker-notifications`
**Queue:** `notifications`
**Concurrency:** 5
**Memory:** 512MB
**Grace period:** 30s

**Job types handled:**
```typescript
type NotificationJobType =
  | 'notification_single'      // Single notification for one user
  | 'notification_broadcast'   // Same notification to multiple users (fan-out)
  | 'notification_batch_flush' // Flush accumulated batched notifications
  | 'notification_cleanup';    // Periodic cleanup of expired subscriptions
```

**Job data interface:**
```typescript
interface NotificationJobData {
  type: NotificationJobType;

  // For single notification
  userId?: string;
  accountId?: string;
  notificationType?: NotificationType;  // e.g., 'ranking_top3_entry'
  eventData?: Record<string, any>;

  // For broadcast
  userIds?: string[];

  // For batch flush
  batchKey?: string;  // Redis key to flush
}
```

**Processing logic:**
```typescript
async function processNotification(job: Job<NotificationJobData>) {
  const { type } = job.data;

  switch (type) {
    case 'notification_single':
      return processSingleNotification(job);
    case 'notification_broadcast':
      return processBroadcast(job);
    case 'notification_batch_flush':
      return processBatchFlush(job);
    case 'notification_cleanup':
      return processCleanup(job);
  }
}

async function processSingleNotification(job: Job<NotificationJobData>) {
  const { userId, accountId, notificationType, eventData } = job.data;

  // 1. Check eligibility
  const eligible = await checkNotificationEligibility(userId!, notificationType!);
  if (!eligible.pass) {
    // Log skip reason, return
    return;
  }

  // 2. Build notification content
  const content = buildNotificationContent(notificationType!, eventData!);

  // 3. Save to notifications table (in-app — always)
  const notification = await db.insert(notifications).values({
    userId, accountId,
    type: notificationType,
    category: getCategoryFromType(notificationType!),
    title: content.title,
    body: content.body,
    url: content.url,
    icon: content.icon,
    priority: content.priority,
    eventData,
  }).returning();

  // 4. Send Web Push (if user has push enabled for this type + has active subscription)
  if (await shouldSendPush(userId!, notificationType!)) {
    const subscriptions = await getActiveSubscriptions(userId!);
    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(sub, JSON.stringify({
          title: content.title,
          body: content.body,
          icon: content.icon,
          url: content.url,
          tag: content.tag,
          priority: content.priority,
          notificationId: notification.id,
        }));
        await updateNotification(notification.id, { pushSent: true, pushSentAt: new Date() });
        await logDelivery(notification.id, sub.id, 'sent');
      } catch (error) {
        await handlePushError(error, sub, notification.id);
      }
    }
  }
}
```

**Retry config:**
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 10000 },  // 10s, 20s, 40s
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 },
}
```

---

## 5. Queue Architecture

### 5.1 Queue Definitions

```typescript
// apps/scraper/src/queue.ts — EXTEND with 3 new queues

// EXISTING
export const BACKGROUND_QUEUE_NAME = 'scraper-jobs-background';
export const INTERACTIVE_QUEUE_NAME = 'scraper-jobs-interactive';

// NEW
export const EMAIL_INSTANT_QUEUE_NAME = 'email-instant';
export const EMAIL_BULK_QUEUE_NAME = 'email-bulk';
export const NOTIFICATIONS_QUEUE_NAME = 'notifications';
```

### 5.2 Queue Configuration Comparison

| Property | email-instant | email-bulk | notifications |
|----------|--------------|-----------|--------------|
| **Concurrency** | 3 | 5 | 5 |
| **Retry attempts** | 3 | 2 | 3 |
| **Backoff base** | 5s exponential | 30s exponential | 10s exponential |
| **Job TTL** | 1 hour | 24 hours | 4 hours |
| **Rate limit** | None (unlimited) | 50 jobs/min | 100 jobs/min |
| **DLQ logging** | Yes | Yes | Yes |
| **Priority support** | Yes | Yes | Yes |
| **Keep completed** | Last 200 | Last 100 | Last 200 |
| **Keep failed** | Last 100 | Last 50 | Last 100 |

### 5.3 Enqueue Functions

```typescript
// Transactional emails — called from API routes
export async function enqueueInstantEmail(data: InstantEmailJobData): Promise<string> {
  const queue = getEmailInstantQueue();
  const job = await queue.add(`email:${data.type}`, data, {
    priority: 1,  // Always high priority
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  return job.id!;
}

// Bulk/marketing emails — called from scheduler and event dispatcher
export async function enqueueBulkEmail(
  data: BulkEmailJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> {
  const queue = getEmailBulkQueue();
  const job = await queue.add(`email:${data.type}`, data, {
    priority: options?.priority ?? 5,
    delay: options?.delay,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
  });
  return job.id!;
}

// Notifications — called from event dispatcher
export async function enqueueNotification(
  data: NotificationJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> {
  const queue = getNotificationsQueue();
  const job = await queue.add(`notif:${data.type}`, data, {
    priority: options?.priority ?? 3,
    delay: options?.delay,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  });
  return job.id!;
}
```

### 5.4 Redis Keys for Shared State

```
# Alert batching (email — 30 min window)
email:batch:{userId}:{emailType}     → Redis sorted set (score=timestamp, value=eventJSON)
                                       TTL: 60 minutes

# Alert batching (notification — 5 min window)
notif:batch:{userId}:{notifCategory} → Redis sorted set (score=timestamp, value=eventJSON)
                                       TTL: 30 minutes

# Quiet hours buffer
email:quiet:{userId}                 → Redis list of queued email jobs
                                       TTL: 12 hours

# Frequency cap counters
email:freq:{userId}:daily            → Redis counter, TTL: 24h (max 10/day)
email:freq:{userId}:{emailType}      → Redis counter, TTL varies by type
notif:rate:{userId}:hourly           → Redis counter, TTL: 1h (max 10 push/hour)
notif:rate:{userId}:daily            → Redis counter, TTL: 24h (max 50 push/day)

# Deduplication
email:dedup:{emailType}:{userId}:{entityId}  → Redis key with TTL = cooldown
notif:dedup:{notifType}:{userId}:{entityId}  → Redis key with TTL = 5 min

# Cold email daily counter
email:cold:daily:{YYYY-MM-DD}        → Redis counter, TTL: 48h (max 50/day)
```

---

## 6. Database Schema

### 6.1 Email System Tables (7 tables)

```sql
-- 1. Global email type configuration (admin-managed)
CREATE TABLE IF NOT EXISTS email_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL UNIQUE,     -- EmailType enum value
  enabled BOOLEAN NOT NULL DEFAULT false,     -- Global on/off toggle
  config JSONB NOT NULL DEFAULT '{}',         -- Type-specific config (thresholds, limits)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with all 20 email types (disabled by default except daily digest + welcome)

-- 2. Per-account email type overrides
CREATE TABLE IF NOT EXISTS email_type_account_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_type, account_id)
);

-- 3. Email send log (EVERY email ever sent/attempted/skipped)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  html_body TEXT,                              -- Full rendered HTML (for admin preview)
  data_snapshot JSONB,                         -- Builder data at send-time
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/sent/failed/skipped/bounced
  error_message TEXT,
  skip_reason VARCHAR(50),                    -- type_disabled/account_override/user_opted_out/freq_cap/dedup/quiet_hours
  is_transactional BOOLEAN NOT NULL DEFAULT false,
  is_dry_run BOOLEAN NOT NULL DEFAULT false,
  message_id VARCHAR(255),                    -- SMTP message ID
  dedup_key VARCHAR(255),
  -- Tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  tracking_pixel_url TEXT,
  tracking_links JSONB,                       -- Map of link index → original URL
  -- Unsubscribe
  unsubscribe_token_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Cold email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft/active/paused/completed
  platform VARCHAR(50),                         -- Target platform (optional)
  total_prospects INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_converted INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',           -- Campaign-specific settings
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Cold email prospects (non-user contacts)
CREATE TABLE IF NOT EXISTS email_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company_name VARCHAR(255),
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  platform VARCHAR(50),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',   -- new/contacted/responded/converted/unsubscribed
  contact_count INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, campaign_id)
);

-- 6. Per-user email preferences
CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_type)
);

-- 7. One-click unsubscribe tokens
CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES email_prospects(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.2 Notification System Tables (4 tables)

```sql
-- 8. Push notification subscriptions (one per browser/device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,              -- Push service URL from browser
  p256dh VARCHAR(255) NOT NULL,              -- Public key for encryption
  auth VARCHAR(255) NOT NULL,                -- Auth secret for encryption
  user_agent TEXT,                           -- Browser/device info for admin display
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_push_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. All notifications (in-app + push source of truth)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,                 -- NotificationType enum value
  category VARCHAR(20) NOT NULL,             -- ranking/competitor/review/milestone/featured/system
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  url VARCHAR(500),                          -- Deep link for click navigation
  icon VARCHAR(500),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium', -- high/medium/low
  event_data JSONB NOT NULL DEFAULT '{}',

  -- In-app status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,

  -- Push delivery
  push_sent BOOLEAN NOT NULL DEFAULT false,
  push_sent_at TIMESTAMPTZ,
  push_clicked BOOLEAN NOT NULL DEFAULT false,
  push_clicked_at TIMESTAMPTZ,
  push_dismissed BOOLEAN NOT NULL DEFAULT false,
  push_error TEXT,

  -- Metadata
  trigger_job_id VARCHAR(255),
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Notification type configuration (admin-managed defaults)
CREATE TABLE IF NOT EXISTS notification_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL UNIQUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_default_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',        -- Thresholds, rate limits
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Per-user notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);
```

### 6.3 Notification Delivery Log (Optional — for detailed push tracking)

```sql
-- 12. Notification delivery log (tracks every push send attempt)
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL,              -- 'push' | 'in_app'
  push_subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL,               -- sent/delivered/clicked/dismissed/failed/expired/skipped
  status_code INTEGER,                       -- HTTP status from push service
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interacted_at TIMESTAMPTZ
);
```

### 6.4 User Table Changes

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_frequency VARCHAR(20) NOT NULL DEFAULT 'daily';
  -- 'realtime' | 'daily' | 'weekly' | 'none'

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
  -- Set to true when user grants browser permission and subscribes
```

### 6.5 Indexes

```sql
-- Email logs (high-traffic, needs fast queries)
CREATE INDEX CONCURRENTLY idx_email_logs_type ON email_logs(email_type);
CREATE INDEX CONCURRENTLY idx_email_logs_status ON email_logs(status);
CREATE INDEX CONCURRENTLY idx_email_logs_user ON email_logs(user_id);
CREATE INDEX CONCURRENTLY idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX CONCURRENTLY idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX CONCURRENTLY idx_email_logs_campaign ON email_logs(campaign_id) WHERE campaign_id IS NOT NULL;

-- Push subscriptions
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subs_active ON push_subscriptions(user_id) WHERE is_active = true;

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = false AND is_archived = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_account ON notifications(account_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Notification delivery log
CREATE INDEX idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX idx_delivery_log_sent ON notification_delivery_log(sent_at DESC);

-- User preferences
CREATE INDEX idx_email_prefs_user ON user_email_preferences(user_id);
CREATE INDEX idx_notif_prefs_user ON user_notification_preferences(user_id);

-- Prospects
CREATE INDEX idx_prospects_campaign ON email_prospects(campaign_id);
CREATE INDEX idx_prospects_email ON email_prospects(email);
CREATE INDEX idx_prospects_status ON email_prospects(status);
```

---

## 7. Shared Infrastructure

### 7.1 Event Detector

**File:** `apps/scraper/src/events/event-detector.ts`

Called inline after scraper processing completes. Compares current vs previous data to detect significant events.

```typescript
interface DetectedEvent {
  type: string;                     // NotificationType or email trigger type
  appId: string;
  keywordId?: string;
  platform: string;
  data: Record<string, any>;        // Event-specific payload
  severity: 'high' | 'medium' | 'low';
}

// Integration points in existing scrapers:
// KeywordScraper.processResults() → checkRankingAlerts()
//   → ranking_top3_entry, ranking_top3_exit, ranking_significant_change,
//     ranking_new_entry, ranking_dropped_out, milestone_rank_first
//
// AppDetailsScraper.processResults() → checkCompetitorMoves()
//   → competitor_overtook, competitor_featured, competitor_pricing_change
//
// ReviewScraper.processResults() → checkNewReviews()
//   → review_new_positive, review_new_negative, review_milestone
//
// CategoryScraper.processResults() → checkCategoryAlerts()
//   → category_rank_change
//
// Post-processing (any) → detectMilestones()
//   → milestone_rating_threshold, milestone_best_week
```

### 7.2 Event Dispatcher

**File:** `apps/scraper/src/events/event-dispatcher.ts`

Takes a detected event and fans it out to the correct queues for all affected users.

```typescript
class EventDispatcher {
  async dispatch(event: DetectedEvent): Promise<void> {
    // 1. Find affected users
    const users = await this.findAffectedUsers(event);

    for (const user of users) {
      // 2. Enqueue email (if applicable for this event type)
      if (this.shouldSendEmail(event.type)) {
        await enqueueBulkEmail({
          type: this.getEmailJobType(event.type),
          userId: user.id,
          accountId: user.accountId,
          appId: event.appId,
          eventData: event.data,
        });
      }

      // 3. Enqueue notification (always for tracked events)
      await enqueueNotification({
        type: 'notification_single',
        userId: user.id,
        accountId: user.accountId,
        notificationType: event.type as NotificationType,
        eventData: event.data,
      });
    }
  }

  private async findAffectedUsers(event: DetectedEvent): Promise<User[]> {
    // For app events: users in accounts that track this app
    // For keyword events: users in accounts that track this keyword on this app
    // For competitor events: users whose accountCompetitorApps includes this app
    // For system events: specific user or all users in account
  }
}
```

### 7.3 Notification Content Builder

**File:** `apps/scraper/src/notifications/content-builder.ts`

Maps notification type + event data → human-readable title/body/url.

```typescript
function buildNotificationContent(type: NotificationType, data: Record<string, any>): NotificationContent {
  switch (type) {
    case 'ranking_top3_entry':
      return {
        title: `${data.appName} entered top 3!`,
        body: `Now ranked #${data.newPosition} for "${data.keyword}" on ${data.platform} (was #${data.oldPosition})`,
        url: `/keywords/${data.keywordSlug}`,
        icon: `/platforms/${data.platform}.svg`,
        tag: `ranking:${data.keywordId}`,
        priority: 'high',
      };
    case 'competitor_overtook':
      return {
        title: `${data.competitorName} overtook you`,
        body: `Now #${data.compPosition} vs your #${data.yourPosition} for "${data.keyword}"`,
        url: `/competitors`,
        icon: `/platforms/${data.platform}.svg`,
        tag: `competitor:${data.competitorId}:${data.keywordId}`,
        priority: 'high',
      };
    case 'review_new_negative':
      return {
        title: `New ${data.rating}-star review`,
        body: `"${data.reviewSnippet}..."`,
        url: `/apps/${data.appSlug}/reviews`,
        priority: 'high',
      };
    // ... all 23 notification types
  }
}
```

### 7.4 Web Push Infrastructure

**VAPID key generation (one-time setup):**
```typescript
import webPush from 'web-push';
const vapidKeys = webPush.generateVAPIDKeys();
// Store as env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
```

**Service Worker:** `apps/dashboard/public/sw.js`
- Handles `push` event → shows browser notification
- Handles `notificationclick` → opens deep link URL in dashboard
- Handles `notificationclose` → reports dismiss to API
- Reports click/dismiss to `/api/notifications/:id/clicked` and `/api/notifications/:id/dismissed`

**Frontend push subscription:** `apps/dashboard/src/lib/push-notifications.ts`
- `registerServiceWorker()` → registers `sw.js`
- `subscribeToPush(registration)` → requests permission, gets subscription, sends to API
- `unsubscribeFromPush()` → unsubscribes and removes from API
- `getPushPermissionStatus()` → returns current browser permission state

### 7.5 Alert Batching

**Email batching (30-minute window):**
```
Alert triggered → Add to Redis sorted set (key: email:batch:{userId}:{type})
                  Score = timestamp, value = alert data JSON
                      ↓
BullMQ delayed job fires after 30 minutes
                      ↓
Read all accumulated alerts from Redis
                      ↓
If 1 alert → send as individual alert email
If 2+ alerts → send as batched alert email (combined template)
                      ↓
Clear Redis key
```

**Notification batching (5-minute window):**
```
Same pattern, shorter window.
If 1-3 events → send individual notifications
If 4+ events → batch into summary notification:
  Title: "5 ranking changes detected"
  Body: "Acme CRM: 3 improved, 2 dropped across Shopify keywords"
  URL: /keywords (overview page)
```

### 7.6 Quiet Hours

```
Alert triggered → Is it quiet hours for this user? (22:00-07:00 local)
  YES → Add email to Redis list (email:quiet:{userId})
        In-app notification still created (visible when user opens app)
        Push notification queued (not sent)
  NO  → Normal batching flow

Cron every 15 min → For each user exiting quiet hours (local 07:00):
  Flush quiet queue → batch into single morning summary email
  Send queued push notifications
```

---

## 8. Implementation Steps

### Phase 0: Foundation — Queue & Schema Infrastructure

---

#### Step 0.1: Add 3 New BullMQ Queues

**Priority:** Urgent | **Depends on:** Nothing

**Problem:** Currently only 2 queues exist (`scraper-jobs-background`, `scraper-jobs-interactive`). All email sending happens inline in the scraper worker. We need 3 new isolated queues.

**What to do:**
1. In `apps/scraper/src/queue.ts`:
   - Add constants: `EMAIL_INSTANT_QUEUE_NAME`, `EMAIL_BULK_QUEUE_NAME`, `NOTIFICATIONS_QUEUE_NAME`
   - Add lazy-initialized Queue instances (same pattern as existing `getBackgroundQueue()`)
   - Add `enqueueInstantEmail()`, `enqueueBulkEmail()`, `enqueueNotification()` functions
   - Each queue uses the same Redis connection (`getRedisConnection()`)
   - Each queue has different default job options (retry, backoff, TTL — see Section 5.2)
2. In `packages/shared/src/types/`:
   - Create `email-types.ts` — `EmailType` enum (20 types), `InstantEmailJobData`, `BulkEmailJobData` interfaces
   - Create `notification-types.ts` — `NotificationType` enum (23 types), `NotificationJobData`, `NotificationContent` interfaces
   - Export from `packages/shared/src/index.ts`

**Files to create/modify:**
- `apps/scraper/src/queue.ts` (modify — add 3 queues + enqueue functions)
- `packages/shared/src/types/email-types.ts` (create)
- `packages/shared/src/types/notification-types.ts` (create)
- `packages/shared/src/index.ts` (modify — add exports)

**Tests:**
- Unit test: `enqueueInstantEmail()` adds job to correct queue
- Unit test: `enqueueBulkEmail()` respects priority and delay options
- Unit test: `enqueueNotification()` adds job to notifications queue
- Unit test: Each queue uses correct default job options (retry, backoff)

**Acceptance criteria:**
- 3 new queues are initialized lazily on first use
- Each queue has distinct retry/backoff configuration
- TypeScript types compile and are importable from `@repo/shared`

---

#### Step 0.2: Create Database Schema — Email Tables

**Priority:** Urgent | **Depends on:** Nothing

**Problem:** No email logging, no email type configs, no unsubscribe tokens, no prospect/campaign tables exist.

**What to do:**
1. Create migration file in `packages/db/src/migrations/` — all 7 email tables (see Section 6.1):
   - `email_type_configs`
   - `email_type_account_overrides`
   - `email_logs`
   - `email_campaigns`
   - `email_prospects`
   - `user_email_preferences`
   - `email_unsubscribe_tokens`
2. All `CREATE TABLE` with `IF NOT EXISTS`
3. All indexes with `CREATE INDEX CONCURRENTLY` for `email_logs` (add `-- breakpoint` before each)
4. Seed `email_type_configs` with all 20 email types (only `email_daily_digest` and `email_welcome` enabled by default)
5. Add `email_frequency` column to `users` table
6. Update `packages/db/src/migrations/meta/_journal.json`
7. Add Drizzle schema definition in `packages/db/src/schema/email.ts`

**Files to create/modify:**
- `packages/db/src/migrations/XXXX_email_system_tables.sql` (create)
- `packages/db/src/migrations/meta/_journal.json` (modify — add entry)
- `packages/db/src/schema/email.ts` (create — Drizzle schema)
- `packages/db/src/schema/auth.ts` (modify — add email_frequency to users)
- `packages/db/src/schema/index.ts` (modify — export email schema)

**Tests:**
- Migration applies cleanly to local DB (`npm run db:migrate`)
- Migration is idempotent (running twice doesn't error)
- All 20 email types seeded in `email_type_configs`
- Indexes created correctly

**Acceptance criteria:**
- 7 new tables created with correct columns, types, and constraints
- `users` table has `email_frequency` column with default `'daily'`
- Journal entry added with correct sequential `idx`

---

#### Step 0.3: Create Database Schema — Notification Tables

**Priority:** Urgent | **Depends on:** Nothing

**Problem:** No notification infrastructure exists in the database.

**What to do:**
1. Create migration file — 4 notification tables + 1 delivery log table (see Section 6.2-6.3):
   - `push_subscriptions`
   - `notifications`
   - `notification_type_configs`
   - `user_notification_preferences`
   - `notification_delivery_log`
2. All `CREATE TABLE` with `IF NOT EXISTS`
3. Indexes with `CONCURRENTLY` for high-traffic tables (`notifications`)
4. Seed `notification_type_configs` with all 23 types (with correct default push ON/OFF per type — see Section 1 inventory)
5. Add `push_notifications_enabled` column to `users` table
6. Update journal
7. Add Drizzle schema in `packages/db/src/schema/notification.ts`

**Files to create/modify:**
- `packages/db/src/migrations/XXXX_notification_system_tables.sql` (create)
- `packages/db/src/migrations/meta/_journal.json` (modify)
- `packages/db/src/schema/notification.ts` (create)
- `packages/db/src/schema/auth.ts` (modify — add push_notifications_enabled)
- `packages/db/src/schema/index.ts` (modify — export)

**Tests:**
- Migration applies cleanly
- All 23 notification types seeded
- Indexes created correctly

**Acceptance criteria:**
- 5 new tables created
- `users` table has `push_notifications_enabled` column
- Default push settings match the inventory matrix

---

#### Step 0.4: Event Detector Module

**Priority:** High | **Depends on:** Step 0.1 (types)

**Problem:** Scrapers don't detect significant events. They write data to DB and move on.

**What to do:**
1. Create `apps/scraper/src/events/event-detector.ts`:
   - `checkRankingAlerts(appId, newRankings, previousRankings)` → DetectedEvent[]
     - Top 3 entry/exit
     - Significant change (5+ positions)
     - New keyword entry / dropped out
     - Category rank change (3+ positions)
   - `checkCompetitorMoves(appId, currentSnapshot, previousSnapshot)` → DetectedEvent[]
     - Overtake detection (comparing shared keywords)
     - Featured placement
     - Review surge (10+ in 24h)
     - Pricing change
   - `checkNewReviews(appId, currentReviews, previousReviewIds)` → DetectedEvent[]
     - New positive/negative review
     - Review milestone (100, 250, 500, 1000)
   - `detectMilestones(appId, currentRankings, currentMetrics)` → DetectedEvent[]
     - Rank #1 (first time or reclaim)
     - Rating threshold (4.0, 4.5, 4.8)
     - Best ranking week ever
2. Each function compares current vs previous state and returns an array of `DetectedEvent` objects
3. Thresholds are configurable via `email_type_configs.config` JSONB field

**Files to create:**
- `apps/scraper/src/events/event-detector.ts`
- `apps/scraper/src/events/index.ts`

**Tests:**
- Unit test: Ranking enters top 3 → `ranking_top3_entry` event emitted
- Unit test: Ranking exits top 3 → `ranking_top3_exit` event emitted
- Unit test: Position changes by 5+ → `ranking_significant_change` event
- Unit test: Position changes by 3 → no event (below threshold)
- Unit test: New negative review → `review_new_negative` event
- Unit test: Review count hits 500 → `review_milestone` event
- Unit test: Competitor passes user on keyword → `competitor_overtook` event
- Unit test: No significant changes → empty array returned

**Acceptance criteria:**
- All ranking, competitor, review, and milestone events detected correctly
- Thresholds are configurable, not hardcoded
- Returns empty array when nothing significant happened

---

#### Step 0.5: Event Dispatcher Module

**Priority:** High | **Depends on:** Step 0.1, Step 0.4

**Problem:** No mechanism to fan out detected events to email + notification queues for affected users.

**What to do:**
1. Create `apps/scraper/src/events/event-dispatcher.ts`:
   - `dispatch(event: DetectedEvent)` — main entry point
   - `findAffectedUsers(event)` — queries DB to find users who track the affected app/keyword/competitor
     - For app events: `accountTrackedApps` → `users` in those accounts
     - For keyword events: `accountTrackedKeywords` matching keyword_id + account → users
     - For competitor events: `accountCompetitorApps` → users
   - For each user:
     - Check if event type maps to an email → `enqueueBulkEmail()` to `email-bulk` queue
     - Always → `enqueueNotification()` to `notifications` queue
   - Mapping table: which event types produce emails vs. only notifications
     - All ranking/competitor/review/milestone events → both email AND notification
     - System events (scrape_complete, app_added) → notification only
2. Integrate into existing scraper processing:
   - In `apps/scraper/src/process-job.ts`, after each scraper type's results are written to DB, call the event detector + dispatcher

**Files to create/modify:**
- `apps/scraper/src/events/event-dispatcher.ts` (create)
- `apps/scraper/src/events/index.ts` (modify — add export)
- `apps/scraper/src/process-job.ts` (modify — add event detection/dispatch calls after scraper processing)

**Tests:**
- Unit test: Event for app tracked by 3 users → 3 email jobs + 3 notification jobs enqueued
- Unit test: Event for app tracked by nobody → nothing enqueued
- Unit test: System event → only notification jobs, no email jobs
- Unit test: findAffectedUsers returns correct users based on tracked apps/keywords

**Acceptance criteria:**
- Every significant scraper event is detected and dispatched
- Affected users correctly identified through tracked apps/keywords/competitors
- Both email-bulk and notifications queues receive jobs
- No duplicate dispatches for the same event+user

---

### Phase 1: Transactional Email Worker

---

#### Step 1.1: Transactional Email Templates

**Priority:** High | **Depends on:** Step 0.1 (types)

**Problem:** No templates exist for password reset, email verification, invitation, login alert, 2FA.

**What to do:**
1. Create `apps/scraper/src/email/templates/transactional/`:
   - `password-reset.ts` — Token link, 1-hour expiry note, "If you didn't request this" disclaimer
   - `email-verification.ts` — Verification link, welcome note
   - `welcome.ts` — (Already exists as `welcome-template.ts` — move/refactor to use shared components)
   - `invitation.ts` — Team invitation with inviter name, account name, accept link
   - `login-alert.ts` — New device/location, "If this wasn't you" action
   - `2fa-code.ts` — 6-digit code display, expiry note
2. Each template is a pure function: `(data: SpecificData) => { subject: string, html: string }`
3. Use design tokens from `design-tokens.ts` (colors, fonts, max-width)
4. Simple layout: header (logo), content, footer (AppRanks.io, no unsubscribe for transactional)
5. All inline CSS, table-based layout

**Files to create:**
- `apps/scraper/src/email/templates/transactional/password-reset.ts`
- `apps/scraper/src/email/templates/transactional/email-verification.ts`
- `apps/scraper/src/email/templates/transactional/invitation.ts`
- `apps/scraper/src/email/templates/transactional/login-alert.ts`
- `apps/scraper/src/email/templates/transactional/2fa-code.ts`
- `apps/scraper/src/email/templates/transactional/index.ts`

**Tests:**
- Unit test: Each template renders valid HTML with correct data interpolation
- Unit test: Password reset includes the token link
- Unit test: 2FA code displays the code prominently
- Unit test: No tracking pixel in transactional emails
- Unit test: No unsubscribe link in transactional emails (except "manage preferences")

**Acceptance criteria:**
- 5 new transactional templates (welcome already exists)
- All templates render without error with sample data
- HTML is valid and renders correctly in preview

---

#### Step 1.2: Email Instant Worker Entry Point

**Priority:** High | **Depends on:** Step 0.1, Step 0.2, Step 1.1

**Problem:** No worker process exists for instant/transactional emails.

**What to do:**
1. Create `apps/scraper/src/email-instant-worker.ts`:
   - Initialize BullMQ Worker listening to `email-instant` queue
   - Concurrency: 3
   - Process function routes to template + send:
     ```
     1. Resolve template by job type
     2. Render HTML
     3. Log to email_logs (status: pending, isTransactional: true)
     4. Send via SMTP (same mailer.ts transporter)
     5. Update email_logs (status: sent/failed)
     ```
   - NO eligibility checks (transactional = always send)
   - NO tracking pixel injection
   - NO batching or quiet hours
   - Error → throw (BullMQ retries 3x with 5s exponential backoff)
   - After final failure → log to `dead_letter_jobs` table
2. Create `Dockerfile.worker-email-instant`:
   - Same base as `Dockerfile.worker`
   - CMD: `node apps/scraper/dist/email-instant-worker.js`
   - No scheduler, no stale job cleanup
3. Handle graceful shutdown (SIGTERM): let in-flight emails complete

**Files to create:**
- `apps/scraper/src/email-instant-worker.ts` (create)
- `Dockerfile.worker-email-instant` (create)

**Tests:**
- Unit test: Worker processes password reset job → renders template → sends email → logs to DB
- Unit test: SMTP failure → job retries 3x → logged to dead_letter_jobs
- Unit test: Concurrent jobs (3) processed in parallel
- Integration test: Enqueue instant email → worker picks up → email_logs entry created

**Acceptance criteria:**
- Worker starts, connects to Redis, listens to `email-instant` queue
- Processes transactional email jobs end-to-end
- Emails sent via SMTP, logged to `email_logs`
- Failed jobs retry 3x and land in dead letter queue

---

#### Step 1.3: API Integration — Enqueue Transactional Emails

**Priority:** High | **Depends on:** Step 0.1, Step 1.2

**Problem:** Auth routes (password reset, registration) currently don't send emails or send them synchronously.

**What to do:**
1. Create `apps/api/src/lib/email-enqueue.ts`:
   - Helper functions: `sendPasswordResetEmail(email, token, name)`, `sendVerificationEmail(email, token, name)`, `sendWelcomeEmail(email, name)`, `sendInvitationEmail(email, inviterName, accountName, token)`, `sendLoginAlertEmail(email, name, device, location)`, `send2FAEmail(email, code)`
   - Each function calls `enqueueInstantEmail()` (from scraper/queue.ts — need to make it importable or duplicate the enqueue logic using BullMQ Queue directly in the API)
   - Since API and scraper are separate packages, the API needs its own BullMQ Queue instance pointing to `email-instant`
2. Integrate into existing auth routes:
   - `POST /api/auth/forgot-password` → `sendPasswordResetEmail()`
   - `POST /api/auth/register` → `sendWelcomeEmail()` + schedule onboarding series (delayed jobs on `email-bulk`)
   - Team invitation flow → `sendInvitationEmail()`
3. The API only enqueues — the instant worker does the actual sending

**Files to create/modify:**
- `apps/api/src/lib/email-enqueue.ts` (create)
- `apps/api/src/routes/auth.ts` (modify — add email enqueue calls)
- `apps/api/src/routes/account-management.ts` (modify — invitation email)

**Tests:**
- Unit test: `sendPasswordResetEmail()` enqueues correct job data
- Unit test: Registration triggers welcome email + 3 delayed onboarding jobs
- Integration test: Forgot password API → email_instant queue has job → worker sends email

**Acceptance criteria:**
- Auth flows enqueue transactional emails to `email-instant` queue
- Registration triggers welcome + onboarding series (delayed 24h/72h/168h)
- API response times not affected (enqueue is async, returns immediately)

---

#### Step 1.4: Docker & Deployment — Instant Worker

**Priority:** High | **Depends on:** Step 1.2

**Problem:** Need to deploy the instant worker container in production.

**What to do:**
1. Add `worker-email-instant` service to `docker-compose.prod.yml`:
   - Image: same build as other workers (monorepo, different CMD)
   - Memory limit: 512MB
   - Environment: same as worker (REDIS_URL, DATABASE_URL, SMTP_*)
   - Restart: always
   - Grace period: 30s
   - Health check: BullMQ worker isRunning()
2. Update Coolify deployment config if needed
3. Ensure SMTP env vars are available to the new container

**Files to modify:**
- `docker-compose.prod.yml` (add worker-email-instant service)
- `Dockerfile.worker-email-instant` (already created in Step 1.2)

**Acceptance criteria:**
- Container starts and connects to Redis
- Shows in `docker ps` alongside other containers
- Memory stays under 512MB
- Processes test email job successfully in production

---

### Phase 2: Bulk Email Worker + Enhanced Emails

---

#### Step 2.1: Email Bulk Worker Entry Point

**Priority:** High | **Depends on:** Step 0.1, Step 0.2

**Problem:** Bulk/marketing emails currently process inline in the scraper worker. Need dedicated worker.

**What to do:**
1. Create `apps/scraper/src/email-bulk-worker.ts`:
   - Initialize BullMQ Worker listening to `email-bulk` queue
   - Concurrency: 5
   - Rate limiter: max 50 jobs per minute (BullMQ limiter)
   - Process function routes by job type to existing builders/templates
   - Uses the full 6-step email pipeline: Build Data → Check Eligibility → Render Template → Log to DB → Inject Tracking → Send SMTP
   - Job types include: digest, weekly, ranking alert, competitor alert, review alert, win celebration, opportunity, onboarding, re-engagement, cold emails
   - Error handling: log to dead_letter_jobs after final retry
   - Graceful shutdown: let in-flight emails complete (120s grace)
2. Create `Dockerfile.worker-email-bulk`:
   - CMD: `node apps/scraper/dist/email-bulk-worker.js`
   - Also runs the email-related cron scheduler (digest, weekly, opportunity, re-engagement, cold auto-followup)
3. **Migrate existing email processing from scraper worker:**
   - Remove `daily_digest` and `weekly_summary` handling from `apps/scraper/src/process-job.ts`
   - Scheduler cron entries for `daily_digest` and `weekly_summary` should now enqueue to `email-bulk` queue instead of `scraper-jobs-background`

**Files to create/modify:**
- `apps/scraper/src/email-bulk-worker.ts` (create)
- `Dockerfile.worker-email-bulk` (create)
- `apps/scraper/src/process-job.ts` (modify — remove email job handling)
- `packages/shared/src/constants/scraper-schedules.ts` (modify — redirect email crons to email-bulk queue)

**Tests:**
- Unit test: Worker processes daily digest job → runs full pipeline → emails sent
- Unit test: Rate limiter kicks in at 50 jobs/minute
- Unit test: Failed job retries 2x with 30s exponential backoff
- Integration test: Enqueue bulk email → worker picks up → pipeline executes → email_logs entry

**Acceptance criteria:**
- Worker starts, connects to Redis, listens to `email-bulk` queue
- Existing daily digest and weekly summary work identically through new worker
- Scraper worker no longer handles email jobs
- Rate limiting prevents SMTP overload

---

#### Step 2.2: Component-Based Email Template Engine

**Priority:** High | **Depends on:** Nothing

**Problem:** Existing templates are monolithic. Need reusable components for 20 email types.

**What to do:**
1. Create `apps/scraper/src/email/components/`:
   - `layout.ts` — Base HTML wrapper (DOCTYPE, head with inline styles, body, max-width 640px table)
   - `header.ts` — Logo + email type label + date
   - `hero-stat.ts` — Big number display (`#3 → #1`) with color coding
   - `data-table.ts` — Ranking/comparison table with column headers
   - `insight-block.ts` — AI-generated insight with lightbulb icon
   - `competitor-card.ts` — Competitor summary (name, rating, reviews, keyword comparison)
   - `cta-button.ts` — Primary/secondary CTA button (44x44px min touch target)
   - `footer.ts` — Unsubscribe + preferences links + AppRanks.io copyright
   - `summary-badge.ts` — Colored strip showing "5 up, 2 down, 8 steady"
   - `review-card.ts` — Review quote with star rating
   - `milestone-card.ts` — Celebration display with trophy icon
   - `sparkline-chart.ts` — CSS-based trend line (for weekly)
   - `index.ts` — Re-export all components
2. Create `apps/scraper/src/email/design-tokens.ts`:
   - Colors: brand (#6366f1), up (#16a34a), down (#dc2626), new (#2563eb), warning (#f59e0b), win (#8b5cf6)
   - Typography: system font stack, mono for numbers
   - Spacing, max-width, button styles
3. Each component is a pure function: `(props: ComponentProps) => string` (HTML string)
4. Composition pattern: `emailLayout([header(), heroStat(), dataTable(), cta(), footer()])`

**Files to create:**
- `apps/scraper/src/email/design-tokens.ts`
- `apps/scraper/src/email/components/layout.ts`
- `apps/scraper/src/email/components/header.ts`
- `apps/scraper/src/email/components/hero-stat.ts`
- `apps/scraper/src/email/components/data-table.ts`
- `apps/scraper/src/email/components/insight-block.ts`
- `apps/scraper/src/email/components/competitor-card.ts`
- `apps/scraper/src/email/components/cta-button.ts`
- `apps/scraper/src/email/components/footer.ts`
- `apps/scraper/src/email/components/summary-badge.ts`
- `apps/scraper/src/email/components/review-card.ts`
- `apps/scraper/src/email/components/milestone-card.ts`
- `apps/scraper/src/email/components/sparkline-chart.ts`
- `apps/scraper/src/email/components/index.ts`

**Tests:**
- Unit test: Each component renders valid HTML with sample props
- Unit test: `emailLayout` wraps children correctly
- Unit test: `heroStat` shows green for positive change, red for negative
- Unit test: `footer` includes unsubscribe link when provided
- Unit test: Full composition produces valid complete email HTML
- Visual test: Rendered HTML looks correct in browser preview

**Acceptance criteria:**
- 12 reusable components + design tokens file
- Components compose into full emails via `emailLayout()`
- Inline CSS only (no `<style>` blocks)
- Table-based layout for email client compatibility

---

#### Step 2.3: Enhanced Daily Digest

**Priority:** High | **Depends on:** Step 2.1, Step 2.2

**Problem:** Current digest is basic. Need 5-section enhanced digest with dynamic subjects for all 11 platforms.

**What to do:**
1. Refactor `apps/scraper/src/email/digest-builder.ts`:
   - Add "Today's Highlight" section (most impactful single event)
   - Add category rankings section
   - Add "Insight of the Day" section (rule-based, see rules in implementation guide)
   - Add deep links to every section (links to relevant dashboard pages)
   - Build data for all 11 platforms (currently Shopify only)
2. Refactor `apps/scraper/src/email/digest-template.ts`:
   - Rewrite using new components: `header()`, `heroStat()`, `summaryBadge()`, `dataTable()`, `competitorCard()`, `insightBlock()`, `ctaButton()`, `footer()`
3. Dynamic subject line generation:
   - Win day: `"Great day! {app} hit #1 for '{keyword}'"`
   - Alert day: `"Heads up: {app} dropped for '{keyword}'"`
   - Mixed: `"{app}: 3 up, 2 down — '{keyword}' hits #1"`
   - Quiet: `"Daily snapshot — {app} across 15 keywords"`
4. Insight of the Day rules:
   - Competitor gained 3x+ reviews in 7 days → review velocity insight
   - Keyword declining 3+ consecutive days → trend warning
   - #2 on keyword where #1 has lower rating → opportunity hint
   - Rating improved but rankings didn't → patience/lagging indicator

**Files to modify:**
- `apps/scraper/src/email/digest-builder.ts` (major refactor)
- `apps/scraper/src/email/digest-template.ts` (rewrite with components)

**Tests:**
- Unit test: Dynamic subject line matches content sentiment
- Unit test: Highlight picks the most impactful event
- Unit test: Insight rules fire correctly (competitor review surge, declining keyword, etc.)
- Unit test: All 11 platforms produce valid digest data
- Unit test: Empty day (no changes) produces "holding steady" subject

**Acceptance criteria:**
- Enhanced digest has 5 sections: Highlight, Keywords, Categories, Competitors, Insight
- Dynamic subject lines based on content
- Works for all 11 platforms
- Backward compatible: output looks at least as good as before

---

#### Step 2.4: Timezone-Aware Scheduling

**Priority:** High | **Depends on:** Step 2.1

**Problem:** Digest runs at 5 AM UTC for everyone. Should deliver at 8 AM user's local time.

**What to do:**
1. The cron job runs every 15 minutes and checks which users should receive their digest NOW:
   ```
   For each user with emailDigestEnabled = true:
     Convert current UTC to user's timezone
     If local hour = 8 AND local minute < 15:
       If lastDigestSentAt is NOT today (user's local date):
         Build and send digest
         Update lastDigestSentAt
   ```
2. Handle edge cases:
   - DST transitions: prefer skip over double-send
   - No timezone set: default `Europe/Istanbul`
   - UTC+13/UTC+14 timezones
3. Update scheduler to use `*/15 * * * *` cron for digest (already partially exists)
4. Weekly summary: same pattern but checks for Monday 8 AM local time

**Files to modify:**
- `apps/scraper/src/email/digest-builder.ts` (modify — timezone logic)
- `packages/shared/src/constants/scraper-schedules.ts` (modify — update cron patterns)

**Tests:**
- Unit test: User in UTC+3, current time UTC 05:00 → local 08:00 → should send
- Unit test: User in UTC-5, current time UTC 05:00 → local 00:00 → should NOT send
- Unit test: DST transition: user doesn't get double digest
- Unit test: No timezone → defaults to Europe/Istanbul
- Unit test: Already sent today → skip

**Acceptance criteria:**
- Users receive digest at 8 AM their local time
- No double-sends during DST transitions
- Weekly summary delivers Monday 8 AM local time

---

#### Step 2.5: Alert Batching & Quiet Hours System

**Priority:** High | **Depends on:** Step 0.1

**Problem:** Multiple events from one scrape cycle could spam a user with 5+ emails/notifications simultaneously.

**What to do:**
1. Create `apps/scraper/src/email/alert-batcher.ts`:
   - `addToEmailBatch(userId, emailType, eventData)` — adds to Redis sorted set
   - `scheduleFlush(userId, emailType)` — creates a BullMQ delayed job (30 min)
   - `flushEmailBatch(userId, emailType)` — reads all from Redis, sends single or combined email
   - If 1 event → individual email
   - If 2+ events → batched email with combined template
2. Create `apps/scraper/src/email/quiet-hours.ts`:
   - `isQuietHours(user)` — checks if 22:00-07:00 in user's timezone
   - `queueForMorning(userId, emailJobData)` — adds to Redis list `email:quiet:{userId}`
   - Cron every 15 min checks for users exiting quiet hours (local 07:00) → flushes queue
3. Create `apps/scraper/src/notifications/notification-batcher.ts`:
   - Same pattern, 5-minute window
   - If 4+ events of same category → batch into summary notification
4. Integrate batching into event dispatcher:
   - Instead of directly enqueuing, event dispatcher calls batcher
   - Batcher decides: batch or send immediately based on current accumulation

**Files to create:**
- `apps/scraper/src/email/alert-batcher.ts`
- `apps/scraper/src/email/quiet-hours.ts`
- `apps/scraper/src/notifications/notification-batcher.ts`

**Tests:**
- Unit test: 3 ranking alerts within 10 min → single batched email after 30 min
- Unit test: 1 ranking alert, no more within 30 min → individual email
- Unit test: Alert at 2 AM (user timezone) → queued, not sent
- Unit test: Quiet hours flush at 7 AM → morning summary email sent
- Unit test: 5 ranking notifications within 3 min → batched into summary notification
- Unit test: Non-quiet hours → normal flow (no queuing)

**Acceptance criteria:**
- Email alerts batch within 30-minute windows
- Notification events batch within 5-minute windows
- Quiet hours (22:00-07:00 local) queue emails for morning delivery
- In-app notifications still created during quiet hours (just push is delayed)

---

#### Step 2.6: Docker & Deployment — Bulk Worker

**Priority:** High | **Depends on:** Step 2.1

**What to do:**
1. Add `worker-email-bulk` service to `docker-compose.prod.yml`:
   - Memory limit: 1GB
   - Restart: always
   - Grace period: 120s
   - Same env vars as worker
2. This worker also runs the email-related scheduler (digest, weekly, opportunity, re-engagement crons)

**Files to modify:**
- `docker-compose.prod.yml` (add worker-email-bulk service)

**Acceptance criteria:**
- Container starts and processes bulk email jobs
- Memory stays under 1GB
- Scheduler runs email-related crons

---

### Phase 3: Event-Driven Alert Emails

---

#### Step 3.1: Ranking Alert Email

**Priority:** High | **Depends on:** Step 0.4, Step 0.5, Step 2.1, Step 2.2

**Problem:** No real-time email when user's app ranking changes significantly.

**What to do:**
1. Builder `apps/scraper/src/email/builders/ranking-alert.ts`:
   - Input: userId, keywordId, appId, oldPosition, newPosition, platform
   - Queries: last 7 days of position data for context, category average, competitors at nearby positions
   - Output: `RankingAlertData` with all template fields
2. Template already exists (`ranking-alert-template.ts`) — refactor to use components
3. Configurable thresholds in `email_type_configs.config`:
   ```json
   { "minPositionChange": 5, "triggerOnTop3Entry": true, "triggerOnTop3Exit": true, "triggerOnKeywordEntryExit": true, "categoryChangeThreshold": 3 }
   ```
4. Recipient resolution: all users in accounts that track the affected app + keyword

**Files to create/modify:**
- `apps/scraper/src/email/builders/ranking-alert.ts` (create)
- `apps/scraper/src/email/ranking-alert-template.ts` (modify — use components)

**Tests:**
- Unit test: Builder produces correct data structure
- Unit test: Template renders with hero stat showing position change
- Unit test: 7-day context shows trajectory
- Integration test: Scraper detects ranking change → email sent to correct users

---

#### Step 3.2: Competitor Alert Email

**Priority:** High | **Depends on:** Step 0.4, Step 0.5, Step 2.1, Step 2.2

**Problem:** No email when a tracked competitor makes a significant move.

**What to do:**
1. Builder `apps/scraper/src/email/builders/competitor-alert.ts`:
   - 5 trigger conditions: overtake, featured, review surge (10+/24h), pricing change, listing update
   - Input: competitorAppId, eventType, eventData
   - Queries: comparison data between user's app and competitor
   - Generates actionable insights ("Your options: focus on reviews, check their listing changes")
2. Template already exists (`competitor-alert-template.ts`) — refactor to use components

**Files to create/modify:**
- `apps/scraper/src/email/builders/competitor-alert.ts` (create)
- `apps/scraper/src/email/competitor-alert-template.ts` (modify)

**Tests:**
- Unit test: Overtake detection generates correct comparison data
- Unit test: Review surge includes review velocity comparison
- Unit test: Template renders competitor card with keyword comparison

---

#### Step 3.3: Review Alert Email

**Priority:** Medium | **Depends on:** Step 0.4, Step 0.5, Step 2.1, Step 2.2

**What to do:**
1. Builder `apps/scraper/src/email/builders/review-alert.ts`:
   - New review detection: compare current review list with previous scrape
   - Include: review text snippet, rating, reviewer name, overall rating impact, review stats
   - Configurable: alert on all reviews vs. only negative (1-2 stars)
2. Template already exists (`review-alert-template.ts`) — refactor

**Files to create/modify:**
- `apps/scraper/src/email/builders/review-alert.ts` (create)
- `apps/scraper/src/email/review-alert-template.ts` (modify)

---

#### Step 3.4: Win Celebration Email

**Priority:** Medium | **Depends on:** Step 0.4, Step 0.5, Step 2.1, Step 2.2

**What to do:**
1. Create `apps/scraper/src/email/milestone-detector.ts`:
   - `detectMilestones(appId, rankings, metrics)` → Milestone[]
   - Types: rank_1, top_3, rating_threshold (4.0/4.5/4.8), review_count (100/250/500/1000), best_period, competitor_overtake
   - Dedup: check `email_logs` metadata to avoid re-celebrating same milestone
2. Builder `apps/scraper/src/email/builders/win-celebration.ts`:
   - Shows the journey ("30 days ago: #8, 14 days ago: #4, today: #1")
   - Identifies contributing factors (review growth, competitor drop, etc.)
   - Suggests next goals ("You're also close on 'team tools' (#3)")
3. Template already exists (`win-celebration-template.ts`) — refactor

**Files to create/modify:**
- `apps/scraper/src/email/milestone-detector.ts` (create)
- `apps/scraper/src/email/builders/win-celebration.ts` (create)
- `apps/scraper/src/email/win-celebration-template.ts` (modify)

---

### Phase 4: Notification Worker + In-App

---

#### Step 4.1: Notification Worker Entry Point

**Priority:** High | **Depends on:** Step 0.1, Step 0.3

**Problem:** No worker exists for processing notification jobs.

**What to do:**
1. Create `apps/scraper/src/notification-worker.ts`:
   - BullMQ Worker on `notifications` queue, concurrency: 5
   - Job type routing: single, broadcast, batch_flush, cleanup
   - For `notification_single`:
     1. Check eligibility (type enabled, user preference, rate limit, dedup)
     2. Build notification content (title, body, url, icon, priority)
     3. Insert into `notifications` table (in-app — always)
     4. If user has push enabled for this type AND has active subscriptions → send web push via `web-push` lib
     5. Log delivery to `notification_delivery_log`
   - For `notification_broadcast`: fan-out to individual `notification_single` jobs
   - For `notification_batch_flush`: read batched events from Redis, create summary notification
   - For `notification_cleanup`: delete expired push subscriptions (inactive > 30 days)
2. Create `Dockerfile.worker-notifications`
3. VAPID configuration: read from env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)

**Files to create:**
- `apps/scraper/src/notification-worker.ts`
- `apps/scraper/src/notifications/eligibility.ts` (eligibility checks)
- `apps/scraper/src/notifications/push-sender.ts` (web-push wrapper)
- `Dockerfile.worker-notifications`

**Tests:**
- Unit test: Notification created in DB for every eligible event
- Unit test: Push sent only if user has push enabled + active subscription
- Unit test: Push error 410 → subscription deactivated
- Unit test: Rate limit exceeded → notification still created in DB, push skipped
- Unit test: Broadcast fans out to correct individual jobs
- Integration test: Event → notification in DB + push attempt

**Acceptance criteria:**
- Worker processes notification jobs
- In-app notifications always created
- Web push sent when applicable
- Failed push subscriptions handled gracefully

---

#### Step 4.2: Service Worker + Frontend Push Subscription

**Priority:** High | **Depends on:** Step 4.1

**Problem:** No Service Worker exists. No push subscription management in frontend.

**What to do:**
1. Create `apps/dashboard/public/sw.js`:
   - `push` event handler: parse payload, show browser notification with correct title/body/icon/tag
   - `notificationclick` handler: close notification, navigate to deep link URL, report click to API
   - `notificationclose` handler: report dismiss to API
   - `install`/`activate` handlers: skipWaiting, claim clients
2. Create `apps/dashboard/src/lib/push-notifications.ts`:
   - `registerServiceWorker()` — register sw.js
   - `subscribeToPush(registration)` — request permission, get subscription, POST to API
   - `unsubscribeFromPush()` — unsubscribe browser, DELETE from API
   - `getPushPermissionStatus()` — return current permission state
3. VAPID public key available via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var

**Files to create:**
- `apps/dashboard/public/sw.js`
- `apps/dashboard/src/lib/push-notifications.ts`

**Tests:**
- Unit test: Push subscription correctly sends subscription object to API
- Unit test: Unsubscribe cleans up browser subscription and API
- Manual test: Push notification appears in browser with correct content
- Manual test: Clicking notification opens correct dashboard page

---

#### Step 4.3: Notification API Endpoints

**Priority:** High | **Depends on:** Step 0.3, Step 4.1

**Problem:** No API endpoints for notification management.

**What to do:**
1. Create `apps/api/src/routes/notifications.ts` — user-facing:
   - `POST /api/notifications/push-subscription` — register push subscription
   - `DELETE /api/notifications/push-subscription` — remove push subscription
   - `GET /api/notifications/push-status` — current push permission/subscription status
   - `GET /api/notifications` — list notifications (paginated, filterable by category)
   - `GET /api/notifications/unread-count` — unread count for bell badge
   - `POST /api/notifications/:id/read` — mark single as read
   - `POST /api/notifications/read-all` — mark all as read
   - `POST /api/notifications/:id/archive` — archive/dismiss
   - `POST /api/notifications/:id/clicked` — report push click (from SW)
   - `POST /api/notifications/:id/dismissed` — report push dismiss (from SW)
   - `GET /api/notifications/preferences` — user's notification preferences
   - `PATCH /api/notifications/preferences` — update preferences
2. Create `apps/api/src/routes/admin-notifications.ts` — system admin:
   - `GET /api/system-admin/notifications` — list all (paginated, filterable)
   - `GET /api/system-admin/notifications/:id` — detail with delivery log
   - `GET /api/system-admin/notifications/stats` — aggregate stats
   - `GET /api/system-admin/notifications/stats/by-type` — breakdown
   - `GET /api/system-admin/notifications/stats/by-user` — breakdown
   - `GET /api/system-admin/push-subscriptions` — list all
   - `DELETE /api/system-admin/push-subscriptions/expired` — cleanup
   - `GET /api/system-admin/notification-configs` — list type configs
   - `PATCH /api/system-admin/notification-configs/:type` — update config
   - `POST /api/system-admin/notifications/send` — manual send
   - `POST /api/system-admin/notifications/send-test-push` — test push

**Files to create:**
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/admin-notifications.ts`

**Tests:**
- Unit test: Each endpoint returns correct data shape
- Unit test: Push subscription endpoint validates subscription object
- Unit test: Unread count returns correct number
- Unit test: Mark as read updates `is_read` and `read_at`
- Unit test: Preferences merge defaults with user overrides
- Integration test: Full flow: create notification → fetch → mark read → verify

---

#### Step 4.4: Bell Icon + Notification Dropdown (Dashboard)

**Priority:** High | **Depends on:** Step 4.3

**Problem:** No notification UI in the dashboard.

**What to do:**
1. Create notification bell component for dashboard header:
   - Bell icon (Lucide `Bell` icon, h-4 w-4 with h-8 w-8 button wrapper)
   - Red badge showing unread count (max "99+")
   - Click opens dropdown panel
   - Polling: fetch unread count every 60 seconds
2. Create notification dropdown panel:
   - Shows last 10 notifications grouped by day (Today, Yesterday, etc.)
   - Unread: blue dot + highlighted background
   - Each item: icon + title + body preview + relative time
   - Click item: mark as read + navigate to deep link URL
   - "Mark all as read" button at top
   - "View all notifications" link at bottom → `/notifications`
3. Integrate into existing dashboard header/navbar component

**Files to create/modify:**
- `apps/dashboard/src/components/notifications/bell-icon.tsx` (create)
- `apps/dashboard/src/components/notifications/notification-dropdown.tsx` (create)
- `apps/dashboard/src/components/notifications/notification-item.tsx` (create)
- `apps/dashboard/src/app/(dashboard)/layout.tsx` or header component (modify — add bell icon)

**Tests:**
- Unit test: Bell icon shows correct unread count
- Unit test: Dropdown renders notifications grouped by day
- Unit test: Clicking notification calls mark-as-read API
- Manual test: Real-time updates when new notification arrives

---

#### Step 4.5: Full Notification Center Page

**Priority:** Medium | **Depends on:** Step 4.3, Step 4.4

**Problem:** Users need a dedicated page to view all notification history.

**What to do:**
1. Create `/notifications` page:
   - Category tabs: All, Ranking, Competitor, Reviews, Milestones, System
   - Notifications grouped by day with date headers
   - Each notification: unread indicator, icon, title, body, relative time, dismiss button
   - "Mark all as read" bulk action
   - "Notification settings" shortcut link
   - Infinite scroll / "Load more" pagination
   - Click notification → navigate to deep link

**Files to create:**
- `apps/dashboard/src/app/(dashboard)/notifications/page.tsx`
- `apps/dashboard/src/components/notifications/notification-list.tsx`
- `apps/dashboard/src/components/notifications/notification-filters.tsx`

---

#### Step 4.6: Docker & Deployment — Notification Worker

**Priority:** High | **Depends on:** Step 4.1

**What to do:**
1. Add `worker-notifications` service to `docker-compose.prod.yml`:
   - Memory: 512MB
   - Grace period: 30s
   - Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT + standard vars
2. Generate VAPID keys and add to production env vars

**Files to modify:**
- `docker-compose.prod.yml`

---

### Phase 5: User Preferences & Unsubscribe

---

#### Step 5.1: Email Preferences UI

**Priority:** Medium | **Depends on:** Step 0.2

**What to do:**
1. Add email preferences section to `/settings` page:
   - General: timezone selector (already exists), email frequency radio (realtime/daily/weekly/none)
   - Per-type toggles: toggle switch for each member email type (7 types)
   - Save button writes to `user_email_preferences` table
2. API endpoints (may already exist or need creation):
   - `GET /api/account/email-preferences` — current user's prefs (merge defaults with overrides)
   - `PATCH /api/account/email-preferences` — accepts `{ emailType, enabled }[]`

**Files to modify/create:**
- `apps/dashboard/src/app/(dashboard)/settings/page.tsx` (modify)
- `apps/api/src/routes/account-info.ts` (modify — add email preference endpoints)

---

#### Step 5.2: Notification Preferences UI

**Priority:** Medium | **Depends on:** Step 0.3, Step 4.2

**What to do:**
1. Add notification preferences section to `/settings` page (or `/settings/notifications` tab):
   - Push toggle: Enable/Disable push notifications (triggers browser permission flow)
   - Per-type matrix: checkbox grid with In-App column and Push column for each notification type
   - Grouped by category (Ranking, Competitor, Reviews, Milestones, System)
2. Uses the notification preferences API (Step 4.3)

**Files to modify:**
- `apps/dashboard/src/app/(dashboard)/settings/page.tsx` (modify)

---

#### Step 5.3: Unsubscribe Flow + Open/Click Tracking

**Priority:** Medium | **Depends on:** Step 0.2

**What to do:**
1. Unsubscribe endpoints (create or verify existing):
   - `GET /api/emails/unsubscribe/:token` — show unsubscribe confirmation page
   - `POST /api/emails/unsubscribe/:token` — process unsubscribe (update user_email_preferences or email_prospects)
   - Include `List-Unsubscribe` and `List-Unsubscribe-Post` headers in every email
2. Open tracking (verify existing implementation in `tracking.ts`):
   - `GET /api/emails/track/open/:emailLogId.png` — returns 1x1 transparent PNG, updates `opened_at`
3. Click tracking (verify existing):
   - `GET /api/emails/track/click/:emailLogId/:linkIndex` — 302 redirect to original URL, updates `clicked_at` + `click_count`

**Files to create/modify:**
- `apps/api/src/routes/email-tracking.ts` (create or verify)
- `apps/scraper/src/email/tracking.ts` (verify — pixel injection and link rewriting)

---

### Phase 6: Cold Email System

---

#### Step 6.1: Campaign & Prospect Management

**Priority:** Low | **Depends on:** Step 0.2, Step 2.1

**What to do:**
1. Admin API for campaigns and prospects:
   - CRUD for `email_campaigns` (create, list, get, update status)
   - CRUD for `email_prospects` (add manually, CSV import, list by campaign, update status)
   - Campaign lifecycle: draft → active → paused → active → completed
   - Prospect lifecycle: new → contacted → responded → converted / unsubscribed
2. Conversion tracking: when a new user registers, match email against `email_prospects.email` → auto-update status to `converted`

**Files to create:**
- `apps/api/src/routes/admin-campaigns.ts`

---

#### Step 6.2: Cold Email Templates + Data Generator

**Priority:** Low | **Depends on:** Step 6.1, Step 2.2

**What to do:**
1. Cold data generator `apps/scraper/src/email/cold-data-generator.ts`:
   - For a given app: fetch top 10 keywords, category rank, competitor comparison
   - Auto-generate competitive insights
2. Cold email templates already exist (`cold-email-templates.ts`):
   - First Contact: lead with their data, show keyword rankings + competitors
   - Follow-up Nudge: short, focused on one change since first email
   - Competitive Alert: time-sensitive competitor move
3. Rate limit: max 50 cold emails per day (Redis counter)
4. Auto follow-up: BullMQ delayed job 3-7 days after first contact (only if no click/signup)

**Files to create/modify:**
- `apps/scraper/src/email/cold-data-generator.ts` (create)
- `apps/scraper/src/email/cold-email-templates.ts` (modify — use components)

---

### Phase 7: Admin Dashboards

---

#### Step 7.1: Admin Email Dashboard

**Priority:** Medium | **Depends on:** Step 0.2, Step 2.1

**What to do:**
1. `/system-admin/emails/page.tsx` — Overview:
   - Stat cards: sent today/week, open rate, click rate (with delta vs last period)
   - Filterable email log table: type, status, date, recipient, subject
   - Tabs: All / Cold / Member / System
2. `/system-admin/emails/[id]/page.tsx` — Detail:
   - HTML preview in sandboxed iframe
   - Metadata: recipient, account, type, sent time, status, tracking events
   - Actions: View HTML source, Resend, Send similar
3. `/system-admin/emails/settings/page.tsx` — Configuration:
   - Email type config table: global toggle, frequency, configure button
   - Account overrides table

**Files to create:**
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/page.tsx`
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/[id]/page.tsx`
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/settings/page.tsx`

---

#### Step 7.2: Admin Notification Dashboard

**Priority:** Medium | **Depends on:** Step 0.3, Step 4.3

**What to do:**
1. `/system-admin/notifications/page.tsx` — Overview:
   - Stat cards: sent today/week, push subscriptions, click rate
   - Filterable notification log: type, channel, user, status, time
   - Tabs: All / By Type / By User / Push Subscriptions / Settings
2. `/system-admin/notifications/[id]/page.tsx` — Detail:
   - Who/What/Why/How breakdown
   - Delivery log: channel, status, timestamps
3. `/system-admin/notifications/settings/page.tsx`:
   - Type config table with in-app and push default toggles
   - Rate limits configuration
   - Notification retention settings

**Files to create:**
- `apps/dashboard/src/app/(dashboard)/system-admin/notifications/page.tsx`
- `apps/dashboard/src/app/(dashboard)/system-admin/notifications/[id]/page.tsx`
- `apps/dashboard/src/app/(dashboard)/system-admin/notifications/settings/page.tsx`

---

#### Step 7.3: Admin Campaign Dashboard (Cold Emails)

**Priority:** Low | **Depends on:** Step 6.1

**What to do:**
1. `/system-admin/emails/campaigns/page.tsx` — Campaign list:
   - Campaign name, status, progress, sent/opened/clicked/converted counts
   - Create new campaign button
2. `/system-admin/emails/campaigns/[id]/page.tsx` — Campaign detail:
   - Prospect list with status filters
   - Campaign stats and conversion funnel
   - Pause/resume actions

**Files to create:**
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/campaigns/page.tsx`
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/campaigns/[id]/page.tsx`

---

#### Step 7.4: Queue Monitoring Dashboard

**Priority:** Medium | **Depends on:** Step 0.1

**What to do:**
1. `/system-admin/queues/page.tsx` — All 5 queues in one view:
   - Per queue: name, waiting count, active count, completed count, failed count, processing rate
   - Mini chart showing queue depth over time
   - Failed job list with error messages
   - Pause/resume controls per queue
   - Retry failed jobs button
2. Extends existing queue admin API (`/api/system-admin/scraper/queue`) to cover all 5 queues

**Files to create/modify:**
- `apps/dashboard/src/app/(dashboard)/system-admin/queues/page.tsx` (create)
- `apps/api/src/routes/system-admin.ts` (modify — extend queue endpoints for new queues)

---

#### Step 7.5: Dry Run System Dashboard

**Priority:** Low | **Depends on:** Step 7.1

**What to do:**
1. `/system-admin/emails/dry-run/page.tsx`:
   - Select email type, select user/account/app
   - "Preview" button: shows rendered HTML + subject + data JSON
   - "Send Test" button: sends to admin's email (marked `is_dry_run` in email_logs)
   - "Bulk Preview" button: shows eligible count, skip count with reasons, 5-10 sample subjects
2. Uses existing `dry-run.ts` module

**Files to create:**
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/dry-run/page.tsx`

---

### Phase 8: Polish & Deliverability

---

#### Step 8.1: Email Deliverability Setup

**Priority:** Low | **Depends on:** Nothing (DNS config)

**What to do:**
1. Configure DNS records for `appranks.io`:
   - SPF: `v=spf1 include:_spf.<provider>.com ~all`
   - DKIM: generate key pair, add TXT record
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@appranks.io`
   - Bounce domain: CNAME for bounce handling
2. Warm-up plan: start with low volume (10/day), gradually increase

**No code changes — infrastructure/DNS only.**

---

#### Step 8.2: Bounce Handling

**Priority:** Low | **Depends on:** Step 0.2

**What to do:**
1. Process SMTP bounce notifications:
   - Hard bounce → set `email_logs.status = 'bounced'`, auto-disable email for that address
   - Soft bounce (3 consecutive) → auto-disable
   - Complaint → auto-unsubscribe + flag in admin
2. Add `is_bounced` and `bounce_count` columns to `users` or use `email_logs` aggregation

---

#### Step 8.3: Lifecycle Emails — Onboarding Series

**Priority:** Medium | **Depends on:** Step 1.3, Step 2.1

**What to do:**
1. On registration, schedule 3 delayed email jobs on `email-bulk` queue:
   - Day 1 (24h delay): "Your first step: add your app"
   - Day 3 (72h delay): "Here's what we found for {app}" (or "Here's what you're missing" if no app)
   - Day 7 (168h delay): "Your first week on AppRanks" (week-1 summary if active, upgrade CTA if not)
2. Onboarding intelligence: each email checks user's setup progress and adapts content
3. Cancel condition: if user becomes active (lastSeenAt updated recently), skip remaining onboarding emails

---

#### Step 8.4: Re-engagement Email

**Priority:** Medium | **Depends on:** Step 2.1

**What to do:**
1. Daily cron checks `users.lastSeenAt < now() - 14 days`:
   - Only for users with `emailDigestEnabled = true`
   - Exclude users who received re-engagement email in last 14 days
2. Content: "While you were away" — show ranking changes, competitor moves, new reviews since last visit
3. Template already exists (`re-engagement-template.ts`)

---

#### Step 8.5: Opportunity Alert Email

**Priority:** Medium | **Depends on:** Step 2.1, Step 2.2

**What to do:**
1. Weekly cron (Saturday morning): analyze each user's tracked apps for opportunities
2. 5 opportunity detection algorithms:
   - Low competition: app #4-#10, apps above have lower rating
   - Momentum: 3+ consecutive position improvements
   - Near top-3: app at #4 or #5
   - Untracked high-value: competitor ranks for keyword user doesn't track
   - Category near top-10: category rank #11-#13
3. Each opportunity gets an impact score. Email shows top 3 by score.
4. Template already exists (`opportunity-alert-template.ts`)

---

## 9. Frequency & Throttling Rules

### Per-Type Email Limits

| Email Type | Max/Day | Max/Week | Cooldown | Batching |
|------------|---------|----------|----------|----------|
| Daily Digest | 1 | 7 | 24h | N/A |
| Weekly Summary | — | 1 | 7d | N/A |
| Ranking Alert | 5 | 20 | 6h per keyword | 30 min window |
| Competitor Alert | 3 | 15 | 12h per competitor | 30 min window |
| Review Alert | 3 | 15 | 1h per app | 30 min window |
| Win Celebration | 2 | 5 | 24h | N/A |
| Opportunity | — | 1 | 7d | N/A |
| Welcome | 1 lifetime | — | — | N/A |
| Onboarding | 1 per step | — | — | N/A |
| Re-engagement | — | 1 | 14d | N/A |
| Cold First Contact | — | — | Once/prospect | N/A |
| Cold Follow-up | — | 1 | 3d after last | N/A |
| Cold Competitive | — | — | Once/prospect | N/A |

### Global Limits

| Rule | Value |
|------|-------|
| Max emails per user per day (all types) | 10 |
| Max cold emails per day (system-wide) | 50 |
| Quiet hours (default) | 22:00-07:00 user local time |
| Alert email batch window | 30 minutes |

### Notification Rate Limits

| Rule | Value |
|------|-------|
| Max push per user per hour | 10 |
| Max push per user per day | 50 |
| Notification batch window | 5 minutes |
| Batch threshold | 4+ events of same category → summary |
| Quiet hours (push only) | 22:00-07:00 user local time |

### Deduplication

- Email: `{emailType}:{userId}:{entityId}` → Redis key with TTL = cooldown
- Notification: `{notifType}:{userId}:{entityId}` → Redis key with TTL = 5 min

---

## 10. Admin Dashboard Pages

### Page Inventory

| Route | Page | Content | Phase |
|-------|------|---------|-------|
| `/system-admin/emails` | Email Overview | Stats + filterable email log | Phase 7 |
| `/system-admin/emails/[id]` | Email Detail | HTML preview + metadata + resend | Phase 7 |
| `/system-admin/emails/settings` | Email Settings | Type configs + account overrides | Phase 7 |
| `/system-admin/emails/campaigns` | Campaign List | Cold email campaigns + stats | Phase 7 |
| `/system-admin/emails/campaigns/[id]` | Campaign Detail | Prospects + funnel | Phase 7 |
| `/system-admin/emails/dry-run` | Dry Run | Preview + test send + bulk preview | Phase 7 |
| `/system-admin/notifications` | Notification Overview | Stats + filterable log | Phase 7 |
| `/system-admin/notifications/[id]` | Notification Detail | Who/what/why/how | Phase 7 |
| `/system-admin/notifications/settings` | Notification Settings | Type configs + rate limits | Phase 7 |
| `/system-admin/notifications/send` | Manual Send | Send test notification | Phase 7 |
| `/system-admin/queues` | Queue Monitor | All 5 queues health dashboard | Phase 7 |

---

## 11. User-Facing Pages

| Route | Component | Content | Phase |
|-------|-----------|---------|-------|
| Header bell icon | `<BellIcon />` | Unread count badge + dropdown | Phase 4 |
| Notification dropdown | `<NotificationDropdown />` | Last 10 notifications | Phase 4 |
| `/notifications` | Full page | All notifications, filterable, paginated | Phase 4 |
| `/settings` (section) | Email preferences | Per-type email toggles | Phase 5 |
| `/settings` (section) | Notification preferences | Push toggle + per-type in-app/push toggles | Phase 5 |

---

## 12. Docker & Deployment

### Container Inventory (After)

| Service | Memory | Concurrency | Grace | New? |
|---------|--------|-------------|-------|------|
| postgres | 2GB | — | — | No |
| redis | 1.5GB | — | — | No |
| api | 1GB | — | — | No |
| dashboard | 512MB | — | — | No |
| worker (scraper bg) | 3GB | 11 | 120s | No |
| worker-interactive | 1GB | 1 | 120s | No |
| **worker-email-instant** | **512MB** | **3** | **30s** | **Yes** |
| **worker-email-bulk** | **1GB** | **5** | **120s** | **Yes** |
| **worker-notifications** | **512MB** | **5** | **30s** | **Yes** |

**Total memory: ~11GB** (Hetzner CX41 has 16GB — comfortable)

### New Environment Variables

```env
# VAPID keys (for web push)
VAPID_PUBLIC_KEY=BNx...       # Share with frontend via NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=abc...      # Server-only
VAPID_SUBJECT=mailto:notifications@appranks.io

# Worker concurrency (optional overrides)
EMAIL_INSTANT_WORKER_CONCURRENCY=3
EMAIL_BULK_WORKER_CONCURRENCY=5
NOTIFICATION_WORKER_CONCURRENCY=5
```

---

## 13. Testing Strategy

### Unit Tests (Required for ALL steps)

| Layer | What to Test |
|-------|-------------|
| Queue setup | Enqueue functions put jobs on correct queue with correct options |
| Event detector | Each event type detected with correct thresholds |
| Event dispatcher | Affected users found correctly, jobs enqueued to both queues |
| Email builders | Data aggregation returns correct structure |
| Email templates | HTML rendering includes all sections |
| Email pipeline | Eligibility gates pass/fail correctly |
| Frequency cap | Counts recent sends, blocks when exceeded |
| Batching | Groups alerts within window, singles pass through |
| Quiet hours | Timezone calculation, queue/flush |
| Notification content | Each type generates correct title/body/url |
| Push sender | Sends to web-push, handles errors, deactivates expired subs |
| Milestone detection | Each milestone type detected correctly |
| Subject generation | Dynamic subjects match content sentiment |

### Integration Tests

| Scenario | Verify |
|----------|--------|
| Full digest flow | Cron → builder → pipeline → SMTP mock → email_logs entry |
| Transactional flow | API → enqueue → instant worker → email sent |
| Alert trigger | Scraper result → event detect → dispatch → email + notification |
| Frequency cap | 5 ranking alerts → 6th blocked with correct reason |
| Quiet hours | Alert at 2 AM → queued → sent at 7 AM |
| Push flow | Event → notification worker → web-push call → delivery log |
| Unsubscribe | Click link → preference updated → next email skipped |

---

## 14. Metrics & Success Criteria

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 1 | Transactional email delivery time | < 30 seconds |
| Phase 2 | Daily digest open rate | > 35% |
| Phase 2 | Weekly summary open rate | > 40% |
| Phase 3 | Ranking alert click rate | > 15% |
| Phase 4 | Push notification click rate | > 20% |
| Phase 4 | In-app notification read rate | > 60% |
| Phase 5 | Unsubscribe rate per email type | < 0.5% |
| Phase 6 | Cold email open rate | > 25% |
| Phase 6 | Cold email → signup conversion | > 5% |
| Phase 8 | Bounce rate | < 2% |

---

## 15. Risk Analysis

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Transactional emails delayed by bulk queue | High | Low | Separate queues + separate workers (this architecture) |
| Alert flood overwhelms users | Medium | High | Batching (30 min window), frequency caps, quiet hours |
| Cold emails damage domain reputation | High | Medium | Rate limit 50/day, warm-up gradually, monitor complaints |
| Push notifications annoy users | Medium | Medium | Conservative defaults (most OFF), user controls, rate limits |
| Emails land in spam | High | Medium | SPF/DKIM/DMARC, proper unsubscribe headers, warm-up |
| Template breaks in Outlook | Low | High | Table-based layout, inline CSS, test in multiple clients |
| Redis memory spike from batching keys | Low | Low | TTLs on all Redis keys, cleanup cron |
| Timezone bugs cause double-sends | Medium | Medium | `lastDigestSentAt` check + Redis dedup key with date |
| VPS memory exceeded with 3 new workers | High | Low | Budget: 11GB / 16GB available, monitor and tune |
| Push subscription churn (expired subs) | Low | High | Monthly cleanup cron, graceful 410/404 handling |

---

## 16. Task Dependency Graph

```
Phase 0 (Foundation) — ALL other phases depend on these
  Step 0.1 (Queues + Types)     ─────────────────────────────┐
  Step 0.2 (Email DB Schema)    ─────────────────────────────┤
  Step 0.3 (Notification DB Schema) ─────────────────────────┤
  Step 0.4 (Event Detector)     ─── needs 0.1               │
  Step 0.5 (Event Dispatcher)   ─── needs 0.1, 0.4          │
                                                             │
Phase 1 (Transactional Email Worker)                         │
  Step 1.1 (Templates)          ─── needs 0.1               │
  Step 1.2 (Worker)             ─── needs 0.1, 0.2, 1.1     │
  Step 1.3 (API Integration)    ─── needs 0.1, 1.2          │
  Step 1.4 (Docker Deploy)      ─── needs 1.2               │
                                                             │
Phase 2 (Bulk Email Worker + Enhancements)                   │
  Step 2.1 (Bulk Worker)        ─── needs 0.1, 0.2          │
  Step 2.2 (Template Components)─── independent              │
  Step 2.3 (Enhanced Digest)    ─── needs 2.1, 2.2          │
  Step 2.4 (Timezone Scheduling)─── needs 2.1               │
  Step 2.5 (Batching + Quiet)   ─── needs 0.1               │
  Step 2.6 (Docker Deploy)      ─── needs 2.1               │
                                                             │
Phase 3 (Event-Driven Alert Emails)                          │
  Step 3.1 (Ranking Alert)      ─── needs 0.4, 0.5, 2.1, 2.2
  Step 3.2 (Competitor Alert)   ─── needs 0.4, 0.5, 2.1, 2.2
  Step 3.3 (Review Alert)       ─── needs 0.4, 0.5, 2.1, 2.2
  Step 3.4 (Win Celebration)    ─── needs 0.4, 0.5, 2.1, 2.2
                                                             │
Phase 4 (Notification Worker + In-App)                       │
  Step 4.1 (Notif Worker)       ─── needs 0.1, 0.3          │
  Step 4.2 (Service Worker + Push) ── needs 4.1              │
  Step 4.3 (Notification API)   ─── needs 0.3, 4.1          │
  Step 4.4 (Bell Icon + Dropdown)── needs 4.3               │
  Step 4.5 (Full Notif Page)    ─── needs 4.3, 4.4          │
  Step 4.6 (Docker Deploy)      ─── needs 4.1               │
                                                             │
Phase 5 (Preferences + Unsubscribe)                          │
  Step 5.1 (Email Prefs UI)     ─── needs 0.2               │
  Step 5.2 (Notif Prefs UI)     ─── needs 0.3, 4.2          │
  Step 5.3 (Unsubscribe + Tracking) ── needs 0.2            │
                                                             │
Phase 6 (Cold Email System)                                  │
  Step 6.1 (Campaign/Prospect)  ─── needs 0.2, 2.1          │
  Step 6.2 (Cold Templates)     ─── needs 6.1, 2.2          │
                                                             │
Phase 7 (Admin Dashboards)                                   │
  Step 7.1 (Email Admin)        ─── needs 0.2, 2.1          │
  Step 7.2 (Notif Admin)        ─── needs 0.3, 4.3          │
  Step 7.3 (Campaign Admin)     ─── needs 6.1               │
  Step 7.4 (Queue Monitor)      ─── needs 0.1               │
  Step 7.5 (Dry Run Dashboard)  ─── needs 7.1               │
                                                             │
Phase 8 (Polish)                                             │
  Step 8.1 (DNS Deliverability) ─── independent              │
  Step 8.2 (Bounce Handling)    ─── needs 0.2               │
  Step 8.3 (Onboarding Series)  ─── needs 1.3, 2.1          │
  Step 8.4 (Re-engagement)      ─── needs 2.1               │
  Step 8.5 (Opportunity Alert)  ─── needs 2.1, 2.2          │
```

### Recommended Implementation Order

```
WEEK 1:  0.1, 0.2, 0.3, 2.2        (Foundation: queues, schemas, components — all parallel)
WEEK 2:  0.4, 0.5, 1.1, 1.2        (Event system + instant worker)
WEEK 3:  1.3, 1.4, 2.1, 2.6        (API integration + bulk worker + deploy both)
WEEK 4:  2.3, 2.4, 2.5             (Enhanced digest + timezone + batching)
WEEK 5:  3.1, 3.2, 3.3, 3.4        (All alert emails)
WEEK 6:  4.1, 4.2, 4.3, 4.6        (Notification worker + push + API + deploy)
WEEK 7:  4.4, 4.5, 5.1, 5.2        (UI: bell icon, notif page, preferences)
WEEK 8:  5.3, 7.1, 7.2, 7.4        (Unsubscribe + admin dashboards)
WEEK 9:  6.1, 6.2, 7.3             (Cold email system)
WEEK 10: 7.5, 8.1, 8.2, 8.3, 8.4, 8.5  (Polish: dry run, deliverability, lifecycle emails)
```

---

## Appendix: Data Flow Reference

### Which DB Tables Feed Which Emails

```
appKeywordRankings ────→ Daily Digest, Weekly, Ranking Alert, Opportunity, Cold
appCategoryRankings ───→ Daily Digest, Weekly, Ranking Alert, Cold
appSnapshots ──────────→ Daily Digest, Weekly, Competitor Alert, Cold
appFieldChanges ───────→ Competitor Alert
appReviewMetrics ──────→ Weekly, Review Alert, Win Celebration
accountTrackedApps ────→ All member emails (determines recipients)
accountTrackedKeywords → All member emails (determines keywords)
accountCompetitorApps ─→ All competitor-related emails
users ─────────────────→ All emails (timezone, preferences, lastSeenAt)
email_type_configs ────→ Pipeline eligibility check
email_logs ────────────→ Frequency cap, dedup, admin dashboard
email_prospects ───────→ Cold emails
notifications ─────────→ In-app notification center
push_subscriptions ────→ Web push delivery
```

### Scraper → Event → Queue Trigger Map

```
KeywordScraper.processResults()
  ↓ writes appKeywordRankings
  ↓ eventDetector.checkRankingAlerts()
  │   → ranking_top3_entry, ranking_top3_exit, ranking_significant_change
  │   → ranking_new_entry, ranking_dropped_out
  ↓ eventDetector.detectMilestones()
  │   → milestone_rank_first, milestone_best_week
  ↓ eventDispatcher.dispatch()
      → email-bulk: email_ranking_alert, email_win_celebration
      → notifications: ranking_*, milestone_*

AppDetailsScraper.processResults()
  ↓ writes appSnapshots + appFieldChanges
  ↓ eventDetector.checkCompetitorMoves()
  │   → competitor_overtook, competitor_featured, competitor_pricing_change
  ↓ eventDispatcher.dispatch()
      → email-bulk: email_competitor_alert
      → notifications: competitor_*

ReviewScraper.processResults()
  ↓ writes review data
  ↓ eventDetector.checkNewReviews()
  │   → review_new_positive, review_new_negative
  ↓ eventDetector.checkReviewMilestones()
  │   → review_milestone
  ↓ eventDispatcher.dispatch()
      → email-bulk: email_review_alert, email_win_celebration
      → notifications: review_*

CategoryScraper.processResults()
  ↓ writes appCategoryRankings
  ↓ eventDetector.checkCategoryAlerts()
  │   → category_rank_change
  ↓ eventDispatcher.dispatch()
      → email-bulk: email_ranking_alert
      → notifications: category_rank_change
```

### Email Components Used per Type

| Email Type | layout | header | heroStat | dataTable | insight | competitor | cta | footer | summary | review | milestone |
|------------|--------|--------|----------|-----------|---------|------------|-----|--------|---------|--------|-----------|
| Password Reset | x | x | | | | | x | x | | | |
| Email Verification | x | x | | | | | x | x | | | |
| Welcome | x | x | | | | | x | x | | | |
| Invitation | x | x | | | | | x | x | | | |
| Login Alert | x | x | | | | | x | x | | | |
| 2FA Code | x | x | x | | | | | x | | | |
| Daily Digest | x | x | x | x | x | x | x | x | x | | |
| Weekly Summary | x | x | | x | x | x | x | x | x | | |
| Ranking Alert | x | x | x | x | | | x | x | | | |
| Competitor Alert | x | x | x | | | x | x | x | | | |
| Review Alert | x | x | | | | | x | x | | x | |
| Win Celebration | x | x | | | | | x | x | | | x |
| Opportunity | x | x | | x | x | | x | x | | | |
| Onboarding | x | x | | x | | | x | x | | | |
| Re-engagement | x | x | x | | | | x | x | x | | |
| Cold First Contact | x | x | | x | | x | x | x | | | |
| Cold Follow-up | x | x | | x | | x | x | x | | | |
| Cold Competitive | x | x | x | | | x | x | x | | | |
