# Email System — Implementation Guide

> AppRanks.io Email Marketing & Notification System
> Created: 2026-03-29
> Design Doc: [`files/email-system-design.md`](email-system-design.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1: Foundation](#4-phase-1-foundation)
5. [Phase 2: Enhanced Member Emails](#5-phase-2-enhanced-member-emails)
6. [Phase 3: Real-time Alerts](#6-phase-3-real-time-alerts)
7. [Phase 4: Engagement Emails](#7-phase-4-engagement-emails)
8. [Phase 5: Cold Email System](#8-phase-5-cold-email-system)
9. [Phase 6: Polish & Deliverability](#9-phase-6-polish--deliverability)
10. [Email Catalogue — All 15 Email Types](#10-email-catalogue--all-15-email-types)
11. [Data Flow & Integration Map](#11-data-flow--integration-map)
12. [Frequency & Throttling Rules](#12-frequency--throttling-rules)
13. [Email Design Language](#13-email-design-language)
14. [Testing Strategy](#14-testing-strategy)
15. [Metrics & Success Criteria](#15-metrics--success-criteria)
16. [Risk Analysis & Mitigations](#16-risk-analysis--mitigations)

---

## 1. Executive Summary

AppRanks sits on a goldmine of marketplace data — keyword rankings, category positions, competitor movements, review metrics — across 11 platforms. Today this data only reaches users when they log into the dashboard. Email transforms this passive data into an active communication channel.

**The system delivers 15 email types across 3 categories:**

| Category | Count | Goal | Linear Tasks |
|----------|-------|------|--------------|
| Cold Outreach | 3 types | User acquisition | PLA-348, PLA-350, PLA-352 |
| Member Notifications | 7 types | Retention & engagement | PLA-315, PLA-316, PLA-324, PLA-326, PLA-330, PLA-332, PLA-345 |
| System/Lifecycle | 5 types | Onboarding & win-back | PLA-339, PLA-342 |

**Infrastructure** is built across 6 tasks: PLA-304 (schema), PLA-305 (templates), PLA-306 (pipeline), PLA-307 (timezone scheduling), PLA-308 (tracking/unsubscribe), PLA-312 (admin API).

**Total: 18 Linear tasks across 6 phases.**

---

## 2. Current State Analysis

### What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| SMTP Transport | Working | `apps/scraper/src/email/mailer.ts` (43 lines) |
| Daily Digest Builder | Working, basic | `apps/scraper/src/email/digest-builder.ts` (380 lines) |
| Digest HTML Template | Working, monolithic | `apps/scraper/src/email/digest-template.ts` (209 lines) |
| User email fields | Partial | `users.emailDigestEnabled`, `users.lastDigestSentAt`, `users.timezone` |
| Cron schedule | Shopify only | `0 5 * * *` (5 AM UTC) in `scraper-schedules.ts` |
| Manual send | Admin only | `/api/system-admin/accounts/:id/send-digest`, `/api/system-admin/members/:id/send-digest` |

### Key Gaps

1. **Single email type** — Only daily digest exists. No alerts, no cold emails, no lifecycle emails.
2. **No email logging** — Sent emails are not stored. No way to see what was sent, to whom, when.
3. **No tracking** — No open rates, no click tracking. Blind sending.
4. **No unsubscribe** — Only a binary `emailDigestEnabled` toggle. No per-type control, no one-click unsubscribe header.
5. **No frequency control** — No caps, no dedup, no quiet hours.
6. **Single platform** — Digest only scheduled for Shopify. Other 10 platforms have no email.
7. **Fixed timezone** — Runs at 5 AM UTC regardless of user timezone (the `timezone` field is stored but never used).
8. **Monolithic template** — One big function generates all HTML. No reusable components.

### What We Keep

- **SMTP config pattern** (`mailer.ts`) — Simple, working. Enhance but don't replace.
- **Digest data model** — `RankingChange` and `CompetitorSummary` types are solid. Extend them.
- **BullMQ job system** — Proven queue infrastructure. Add new job types to it.
- **User timezone field** — Already stored, just needs to be used.

---

## 3. Architecture Overview

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        TRIGGER LAYER                             │
├──────────┬──────────┬───────────┬───────────┬───────────────────┤
│  Cron    │ Scraper  │ API Event │  Admin    │  Campaign         │
│ Schedule │ Results  │ (register)│  Manual   │  Scheduler        │
└────┬─────┴────┬─────┴─────┬─────┴─────┬─────┴────────┬──────────┘
     │          │           │           │              │
     ▼          ▼           ▼           ▼              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BullMQ EMAIL QUEUE                            │
│  email_daily_digest, email_ranking_alert, email_cold_campaign... │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EMAIL PIPELINE                              │
│                                                                  │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌───────┐  ┌─────┐ │
│  │ Build   │→ │ Eligibility│→ │ Render   │→ │ Log   │→ │Send │ │
│  │ Data    │  │ Check      │  │ Template │  │ to DB │  │SMTP │ │
│  └─────────┘  └────────────┘  └──────────┘  └───────┘  └─────┘ │
│                     │                                            │
│         ┌───────────┼───────────────────┐                        │
│         │           │                   │                        │
│    Type enabled? Freq cap ok?    Quiet hours?                    │
│    User opted in? Dedup check?   Batching?                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      POST-SEND                                   │
│                                                                  │
│  email_logs table ← status updates (sent/delivered/bounced)      │
│  Open tracking    ← 1x1 pixel ping → update opened_at           │
│  Click tracking   ← redirect link → update clicked_at, count    │
│  Unsubscribe      ← token link → update user preferences        │
└──────────────────────────────────────────────────────────────────┘
```

### File Structure (New/Modified)

```
apps/scraper/src/email/
├── mailer.ts                    # EXISTING — enhance with pipeline
├── digest-builder.ts            # EXISTING — rewrite
├── digest-template.ts           # EXISTING — deprecate, replace with components
├── pipeline.ts                  # NEW — central send pipeline (PLA-306)
├── eligibility.ts               # NEW — eligibility checks (PLA-306)
├── frequency-cap.ts             # NEW — frequency cap logic (PLA-306)
├── email-logger.ts              # NEW — DB logging (PLA-306)
├── alert-batcher.ts             # NEW — alert batching (PLA-336)
├── quiet-hours.ts               # NEW — quiet hours logic (PLA-336)
├── tracking.ts                  # NEW — open/click pixel injection (PLA-308)
├── unsubscribe.ts               # NEW — token generation (PLA-308)
├── milestone-detector.ts        # NEW — win detection (PLA-332)
├── opportunity-detector.ts      # NEW — opportunity analysis (PLA-345)
├── cold-data-generator.ts       # NEW — pre-send data gen for cold (PLA-350)
├── design-tokens.ts             # NEW — shared colors, fonts (PLA-305)
├── components/                  # NEW — reusable email blocks (PLA-305)
│   ├── index.ts
│   ├── layout.ts
│   ├── header.ts
│   ├── hero-stat.ts
│   ├── data-table.ts
│   ├── insight-block.ts
│   ├── competitor-card.ts
│   ├── cta-button.ts
│   ├── footer.ts
│   ├── summary-badge.ts
│   ├── review-card.ts
│   └── milestone-card.ts
├── builders/                    # NEW — per-type data builders
│   ├── daily-digest.ts          # PLA-315
│   ├── weekly-summary.ts        # PLA-316
│   ├── ranking-alert.ts         # PLA-324
│   ├── competitor-alert.ts      # PLA-326
│   ├── review-alert.ts          # PLA-330
│   ├── win-celebration.ts       # PLA-332
│   ├── opportunity-alert.ts     # PLA-345
│   ├── welcome.ts               # PLA-339
│   ├── onboarding.ts            # PLA-339
│   ├── reengagement.ts          # PLA-342
│   ├── cold-first-contact.ts    # PLA-350
│   ├── cold-followup.ts         # PLA-352
│   └── cold-competitive.ts      # PLA-352
└── templates/                   # NEW — per-type HTML composers
    ├── daily-digest.ts          # PLA-315
    ├── weekly-summary.ts        # PLA-316
    ├── ranking-alert.ts         # PLA-324
    ├── competitor-alert.ts      # PLA-326
    ├── review-alert.ts          # PLA-330
    ├── win-celebration.ts       # PLA-332
    ├── opportunity-alert.ts     # PLA-345
    ├── welcome.ts               # PLA-339
    ├── onboarding.ts            # PLA-339
    ├── reengagement.ts          # PLA-342
    ├── cold-first-contact.ts    # PLA-350
    ├── cold-followup.ts         # PLA-352
    └── cold-competitive.ts      # PLA-352

packages/db/src/schema/
├── email.ts                     # NEW — all email tables (PLA-304)
└── auth.ts                      # MODIFY — add email_frequency to users (PLA-304)

apps/api/src/routes/
├── admin-emails.ts              # NEW — email management API (PLA-312)
├── admin-campaigns.ts           # NEW — campaign management API (PLA-348)
├── email-tracking.ts            # NEW — open/click/unsubscribe routes (PLA-308)
└── account-info.ts              # MODIFY — add email preference endpoints (PLA-319)

apps/dashboard/src/app/(dashboard)/
├── settings/page.tsx            # MODIFY — add email preferences section (PLA-319)
└── system-admin/emails/
    ├── page.tsx                  # NEW — email overview dashboard (PLA-322)
    ├── [id]/page.tsx             # NEW — email detail view (PLA-322)
    ├── settings/page.tsx         # NEW — email type config (PLA-322)
    ├── campaigns/page.tsx        # NEW — campaign list (PLA-348)
    ├── campaigns/[id]/page.tsx   # NEW — campaign detail (PLA-348)
    └── dry-run/page.tsx          # NEW — dry run preview (PLA-353)
```

---

## 4. Phase 1: Foundation

> **Goal:** Build the infrastructure that all email types depend on.
> **Priority:** Urgent — nothing else works without this.
> **Tasks:** PLA-304, PLA-305, PLA-306, PLA-307, PLA-308, PLA-312

### 4.1 Database Schema — [PLA-304](https://linear.app/plan-b-side-projects/issue/PLA-304)

7 new tables form the backbone of the email system:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `email_type_configs` | Global on/off + settings per email type | `email_type`, `enabled`, `config` (JSONB) |
| `email_type_account_overrides` | Per-account overrides | `email_type`, `account_id`, `enabled`, `config` |
| `email_logs` | Every email ever sent | `email_type`, `recipient_email`, `subject`, `html_body`, `data_snapshot`, `status`, `opened_at`, `clicked_at` |
| `email_campaigns` | Cold email campaign groupings | `name`, `status`, `total_sent/opened/clicked/converted` |
| `email_prospects` | Non-user contacts | `email`, `app_id`, `status`, `campaign_id`, `contact_count` |
| `user_email_preferences` | Per-user per-type opt-in/out | `user_id`, `email_type`, `enabled`, `config` |
| `email_unsubscribe_tokens` | One-click unsubscribe tokens | `token`, `email`, `email_type`, `user_id` |

**Dependency:** This is the first task to implement. Everything else reads/writes these tables.

**User table change:** Add `email_frequency` column (`'realtime' | 'daily' | 'weekly' | 'none'`).

**Migration notes:**
- Use `IF NOT EXISTS` on all `CREATE TABLE`
- Use `CREATE INDEX CONCURRENTLY` for `email_logs` indexes (high-traffic table)
- Seed `email_type_configs` with all 15 types (disabled by default except daily digest)

### 4.2 Component-Based Template Engine — [PLA-305](https://linear.app/plan-b-side-projects/issue/PLA-305)

Replace the monolithic `digest-template.ts` with a component system.

**12 reusable components:**

| Component | Usage | Appears In |
|-----------|-------|------------|
| `emailLayout()` | Base HTML wrapper | Every email |
| `header()` | Logo + type label + date | Every email |
| `heroStat()` | Big number display (`#3 → #1`) | Ranking alert, Win celebration, Cold first contact |
| `dataTable()` | Ranking/comparison table | Daily digest, Weekly, Cold first contact |
| `insightBlock()` | AI-generated insight | Daily digest, Weekly, Opportunity |
| `competitorCard()` | Competitor summary | Daily digest, Weekly, Competitor alert, Cold |
| `ctaButton()` | Primary/secondary CTA | Every email |
| `footer()` | Unsubscribe + preferences | Every email |
| `summaryBadge()` | Colored summary strip | Daily digest, Weekly |
| `reviewCard()` | Review quote + stars | Review alert |
| `milestoneCard()` | Celebration display | Win celebration |
| `sparklineChart()` | CSS-based trend line | Weekly summary |

**Composition pattern:**
```typescript
function buildRankingAlertEmail(data: RankingAlertData): string {
  return emailLayout([
    header({ type: 'Ranking Alert', date: data.date }),
    heroStat({ from: data.oldRank, to: data.newRank, keyword: data.keyword }),
    dataTable({ rows: data.context }),
    ctaButton({ text: 'View Details', url: data.dashboardUrl }),
    footer({ unsubscribeUrl: data.unsubscribeUrl }),
  ]);
}
```

**Backward compatibility:** Existing digest output should look identical (or better) after refactoring to use components. Run visual regression by comparing rendered HTML before/after.

### 4.3 Email Send Pipeline — [PLA-306](https://linear.app/plan-b-side-projects/issue/PLA-306)

Central pipeline that every email passes through:

```
[Trigger] → [Build Data] → [Check Eligibility] → [Render Template] → [Log to DB] → [Send SMTP] → [Update Status]
```

**6 eligibility gates (checked in order):**

| # | Check | Fails → |
|---|-------|---------|
| 1 | Email type enabled globally? | Skip, log reason "type_disabled" |
| 2 | Email type enabled for account? (check overrides) | Skip, log reason "account_override_disabled" |
| 3 | User opted out of this type? | Skip, log reason "user_opted_out" |
| 4 | Within frequency cap? | Skip, log reason "frequency_cap_exceeded" |
| 5 | Within quiet hours? | Queue for later, log reason "quiet_hours_queued" |
| 6 | Duplicate of recent email? | Skip, log reason "dedup_filtered" |

**Every email logged** — Even skipped emails get a log entry with `status: 'skipped'` and `error_message` containing the reason. This gives admin full visibility.

**Interface:**
```typescript
interface SendEmailResult {
  sent: boolean;
  emailLogId: string;
  skipReason?: string;
}

async function sendEmail(params: {
  type: EmailType;
  recipientEmail: string;
  recipientName?: string;
  userId?: string;
  accountId?: string;
  appId?: string;
  campaignId?: string;
  buildData: () => Promise<EmailData>;
  renderTemplate: (data: EmailData) => { subject: string; html: string };
}): Promise<SendEmailResult>;
```

### 4.4 Timezone-Aware Scheduling — [PLA-307](https://linear.app/plan-b-side-projects/issue/PLA-307)

**Current:** Fixed `0 5 * * *` UTC for all users.
**New:** Run every 15 minutes, deliver at 8 AM user's local time.

**Algorithm:**
```
Every 15 minutes:
  1. Get all users with emailDigestEnabled = true
  2. For each user:
     a. Convert current UTC time to user's timezone
     b. If local hour = 8 AND local minute < 15:
        c. Check if lastDigestSentAt is already today (user's local date)
        d. If not sent today → build and send digest
        e. Update lastDigestSentAt
```

**Edge cases to handle:**
- DST transitions (user might get two digests or skip one — prefer skip over double)
- Users with no timezone set (default `Europe/Istanbul`)
- Users who change timezone mid-day
- UTC+13/UTC+14 timezones (Samoa, Kiribati)

**Schedule change:**
```
Before: { cron: "0 5 * * *", type: "daily_digest", platform: "shopify" }
After:  { cron: "*/15 * * * *", type: "email_daily_digest" }  // all platforms
```

### 4.5 Unsubscribe + Open/Click Tracking — [PLA-308](https://linear.app/plan-b-side-projects/issue/PLA-308)

**Unsubscribe flow:**
```
Email footer → "Unsubscribe" link with token
                      ↓
        GET /api/emails/unsubscribe/:token
                      ↓
        Show page: "Unsubscribe from [type]?" + "Unsubscribe from all"
                      ↓
        POST /api/emails/unsubscribe/:token
                      ↓
        Update user_email_preferences (or email_prospects for cold)
```

**Headers (every email):**
```
List-Unsubscribe: <https://api.appranks.io/api/emails/unsubscribe/{token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

**Open tracking:**
- Append `<img src="https://api.appranks.io/api/emails/track/open/{emailLogId}.png" width="1" height="1">` to email HTML
- Route returns 1x1 transparent PNG, updates `opened_at`

**Click tracking:**
- Rewrite all `<a href="...">` in email HTML to `https://api.appranks.io/api/emails/track/click/{emailLogId}/{linkIndex}`
- Route 302-redirects to original URL, updates `clicked_at` + increments `click_count`

### 4.6 Admin API Endpoints — [PLA-312](https://linear.app/plan-b-side-projects/issue/PLA-312)

All endpoints under `/api/system-admin/` (requires system admin auth):

**Email Logs:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/emails` | List emails (paginated, filter by type/status/date/recipient) |
| GET | `/emails/:id` | Full detail with HTML body |
| GET | `/emails/stats` | Aggregate stats with period comparison |

**Email Configs:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/email-configs` | List all 15 type configs |
| PATCH | `/email-configs/:type` | Update thresholds, limits |
| POST | `/email-configs/:type/toggle` | Enable/disable globally |

**Account Overrides:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/email-configs/:type/overrides` | List per-account overrides |
| POST | `/email-configs/:type/overrides` | Create override |
| DELETE | `/email-configs/:type/overrides/:id` | Delete override |

**Dry Run:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/emails/dry-run` | Preview without sending |
| POST | `/emails/dry-run/send-test` | Send preview to test address |
| POST | `/emails/dry-run/bulk` | Eligible count + sample subjects |

**Manual:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/emails/send` | Send to specific user/account |
| POST | `/emails/resend/:id` | Resend previous email |

---

## 5. Phase 2: Enhanced Member Emails

> **Goal:** Replace basic daily digest with rich emails + add weekly summary.
> **Depends on:** Phase 1 complete.
> **Tasks:** PLA-315, PLA-316, PLA-319, PLA-322

### 5.1 Enhanced Daily Digest — [PLA-315](https://linear.app/plan-b-side-projects/issue/PLA-315)

**What changes from current digest:**

| Feature | Current | Enhanced |
|---------|---------|----------|
| Sections | Ranking table + competitor metrics | 5 sections (highlight, keywords, categories, competitors, insight) |
| Subject line | Static `"Ranking Report {date}"` | Dynamic based on content sentiment |
| Platforms | Shopify only | All 11 platforms |
| Category rankings | Missing | Included |
| Deep links | None | Every section links to dashboard |
| Insights | None | Rule-based actionable recommendations |
| Visual design | Basic table | Component-based with hero stat |

**Dynamic subject line logic:**
```typescript
function generateDigestSubject(data: DigestData): string {
  const { rankingChanges, summary } = data;

  // Find the most impactful change
  const bestWin = rankingChanges.find(r => r.type === 'improved' && r.todayPosition <= 3);
  const worstDrop = rankingChanges.find(r => r.type === 'dropped' && Math.abs(r.change) >= 3);

  if (bestWin && bestWin.todayPosition === 1) {
    return `Great day! ${data.appName} hit #1 for "${bestWin.keyword}"`;
  }
  if (worstDrop && summary.dropped > summary.improved) {
    return `Heads up: ${data.appName} dropped for "${worstDrop.keyword}"`;
  }
  if (summary.improved > 0 && summary.dropped > 0) {
    return `${data.appName}: ${summary.improved} up, ${summary.dropped} down`;
  }
  return `Daily snapshot — ${data.appName} across ${data.totalKeywords} keywords`;
}
```

**"Insight of the Day" rules** (Phase 2 = rule-based, can upgrade to AI later):
- If competitor gained 3x+ your reviews in 7 days → review velocity insight
- If a keyword has been declining 3+ consecutive days → trend warning
- If you're #2 on a keyword and #1 has lower rating → opportunity hint
- If rating improved but rankings didn't → patience/lagging indicator insight

### 5.2 Weekly Summary — [PLA-316](https://linear.app/plan-b-side-projects/issue/PLA-316)

Aggregated 7-day view. Sent Mondays at 8 AM user local time.

**Data aggregation queries:**
```sql
-- Keyword performance: compare first and last ranking of the week
SELECT keyword_id, app_id,
  FIRST_VALUE(position) OVER (PARTITION BY keyword_id, app_id ORDER BY created_at ASC) as week_start,
  FIRST_VALUE(position) OVER (PARTITION BY keyword_id, app_id ORDER BY created_at DESC) as week_end
FROM app_keyword_rankings
WHERE created_at >= now() - interval '7 days';

-- Review velocity: count new reviews per app
SELECT app_id, COUNT(*) as new_reviews,
  AVG(rating) as avg_rating
FROM app_snapshots
WHERE created_at >= now() - interval '7 days'
GROUP BY app_id;
```

**Key difference from daily:** Weekly shows **trends and patterns**, not just day-over-day snapshots. "You've been climbing on this keyword for 5 days straight" is a weekly insight, not a daily one.

### 5.3 User Email Preferences — [PLA-319](https://linear.app/plan-b-side-projects/issue/PLA-319)

Add to existing Settings page (`/settings`):

**UI sections:**
1. **General** — Timezone selector (already exists), email frequency radio (`realtime/daily/weekly/none`)
2. **Email Types** — Toggle switches for each member email type
3. **Save button** — Writes to `user_email_preferences` table

**API:**
- `GET /api/account/email-preferences` — Returns current user's preferences (merge defaults from `email_type_configs` with overrides from `user_email_preferences`)
- `PATCH /api/account/email-preferences` — Accepts `{ emailType: string, enabled: boolean }[]`

### 5.4 Admin Email Dashboard — [PLA-322](https://linear.app/plan-b-side-projects/issue/PLA-322)

Three pages under `/system-admin/emails`:

**Overview page** — stat cards (sent today/week, open/click rates with delta), filterable log table
**Detail page** — full HTML preview in sandboxed iframe, metadata, resend action
**Settings page** — email type config table with toggles, account override management

See design doc Section 6 for full wireframes.

---

## 6. Phase 3: Real-time Alerts

> **Goal:** Event-driven emails triggered by scraper results.
> **Depends on:** Phase 1 + Phase 2 (pipeline, components, configs in place).
> **Tasks:** PLA-324, PLA-326, PLA-330, PLA-332, PLA-336

### 6.1 How Event-Driven Triggers Work

Real-time alerts are **not scheduled by cron**. They're triggered inline during scraper processing:

```
Scraper Job (keyword/app_details/reviews)
  ↓ processes results
  ↓ writes to ranking/snapshot tables
  ↓ THEN: checks for significant changes
  ↓ IF significant → enqueue email job to BullMQ
  ↓
Email Worker picks up job
  ↓ runs through pipeline (eligibility, freq cap, quiet hours)
  ↓ builds data, renders template, sends
```

**Integration points in existing scrapers:**

| Scraper | Hook Point | Triggers |
|---------|-----------|----------|
| `KeywordScraper` | After `appKeywordRankings` insert | Ranking alert (PLA-324) |
| `AppDetailsScraper` | After `appFieldChanges` insert | Competitor alert (PLA-326) |
| `ReviewScraper` | After new reviews detected | Review alert (PLA-330) |
| `CategoryScraper` | After `appCategoryRankings` insert | Ranking alert (PLA-324) |
| Post-processing (any) | After all scraper results | Win celebration (PLA-332) |

### 6.2 Ranking Alert — [PLA-324](https://linear.app/plan-b-side-projects/issue/PLA-324)

**Trigger thresholds (configurable in `email_type_configs.config`):**
```json
{
  "minPositionChange": 5,
  "triggerOnTop3Entry": true,
  "triggerOnTop3Exit": true,
  "triggerOnKeywordEntryExit": true,
  "categoryChangeThreshold": 3
}
```

**Who receives it:** All users in accounts that track the affected app + keyword. Lookup chain:
```
appKeywordRankings change detected
  → find accountTrackedApps matching app_id
    → find accountTrackedKeywords matching keyword_id + account
      → find users in those accounts with ranking_alert enabled
```

### 6.3 Competitor Alert — [PLA-326](https://linear.app/plan-b-side-projects/issue/PLA-326)

**5 trigger conditions:**
1. **Overtake** — Competitor moved above user's app on a shared keyword
2. **Featured** — Competitor appeared in featured apps
3. **Review surge** — 10+ reviews in 24h (configurable)
4. **Pricing change** — Price field changed in app snapshot
5. **Listing update** — Description, tagline, or features changed

**Who receives it:** Users whose `accountCompetitorApps` includes the changed app.

### 6.4 Review Alert — [PLA-330](https://linear.app/plan-b-side-projects/issue/PLA-330)

**New review detection:** Compare current review list with previous scrape's list. Reviews with new `reviewId` or `createdAt` are new.

**Configurable options:**
- Alert on all reviews vs. only negative (1-2 stars)
- Alert for user's apps only vs. also competitors

### 6.5 Win Celebration — [PLA-332](https://linear.app/plan-b-side-projects/issue/PLA-332)

**Milestone detection runs after ranking processing:**

```typescript
interface Milestone {
  type: 'rank_1' | 'top_3' | 'rating_threshold' | 'review_count' | 'best_period' | 'competitor_overtake';
  appId: string;
  details: Record<string, any>;
}

function detectMilestones(appId: string, currentRankings: Ranking[], currentMetrics: AppMetrics): Milestone[] {
  const milestones: Milestone[] = [];

  // Check: reached #1 for any keyword
  for (const ranking of currentRankings) {
    if (ranking.position === 1 && ranking.previousPosition > 1) {
      milestones.push({ type: 'rank_1', appId, details: { keyword: ranking.keyword, from: ranking.previousPosition } });
    }
  }

  // Check: review count crossed milestone (100, 250, 500, 1000)
  const thresholds = [100, 250, 500, 1000];
  for (const threshold of thresholds) {
    if (currentMetrics.reviewCount >= threshold && currentMetrics.previousReviewCount < threshold) {
      milestones.push({ type: 'review_count', appId, details: { count: threshold } });
    }
  }

  // ... other checks
  return milestones;
}
```

**Dedup:** Store celebrated milestones (e.g., in `email_logs` metadata or a dedicated column) to avoid re-celebrating the same milestone.

### 6.6 Alert Batching & Quiet Hours — [PLA-336](https://linear.app/plan-b-side-projects/issue/PLA-336)

**Problem:** A single keyword scrape might trigger 5 ranking alerts for one user.
**Solution:** Accumulate alerts in a Redis-based buffer, flush after a window.

**Batching flow:**
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

**Quiet hours:**
```
Alert triggered → Is it quiet hours for this user? (22:00-07:00 local)
  YES → Add to quiet queue (Redis key: email:quiet:{userId})
  NO  → Normal batching flow

Cron every 15 min → For each user exiting quiet hours (local 07:00):
  Flush quiet queue → batch into single morning summary
```

---

## 7. Phase 4: Engagement Emails

> **Goal:** Lifecycle emails for new user onboarding and inactive user win-back.
> **Depends on:** Phase 1 (pipeline, templates).
> **Tasks:** PLA-339, PLA-342, PLA-345

### 7.1 Welcome + Onboarding Series — [PLA-339](https://linear.app/plan-b-side-projects/issue/PLA-339)

**Trigger chain:**

```
User registers (POST /api/register)
  ↓
Immediately: Enqueue SYSTEM_WELCOME email job
  ↓
Schedule delayed jobs:
  - SYSTEM_ONBOARDING_DAY1 → delay: 24h
  - SYSTEM_ONBOARDING_DAY3 → delay: 72h
  - SYSTEM_ONBOARDING_DAY7 → delay: 168h
```

**Onboarding intelligence:** Each onboarding email checks what the user has set up:

| Day | User has no app tracked | User has app, no keywords | User fully set up |
|-----|------------------------|--------------------------|-------------------|
| 1 | "Add your first app" CTA | "Now add keywords" CTA | "Here's how to read your first digest" |
| 3 | "Here's what you're missing" with sample data | "We found 10 keywords for your app" | Mini report with first data |
| 7 | Final nudge with compelling sample | Feature showcase (research, tags) | Week-1 summary + upgrade CTA |

**Cancel conditions:** If user becomes active (lastSeenAt updated), skip remaining onboarding emails — they've already engaged.

### 7.2 Re-engagement — [PLA-342](https://linear.app/plan-b-side-projects/issue/PLA-342)

**Detection:** Daily cron at 10 AM UTC checks `users.lastSeenAt`:
```sql
SELECT * FROM users
WHERE email_digest_enabled = true
  AND last_seen_at < now() - interval '14 days'
  AND last_seen_at IS NOT NULL
  AND id NOT IN (
    SELECT user_id FROM email_logs
    WHERE email_type = 'system_reengagement'
      AND created_at > now() - interval '14 days'
  );
```

**Content strategy:** Show them what they missed, not what they're missing. Concrete data changes since their last visit create urgency to return.

### 7.3 Opportunity Alert — [PLA-345](https://linear.app/plan-b-side-projects/issue/PLA-345)

**5 opportunity detection algorithms:**

| Type | Logic | Impact Score |
|------|-------|-------------|
| Low competition | App #4-#10, apps above have rating < user's rating | High |
| Momentum | 3+ consecutive position improvements on a keyword | Medium |
| Near top-3 | App at #4 or #5, within striking distance | High |
| Untracked high-value | Competitor ranks for keyword user doesn't track | Medium |
| Category near top-10 | Category rank #11-#13 | Low |

**Scoring:** Each opportunity gets an impact score. Email shows top 3 by score. Score considers: position gap, rating advantage, review count difference, trend direction.

---

## 8. Phase 5: Cold Email System

> **Goal:** User acquisition through data-driven outreach.
> **Depends on:** Phase 1 (pipeline, templates, tracking).
> **Tasks:** PLA-348, PLA-350, PLA-352

### 8.1 Campaign & Prospect Management — [PLA-348](https://linear.app/plan-b-side-projects/issue/PLA-348)

**Prospect sources:**
- Manual entry (admin enters email + app)
- CSV import (bulk)
- Auto-discovery from scraped developer data (future enhancement)

**Prospect lifecycle:**
```
new → contacted (first email sent) → responded (clicked/replied) → converted (signed up) → [done]
                                   → unsubscribed → [never contact again]
```

**Campaign lifecycle:**
```
draft → active (sending) → paused → active → completed
```

**Conversion tracking:** When a prospect signs up, match registration email against `email_prospects.email`. Auto-update status to `converted`, increment campaign `total_converted`.

### 8.2 Cold First Contact — [PLA-350](https://linear.app/plan-b-side-projects/issue/PLA-350)

The highest-value email. Before sending, the system generates:

```typescript
interface ColdEmailData {
  prospect: { name: string; email: string };
  app: {
    name: string; slug: string; platform: string;
    rating: number; reviewCount: number;
    categoryName: string; categoryRank: number;
    categoryAvgRating: number;
  };
  keywords: Array<{
    keyword: string; position: number;
    previousPosition: number; change: number;
  }>;  // top 10
  competitors: Array<{
    name: string; rating: number; reviewCount: number;
    beatsOnKeywords: string[];
    losesOnKeywords: string[];
  }>;  // top 3
}
```

**Data generation sequence:**
1. Fetch app from `apps` table (rating, reviews, category)
2. Fetch category ranking from `appCategoryRankings`
3. Fetch keyword rankings from `appKeywordRankings` (or generate via AI suggestions if not tracked)
4. Fetch competitors from same category with similar keywords
5. Compute competitive comparison (who beats whom on which keywords)

**Rate limit:** Max 50 cold emails per day (warm up gradually).

### 8.3 Cold Follow-ups — [PLA-352](https://linear.app/plan-b-side-projects/issue/PLA-352)

**Follow-up Nudge:**
- Triggered 3-7 days after first contact
- Only if prospect hasn't clicked or signed up
- Shows changes that happened since first email (proving the data is live)
- Much shorter than first contact

**Cold Competitive Alert:**
- Triggered when a significant competitor move is detected for a prospected app
- Max 1 per prospect per campaign
- Highest conversion potential — time-sensitive competitive intelligence

---

## 9. Phase 6: Polish & Deliverability

> **Goal:** Complete admin tools + ensure emails actually reach inboxes.
> **Tasks:** PLA-353, PLA-355

### 9.1 Dry Run System — [PLA-353](https://linear.app/plan-b-side-projects/issue/PLA-353)

**Three modes:**

| Mode | Input | Output |
|------|-------|--------|
| Single preview | Email type + user/account/app | Rendered HTML + subject + data JSON |
| Send test | Above + test email address | Actual email sent to test address (marked `is_dry_run`) |
| Bulk preview | Email type only | Eligible count, skip count (with reasons), 5-10 sample subjects |

**Historical replay:** Admin selects a past date → system uses snapshot data from that date to generate what the email *would have looked like*. Useful for demonstrating the system to stakeholders.

### 9.2 Email Deliverability — [PLA-355](https://linear.app/plan-b-side-projects/issue/PLA-355)

**DNS records for `appranks.io`:**
```
TXT  appranks.io          "v=spf1 include:_spf.<provider>.com ~all"
TXT  dkim._domainkey      "v=DKIM1; k=rsa; p=<public_key>"
TXT  _dmarc.appranks.io   "v=DMARC1; p=quarantine; rua=mailto:dmarc@appranks.io"
CNAME bounces.appranks.io  <provider_bounce_domain>
```

**Bounce handling:**
- Hard bounce → auto-disable email for that address
- Soft bounce (3 consecutive) → auto-disable
- Complaint → auto-unsubscribe + flag in admin

---

## 10. Email Catalogue — All 15 Email Types

### Quick Reference Table

| # | Type | Trigger | Frequency | Subject Pattern | Task |
|---|------|---------|-----------|-----------------|------|
| 1 | Daily Digest | Cron (8 AM local) | Daily | `{app}: 3 up, 2 down — "{keyword}" hits #1` | PLA-315 |
| 2 | Weekly Summary | Cron (Mon 8 AM local) | Weekly | `Week in review: {app} up on 8 keywords` | PLA-316 |
| 3 | Ranking Alert | Keyword scraper | Real-time | `{app} jumped from #15 to #6 for "{keyword}"` | PLA-324 |
| 4 | Competitor Alert | App details/review scraper | Real-time | `{comp} overtook {app} for "{keyword}"` | PLA-326 |
| 5 | Review Alert | Review scraper | Real-time | `New 5-star review for {app}: "{snippet}"` | PLA-330 |
| 6 | Win Celebration | Post-processing | Event | `{app} hit #1 for "{keyword}"!` | PLA-332 |
| 7 | Opportunity | Cron (Sat morning) | Weekly | `3 keywords where {app} could reach top 3` | PLA-345 |
| 8 | Welcome | Registration | Once | `Welcome to AppRanks, {name}!` | PLA-339 |
| 9 | Onboarding Day 1 | 24h post-reg | Once | `Your first step: add your app` | PLA-339 |
| 10 | Onboarding Day 3 | 72h post-reg | Once | `Here's what we found for {app}` | PLA-339 |
| 11 | Onboarding Day 7 | 168h post-reg | Once | `Your first week on AppRanks` | PLA-339 |
| 12 | Re-engagement | Inactivity 14d+ | Max 1/14d | `While you were away: 8 ranking changes` | PLA-342 |
| 13 | Cold First Contact | Admin/campaign | Once | `Your app "{app}" ranks #7 for "{keyword}"` | PLA-350 |
| 14 | Cold Follow-up | Auto (3-7d after) | Once | `{app} dropped 2 spots since we checked` | PLA-352 |
| 15 | Cold Competitive | Competitor move | Max 1/prospect | `{comp} hit #1 — {app} is now #4` | PLA-352 |

### Email Components Used per Type

| Email Type | header | heroStat | dataTable | insight | competitor | cta | footer | summary | review | milestone |
|------------|--------|----------|-----------|---------|------------|-----|--------|---------|--------|-----------|
| Daily Digest | x | x | x | x | x | x | x | x | | |
| Weekly Summary | x | | x | x | x | x | x | x | | |
| Ranking Alert | x | x | x | | | x | x | | | |
| Competitor Alert | x | x | | | x | x | x | | | |
| Review Alert | x | | | | | x | x | | x | |
| Win Celebration | x | | | | | x | x | | | x |
| Opportunity | x | | x | x | | x | x | | | |
| Welcome | x | | | | | x | x | | | |
| Onboarding | x | | x | | | x | x | | | |
| Re-engagement | x | x | | | | x | x | x | | |
| Cold First Contact | x | | x | | x | x | x | | | |
| Cold Follow-up | x | | x | | x | x | x | | | |
| Cold Competitive | x | x | | | x | x | x | | | |

---

## 11. Data Flow & Integration Map

### Which DB Tables Feed Which Emails

```
appKeywordRankings ────→ Daily Digest, Weekly, Ranking Alert, Opportunity, Cold
appCategoryRankings ───→ Daily Digest, Weekly, Ranking Alert, Cold
appSnapshots ──────────→ Daily Digest, Weekly, Competitor Alert, Cold
appFieldChanges ───────→ Competitor Alert
appReviewMetrics ──────→ Weekly, Review Alert, Win Celebration
accountTrackedApps ────→ All member emails (determines recipients)
accountTrackedKeywords → All member emails (determines which keywords to report)
accountCompetitorApps ─→ All competitor-related emails
users ─────────────────→ All emails (timezone, preferences, lastSeenAt)
email_type_configs ────→ Pipeline eligibility check
email_logs ────────────→ Frequency cap, dedup, admin dashboard
email_prospects ───────→ Cold emails
```

### Scraper → Email Trigger Map

```
KeywordScraper.processResults()
  ↓ writes appKeywordRankings
  ↓ calls checkRankingAlerts()  ──→ email_ranking_alert job     (PLA-324)
  ↓ calls checkMilestones()     ──→ email_win_celebration job   (PLA-332)

AppDetailsScraper.processResults()
  ↓ writes appSnapshots + appFieldChanges
  ↓ calls checkCompetitorChanges() ──→ email_competitor_alert job (PLA-326)

ReviewScraper.processResults()
  ↓ writes review data
  ↓ calls checkNewReviews()     ──→ email_review_alert job      (PLA-330)
  ↓ calls checkReviewMilestones() ──→ email_win_celebration job  (PLA-332)

CategoryScraper.processResults()
  ↓ writes appCategoryRankings
  ↓ calls checkCategoryAlerts() ──→ email_ranking_alert job      (PLA-324)
```

---

## 12. Frequency & Throttling Rules

### Per-Type Limits

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
| Cold First Contact | — | — | Once per prospect | N/A |
| Cold Follow-up | — | 1 | 3d after last | N/A |
| Cold Competitive | — | — | Once per prospect | N/A |

### Global Limits

| Rule | Value |
|------|-------|
| Max emails per user per day (all types combined) | 10 |
| Max cold emails per day (system-wide) | 50 |
| Quiet hours (default) | 22:00 - 07:00 user local time |
| Alert batch window | 30 minutes |

### Deduplication Rules

- Same email type + same user + same primary data (keyword/app/competitor) within cooldown → skip
- Dedup key: `{emailType}:{userId}:{primaryEntityId}`
- Stored in Redis with TTL = cooldown duration

---

## 13. Email Design Language

### Design Tokens — [PLA-305](https://linear.app/plan-b-side-projects/issue/PLA-305)

```
Brand:     #6366f1 (indigo)     Background: #f9fafb (light gray)
Dark:      #111827              Card:       #ffffff
Text:      #111827 (primary)    Text:       #6b7280 (secondary)

Status:    #16a34a (green/up)   #dc2626 (red/down)
           #2563eb (blue/new)   #f59e0b (amber/warning)
           #8b5cf6 (purple/win)

Font:      -apple-system, Segoe UI, Roboto, sans-serif
Mono:      SF Mono, Fira Code, monospace (for ranks/numbers)
Max-width: 640px
```

### Subject Line Principles

1. Lead with the specific data point, never generic
2. Include app name or competitor name
3. Use numbers (rankings, counts, changes)
4. Under 60 characters for mobile preview
5. No ALL CAPS, minimal punctuation

### Rendering Rules

- Inline CSS only (Gmail strips `<style>` blocks)
- Table-based layout (Outlook compatibility)
- Single column (no multi-column — breaks everywhere)
- Min touch target: 44x44px for buttons
- Dark mode: `@media (prefers-color-scheme: dark)` with fallback
- Images: `alt` text always set, `width`/`height` attributes for layout stability

---

## 14. Testing Strategy

### Unit Tests (required for all tasks)

| Layer | What to Test | Example |
|-------|-------------|---------|
| Builders | Data aggregation returns correct structure | `dailyDigestBuilder` returns changes grouped by type |
| Templates | HTML rendering includes all sections | `rankingAlertTemplate` contains hero stat + context |
| Pipeline | Eligibility checks pass/fail correctly | Disabled type → skip; within cap → pass |
| Frequency cap | Correctly counts recent sends | 5 ranking alerts today → 6th blocked |
| Batching | Groups alerts within window | 3 alerts in 10 min → single batched email |
| Quiet hours | Timezone calculation correct | UTC 02:00, user in EST → local 21:00 → not quiet |
| Milestone detection | Each milestone type detected | App hits #1 → `rank_1` milestone returned |
| Opportunity detection | Algorithms find valid opportunities | App #6 with higher rating than #4/#5 → opportunity |
| Subject generation | Dynamic subjects match content | Win day → "Great day!" pattern |
| Unsubscribe | Token validates and updates preferences | Valid token → preference updated, email stops |

### Integration Tests

| Scenario | What to Verify |
|----------|---------------|
| Full digest flow | Cron → builder → pipeline → SMTP mock → email_logs entry |
| Alert trigger → send | Keyword scraper result → ranking alert → email sent |
| Frequency cap in action | Send 5 ranking alerts → 6th is blocked with correct reason |
| Quiet hours queue → morning flush | Alert at 2 AM → queued → sent at 7 AM |
| Unsubscribe flow | Click link → update preference → next email skipped |
| Dry run | Generate preview → no email sent, no email_log with `sent` status |
| Cold campaign | Create campaign → add prospects → send → track opens/clicks → conversion |

### Manual Testing Checklist

- [ ] Render emails in Gmail, Outlook, Apple Mail, Yahoo
- [ ] Mobile rendering (iPhone, Android Gmail)
- [ ] Dark mode rendering
- [ ] Unsubscribe link works
- [ ] Open tracking pixel fires
- [ ] Click tracking redirects correctly
- [ ] Frequency cap blocks excess emails
- [ ] Quiet hours queues and flushes correctly
- [ ] Admin dashboard shows all sent emails
- [ ] Dry run generates accurate preview

---

## 15. Metrics & Success Criteria

### KPIs by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 2 | Daily digest open rate | > 35% |
| Phase 2 | Weekly summary open rate | > 40% |
| Phase 3 | Ranking alert click rate | > 15% |
| Phase 3 | Alert → dashboard visit rate | > 20% |
| Phase 4 | Onboarding completion (all 3 setup steps) | > 50% |
| Phase 4 | Re-engagement return rate (login within 7d) | > 10% |
| Phase 5 | Cold email open rate | > 25% |
| Phase 5 | Cold email → signup conversion | > 5% |

### Dashboard Metrics (PLA-322)

- **Sent volume:** by type, by day/week/month
- **Open rate:** by type, trend over time
- **Click rate:** by type, by link position
- **Unsubscribe rate:** by type (should be < 0.5%)
- **Bounce rate:** hard + soft (should be < 2%)
- **Conversion rate:** cold emails → signups

---

## 16. Risk Analysis & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Emails land in spam | High | Medium | SPF/DKIM/DMARC setup (PLA-355), warm-up gradually, monitor deliverability |
| Alert flood overwhelms users | Medium | High | Frequency caps (PLA-306), batching (PLA-336), quiet hours |
| Cold emails cause domain reputation damage | High | Medium | Rate limit 50/day, dedicated subdomain for cold, monitor complaints |
| Template breaks in Outlook | Low | High | Table-based layout (PLA-305), test in Litmus/Email on Acid |
| User data in email is stale | Low | Medium | Build data at send-time, not at queue-time |
| GDPR violation via cold email | High | Low | Business emails only, immediate unsubscribe, physical address in footer |
| Timezone bugs cause double-sends | Medium | Medium | `lastDigestSentAt` check, Redis dedup key with date |
| Pipeline bottleneck during bulk send | Medium | Low | BullMQ concurrency control, rate-limit SMTP sends |

---

## Appendix: Task Dependency Graph

```
Phase 1 (Foundation)
  PLA-304 (Schema) ─────────────────────┐
  PLA-305 (Templates) ──────────────────┤
  PLA-306 (Pipeline) ───────────────────┤─→ Phase 2, 3, 4, 5 all depend on these
  PLA-307 (Timezone) ───────────────────┤
  PLA-308 (Tracking/Unsub) ────────────┤
  PLA-312 (Admin API) ─────────────────┘

Phase 2 (Member Emails)
  PLA-315 (Daily Digest) ──→ needs PLA-304, 305, 306, 307
  PLA-316 (Weekly Summary) ─→ needs PLA-304, 305, 306, 307
  PLA-319 (User Prefs UI) ──→ needs PLA-304, 312
  PLA-322 (Admin Dashboard) → needs PLA-304, 312

Phase 3 (Alerts)
  PLA-324 (Ranking Alert) ──→ needs PLA-304, 305, 306
  PLA-326 (Competitor Alert) → needs PLA-304, 305, 306
  PLA-330 (Review Alert) ───→ needs PLA-304, 305, 306
  PLA-332 (Win Celebration) → needs PLA-304, 305, 306
  PLA-336 (Batching) ───────→ needs PLA-324, 326, 330 (builds on top of alerts)

Phase 4 (Engagement)
  PLA-339 (Welcome/Onboarding) → needs PLA-304, 305, 306
  PLA-342 (Re-engagement) ─────→ needs PLA-304, 305, 306
  PLA-345 (Opportunity) ────────→ needs PLA-304, 305, 306

Phase 5 (Cold)
  PLA-348 (Campaigns) ──────→ needs PLA-304, 306, 308
  PLA-350 (First Contact) ──→ needs PLA-348, 305
  PLA-352 (Follow-ups) ─────→ needs PLA-348, 350

Phase 6 (Polish)
  PLA-353 (Dry Run) ────────→ needs PLA-312, 305, all builders
  PLA-355 (Deliverability) ─→ independent (DNS config)
```

---

## Appendix: Linear Task Quick Reference

| Task | Title | Phase | Priority |
|------|-------|-------|----------|
| [PLA-304](https://linear.app/plan-b-side-projects/issue/PLA-304) | Create database schema for email system | 1 | Urgent |
| [PLA-305](https://linear.app/plan-b-side-projects/issue/PLA-305) | Build component-based email template engine | 1 | Urgent |
| [PLA-306](https://linear.app/plan-b-side-projects/issue/PLA-306) | Build email send pipeline with eligibility checks | 1 | Urgent |
| [PLA-307](https://linear.app/plan-b-side-projects/issue/PLA-307) | Implement timezone-aware email scheduling | 1 | High |
| [PLA-308](https://linear.app/plan-b-side-projects/issue/PLA-308) | Implement unsubscribe system and open/click tracking | 1 | High |
| [PLA-312](https://linear.app/plan-b-side-projects/issue/PLA-312) | Create admin API endpoints for email management | 1 | High |
| [PLA-315](https://linear.app/plan-b-side-projects/issue/PLA-315) | Build enhanced daily digest email | 2 | High |
| [PLA-316](https://linear.app/plan-b-side-projects/issue/PLA-316) | Build weekly summary email | 2 | High |
| [PLA-319](https://linear.app/plan-b-side-projects/issue/PLA-319) | Build user email preferences page in dashboard | 2 | Medium |
| [PLA-322](https://linear.app/plan-b-side-projects/issue/PLA-322) | Build admin email management dashboard | 2 | Medium |
| [PLA-324](https://linear.app/plan-b-side-projects/issue/PLA-324) | Build ranking alert email with event triggers | 3 | High |
| [PLA-326](https://linear.app/plan-b-side-projects/issue/PLA-326) | Build competitor alert email | 3 | High |
| [PLA-330](https://linear.app/plan-b-side-projects/issue/PLA-330) | Build review alert email | 3 | Medium |
| [PLA-332](https://linear.app/plan-b-side-projects/issue/PLA-332) | Build win celebration email with milestone detection | 3 | Medium |
| [PLA-336](https://linear.app/plan-b-side-projects/issue/PLA-336) | Build alert batching and quiet hours system | 3 | Medium |
| [PLA-339](https://linear.app/plan-b-side-projects/issue/PLA-339) | Build welcome email and onboarding series | 4 | Medium |
| [PLA-342](https://linear.app/plan-b-side-projects/issue/PLA-342) | Build re-engagement email for inactive users | 4 | Medium |
| [PLA-345](https://linear.app/plan-b-side-projects/issue/PLA-345) | Build opportunity alert email with weekly analysis | 4 | Medium |
| [PLA-348](https://linear.app/plan-b-side-projects/issue/PLA-348) | Build cold email prospect management and campaign system | 5 | Low |
| [PLA-350](https://linear.app/plan-b-side-projects/issue/PLA-350) | Build cold first contact email with auto-generated insights | 5 | Low |
| [PLA-352](https://linear.app/plan-b-side-projects/issue/PLA-352) | Build cold follow-up nudge and cold competitive alert | 5 | Low |
| [PLA-353](https://linear.app/plan-b-side-projects/issue/PLA-353) | Build dry run system with preview and bulk mode | 6 | Low |
| [PLA-355](https://linear.app/plan-b-side-projects/issue/PLA-355) | Configure email deliverability (SPF, DKIM, DMARC) | 6 | Low |
