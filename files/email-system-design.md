# Email System Design Document

> AppRanks.io Email Marketing & Notification System
> Created: 2026-03-29

---

## Table of Contents

1. [Vision & Strategy](#1-vision--strategy)
2. [Email Categories](#2-email-categories)
3. [Cold Emails (Prospecting)](#3-cold-emails-prospecting)
4. [Member Emails (Retention & Engagement)](#4-member-emails-retention--engagement)
5. [Email Design System](#5-email-design-system)
6. [Admin Dashboard — Email Management](#6-admin-dashboard--email-management)
7. [Dry Run System](#7-dry-run-system)
8. [Database Schema](#8-database-schema)
9. [API Endpoints](#9-api-endpoints)
10. [Worker & Scheduling](#10-worker--scheduling)
11. [Email Deliverability & Compliance](#11-email-deliverability--compliance)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Vision & Strategy

### The Problem
AppRanks tracks 11 marketplace platforms with rich data — keyword rankings, category positions, competitor movements, review metrics, featured placements. This data is **extremely valuable** to app developers, but they only see it when they log into the dashboard.

### The Opportunity
Email is the highest-ROI marketing channel. By delivering **timely, personalized, data-driven insights** directly to inboxes, we can:

1. **Acquire users** — Cold outreach showing app owners data they didn't know existed about their own app
2. **Retain users** — Regular updates that make AppRanks indispensable
3. **Re-engage churned users** — "While you were away, here's what changed"
4. **Upsell** — Show free-tier users what premium tracking reveals

### Core Principles
- **Every email must deliver value** — No "just checking in" emails. Every email contains actionable data.
- **Dynamic, not template** — Each email is uniquely generated from real-time data for that specific recipient/app.
- **Respect the inbox** — Smart frequency capping, easy unsubscribe, preference controls.
- **Beautiful design** — Emails should look as polished as the dashboard itself.

---

## 2. Email Categories

### Category Matrix

| Category | Target | Trigger | Goal |
|----------|--------|---------|------|
| **Cold: First Contact** | Non-users (app owners) | Manual/batch by admin | Acquisition |
| **Cold: Follow-up Nudge** | Non-users who didn't respond | 3-7 days after first contact | Acquisition |
| **Cold: Competitive Alert** | Non-users | Competitor made a significant move | Acquisition |
| **Member: Daily Digest** | Active members | Daily cron (existing, enhanced) | Retention |
| **Member: Weekly Summary** | Active members | Weekly cron | Retention |
| **Member: Ranking Alert** | Active members | Real-time trigger | Engagement |
| **Member: Competitor Alert** | Active members | Real-time trigger | Engagement |
| **Member: Opportunity Alert** | Active members | Weekly analysis | Upsell/Value |
| **Member: Review Alert** | Active members | New review detected | Engagement |
| **Member: Win Celebration** | Active members | Positive milestone | Retention |
| **System: Welcome** | New members | Registration | Onboarding |
| **System: Onboarding Series** | New members | Days 1, 3, 7 after signup | Onboarding |
| **System: Re-engagement** | Inactive members | 14+ days inactive | Win-back |

### Email Type Registry

```typescript
enum EmailType {
  // Cold outreach
  COLD_FIRST_CONTACT = 'cold_first_contact',
  COLD_FOLLOWUP_NUDGE = 'cold_followup_nudge',
  COLD_COMPETITIVE_ALERT = 'cold_competitive_alert',

  // Member notifications
  MEMBER_DAILY_DIGEST = 'member_daily_digest',
  MEMBER_WEEKLY_SUMMARY = 'member_weekly_summary',
  MEMBER_RANKING_ALERT = 'member_ranking_alert',
  MEMBER_COMPETITOR_ALERT = 'member_competitor_alert',
  MEMBER_OPPORTUNITY_ALERT = 'member_opportunity_alert',
  MEMBER_REVIEW_ALERT = 'member_review_alert',
  MEMBER_WIN_CELEBRATION = 'member_win_celebration',

  // System
  SYSTEM_WELCOME = 'system_welcome',
  SYSTEM_ONBOARDING_DAY1 = 'system_onboarding_day1',
  SYSTEM_ONBOARDING_DAY3 = 'system_onboarding_day3',
  SYSTEM_ONBOARDING_DAY7 = 'system_onboarding_day7',
  SYSTEM_REENGAGEMENT = 'system_reengagement',
}
```

---

## 3. Cold Emails (Prospecting)

### 3.1 First Contact Email

**Trigger:** Admin selects an app and initiates cold outreach to the app's developer contact.

**Prerequisite Data:** Before sending, the system auto-generates:
- Top 10 relevant keywords (from AI keyword suggestions or existing tracked data)
- Current ranking positions for those keywords
- Category ranking position
- Top 3 competitors in the same category
- Rating/review comparison vs competitors

**Subject Line Examples** (dynamic, A/B testable):
- `Your app "{appName}" ranks #7 for "{topKeyword}" — here's what that means`
- `{appName}: 3 keywords where you're losing to {competitorName}`
- `{appName} dropped from #3 to #8 in {categoryName} this week`
- `How {competitorName} overtook {appName} for "{keyword}"`

**Email Structure:**

```
┌─────────────────────────────────────────────────┐
│  AppRanks logo (subtle, not pushy)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Hi {developerName},                            │
│                                                 │
│  We've been tracking {platform} marketplace     │
│  data and found some interesting insights       │
│  about {appName}.                               │
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │  📊 YOUR APP AT A GLANCE               │    │
│  │                                         │    │
│  │  Category: {categoryName}               │    │
│  │  Category Rank: #{categoryRank}         │    │
│  │  Rating: ⭐ {rating} ({reviewCount})    │    │
│  │  vs Category Avg: ⭐ {avgRating}        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
├─────────────────────────────────────────────────┤
│  🔍 KEYWORD RANKINGS                           │
│                                                 │
│  ┌──────────────────────┬──────┬───────────┐    │
│  │ Keyword              │ Rank │ Trend     │    │
│  ├──────────────────────┼──────┼───────────┤    │
│  │ "crm integration"    │  #3  │ ▲ +2      │    │
│  │ "customer support"   │  #12 │ ▼ -4      │    │
│  │ "helpdesk"           │  #7  │ — steady  │    │
│  │ "ticket management"  │  #21 │ ▼ -8      │    │
│  │ "live chat"          │  #5  │ ▲ +1      │    │
│  └──────────────────────┴──────┴───────────┘    │
│                                                 │
│  You're ranking for 47 keywords total.          │
│  5 of those dropped this week.                  │
│                                                 │
├─────────────────────────────────────────────────┤
│  ⚔️ YOUR TOP COMPETITORS                       │
│                                                 │
│  1. {comp1Name} — ⭐ {rating} ({reviews})      │
│     Beating you on: "helpdesk", "live chat"     │
│                                                 │
│  2. {comp2Name} — ⭐ {rating} ({reviews})      │
│     You beat them on: "crm integration"         │
│                                                 │
│  3. {comp3Name} — ⭐ {rating} ({reviews})      │
│     Neck and neck on 4 keywords                 │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  This is just a snapshot. AppRanks tracks       │
│  these metrics daily across 11 marketplaces.    │
│                                                 │
│  ┌─────────────────────────────────────┐        │
│  │  See Your Full Dashboard →          │        │
│  └─────────────────────────────────────┘        │
│                                                 │
│  No signup required to see your data.           │
│  We've already set up tracking for {appName}.   │
│                                                 │
├─────────────────────────────────────────────────┤
│  Unsubscribe · AppRanks.io                      │
└─────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- Lead with **their data**, not our product
- Show enough value to create curiosity, but not so much they don't need to visit
- "No signup required" removes friction — link goes to a public app profile page
- Competitor comparison creates urgency

### 3.2 Follow-up Nudge Email

**Trigger:** 3-7 days after First Contact, if no click/signup detected.

**Subject Line Examples:**
- `{appName} just dropped 2 spots for "{keyword}" since we last checked`
- `Update: {competitorName} added 12 new reviews this week`
- `Quick update on {appName}'s marketplace position`

**Content:** Short, focused on ONE significant change since the first email. Creates urgency by showing the data is alive and changing.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Since our last email 5 days ago:               │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  {appName}                              │    │
│  │                                         │    │
│  │  "customer support"  #12 → #15  ▼ -3   │    │
│  │  "helpdesk"          #7  → #7   —       │    │
│  │  "live chat"         #5  → #3   ▲ +2   │    │
│  │                                         │    │
│  │  Meanwhile, {competitorName} climbed    │    │
│  │  from #8 to #4 for "customer support"   │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Track these changes daily →                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3.3 Cold Competitive Alert

**Trigger:** A competitor of a prospected app makes a significant move (ranking jump, new featured placement, review surge).

**Subject Line Examples:**
- `Alert: {competitorName} just hit #1 for "{keyword}" — {appName} is now #4`
- `{competitorName} got featured in {categoryName} — are you tracking this?`

**Content:** Focused entirely on the competitive threat. Shows the specific move, the impact, and what it means for the recipient's app.

---

## 4. Member Emails (Retention & Engagement)

### 4.1 Enhanced Daily Digest

**Upgrade from existing digest.** Current digest shows ranking changes + competitor metrics. Enhanced version adds:

**Subject Line** (dynamic, changes based on content):
- Best day: `Great day! {appName} climbed to #2 for "{keyword}" (+5 positions)`
- Alert day: `Heads up: {appName} lost #1 position for "{topKeyword}"`
- Mixed day: `{appName}: 3 keywords up, 2 down — "{topKeyword}" hits #1`
- Quiet day: `Your daily snapshot — {appName} holding steady across 15 keywords`

**Enhanced Structure:**

```
┌─────────────────────────────────────────────────┐
│  AppRanks · Daily Report · March 29, 2026       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  TODAY'S HIGHLIGHT                      │    │
│  │                                         │    │
│  │  🎯 {appName} reached #1 for            │    │
│  │     "project management" for the         │    │
│  │     first time in 30 days!               │    │
│  │                                         │    │
│  │  ─── or ───                             │    │
│  │                                         │    │
│  │  ⚠️ {competitorName} overtook you for   │    │
│  │     "task automation" — you dropped      │    │
│  │     from #2 to #5                        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
├─────────────────────────────────────────────────┤
│  KEYWORD PERFORMANCE        5↑  2↓  8→         │
│                                                 │
│  Biggest wins:                                  │
│  ▲ "project management"    #3 → #1  (+2)       │
│  ▲ "team collaboration"    #8 → #5  (+3)       │
│                                                 │
│  Needs attention:                               │
│  ▼ "task automation"       #2 → #5  (-3)       │
│  ▼ "workflow builder"      #6 → #9  (-3)       │
│                                                 │
│  [View all 15 keywords →]                       │
│                                                 │
├─────────────────────────────────────────────────┤
│  CATEGORY RANKINGS                              │
│                                                 │
│  Project Management    #4  (→ no change)        │
│  Productivity          #12 (▼ -2 from #10)      │
│                                                 │
├─────────────────────────────────────────────────┤
│  COMPETITOR WATCH                               │
│                                                 │
│  {comp1} · ⭐ 4.8 (+0.1) · 342 reviews (+3)   │
│  └ Beat you on: "task automation" (#2 vs #5)    │
│                                                 │
│  {comp2} · ⭐ 4.5 (→) · 891 reviews (+1)      │
│  └ You beat them on: "team collab" (#5 vs #11)  │
│                                                 │
│  [Full competitor analysis →]                   │
│                                                 │
├─────────────────────────────────────────────────┤
│  💡 INSIGHT OF THE DAY                          │
│                                                 │
│  Your competitor {comp1} gained 12 reviews in   │
│  the last 7 days while you gained 3. Review     │
│  velocity often correlates with ranking          │
│  improvements. Consider running a review         │
│  campaign.                                       │
│                                                 │
├─────────────────────────────────────────────────┤
│  Manage preferences · Unsubscribe               │
└─────────────────────────────────────────────────┘
```

**New Features:**
- **"Today's Highlight"** — The single most important thing, prominently displayed
- **"Insight of the Day"** — AI-generated actionable insight based on trend data
- **Category rankings** — Now included (was missing from current digest)
- **Smarter subject lines** — Dynamic based on content sentiment
- **Deep links** — Every section links to the relevant dashboard page

### 4.2 Weekly Summary

**Trigger:** Every Monday at user's preferred time (timezone-aware).

**Subject Line Examples:**
- `Week in review: {appName} up on 8 keywords, down on 3`
- `Weekly: {appName} climbed 15 spots across all keywords`
- `Your week: {competitorName} gained 45 reviews — 3x your pace`

**Content:** Aggregated 7-day view with trends, not just snapshots.

```
┌─────────────────────────────────────────────────┐
│  AppRanks · Weekly Summary · Mar 23-29, 2026    │
├─────────────────────────────────────────────────┤
│                                                 │
│  WEEK AT A GLANCE                               │
│  ┌────────────┬────────────┬────────────┐       │
│  │ Keywords   │ Categories │ Reviews    │       │
│  │ 8↑ 3↓ 4→  │ 1↑ 1↓     │ +7 new     │       │
│  └────────────┴────────────┴────────────┘       │
│                                                 │
├─────────────────────────────────────────────────┤
│  📈 7-DAY KEYWORD TREND CHART                   │
│                                                 │
│  [Sparkline chart showing avg position          │
│   movement over the week for top keywords]      │
│                                                 │
│  Best performer: "crm tool" #9 → #3 (+6)       │
│  Worst performer: "sales app" #4 → #11 (-7)    │
│                                                 │
├─────────────────────────────────────────────────┤
│  🏆 WINS THIS WEEK                              │
│                                                 │
│  · Reached #1 for "project management"          │
│  · Entered top 5 for "team tools"               │
│  · Gained 7 new reviews (best week in 30 days)  │
│  · Overtook {comp2} on "workflow builder"        │
│                                                 │
├─────────────────────────────────────────────────┤
│  ⚠️ WATCH LIST                                  │
│                                                 │
│  · "sales app" dropped 7 positions — longest    │
│    decline streak (3 consecutive days)           │
│  · {comp1} gained 23 reviews vs your 7          │
│  · Category "Sales Tools" rank dropped #5 → #8  │
│                                                 │
├─────────────────────────────────────────────────┤
│  📊 COMPETITOR SCORECARD                        │
│                                                 │
│  ┌──────────┬────────┬─────────┬────────────┐   │
│  │ App      │ Rating │ Reviews │ Avg Rank   │   │
│  ├──────────┼────────┼─────────┼────────────┤   │
│  │ You      │ 4.7    │ +7      │ 5.2 (▲)   │   │
│  │ {comp1}  │ 4.8    │ +23     │ 3.8 (▲)   │   │
│  │ {comp2}  │ 4.5    │ +2      │ 8.1 (▼)   │   │
│  │ {comp3}  │ 4.6    │ +5      │ 6.4 (→)   │   │
│  └──────────┴────────┴─────────┴────────────┘   │
│                                                 │
│  [View full weekly report →]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.3 Ranking Alert (Real-time)

**Trigger:** When a tracked app experiences a significant ranking change:
- Enters or exits top 3 for any keyword
- Moves 5+ positions in either direction
- Enters or drops out of a keyword entirely
- Category ranking changes by 3+ positions

**Subject Line Examples:**
- `🎯 {appName} just hit #1 for "{keyword}"!`
- `⚠️ {appName} dropped out of top 10 for "{keyword}"`
- `{appName} jumped from #15 to #6 for "{keyword}"`

**Content:** Focused, single-event notification. Fast to read.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │         #15  →  #6                      │    │
│  │    "team collaboration"                 │    │
│  │                                         │    │
│  │    {appName} jumped 9 positions         │    │
│  │    Detected: March 29, 2026 at 14:30    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Context:                                       │
│  · Last 7 days: #15 → #12 → #11 → #6          │
│  · Category average for this keyword: #8        │
│  · {comp1} is at #3, {comp2} at #5             │
│  · You need +3 more positions to enter top 3    │
│                                                 │
│  [View keyword details →]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.4 Competitor Alert

**Trigger:** When a tracked competitor:
- Overtakes the user's app on a keyword
- Gets featured in a category
- Has a review count surge (10+ in 24h)
- Changes pricing
- Updates their app listing (new features, description change)

**Subject Line Examples:**
- `{competitorName} just overtook {appName} for "{keyword}"`
- `{competitorName} got featured in {categoryName}`
- `{competitorName} gained 15 reviews today — something's happening`
- `{competitorName} just changed their pricing`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ⚔️ COMPETITOR MOVE DETECTED                   │
│                                                 │
│  {competitorName} overtook {appName}            │
│  for "{keyword}"                                │
│                                                 │
│  Before:  You #3  ·  Them #5                    │
│  Now:     You #4  ·  Them #2                    │
│                                                 │
│  What happened:                                 │
│  · They gained 8 new reviews in 3 days          │
│  · Their rating improved from 4.6 → 4.7         │
│  · They updated their listing description       │
│    2 days ago                                   │
│                                                 │
│  Your options:                                  │
│  · Focus on reviews to reclaim position         │
│  · Check their listing changes for insights     │
│  · Monitor: you're still #1 on 3 other keywords │
│                                                 │
│  [View competitor profile →]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.5 Opportunity Alert

**Trigger:** Weekly analysis identifies untapped opportunities:
- Keywords where the app ranks #4-#10 with low competition above
- Categories where the app is close to top 10
- Keywords with high search volume but no tracked competitors
- "Easy wins" — keywords where one position gain would be significant

**Subject Line Examples:**
- `Opportunity: "{keyword}" — you're #6 and #4-5 have weak apps`
- `3 keywords where {appName} could reach top 3 this month`
- `Untapped: "{keyword}" has high volume and you're not tracking it`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  💡 WEEKLY OPPORTUNITIES                        │
│                                                 │
│  We analyzed your rankings and found 3          │
│  realistic opportunities:                        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  #1 OPPORTUNITY                         │    │
│  │                                         │    │
│  │  Keyword: "invoice automation"          │    │
│  │  Your rank: #6                          │    │
│  │  Apps above you: all rated < 4.5        │    │
│  │  Your rating: 4.8                       │    │
│  │                                         │    │
│  │  Why this matters:                      │    │
│  │  The #4 and #5 apps have fewer reviews  │    │
│  │  and lower ratings. With 5-10 more      │    │
│  │  reviews, you could realistically       │    │
│  │  reach #4 within weeks.                 │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  #2 OPPORTUNITY                         │    │
│  │  Keyword: "sales crm"                   │    │
│  │  Your rank: #8 · Trend: ▲ +3 this week │    │
│  │  Momentum is on your side.              │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [See all opportunities →]                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.6 Review Alert

**Trigger:** New review detected for a tracked app (user's own or competitor's).

**Subject Line Examples:**
- `New 5-star review for {appName}: "{first 50 chars of review}"`
- `⚠️ New 1-star review for {appName} — "{first 50 chars}"`
- `{competitorName} got a critical review: "{snippet}"`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ⭐⭐⭐⭐⭐  NEW REVIEW                       │
│                                                 │
│  "{This app transformed our workflow.           │
│   The integration with Slack is seamless        │
│   and the support team is incredibly            │
│   responsive...}"                               │
│                                                 │
│  — {reviewerName} · March 29, 2026              │
│                                                 │
│  Your review stats:                             │
│  Rating: 4.7 (→) · Total: 234 (+1)             │
│  This month: +12 reviews (avg 4.6)             │
│                                                 │
│  [View on marketplace →]  [View all reviews →]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.7 Win Celebration

**Trigger:** Positive milestones:
- App reaches #1 for a keyword (first time or reclaim)
- App enters top 3 for a new keyword
- App rating crosses a threshold (4.0, 4.5, 4.8)
- Review count milestone (100, 250, 500, 1000)
- Best ranking week/month ever
- Overtook a competitor on more than half the tracked keywords

**Subject Line Examples:**
- `{appName} just hit #1 for "{keyword}"! 🎉`
- `Milestone: {appName} reached 500 reviews!`
- `Best week ever — {appName} climbed on 12 keywords`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │                                         │    │
│  │           🏆  #1                        │    │
│  │                                         │    │
│  │    {appName} reached the top spot       │    │
│  │    for "project management"             │    │
│  │                                         │    │
│  │    First time in 47 days!               │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  The journey:                                   │
│  30 days ago: #8                                │
│  14 days ago: #4                                │
│  7 days ago:  #2                                │
│  Today:       #1 ← you are here                │
│                                                 │
│  What helped:                                   │
│  · +18 reviews in the last 30 days              │
│  · Rating improved from 4.5 → 4.7              │
│  · Previous #1 ({comp}) dropped to #3           │
│                                                 │
│  Keep the momentum going:                       │
│  · You're also close on "team tools" (#3)       │
│  · Review velocity is key to holding #1         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.8 Welcome Email

**Trigger:** Immediately after registration.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Welcome to AppRanks, {name}!                   │
│                                                 │
│  You now have access to marketplace             │
│  intelligence across 11 platforms.              │
│                                                 │
│  Here's what to do first:                       │
│                                                 │
│  1️⃣  Add your app                              │
│     Start tracking your marketplace position    │
│     [Add your first app →]                      │
│                                                 │
│  2️⃣  Set up keywords                           │
│     We'll suggest keywords automatically,       │
│     or you can add your own                     │
│     [Browse keywords →]                         │
│                                                 │
│  3️⃣  Track competitors                         │
│     Know what your competition is doing         │
│     [Find competitors →]                        │
│                                                 │
│  Questions? Reply to this email.                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.9 Re-engagement Email

**Trigger:** User hasn't logged in for 14+ days.

**Subject Line Examples:**
- `While you were away: {appName} dropped 5 spots for "{keyword}"`
- `{competitorName} overtook {appName} on 3 keywords since your last visit`
- `{appName}: 8 ranking changes happened while you were offline`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  It's been 18 days since your last visit.       │
│  Here's what changed:                           │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  SINCE YOU LEFT (18 days)               │    │
│  │                                         │    │
│  │  Keywords improved:    5                │    │
│  │  Keywords dropped:     3                │    │
│  │  New competitor moves:  7                │    │
│  │  New reviews:          12               │    │
│  │                                         │    │
│  │  Biggest change:                        │    │
│  │  "workflow automation" #3 → #9 (-6)     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Catch up on your dashboard →]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 5. Email Design System

### 5.1 Design Tokens

```css
/* Colors */
--brand-primary: #6366f1;     /* Indigo — main brand */
--brand-dark: #111827;        /* Dark background */
--bg-light: #f9fafb;          /* Light background */
--bg-card: #ffffff;           /* Card background */
--text-primary: #111827;      /* Main text */
--text-secondary: #6b7280;   /* Secondary text */
--text-muted: #9ca3af;       /* Muted text */

/* Status colors */
--color-up: #16a34a;          /* Green — improvements */
--color-down: #dc2626;        /* Red — drops */
--color-new: #2563eb;         /* Blue — new entries */
--color-warning: #f59e0b;    /* Amber — attention needed */
--color-win: #8b5cf6;        /* Purple — celebrations */

/* Typography */
--font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
--font-mono: 'SF Mono', 'Fira Code', monospace;  /* For numbers/ranks */
```

### 5.2 Component Library

Every email is built from reusable blocks:

**Header Block**
```
┌─────────────────────────────────────────────┐
│  [AppRanks logo]        March 29, 2026      │
│  {emailType label}                          │
└─────────────────────────────────────────────┘
```

**Hero Stat Block** — For single-metric emphasis
```
┌─────────────────────────────────────────────┐
│              #3 → #1                        │
│        "project management"                 │
│                                             │
│      {appName} reached the top!             │
└─────────────────────────────────────────────┘
```

**Data Table Block** — For ranking/comparison data
```
┌──────────────────────┬──────┬──────┬────────┐
│ Keyword              │ Prev │ Now  │ Change │
├──────────────────────┼──────┼──────┼────────┤
│ "crm integration"    │  #5  │  #3  │  ▲ +2  │
└──────────────────────┴──────┴──────┴────────┘
```

**Insight Block** — For AI-generated insights
```
┌─────────────────────────────────────────────┐
│  💡 {insight title}                         │
│                                             │
│  {insight body text with actionable         │
│   recommendation}                           │
└─────────────────────────────────────────────┘
```

**CTA Block** — Call to action
```
┌─────────────────────────────────────────────┐
│        [Primary Action Button →]            │
│         Secondary link →                    │
└─────────────────────────────────────────────┘
```

**Competitor Card Block**
```
┌─────────────────────────────────────────────┐
│  {appIcon} {appName}                        │
│  ⭐ 4.8 (+0.1) · 342 reviews (+12)         │
│  Beats you on: "keyword1", "keyword2"       │
└─────────────────────────────────────────────┘
```

**Footer Block**
```
┌─────────────────────────────────────────────┐
│  Manage email preferences · Unsubscribe     │
│  AppRanks.io · © 2026                       │
└─────────────────────────────────────────────┘
```

### 5.3 Responsive Design Rules

- Max width: 640px (email best practice)
- Single column layout (no multi-column — breaks in Outlook)
- Inline CSS only (no `<style>` blocks — Gmail strips them in some contexts)
- Table-based layout for consistency across email clients
- Font sizes: 14px body, 16px headings, 24px hero stats
- Minimum touch target: 44x44px for buttons
- Dark mode support via `@media (prefers-color-scheme: dark)` with fallback

### 5.4 Subject Line Strategy

**Principles:**
- Always lead with the specific data point, never generic phrases
- Include the app name or competitor name
- Use numbers (rankings, counts, changes)
- Keep under 60 characters for mobile preview
- No ALL CAPS, minimal punctuation
- A/B test variants per email type

**Pattern Library:**
| Emotion | Pattern | Example |
|---------|---------|---------|
| Urgency | `{app} dropped...` | `{app} dropped from #2 to #7 for "crm"` |
| Win | `{app} reached/hit...` | `{app} hit #1 for "analytics"` |
| Curiosity | `{competitor} just...` | `{comp} just changed their pricing` |
| FOMO | `While you were away...` | `While you were away: 5 ranking changes` |
| Opportunity | `{number} keywords where...` | `3 keywords where you could reach top 5` |

---

## 6. Admin Dashboard — Email Management

### 6.1 Email Dashboard Overview Page

**Route:** `/system-admin/emails`

```
┌─────────────────────────────────────────────────────────────┐
│  📧 Email Management                                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Sent Today  │  Sent Week   │  Open Rate   │  Click Rate    │
│    47         │    312       │    38.2%     │    12.7%       │
│  ▲ +12 vs    │  ▲ +8% vs    │  ▼ -2.1%    │  ▲ +1.3%      │
│  yesterday   │  last week   │  vs last wk  │  vs last wk   │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                                                             │
│  [Tabs: All Emails | Cold | Member | System | Settings]     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RECENT EMAILS                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Filter: [Type ▼] [Status ▼] [Date range] [Search]  │    │
│  ├─────────┬──────────┬───────────┬────────┬──────────┤    │
│  │ To      │ Type     │ Subject   │ Status │ Sent at  │    │
│  ├─────────┼──────────┼───────────┼────────┼──────────┤    │
│  │ john@.. │ Daily    │ Great day │ Opened │ 08:00    │    │
│  │         │ Digest   │ ! app...  │        │          │    │
│  ├─────────┼──────────┼───────────┼────────┼──────────┤    │
│  │ dev@..  │ Cold:    │ Your app  │ Sent   │ 07:45    │    │
│  │         │ First    │ "Acme"... │        │          │    │
│  ├─────────┼──────────┼───────────┼────────┼──────────┤    │
│  │ sara@.. │ Ranking  │ app hit   │ Clicked│ 07:30    │    │
│  │         │ Alert    │ #1 for... │        │          │    │
│  └─────────┴──────────┴───────────┴────────┴──────────┘    │
│                                                             │
│  [← Prev]  Page 1 of 24  [Next →]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Email Detail View

**Route:** `/system-admin/emails/:id`

Click any row to see full detail:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Emails                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  To: john@example.com (John Doe)                            │
│  Account: Acme Corp                                         │
│  Type: member_daily_digest                                  │
│  Sent: March 29, 2026 at 08:00 UTC                         │
│  Status: Opened (opened at 08:12 UTC)                       │
│                                                             │
│  Subject: Great day! Acme CRM climbed to #2 for "crm"      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EMAIL PREVIEW                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  [Rendered HTML email preview in iframe]             │    │
│  │                                                     │    │
│  │  Full email content rendered exactly as the          │    │
│  │  recipient saw it                                    │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [View HTML Source]  [Resend]  [Send Similar to...]         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  METADATA                                                   │
│                                                             │
│  Message ID: abc-123-def                                    │
│  Template version: v2.3                                     │
│  Data snapshot: { ... collapsible JSON ... }                │
│  Delivery status: delivered                                 │
│  Open tracking: pixel loaded at 08:12                       │
│  Click tracking: "View all keywords" clicked at 08:15       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Email Type Settings

**Route:** `/system-admin/emails/settings`

```
┌─────────────────────────────────────────────────────────────┐
│  EMAIL TYPE CONFIGURATION                                    │
│                                                             │
│  Global settings for each email type. Can be overridden     │
│  per account.                                               │
│                                                             │
│  ┌──────────────────┬────────┬───────────┬─────────────┐    │
│  │ Email Type       │ Global │ Frequency │ Actions     │    │
│  ├──────────────────┼────────┼───────────┼─────────────┤    │
│  │ Daily Digest     │ ✅ ON  │ Daily     │ [Configure] │    │
│  │ Weekly Summary   │ ✅ ON  │ Weekly    │ [Configure] │    │
│  │ Ranking Alert    │ ✅ ON  │ Real-time │ [Configure] │    │
│  │ Competitor Alert │ ✅ ON  │ Real-time │ [Configure] │    │
│  │ Opportunity      │ ✅ ON  │ Weekly    │ [Configure] │    │
│  │ Review Alert     │ ⬚ OFF │ Real-time │ [Configure] │    │
│  │ Win Celebration  │ ✅ ON  │ Event     │ [Configure] │    │
│  │ Cold: First      │ ⬚ OFF │ Manual    │ [Configure] │    │
│  │ Cold: Follow-up  │ ⬚ OFF │ Auto      │ [Configure] │    │
│  │ Cold: Comp Alert │ ⬚ OFF │ Event     │ [Configure] │    │
│  │ Welcome          │ ✅ ON  │ Once      │ [Configure] │    │
│  │ Onboarding       │ ✅ ON  │ Series    │ [Configure] │    │
│  │ Re-engagement    │ ⬚ OFF │ Auto      │ [Configure] │    │
│  └──────────────────┴────────┴───────────┴─────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ACCOUNT OVERRIDES                                          │
│                                                             │
│  ┌──────────────────┬──────────────────────────────┐        │
│  │ Account          │ Overrides                    │        │
│  ├──────────────────┼──────────────────────────────┤        │
│  │ Acme Corp        │ Review Alert: ON             │        │
│  │ Beta Testers     │ Cold emails: all ON          │        │
│  │ Free Tier Co     │ Opportunity: OFF             │        │
│  └──────────────────┴──────────────────────────────┘        │
│                                                             │
│  [+ Add Account Override]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Configure Email Type (Modal/Page)

```
┌─────────────────────────────────────────────────────────────┐
│  Configure: Ranking Alert                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ✅ Enabled globally                                │
│                                                             │
│  TRIGGER THRESHOLDS                                         │
│  · Minimum position change to trigger: [5] positions        │
│  · Trigger for top-3 entry/exit: [✅]                       │
│  · Trigger for keyword entry/exit: [✅]                     │
│  · Category rank change threshold: [3] positions            │
│                                                             │
│  FREQUENCY LIMITS                                           │
│  · Max emails per user per day: [5]                         │
│  · Cooldown between same-keyword alerts: [6] hours          │
│  · Batch nearby alerts: [✅] (group within 30 min window)   │
│                                                             │
│  QUIET HOURS                                                │
│  · Respect user timezone: [✅]                              │
│  · Quiet hours: [22:00] to [07:00]                          │
│  · Queue during quiet hours and send at: [07:00]            │
│                                                             │
│  [Save Changes]  [Reset to Defaults]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Cold Email Campaign View

**Route:** `/system-admin/emails/campaigns`

```
┌─────────────────────────────────────────────────────────────┐
│  COLD EMAIL CAMPAIGNS                                        │
│                                                             │
│  [+ New Campaign]                                           │
│                                                             │
│  ┌──────────────┬─────────┬──────┬───────┬────────────┐     │
│  │ Campaign     │ Status  │ Sent │ Opens │ Signups    │     │
│  ├──────────────┼─────────┼──────┼───────┼────────────┤     │
│  │ Shopify CRM  │ Active  │ 120  │ 45    │ 8          │     │
│  │ apps Q1      │         │      │ (38%) │ (6.7%)     │     │
│  ├──────────────┼─────────┼──────┼───────┼────────────┤     │
│  │ Zendesk      │ Draft   │ 0    │ —     │ —          │     │
│  │ helpdesk     │         │      │       │            │     │
│  └──────────────┴─────────┴──────┴───────┴────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Dry Run System

### 7.1 Concept

Dry run allows admins to **preview exactly what an email would look like** without sending it. This is critical for:
- Testing new email types before enabling them
- Previewing what a specific user/account would receive
- Debugging email content issues
- Demonstrating value to potential users

### 7.2 Dry Run Dashboard

**Route:** `/system-admin/emails/dry-run`

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 EMAIL DRY RUN                                           │
│                                                             │
│  Preview what an email would look like without sending it.   │
│                                                             │
│  CONFIGURATION                                              │
│                                                             │
│  Email Type:    [Daily Digest ▼]                            │
│                                                             │
│  Target:                                                    │
│  ○ Specific user    [Search user... ▼]                      │
│  ○ Specific account [Search account... ▼]                   │
│  ○ Specific app     [Search app... ▼]                       │
│  ● Custom scenario  (enter parameters below)                │
│                                                             │
│  Platform: [shopify ▼]                                      │
│  Date range: [Yesterday ▼] (what timeframe to pull data)    │
│                                                             │
│  [Generate Preview]                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PREVIEW                                                    │
│  ┌────────────────────────┬────────────────────────┐        │
│  │  📱 Mobile (375px)     │  💻 Desktop (640px)    │        │
│  ├────────────────────────┼────────────────────────┤        │
│  │                        │                        │        │
│  │  [Rendered email       │  [Rendered email       │        │
│  │   at mobile width]     │   at desktop width]    │        │
│  │                        │                        │        │
│  │                        │                        │        │
│  │                        │                        │        │
│  │                        │                        │        │
│  └────────────────────────┴────────────────────────┘        │
│                                                             │
│  Subject: "Great day! Acme CRM climbed to #2 for 'crm'"    │
│  From: reports@appranks.io                                  │
│  Would be sent to: john@example.com, jane@example.com       │
│                                                             │
│  [View HTML Source]  [Send as Test Email]  [Download .eml]  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DATA USED                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ {                                                   │    │
│  │   "accountName": "Acme Corp",                       │    │
│  │   "rankingChanges": [                               │    │
│  │     { "keyword": "crm", "from": 5, "to": 2, ... } │    │
│  │   ],                                               │    │
│  │   "competitorSummaries": [ ... ],                   │    │
│  │   ...                                               │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Dry Run Features

1. **Real Data Preview** — Uses actual database data for the selected user/account/app
2. **Mobile + Desktop Preview** — Side-by-side rendering at different widths
3. **Send as Test** — Actually send the preview to admin's email or a specified test address
4. **Data Inspector** — View the raw data object that feeds the template
5. **HTML Source** — View/copy the generated HTML for debugging
6. **Download .eml** — Download as email file for testing in email clients
7. **Historical Replay** — Preview what an email *would have* looked like on a past date
8. **Bulk Preview** — "If I sent this email type to all users right now, how many would qualify?"

### 7.4 Bulk Preview Mode

```
┌─────────────────────────────────────────────────────────────┐
│  BULK DRY RUN: Daily Digest                                  │
│                                                             │
│  If this email were sent now:                               │
│                                                             │
│  Total eligible users: 47                                   │
│  Would receive email: 38 (have data to report)              │
│  Would be skipped: 9 (no changes to report)                 │
│  Disabled by user: 3                                        │
│  Disabled by admin: 2                                       │
│                                                             │
│  SAMPLE PREVIEWS                                            │
│  ┌────────────┬──────────────────────────────────────┐      │
│  │ User       │ Subject preview                      │      │
│  ├────────────┼──────────────────────────────────────┤      │
│  │ john@..    │ Great day! Acme CRM climbed to #2... │      │
│  │ sara@..    │ Heads up: Widget Pro dropped from...  │      │
│  │ dev@..     │ Your daily snapshot — holding stead.. │      │
│  └────────────┴──────────────────────────────────────┘      │
│                                                             │
│  [Preview any →]  [Send all as test to admin →]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Database Schema

### 8.1 New Tables

```sql
-- Email type configuration (admin-managed)
CREATE TABLE IF NOT EXISTS email_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL UNIQUE,      -- matches EmailType enum
  enabled BOOLEAN NOT NULL DEFAULT false,       -- global on/off
  config JSONB NOT NULL DEFAULT '{}',           -- type-specific config (thresholds, limits)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-account overrides for email types
CREATE TABLE IF NOT EXISTS email_type_account_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,                     -- override the global setting
  config JSONB DEFAULT NULL,                    -- optional config override
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_type, account_id)
);

-- Sent email log (every email sent)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,      -- null for cold emails
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- null for cold emails
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,         -- related app if applicable
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,                      -- full rendered HTML (for replay)
  data_snapshot JSONB NOT NULL,                 -- the data used to generate the email
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued, sent, delivered, bounced, failed
  message_id VARCHAR(255),                      -- SMTP message ID
  opened_at TIMESTAMPTZ,                        -- open tracking
  clicked_at TIMESTAMPTZ,                       -- first click tracking
  click_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,                           -- if failed
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  is_dry_run BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Cold email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL,              -- cold_first_contact, etc.
  platform VARCHAR(50),                         -- target platform
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, paused, completed
  config JSONB NOT NULL DEFAULT '{}',           -- campaign-specific settings
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_converted INTEGER NOT NULL DEFAULT 0,   -- led to signup
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cold email prospects (non-users we want to contact)
CREATE TABLE IF NOT EXISTS email_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
  platform VARCHAR(50) NOT NULL,
  developer_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'new',    -- new, contacted, responded, converted, unsubscribed
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMPTZ,
  contact_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, campaign_id)
);

-- User email preferences (extends existing user fields)
CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT NULL,                    -- user-specific settings (e.g., frequency)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_type)
);

-- Unsubscribe tokens (for one-click unsubscribe in email footers)
CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  email_type VARCHAR(50),                       -- null = unsubscribe all
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES email_prospects(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.2 Indexes

```sql
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_user ON email_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_email_logs_account ON email_logs(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_email_prospects_status ON email_prospects(status);
CREATE INDEX idx_email_prospects_campaign ON email_prospects(campaign_id);
CREATE INDEX idx_email_prospects_email ON email_prospects(email);

CREATE INDEX idx_user_email_prefs_user ON user_email_preferences(user_id);
CREATE INDEX idx_unsubscribe_token ON email_unsubscribe_tokens(token);
```

### 8.3 User Table Changes

Add to existing `users` table:
```sql
-- Replace single emailDigestEnabled with granular preferences
-- Keep emailDigestEnabled for backward compatibility during migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_frequency VARCHAR(20) DEFAULT 'daily';
-- 'realtime' | 'daily' | 'weekly' | 'none'
```

---

## 9. API Endpoints

### 9.1 Admin Email Management

```
# Email log
GET    /api/system-admin/emails                    # List sent emails (paginated, filterable)
GET    /api/system-admin/emails/:id                # Email detail with full HTML
GET    /api/system-admin/emails/stats              # Aggregate stats (sent, opened, clicked)

# Email type configuration
GET    /api/system-admin/email-configs             # List all email type configs
PATCH  /api/system-admin/email-configs/:type       # Update config for an email type
POST   /api/system-admin/email-configs/:type/toggle # Enable/disable globally

# Account overrides
GET    /api/system-admin/email-configs/:type/overrides        # List account overrides
POST   /api/system-admin/email-configs/:type/overrides        # Create override
DELETE /api/system-admin/email-configs/:type/overrides/:id    # Remove override

# Dry run
POST   /api/system-admin/emails/dry-run            # Generate preview (no send)
POST   /api/system-admin/emails/dry-run/send-test  # Send preview to test address
POST   /api/system-admin/emails/dry-run/bulk       # Bulk preview (eligible count + samples)

# Cold email campaigns
GET    /api/system-admin/campaigns                 # List campaigns
POST   /api/system-admin/campaigns                 # Create campaign
PATCH  /api/system-admin/campaigns/:id             # Update campaign
GET    /api/system-admin/campaigns/:id/prospects    # List prospects in campaign
POST   /api/system-admin/campaigns/:id/prospects    # Add prospects
POST   /api/system-admin/campaigns/:id/send         # Trigger send for campaign

# Manual triggers
POST   /api/system-admin/emails/send               # Send specific email type to user/account
POST   /api/system-admin/emails/resend/:id         # Resend a previously sent email
```

### 9.2 User Preferences (Member-facing)

```
GET    /api/account/email-preferences              # Get current user's email preferences
PATCH  /api/account/email-preferences              # Update preferences
POST   /api/account/email-preferences/unsubscribe  # Unsubscribe from type
```

### 9.3 Public (Unsubscribe)

```
GET    /api/emails/unsubscribe/:token              # One-click unsubscribe (from email link)
POST   /api/emails/unsubscribe/:token              # Confirm unsubscribe
GET    /api/emails/track/open/:emailLogId.png      # Open tracking pixel
GET    /api/emails/track/click/:emailLogId/:linkId # Click tracking redirect
```

---

## 10. Worker & Scheduling

### 10.1 New Job Types

```typescript
// Add to existing ScraperJobType union
type EmailJobType =
  | 'email_daily_digest'        // Enhanced version of existing daily_digest
  | 'email_weekly_summary'      // Weekly aggregated report
  | 'email_ranking_alert'       // Triggered after keyword scrape detects significant change
  | 'email_competitor_alert'    // Triggered after app_details scrape detects competitor change
  | 'email_opportunity_analysis'// Weekly analysis job
  | 'email_review_alert'       // Triggered after review scrape
  | 'email_win_celebration'    // Triggered after positive milestone detected
  | 'email_welcome'            // Triggered by registration
  | 'email_onboarding'         // Scheduled series after registration
  | 'email_reengagement'       // Triggered by inactivity check
  | 'email_cold_campaign'      // Manual/scheduled cold outreach
  | 'email_cold_followup'      // Auto follow-up for cold emails
```

### 10.2 Cron Schedule

```typescript
const emailSchedules = [
  // Enhanced daily digest — all platforms, timezone-aware
  { name: 'email_daily_digest', cron: '*/15 * * * *', type: 'email_daily_digest' },
  // Runs every 15 minutes, checks which users should receive their digest
  // based on their timezone (send at 8 AM local time)

  // Weekly summary — Monday mornings
  { name: 'email_weekly_summary', cron: '0 * * * 1', type: 'email_weekly_summary' },
  // Runs every hour on Mondays, timezone-aware

  // Opportunity analysis — Saturday mornings
  { name: 'email_opportunity_analysis', cron: '0 9 * * 6', type: 'email_opportunity_analysis' },

  // Re-engagement check — daily
  { name: 'email_reengagement_check', cron: '0 10 * * *', type: 'email_reengagement' },

  // Cold follow-up check — daily
  { name: 'email_cold_followup_check', cron: '0 11 * * *', type: 'email_cold_followup' },
];
```

### 10.3 Event-Driven Triggers

These are triggered by existing scraper jobs, not by cron:

```typescript
// In keyword scraper — after processing results:
async function onKeywordRankingChange(change: RankingChange) {
  if (isSignificantChange(change)) {
    await enqueueEmail('email_ranking_alert', {
      appId: change.appId,
      keywordId: change.keywordId,
      change,
    });
  }
}

// In app details scraper — after detecting competitor changes:
async function onCompetitorChange(change: CompetitorChange) {
  await enqueueEmail('email_competitor_alert', {
    competitorAppId: change.appId,
    changes: change.fields,
  });
}

// In review scraper — after new review:
async function onNewReview(review: ReviewData) {
  await enqueueEmail('email_review_alert', {
    appId: review.appId,
    review,
  });
}

// After keyword ranking processing — milestone detection:
async function checkMilestones(appId: string, rankings: RankingData[]) {
  const milestones = detectMilestones(rankings);
  if (milestones.length > 0) {
    await enqueueEmail('email_win_celebration', { appId, milestones });
  }
}
```

### 10.4 Email Send Pipeline

```
[Trigger] → [Build Email Data] → [Check Eligibility] → [Render Template] → [Log to DB] → [Send via SMTP] → [Update Status]
                                        │
                                        ├── Is email type enabled globally?
                                        ├── Is email type enabled for this account?
                                        ├── Has user opted out of this type?
                                        ├── Is user within frequency cap?
                                        ├── Is it within quiet hours?
                                        └── Was a similar email sent recently? (dedup)
```

### 10.5 Timezone-Aware Scheduling

```typescript
// Instead of sending all digests at one UTC time,
// check every 15 minutes which users should receive their digest

async function processTimezoneAwareDigest() {
  const now = new Date();

  // Get all eligible users
  const users = await getDigestEligibleUsers();

  for (const user of users) {
    const userLocalTime = toTimezone(now, user.timezone);
    const targetHour = 8; // 8 AM local time

    // Check if it's the right time for this user (within 15-min window)
    if (userLocalTime.hour === targetHour && userLocalTime.minute < 15) {
      // Check if digest already sent today
      if (!alreadySentToday(user)) {
        await buildAndSendDigest(user);
      }
    }
  }
}
```

---

## 11. Email Deliverability & Compliance

### 11.1 Technical Setup

- **SPF Record** — Add `include:_spf.smtp-provider.com` to `appranks.io` DNS
- **DKIM Signing** — Configure DKIM key for `appranks.io`
- **DMARC Policy** — `v=DMARC1; p=quarantine; rua=mailto:dmarc@appranks.io`
- **Custom Return-Path** — `bounces@appranks.io`
- **Dedicated IP** (when volume warrants) — Warm up gradually

### 11.2 Compliance

- **CAN-SPAM / GDPR Compliant**
  - Physical address in footer
  - One-click unsubscribe (RFC 8058 `List-Unsubscribe` header)
  - Clear sender identification
  - Unsubscribe honored within 24 hours
- **Cold Email Rules**
  - Only contact business emails (not personal)
  - Clear identification as AppRanks
  - Immediate unsubscribe option
  - No deceptive subject lines
  - Rate limit: max 50 cold emails per day initially

### 11.3 Frequency Caps

| Email Type | Max per User per Day | Max per User per Week | Cooldown |
|------------|---------------------|-----------------------|----------|
| Daily Digest | 1 | 7 | 24h |
| Weekly Summary | — | 1 | 7d |
| Ranking Alert | 5 | 20 | 6h per keyword |
| Competitor Alert | 3 | 15 | 12h per competitor |
| Opportunity | — | 1 | 7d |
| Review Alert | 3 | 15 | 1h per app |
| Win Celebration | 2 | 5 | 24h |
| Cold First Contact | — | — | Once per prospect |
| Cold Follow-up | — | 1 | 3d after last |
| Re-engagement | — | 1 | 14d |

---

## 12. Implementation Phases

### Phase 1: Foundation (Infrastructure)
**Goal:** Build the email infrastructure that all email types will use.

- Database schema (all new tables)
- Email template engine (component-based, reusable blocks)
- Email send pipeline (eligibility checks, frequency caps, dedup, logging)
- Timezone-aware scheduling system
- Unsubscribe system (tokens, one-click, preferences)
- Open/click tracking
- Admin API endpoints (email logs, configs, dry run)

### Phase 2: Enhanced Member Emails
**Goal:** Upgrade existing daily digest + add weekly summary.

- Enhanced daily digest (hero highlight, category rankings, insights, better subjects)
- Weekly summary email
- User email preferences page in dashboard (per-type opt-in/out)
- Admin email dashboard (log viewer, stats, type settings)

### Phase 3: Real-time Alerts
**Goal:** Event-driven emails triggered by scraper results.

- Ranking alert (triggered by keyword scraper)
- Competitor alert (triggered by app details scraper)
- Review alert (triggered by review scraper)
- Win celebration (milestone detection)
- Alert batching (group nearby alerts into single email)
- Quiet hours support

### Phase 4: Engagement Emails
**Goal:** Lifecycle emails for onboarding and re-engagement.

- Welcome email (on registration)
- Onboarding series (day 1, 3, 7)
- Re-engagement email (14+ days inactive)
- Opportunity alert (weekly analysis)

### Phase 5: Cold Email System
**Goal:** Prospecting infrastructure for user acquisition.

- Prospect management (import, status tracking)
- Campaign system (create, manage, track)
- Cold first contact email generation
- Follow-up automation
- Cold competitive alert
- Campaign analytics dashboard

### Phase 6: Admin Dashboard & Polish
**Goal:** Full email management UI for admins.

- Email management dashboard (overview, stats, log viewer)
- Email detail view (preview, resend, metadata)
- Dry run system (preview, bulk preview, test send)
- Campaign management UI
- Email type configuration UI
- Account override management
- Historical replay ("what would this email have looked like last Tuesday?")

---

## Appendix A: Email Service Recommendation

For production, consider migrating from raw SMTP to a transactional email service:

| Service | Pros | Cons | Cost |
|---------|------|------|------|
| **Amazon SES** | Cheapest, high volume, good deliverability | Basic analytics, more setup | $0.10/1000 emails |
| **Resend** | Modern API, React Email support, great DX | Newer, smaller | $20/mo for 50k |
| **Postmark** | Best deliverability, fast delivery | Higher cost | $15/mo for 10k |
| **SendGrid** | Full-featured, good analytics | Complex, can be slow | $20/mo for 50k |

**Recommendation:** Start with existing SMTP setup for Phase 1-2. Evaluate Resend or Amazon SES for Phase 3+ when volume increases.

## Appendix B: Email Template Technology

**Recommendation:** Build a custom template system using the existing approach (string template functions) but with a component-based architecture:

```typescript
// Template components
const header = (props: HeaderProps) => `<table>...</table>`;
const heroStat = (props: HeroStatProps) => `<table>...</table>`;
const dataTable = (props: DataTableProps) => `<table>...</table>`;
const insightBlock = (props: InsightProps) => `<table>...</table>`;
const ctaButton = (props: CTAProps) => `<table>...</table>`;
const footer = (props: FooterProps) => `<table>...</table>`;

// Compose emails from components
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

This keeps things simple, fast, and avoids heavy dependencies like MJML or React Email while maintaining consistency across all email types.
