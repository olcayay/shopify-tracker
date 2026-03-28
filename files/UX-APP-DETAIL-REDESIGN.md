# App Detail Page - Information Architecture & UX Redesign

> Comprehensive analysis and redesign proposal for the app detail pages at appranks.io
> Date: 2026-03-28

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Problem Statement](#2-problem-statement)
3. [User Personas & Jobs-to-be-Done](#3-user-personas--jobs-to-be-done)
4. [Information Taxonomy](#4-information-taxonomy)
5. [Redesign Proposal: Hub & Spoke Model](#5-redesign-proposal-hub--spoke-model)
6. [Page-by-Page Redesign Specifications](#6-page-by-page-redesign-specifications)
7. [Cross-Cutting UX Patterns](#7-cross-cutting-ux-patterns)
8. [Navigation & Wayfinding](#8-navigation--wayfinding)
9. [Information Density Framework](#9-information-density-framework)
10. [Wireframe Sketches](#10-wireframe-sketches)
11. [Migration Strategy](#11-migration-strategy)

---

## 1. Current State Analysis

### 1.1 Current Tab Inventory

The app detail page currently has **13 tabs**:

| # | Tab | URL | Access | Primary Purpose |
|---|-----|-----|--------|-----------------|
| 1 | Overview | `/apps/{slug}` | All | Dashboard summary of everything |
| 2 | Details | `/apps/{slug}/details` | All | App metadata & descriptions |
| 3 | Rankings | `/apps/{slug}/rankings` | All | Category & keyword rank charts |
| 4 | Changes | `/apps/{slug}/changes` | All | Field-level change history |
| 5 | Reviews | `/apps/{slug}/reviews` | All* | Rating distribution & review list |
| 6 | Similar | `/apps/{slug}/similar` | All* | Similar/reverse/2nd-degree apps |
| 7 | Featured | `/apps/{slug}/featured` | All* | Featured placement heatmaps |
| 8 | Ads | `/apps/{slug}/ads` | All* | Keyword & category ad heatmaps |
| 9 | Competitors | `/apps/{slug}/competitors` | Tracked | Competitor comparison table |
| 10 | Keywords | `/apps/{slug}/keywords` | Tracked | Keyword tracking & management |
| 11 | Compare | `/apps/{slug}/compare` | Tracked | Metadata editing/drafting tool |
| 12 | Preview | `/apps/{slug}/preview` | Tracked | Platform listing preview |
| 13 | Loading states | — | — | Skeleton UIs for server pages |

*Platform capability dependent

### 1.2 Data Points Per Tab

```
Overview (~40+ data points)
├── Keyword count, top movers, best-ranked keywords
├── Competitor position (rating, reviews, price)
├── Category rankings with leaders
├── Review metrics & distribution
├── Featured placements summary
├── Ad campaigns summary
├── Similar apps counts
├── Recent changes (self + competitors)
└── Visibility & Power scores

Details (~25+ fields)
├── App name, subtitle, introduction
├── Full description, features list
├── SEO title & meta description
├── Languages, integrations
├── Platform-specific fields (permissions, compatibility, etc.)
├── Pricing plans table
└── Categories list

Competitors (~18 columns)
├── Visibility score, Power score, Similarity score
├── Rating, Reviews, Review velocity (7d/30d/90d)
├── Momentum indicator
├── Pricing, Min paid price
├── Launched date
├── Featured sections count, Ad keywords count
├── Ranked keywords count, Similar apps count
├── Category rank average
└── Last change date

Keywords (~8+ columns + filters)
├── Keyword name, Rank, Rank change
├── Apps also ranked, Featured, Ad sightings
├── Momentum/trend
├── Tag filter, Word group filter
└── Opportunity popover

Rankings (30-day charts)
├── Category rank line charts
├── Keyword rank line charts
└── Keyword ad heatmap

Changes (50 entries)
├── Field name, Detection date
├── Old vs new value diff
└── Pricing plan diffs

Reviews
├── 90-day rating/review chart
├── Rating distribution bars
└── Paginated review list (10/page)

Similar Apps (30-day heatmaps)
├── Direct similar apps
├── Reverse similar apps
└── Second-degree similar apps

Featured (30-day heatmap)
└── Featured section placements with position

Ads (30-day heatmaps)
├── Keyword ad sightings
└── Category ad sightings

Compare
├── Editable metadata fields
├── Character count validation
└── Category ranking viz

Preview
└── Platform-specific listing mockup
```

### 1.3 Current Information Flow

```
User lands on app page
        │
        ▼
   ┌─────────┐
   │ Layout   │ ← App metadata + membership (always loaded)
   │ (Header) │
   └────┬─────┘
        │
        ▼
   ┌─────────┐
   │ Overview │ ← 3 rounds of API calls (~10 parallel fetches)
   │ (Default)│   Tries to show EVERYTHING
   └────┬─────┘
        │
        ├──► User must decide which of 12 other tabs to visit
        │    (cognitive overload at this decision point)
        │
        ▼
   ┌──────────────────────────────────────────────────┐
   │  12 tabs, each independent, no cross-references  │
   │  User must remember what they saw on other tabs   │
   └──────────────────────────────────────────────────┘
```

---

## 2. Problem Statement

### 2.1 Core Problems

**Problem 1: Tab Overload (13 tabs)**
Users face a horizontal scrolling tab bar with up to 13 options. Research shows that beyond 5-7 navigation items, users experience choice paralysis. The tabs lack grouping, making it hard to find what you need.

**Problem 2: Overview Page Does Too Much**
The Overview tab tries to summarize every other tab, resulting in:
- 3 rounds of sequential API calls (slow loading)
- 40+ data points competing for attention
- No clear visual hierarchy or story
- Information that's neither deep enough to act on, nor curated enough to scan

**Problem 3: No Task-Oriented Structure**
Tabs are organized by *data type* (reviews, rankings, changes) not by *user task* (optimize my listing, monitor competitors, track visibility). Users must mentally map their goals to scattered data.

**Problem 4: Disconnected Insights**
Related data lives on different tabs with no cross-references:
- Keywords tab doesn't show related ad sightings inline
- Competitors tab doesn't link to competitor changes
- Rankings tab doesn't connect to keyword optimization
- Changes tab doesn't show impact on rankings

**Problem 5: No Guided Workflow**
The page treats all data equally. There's no:
- Priority indicators (what needs attention NOW?)
- Recommended actions
- Progress tracking (am I improving?)
- Temporal context (how does today compare to last week?)

### 2.2 Symptoms

```
Current UX                          Ideal UX
─────────────────────────────────   ─────────────────────────────────
"Here's ALL your data"              "Here's what MATTERS right now"
13 flat tabs                        Grouped, progressive disclosure
Data dumped in tables               Insights with context
No workflow guidance                Task-oriented navigation
Every page loads independently      Connected, cross-referenced data
Same view for all user types        Adaptive to user's role/goal
```

---

## 3. User Personas & Jobs-to-be-Done

### 3.1 Primary Personas

```
┌─────────────────────────────────────────────────────────────────┐
│                        PERSONA MAP                              │
├──────────────┬──────────────────┬───────────────────────────────┤
│   Persona    │   Primary Goal   │   Key Metrics They Care About │
├──────────────┼──────────────────┼───────────────────────────────┤
│ App Owner    │ "Grow my app's   │ Rankings, reviews, visibility │
│ (Founder/PM) │  visibility"     │ score, competitor moves       │
├──────────────┼──────────────────┼───────────────────────────────┤
│ ASO Analyst  │ "Optimize the    │ Keywords, search rank, ads,   │
│ (Marketing)  │  listing"        │ metadata quality, CTR         │
├──────────────┼──────────────────┼───────────────────────────────┤
│ Competitive  │ "Understand the  │ Competitor table, changes,    │
│ Intel        │  market"         │ similar apps, featured spots  │
├──────────────┼──────────────────┼───────────────────────────────┤
│ Casual       │ "Quick check on  │ Rating, reviews, basic info   │
│ Browser      │  this app"       │ description, pricing          │
└──────────────┴──────────────────┴───────────────────────────────┘
```

### 3.2 Jobs-to-be-Done Framework

| Job | Frequency | Current Path | Pain Points |
|-----|-----------|-------------|-------------|
| "Check if anything changed overnight" | Daily | Overview → scan → jump to tab | Overview too dense, can't scan quickly |
| "Find keywords to target" | Weekly | Keywords tab → suggestions | No connection to competitor keywords |
| "See how I rank vs competitors" | Weekly | Competitors tab → sort | Table has 18 columns, overwhelming |
| "Optimize my listing copy" | Monthly | Compare tab → edit | No guidance on what to improve |
| "Research an unfamiliar app" | Ad-hoc | Overview → Details | Too much data for a quick assessment |
| "Check review sentiment" | Weekly | Reviews tab → scroll | No sentiment summary, just raw reviews |
| "Monitor competitor changes" | Daily | Overview (bottom) or Changes | Competitor changes buried at bottom |
| "Understand my ad landscape" | Weekly | Ads tab | Isolated from keyword context |

---

## 4. Information Taxonomy

### 4.1 Content Categories

All data points in the app detail pages can be categorized into 5 fundamental groups:

```
┌─────────────────────────────────────────────────────────────┐
│                    INFORMATION TAXONOMY                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. IDENTITY          Who is this app?                      │
│     ├── Name, icon, subtitle, developer                     │
│     ├── Description, features, screenshots                  │
│     ├── Pricing plans                                       │
│     ├── Categories                                          │
│     ├── Platform-specific metadata                          │
│     └── Listing preview                                     │
│                                                             │
│  2. PERFORMANCE       How is this app doing?                │
│     ├── Visibility score (composite)                        │
│     ├── Power score (market authority)                      │
│     ├── Category rankings over time                         │
│     ├── Keyword rankings over time                          │
│     ├── Review metrics (count, rating, velocity)            │
│     └── Featured placement frequency                        │
│                                                             │
│  3. MARKET POSITION   Where does it stand vs others?        │
│     ├── Competitor comparison table                         │
│     ├── Similar apps network                                │
│     ├── Category leaders                                    │
│     ├── Keyword overlap with competitors                    │
│     └── Ad landscape                                        │
│                                                             │
│  4. OPTIMIZATION      What can be improved?                 │
│     ├── Keyword opportunities                               │
│     ├── Metadata quality (character counts, SEO)            │
│     ├── Listing preview & draft tools                       │
│     ├── Review response needs                               │
│     └── Featured/ad strategy gaps                           │
│                                                             │
│  5. MONITORING        What changed recently?                │
│     ├── App's own changes (field diffs)                     │
│     ├── Competitor changes                                  │
│     ├── Rank movements (up/down)                            │
│     ├── New/lost similar apps                               │
│     ├── Review trends                                       │
│     └── Featured/ad changes                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data Relationship Map

```
                    ┌──────────┐
                    │ KEYWORDS │
                    └────┬─────┘
                         │ ranked in
                    ┌────▼─────┐        ┌───────────┐
              ┌─────┤ RANKINGS ├────────┤ CATEGORIES│
              │     └────┬─────┘        └───────────┘
              │          │ influenced by
         ┌────▼───┐ ┌───▼────┐
         │  ADS   │ │FEATURED│
         └────┬───┘ └───┬────┘
              │         │
              └────┬────┘
                   │ visibility drives
              ┌────▼─────┐
              │ REVIEWS  │ ← social proof
              └────┬─────┘
                   │ compared with
           ┌───────▼────────┐
           │  COMPETITORS   │
           └───────┬────────┘
                   │ also appears in
            ┌──────▼───────┐
            │ SIMILAR APPS │
            └──────────────┘

    ┌──────────────────────────────┐
    │ CHANGES monitor ALL of above │
    └──────────────────────────────┘

    ┌──────────────────────────────┐
    │ DETAILS/COMPARE/PREVIEW are  │
    │ the EDITABLE identity layer  │
    └──────────────────────────────┘
```

This map reveals the current tabs artificially separate deeply connected data. Keywords, rankings, ads, and featured placements form a tightly coupled **visibility system**, yet each lives on its own tab.

---

## 5. Redesign Proposal: Hub & Spoke Model

### 5.1 Design Philosophy

**From 13 flat tabs → 4 focused sections with progressive disclosure**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   CURRENT MODEL              PROPOSED MODEL                     │
│   (Flat tabs)                (Hub & Spoke)                      │
│                                                                 │
│   ┌──┬──┬──┬──┬──┬──┐       ┌─────────────┐                    │
│   │O │D │R │C │Re│Si│...    │  Dashboard  │ ← Smart overview   │
│   └──┴──┴──┴──┴──┴──┘       │   (Hub)     │                    │
│   All 13 tabs equal          └──────┬──────┘                    │
│   No hierarchy                      │                           │
│                              ┌──────┼──────┐                    │
│                              ▼      ▼      ▼                    │
│                           ┌────┐ ┌────┐ ┌────┐                  │
│                           │Vis │ │Mkt │ │Lst │                  │
│                           │ibi │ │Int │ │Opt │                  │
│                           │lity│ │el  │ │imz │                  │
│                           └────┘ └────┘ └────┘                  │
│                           Spoke  Spoke  Spoke                   │
│                                                                 │
│   Each spoke contains related sub-views                         │
│   with progressive disclosure                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Proposed Section Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  APP HEADER (persistent across all sections)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Icon] App Name                          [Track] [★] [↗]  │ │
│  │ Developer Name · Rating ★4.8 · 234 reviews · Free plan    │ │
│  │                                                            │ │
│  │ Visibility: ██████████░░ 72    Power: ████████░░░░ 58     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  NAVIGATION (4 sections)                                        │
│  ┌──────────┬────────────┬──────────────┬──────────────────┐   │
│  │Dashboard │ Visibility │ Market Intel │ Listing Studio   │   │
│  └──────────┴────────────┴──────────────┴──────────────────┘   │
│                                                                 │
│  Dashboard     = Smart overview (replaces Overview)             │
│  Visibility    = Rankings + Keywords + Ads + Featured           │
│  Market Intel  = Competitors + Similar + Reviews + Changes      │
│  Listing Studio = Details + Compare + Preview                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Tab-to-Section Migration Map

```
Current Tab          →  Proposed Section      →  Sub-view / Location
─────────────────────────────────────────────────────────────────────
Overview             →  Dashboard             →  Smart summary
Details              →  Listing Studio        →  Current Listing
Rankings             →  Visibility            →  Rank Tracker
Changes              →  Market Intel          →  Change Log
Reviews              →  Market Intel          →  Reviews
Similar              →  Market Intel          →  Similar Apps
Featured             →  Visibility            →  Featured Tracker
Ads                  →  Visibility            →  Ad Tracker
Competitors          →  Market Intel          →  Competitors
Keywords             →  Visibility            →  Keyword Tracker
Compare              →  Listing Studio        →  Draft Editor
Preview              →  Listing Studio        →  Live Preview
```

### 5.4 Why This Grouping Works

```
┌─ VISIBILITY ─────────────────────────────────────────────────┐
│                                                              │
│  "How discoverable is my app?"                               │
│                                                              │
│  Keywords ←──drives──→ Rankings                              │
│      │                     │                                 │
│      ├── Ads (paid boost)  ├── Category rank                 │
│      └── Search rank       └── Featured (editorial boost)    │
│                                                              │
│  These 4 data types form a closed feedback loop.             │
│  Seeing them together reveals cause → effect.                │
│                                                              │
│  Example insight enabled:                                    │
│  "Your keyword 'crm' dropped from #3 to #7 because          │
│   competitor X started running ads on it 5 days ago"         │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ MARKET INTEL ───────────────────────────────────────────────┐
│                                                              │
│  "What's happening around me?"                               │
│                                                              │
│  Competitors ←──overlaps──→ Similar Apps                     │
│       │                          │                           │
│       ├── Their changes          ├── Network effects         │
│       └── Comparison metrics     └── Discovery paths         │
│                                                              │
│  Reviews (social proof) + Changes (activity monitoring)      │
│  complete the competitive intelligence picture.              │
│                                                              │
│  Example insight enabled:                                    │
│  "Competitor Y updated their description 3 days ago and      │
│   gained 2 positions in 'project management' category"       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ LISTING STUDIO ─────────────────────────────────────────────┐
│                                                              │
│  "How do I improve my listing?"                              │
│                                                              │
│  Current State ←──compare──→ Draft/Edit                      │
│       │                          │                           │
│       ├── All metadata fields    ├── Character validation    │
│       └── SEO analysis           └── A/B suggestions         │
│                                                              │
│  Preview (visual verification) closes the edit loop.         │
│                                                              │
│  Example workflow:                                           │
│  See current listing → Draft improvements → Preview result   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Page-by-Page Redesign Specifications

### 6.1 Dashboard (Hub)

**Purpose:** Answer "What needs my attention right now?" in under 10 seconds.

**Design Principles:**
- Exception-based: highlight ONLY what changed or needs action
- Temporal: organize by recency, not data type
- Actionable: every card links to the relevant detail view
- Scannable: use color, icons, and numbers — minimize text

```
┌─────────────────────────────────────────────────────────────────┐
│ DASHBOARD                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ HEALTH SCORE BAR ──────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Visibility ██████████░░ 72 (+3)   Power ████████░░░░ 58   │ │
│ │  Keywords ranked: 24/30            Avg position: 12.4       │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ ALERTS & ACTIONS (if any) ─────────────────────────────────┐ │
│ │                                                             │ │
│ │  ⚠ 3 keywords dropped 5+ positions     [View in Visibility]│ │
│ │  ⚠ Competitor "Rival App" changed name  [View in Intel]    │ │
│ │  ✦ New featured placement: "Staff Pick" [View in Visibility]│ │
│ │  ★ 2 new reviews (avg 3.5★)            [View in Intel]    │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ VISIBILITY SNAPSHOT ────┐  ┌─ COMPETITIVE SNAPSHOT ────────┐ │
│ │                          │  │                               │ │
│ │  Top Keyword Movers      │  │  vs 8 Competitors             │ │
│ │  ▲ "crm tool"    #3→#1  │  │  Rating:   2nd / 8            │ │
│ │  ▲ "helpdesk"    #9→#5  │  │  Reviews:  4th / 8            │ │
│ │  ▼ "support"     #4→#8  │  │  Price:    3rd / 8            │ │
│ │                          │  │                               │ │
│ │  Category Ranks          │  │  Recent Competitor Moves      │ │
│ │  CRM:          #4 (=)   │  │  • Rival X: changed pricing   │ │
│ │  Help Desk:    #7 (+2)  │  │  • App Y: +15 reviews (7d)   │ │
│ │  Sales:        #12 (-1) │  │                               │ │
│ │                          │  │                               │ │
│ │  [Go to Visibility →]   │  │  [Go to Market Intel →]       │ │
│ └──────────────────────────┘  └───────────────────────────────┘ │
│                                                                 │
│ ┌─ LISTING HEALTH ────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Title: 48/70 chars ██████████████░░░░░░░░                  │ │
│ │  Description: 1,240/4,000 chars ██████░░░░░░░░░░░░░░        │ │
│ │  SEO Title: ✓  Meta Desc: ✓  Features: 8 listed            │ │
│ │                                                             │ │
│ │  [Go to Listing Studio →]                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Differences from Current Overview:**
1. **Alerts section** — proactive, not just data display
2. **Scores prominent** — Visibility/Power are the north-star metrics
3. **Card-based layout** — each card maps to one section, not to raw data
4. **Progressive disclosure** — cards show 3-5 items max with "Go to..." links
5. **No raw tables** — only curated highlights
6. **Faster loading** — fewer API calls, lighter data payloads

---

### 6.2 Visibility Section

**Purpose:** Everything about discoverability — keywords, rankings, ads, featured.

```
┌─────────────────────────────────────────────────────────────────┐
│ VISIBILITY                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──── Sub-navigation (pills, not tabs) ────────────────────┐   │
│ │  [Overview]  [Keywords]  [Rankings]  [Ads]  [Featured]   │   │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === VISIBILITY > OVERVIEW (default) ===                         │
│                                                                 │
│ ┌─ VISIBILITY TREND ──────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Score: 72/100 (+3 this week)                               │ │
│ │                                                             │ │
│ │  80│         ╭──╮                                           │ │
│ │  70│    ╭────╯  ╰──╮  ╭──────                              │ │
│ │  60│────╯           ╰──╯                                    │ │
│ │  50│                                                        │ │
│ │    └────────────────────────────────                        │ │
│ │     Mar 1                    Mar 28                         │ │
│ │                                                             │ │
│ │  Breakdown:                                                 │ │
│ │  ├── Keyword rankings:  34 pts  (+2)                        │ │
│ │  ├── Category rankings: 18 pts  (=)                         │ │
│ │  ├── Featured spots:    12 pts  (+1)                        │ │
│ │  └── Ad presence:        8 pts  (=)                         │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ QUICK INSIGHTS ────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  24 keywords ranked  │  3 featured spots  │  5 ad keywords  │ │
│ │  Best: "crm" at #1   │  Staff Pick (new!) │  Spend: medium  │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === VISIBILITY > KEYWORDS (sub-view) ===                        │
│                                                                 │
│ ┌─ KEYWORD TABLE ─────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Same as current Keywords tab, but with INLINE context:     │ │
│ │                                                             │ │
│ │  Keyword    Rank  Δ    Ads? Featured? Competition           │ │
│ │  ─────────────────────────────────────────────────          │ │
│ │  crm tool    #1   ▲2   ✓    ✓ Staff   12 apps             │ │
│ │  helpdesk    #5   ▲4   ✗    ✗         28 apps             │ │
│ │  support     #8   ▼4   ✓    ✗         45 apps             │ │
│ │                                                             │ │
│ │  ↑ Ads and Featured columns are NEW — pulled from Ads &    │ │
│ │    Featured data, shown inline instead of separate tabs     │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === VISIBILITY > RANKINGS (sub-view) ===                        │
│                                                                 │
│  Same charts as current Rankings tab                            │
│  (Category + Keyword rank line charts)                          │
│                                                                 │
│ === VISIBILITY > ADS (sub-view) ===                             │
│                                                                 │
│  Heatmaps (keyword + category) — same as current Ads tab        │
│  BUT with "Impact" column showing rank correlation              │
│                                                                 │
│ === VISIBILITY > FEATURED (sub-view) ===                        │
│                                                                 │
│  Heatmap — same as current Featured tab                         │
│  BUT with "Traffic Impact" estimate where possible              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Unified Visibility Score** at the top provides a single north-star metric
- **Keywords table gains context columns** (ads, featured) — no more tab-hopping
- **Sub-navigation uses pills** (not tabs) to differentiate from main nav
- **Overview sub-view** shows the composite score breakdown — helps users understand what drives visibility
- **Rankings, Ads, Featured** keep their heatmaps but gain correlation context

---

### 6.3 Market Intel Section

**Purpose:** Everything about the competitive landscape and market signals.

```
┌─────────────────────────────────────────────────────────────────┐
│ MARKET INTEL                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──── Sub-navigation ──────────────────────────────────────┐   │
│ │ [Competitors] [Similar Apps] [Reviews] [Change Log]      │   │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === MARKET INTEL > COMPETITORS (default) ===                    │
│                                                                 │
│ ┌─ COMPETITOR TABLE ──────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Redesigned table with column presets:                      │ │
│ │                                                             │ │
│ │  Presets: [Essential] [Growth] [Content] [Full] [Custom]   │ │
│ │                                                             │ │
│ │  "Essential" preset (default — 6 columns):                  │ │
│ │  ┌────────────┬───────┬─────┬────────┬───────┬───────────┐ │ │
│ │  │ App        │ Vis.  │ Pwr │ Rating │ Price │ Momentum  │ │ │
│ │  ├────────────┼───────┼─────┼────────┼───────┼───────────┤ │ │
│ │  │ ★ My App   │  72   │  58 │  4.8   │ Free  │  ▲ Rising │ │ │
│ │  │   Rival X  │  85   │  71 │  4.6   │ $9.99 │  = Steady │ │ │
│ │  │   App Y    │  64   │  45 │  4.9   │ $4.99 │  ▼ Falling│ │ │
│ │  └────────────┴───────┴─────┴────────┴───────┴───────────┘ │ │
│ │                                                             │ │
│ │  "Growth" preset:                                           │ │
│ │  App | Reviews (7d/30d/90d) | Velocity | Rank Keywords     │ │
│ │                                                             │ │
│ │  "Content" preset:                                          │ │
│ │  App | Last Change | Change Count | Desc Length | Features  │ │
│ │                                                             │ │
│ │  [+ Add Competitor] [Suggestions]                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ COMPETITOR ACTIVITY FEED ──────────────────────────────────┐ │
│ │                                                             │ │
│ │  Below the table: merged change feed from all competitors   │ │
│ │                                                             │ │
│ │  Today                                                      │ │
│ │  ├── Rival X changed "description" (12:00)                  │ │
│ │  ├── App Y received 3 new reviews (avg 5★)                  │ │
│ │  This week                                                  │ │
│ │  ├── Rival X started running ads on "crm" keyword           │ │
│ │  └── App Z gained Featured: Staff Pick placement            │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === MARKET INTEL > SIMILAR APPS ===                             │
│                                                                 │
│  3-panel layout (same heatmaps, improved headers):              │
│  ┌─────────────────┬──────────────────┬──────────────────┐     │
│  │ Direct Similar  │ Reverse Similar  │ 2nd Degree       │     │
│  │ "Apps like you" │ "You're like     │ "Extended        │     │
│  │                 │  these apps"     │  network"        │     │
│  │ [heatmap]       │ [heatmap]        │ [heatmap]        │     │
│  └─────────────────┴──────────────────┴──────────────────┘     │
│                                                                 │
│ === MARKET INTEL > REVIEWS ===                                  │
│                                                                 │
│  ┌─ REVIEW INSIGHTS ─────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  ┌── Rating Trend (90d chart) ──┐  ┌── Distribution ──┐  │ │
│  │  │  4.9│     ╭──╮               │  │  5★ ████████ 68% │  │ │
│  │  │  4.8│ ────╯  ╰───            │  │  4★ ████    20% │  │ │
│  │  │  4.7│                        │  │  3★ ██       8% │  │ │
│  │  │     └────────────────        │  │  2★ █        3% │  │ │
│  │  │      90 days                 │  │  1★          1% │  │ │
│  │  └──────────────────────────────┘  └──────────────────┘  │ │
│  │                                                           │ │
│  │  Velocity: +12 reviews/30d (▲ vs 8/30d prior)            │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ RECENT REVIEWS (paginated) ──────────────────────────────┐ │
│  │  [Newest ▼] [All Ratings ▼]  ← NEW: rating filter        │ │
│  │                                                           │ │
│  │  ★★★★★  "Great tool!"         John D. · 2 days ago      │ │
│  │  ★★★★☆  "Good but slow"       Maria K. · 5 days ago     │ │
│  │  ...                                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === MARKET INTEL > CHANGE LOG ===                               │
│                                                                 │
│  Unified timeline: own changes + competitor changes             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Filter: [All] [My App] [Competitors]  [Field ▼]        │   │
│  │                                                         │   │
│  │ Mar 28 — My App — description changed                   │   │
│  │          [old text → new text diff]                      │   │
│  │                                                         │   │
│  │ Mar 26 — Rival X — pricing changed                      │   │
│  │          [Free → $9.99/mo]                               │   │
│  │                                                         │   │
│  │ Mar 25 — My App — features updated                      │   │
│  │          [+2 features added]                             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Competitor table gets presets** — 18 columns is too many; presets solve the column overload
- **Competitor Activity Feed** — merges competitor changes, new reviews, and ad/featured moves into one timeline
- **Change Log is unified** — own + competitor changes in one filterable timeline (currently split across Overview bottom + Changes tab)
- **Reviews get summary insights** — velocity, distribution analysis before raw list
- **Review filtering** — by rating, useful for finding negative reviews to respond to

---

### 6.4 Listing Studio Section

**Purpose:** Everything for optimizing the app listing — view, edit, preview.

```
┌─────────────────────────────────────────────────────────────────┐
│ LISTING STUDIO                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──── Sub-navigation ──────────────────────────────────────┐   │
│ │ [Current Listing]  [Draft Editor]  [Live Preview]        │   │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ === LISTING STUDIO > CURRENT LISTING (default) ===              │
│                                                                 │
│ ┌─ LISTING SCORECARD ─────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Listing Completeness: ████████████░░░░ 78%                 │ │
│ │                                                             │ │
│ │  ✓ Title (48/70 chars)          — Good length               │ │
│ │  ✓ Subtitle (32/70 chars)       — Could be longer           │ │
│ │  ⚠ Description (1,240/4,000)    — Below average (avg 2,800) │ │
│ │  ✓ Features (8 listed)          — Above average             │ │
│ │  ✓ SEO Title                    — Present                   │ │
│ │  ⚠ SEO Meta Description         — Missing!                  │ │
│ │  ✓ Categories (3)               — Good coverage             │ │
│ │  ─ Languages (1)                — Consider adding more      │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Below: current Details page content (metadata fields,          │
│  pricing table, categories, platform-specific fields)           │
│  Laid out in a 2-column card grid instead of vertical stack     │
│                                                                 │
│ ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│ │ Description             │  │ Pricing Plans               │   │
│ │ ─────────────────────── │  │ ───────────────────────────  │   │
│ │ Full text with          │  │ Free: $0/mo                 │   │
│ │ expand/collapse for     │  │ Basic: $9.99/mo             │   │
│ │ long descriptions       │  │ Pro: $29.99/mo              │   │
│ │                         │  │                             │   │
│ └─────────────────────────┘  └─────────────────────────────┘   │
│ ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│ │ Features                │  │ SEO & Metadata              │   │
│ │ ─────────────────────── │  │ ───────────────────────────  │   │
│ │ • Feature 1             │  │ SEO Title: "..."            │   │
│ │ • Feature 2             │  │ Meta Desc: "..."            │   │
│ │ • Feature 3             │  │ Languages: English          │   │
│ │                         │  │ Categories: CRM, Sales...   │   │
│ └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                 │
│ === LISTING STUDIO > DRAFT EDITOR ===                           │
│                                                                 │
│  Enhanced version of current Compare tab:                       │
│  - Side-by-side: Current (read-only) | Draft (editable)        │
│  - Character limits with visual progress bars                   │
│  - Keyword density indicator (from tracked keywords)            │
│  - "Suggestions" button per field (based on competitor data)    │
│                                                                 │
│ ┌────────────────────────┐  ┌────────────────────────────────┐ │
│ │ CURRENT                │  │ DRAFT                          │ │
│ │                        │  │                                │ │
│ │ Title:                 │  │ Title:                         │ │
│ │ "My CRM Tool"          │  │ "My CRM Tool - Best...|"      │ │
│ │                        │  │ [48/70 ██████████████░░░░░░]   │ │
│ │                        │  │                                │ │
│ │ Description:           │  │ Description:                   │ │
│ │ "Lorem ipsum..."       │  │ "Lorem ipsum dolor...|"        │ │
│ │                        │  │ [1,240/4,000 ██████░░░░░░░░]   │ │
│ │                        │  │                                │ │
│ │                        │  │ Keyword density:               │ │
│ │                        │  │ "crm": 3x  "helpdesk": 1x     │ │
│ └────────────────────────┘  └────────────────────────────────┘ │
│                                                                 │
│ === LISTING STUDIO > LIVE PREVIEW ===                           │
│                                                                 │
│  Current Preview tab — shows how listing looks on platform      │
│  Enhanced: toggle between "current" and "draft" preview         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Listing Scorecard** — immediately shows what's missing or weak, actionable
- **2-column card grid** for metadata — better use of horizontal space
- **Draft Editor** — side-by-side comparison makes changes visible
- **Keyword density** in editor — connects keywords (Visibility) to listing (Studio)
- **Preview toggle** — compare current vs draft without saving

---

## 7. Cross-Cutting UX Patterns

### 7.1 Contextual Cross-References

One of the biggest problems is disconnected data. Every section should link to related data in other sections:

```
┌─────────────────────────────────────────────────────────────────┐
│              CROSS-REFERENCE PATTERN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  When user sees...          Show link to...                     │
│  ──────────────────────────────────────────────                 │
│  A keyword ranking          → Ads for that keyword              │
│  A competitor in table      → Their changes in Change Log       │
│  A review mentioning a      → Related keyword performance       │
│    feature keyword                                              │
│  A change to description    → Keyword ranks before/after        │
│  An ad for a keyword        → Organic rank for same keyword     │
│  A featured placement       → Visibility score impact           │
│  A similar app              → Whether it's a competitor         │
│  A pricing change           → Competitor pricing comparison     │
│                                                                 │
│  Implementation: inline links, hover popovers, or              │
│  "Related" sidebar panels                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Temporal Context Pattern

Every metric should show both current value AND trend:

```
┌──────────────────────────────────────────────────┐
│  BAD (current)          GOOD (proposed)          │
│                                                  │
│  Rating: 4.8            Rating: 4.8 (▲ +0.1)    │
│  Reviews: 234           Reviews: 234 (+12 / 30d) │
│  Rank: #5               Rank: #5 (was #8, ▲3)   │
│  Keywords: 24           Keywords: 24 (+2 new)    │
│                                                  │
│  Always show: value + direction + magnitude      │
└──────────────────────────────────────────────────┘
```

### 7.3 Progressive Disclosure Pattern

```
Level 1 (Dashboard)     → 3-5 key numbers, alerts
Level 2 (Section view)  → Summary cards + primary table/chart
Level 3 (Detail view)   → Full data table, all columns, heatmaps
Level 4 (Drill-down)    → Individual keyword/competitor detail page

┌─ Example: Keywords ─────────────────────────────────────────┐
│                                                             │
│  L1: "24 keywords ranked, 3 moved significantly"            │
│       ↓ click                                               │
│  L2: Keyword table with rank, change, ads, featured         │
│       ↓ click keyword                                       │
│  L3: Keyword detail: 30d chart, all apps ranked, ads        │
│       ↓ click competitor in keyword                         │
│  L4: Competitor's keyword profile                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Empty State Handling

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  UNTRACKED APP (visitor browsing)                           │
│                                                             │
│  Dashboard: Basic info + public metrics only                │
│  Visibility: Rankings chart + "Track to see keywords"       │
│  Market Intel: Reviews + Similar + "Track for competitors"  │
│  Listing Studio: Current details + "Track to edit drafts"   │
│                                                             │
│  Each locked section shows a preview of what they'd get     │
│  with a clear CTA to track the app                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │     🔒 Track this app to unlock:              │  │   │
│  │  │     • Keyword tracking & optimization         │  │   │
│  │  │     • Competitor comparison table              │  │   │
│  │  │     • Listing draft editor                     │  │   │
│  │  │                                               │  │   │
│  │  │     [Start Tracking →]                         │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  (blurred preview of the feature behind the CTA)    │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Data Freshness Indicator

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Every section shows when data was last refreshed:          │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  Rankings · Updated 2 hours ago  [↻ Refresh] │           │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  Color coding:                                              │
│  • Green:  < 6 hours old                                    │
│  • Yellow: 6-24 hours old                                   │
│  • Red:    > 24 hours old (stale warning)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Navigation & Wayfinding

### 8.1 Header Redesign

The header should be more compact and information-dense:

```
CURRENT HEADER:
┌─────────────────────────────────────────────────────────────────┐
│ [Icon]  App Name                                                │
│         Built for Shopify                                       │
│         Subtitle here                                           │
│         [badges] [badges]                                       │
│                                               [Track] [★] [↗]  │
│                                                                 │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ Rating │ │Reviews │ │Pricing │ │Developer│ │Launched│        │
│ │  4.8   │ │  234   │ │ Free   │ │ Dev Co │ │ 2023   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                                 │
│ [Overview|Details|Rankings|Changes|Reviews|Similar|Featured|...] │
│  ← scrolls horizontally, up to 13 tabs                         │
└─────────────────────────────────────────────────────────────────┘


PROPOSED HEADER:
┌─────────────────────────────────────────────────────────────────┐
│ [Icon]  App Name              ★ 4.8 (234) · Free+ · Dev Co    │
│         Subtitle text here    Visibility: 72  Power: 58        │
│                                               [Track] [★] [↗]  │
│                                                                 │
│ [Dashboard]  [Visibility ▾]  [Market Intel ▾]  [Listing Studio]│
└─────────────────────────────────────────────────────────────────┘
```

**Changes:**
1. **2 rows instead of 5** — stats moved inline, badges removed from header
2. **Visibility/Power scores** prominent in header — these are the north-star metrics
3. **4 main nav items** instead of 13 tabs — massive cognitive load reduction
4. **Dropdown arrows** indicate sections with sub-views (progressive disclosure)

### 8.2 Breadcrumb Depth

```
Platform > Apps > App Name > Section > Sub-view

Examples:
  Shopify > Apps > JotForm AI Chatbot > Visibility > Keywords
  Shopify > Apps > JotForm AI Chatbot > Market Intel > Reviews
  Shopify > Apps > JotForm AI Chatbot > Dashboard
```

### 8.3 Section Dropdown Behavior

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Clicking "Visibility" navigates to Visibility overview.     │
│  Clicking the ▾ arrow shows sub-view dropdown:               │
│                                                              │
│  [Visibility ▾]                                              │
│  ┌─────────────────┐                                         │
│  │ Overview        │  ← Default landing                      │
│  │ Keywords        │                                         │
│  │ Rankings        │                                         │
│  │ Ads             │                                         │
│  │ Featured        │                                         │
│  └─────────────────┘                                         │
│                                                              │
│  This provides both:                                         │
│  - Quick access (1 click to section overview)                │
│  - Direct jump (1 click via dropdown to sub-view)            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Information Density Framework

### 9.1 Density Levels

Different users need different density. Consider a density toggle:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  COMPACT MODE (for power users / ASO analysts)               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Dense tables, smaller fonts, more columns visible,     │  │
│  │ charts compressed, minimal whitespace                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  COMFORTABLE MODE (default)                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Balanced spacing, key metrics prominent,               │  │
│  │ charts at readable size, card-based layout             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  SPACIOUS MODE (for presentations / client demos)            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Large fonts, one chart per viewport, emphasis on       │  │
│  │ visual impact, reduced data points per screen          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Responsive Behavior

```
Desktop (>1280px)          Tablet (768-1280px)       Mobile (<768px)
┌─────┬─────┐              ┌──────────────┐          ┌──────────┐
│     │     │              │              │          │          │
│ Col │ Col │              │  Full width  │          │ Stacked  │
│  1  │  2  │              │  cards       │          │ cards    │
│     │     │              │              │          │ with     │
├─────┴─────┤              ├──────────────┤          │ collapse │
│  Full     │              │  Table with  │          │          │
│  width    │              │  horizontal  │          │ Bottom   │
│  table    │              │  scroll      │          │ sheet    │
└───────────┘              └──────────────┘          │ nav      │
                                                     └──────────┘
```

---

## 10. Wireframe Sketches

### 10.1 Full Page Layout — Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                        MAIN CONTENT                          │
│         │                                                               │
│ ┌─────┐ │ ┌─────────────────────────────────────────────────────────┐   │
│ │ Nav │ │ │ [Icon] JotForm AI Chatbot     ★4.8(234) · Free · JotForm│   │
│ │     │ │ │        Build chatbots with AI  Vis: 72    Pwr: 58       │   │
│ │     │ │ │                                      [Track] [★] [↗]    │   │
│ │     │ │ ├─────────────────────────────────────────────────────────┤   │
│ │     │ │ │ [●Dashboard]  [Visibility▾]  [Market Intel▾]  [Studio] │   │
│ │     │ │ ├─────────────────────────────────────────────────────────┤   │
│ │     │ │ │                                                         │   │
│ │     │ │ │ ┌─ Health Score ──────────────────────────────────────┐ │   │
│ │     │ │ │ │ Vis ████████████░░░ 72(+3)  Pwr ████████░░░░ 58   │ │   │
│ │     │ │ │ │ 24 keywords  │  Avg rank #12.4  │  3 featured      │ │   │
│ │     │ │ │ └────────────────────────────────────────────────────┘ │   │
│ │     │ │ │                                                         │   │
│ │     │ │ │ ┌─ Alerts ───────────────────────────────────────────┐ │   │
│ │     │ │ │ │ ⚠ 3 keywords dropped 5+ pos        [View →]      │ │   │
│ │     │ │ │ │ ✦ New: Staff Pick featured          [View →]      │ │   │
│ │     │ │ │ │ ★ 2 new reviews (avg 3.5★)         [View →]      │ │   │
│ │     │ │ │ └────────────────────────────────────────────────────┘ │   │
│ │     │ │ │                                                         │   │
│ │     │ │ │ ┌─ Visibility ─────────┐ ┌─ Competitors ────────────┐ │   │
│ │     │ │ │ │                      │ │                           │ │   │
│ │     │ │ │ │ Top Movers:          │ │ vs 8 apps:               │ │   │
│ │     │ │ │ │ ▲ crm tool   #3→#1  │ │ Rating:  2nd             │ │   │
│ │     │ │ │ │ ▲ helpdesk   #9→#5  │ │ Reviews: 4th             │ │   │
│ │     │ │ │ │ ▼ support    #4→#8  │ │ Price:   3rd             │ │   │
│ │     │ │ │ │                      │ │                           │ │   │
│ │     │ │ │ │ Categories:          │ │ Recent moves:            │ │   │
│ │     │ │ │ │ CRM:     #4 (=)     │ │ Rival X: changed name   │ │   │
│ │     │ │ │ │ Sales:   #7 (+2)    │ │ App Y: +15 reviews      │ │   │
│ │     │ │ │ │                      │ │                           │ │   │
│ │     │ │ │ │ [Visibility →]      │ │ [Market Intel →]         │ │   │
│ │     │ │ │ └──────────────────────┘ └───────────────────────────┘ │   │
│ │     │ │ │                                                         │   │
│ │     │ │ │ ┌─ Listing Health ───────────────────────────────────┐ │   │
│ │     │ │ │ │ Completeness: ████████████░░░░ 78%                 │ │   │
│ │     │ │ │ │ ✓ Title  ⚠ Description (short)  ✗ Meta desc       │ │   │
│ │     │ │ │ │                              [Listing Studio →]    │ │   │
│ │     │ │ │ └────────────────────────────────────────────────────┘ │   │
│ │     │ │ │                                                         │   │
│ └─────┘ │ └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Full Page Layout — Visibility > Keywords

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                        MAIN CONTENT                          │
│         │                                                               │
│         │ ┌─ HEADER (same as above, collapsed for space) ────────────┐ │
│         │ └──────────────────────────────────────────────────────────┘ │
│         │ │ [Dashboard]  [●Visibility▾]  [Market Intel▾]  [Studio]   │ │
│         │ ├──────────────────────────────────────────────────────────┤ │
│         │ │                                                          │ │
│         │ │ ┌── Pills ──────────────────────────────────────────┐   │ │
│         │ │ │ [Overview] [●Keywords] [Rankings] [Ads] [Featured]│   │ │
│         │ │ └───────────────────────────────────────────────────────┘ │
│         │ │                                                          │ │
│         │ │ ┌─ Keyword Summary ──────────────────────────────────┐   │ │
│         │ │ │ 24 tracked │ 18 ranked │ 3 in top 5 │ 5 with ads  │   │ │
│         │ │ └────────────────────────────────────────────────────┘   │ │
│         │ │                                                          │ │
│         │ │ ┌─ Filters ─────────────────────────────────────────┐   │ │
│         │ │ │ [All Tags ▼] [Word Groups ▼] [Opportunities ▼]   │   │ │
│         │ │ │                              [+ Add] [Suggest]    │   │ │
│         │ │ └────────────────────────────────────────────────────┘   │ │
│         │ │                                                          │ │
│         │ │ ┌─ Keyword Table ────────────────────────────────────┐   │ │
│         │ │ │                                                    │   │ │
│         │ │ │ Keyword      Rank  Δ    Ads  Feat.  Competition   │   │ │
│         │ │ │ ──────────────────────────────────────────────     │   │ │
│         │ │ │ crm tool      #1   ▲2   ✓    ✓      12 apps      │   │ │
│         │ │ │ helpdesk      #5   ▲4   ✗    ✗      28 apps      │   │ │
│         │ │ │ support app   #8   ▼4   ✓    ✗      45 apps      │   │ │
│         │ │ │ ticket mgmt   #12  ▲1   ✗    ✗      33 apps      │   │ │
│         │ │ │ customer svc  #15  =    ✗    ✓      51 apps      │   │ │
│         │ │ │ live chat     —    —    ✓    ✗      67 apps      │   │ │
│         │ │ │ ...                                                │   │ │
│         │ │ │                                                    │   │ │
│         │ │ │ Click a row to expand: 30-day rank chart inline    │   │ │
│         │ │ │ ┌─────────────────────────────────────────────┐   │   │ │
│         │ │ │ │ "crm tool" — 30 day rank history            │   │   │ │
│         │ │ │ │  #1│     ╭──────────                        │   │   │ │
│         │ │ │ │  #3│ ────╯                                  │   │   │ │
│         │ │ │ │  #5│                                        │   │   │ │
│         │ │ │ │    └──────────────────                      │   │   │ │
│         │ │ │ │ Competitors also ranked: Rival X (#2),      │   │   │ │
│         │ │ │ │                          App Y (#4)         │   │   │ │
│         │ │ │ └─────────────────────────────────────────────┘   │   │ │
│         │ │ │                                                    │   │ │
│         │ │ └────────────────────────────────────────────────────┘   │ │
│         │ │                                                          │ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Full Page Layout — Market Intel > Competitors

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                        MAIN CONTENT                          │
│         │                                                               │
│         │ ┌─ HEADER ─────────────────────────────────────────────────┐ │
│         │ └──────────────────────────────────────────────────────────┘ │
│         │ │ [Dashboard]  [Visibility▾]  [●Market Intel▾]  [Studio]   │ │
│         │ ├──────────────────────────────────────────────────────────┤ │
│         │ │                                                          │ │
│         │ │ ┌── Pills ───────────────────────────────────────────┐   │ │
│         │ │ │ [●Competitors] [Similar] [Reviews] [Change Log]   │   │ │
│         │ │ └────────────────────────────────────────────────────┘   │ │
│         │ │                                                          │ │
│         │ │ ┌─ Presets + Actions ─────────────────────────────────┐  │ │
│         │ │ │ View: [●Essential][Growth][Content][Full][Custom]   │  │ │
│         │ │ │                         [+ Add Competitor] [Suggest]│  │ │
│         │ │ └────────────────────────────────────────────────────┘  │ │
│         │ │                                                          │ │
│         │ │ ┌─ Competitor Table (Essential preset) ──────────────┐  │ │
│         │ │ │                                                    │  │ │
│         │ │ │ App           Vis.  Pwr  Rating  Price  Momentum  │  │ │
│         │ │ │ ─────────────────────────────────────────────────  │  │ │
│         │ │ │ ★ My App       72    58   4.8    Free   ▲ Rising  │  │ │
│         │ │ │   Rival X      85    71   4.6    $9.99  = Steady  │  │ │
│         │ │ │   App Y        64    45   4.9    $4.99  ▼ Falling │  │ │
│         │ │ │   Tool Z       78    62   4.4    $14.99 ▲ Rising  │  │ │
│         │ │ │   Widget Co    55    38   4.7    Free   = Steady  │  │ │
│         │ │ │                                                    │  │ │
│         │ │ └────────────────────────────────────────────────────┘  │ │
│         │ │                                                          │ │
│         │ │ ┌─ Activity Feed ────────────────────────────────────┐  │ │
│         │ │ │                                                    │  │ │
│         │ │ │ TODAY                                               │  │ │
│         │ │ │ ├─ 🔄 Rival X changed description        [view →] │  │ │
│         │ │ │ ├─ ★  App Y got 3 new reviews (5★ avg)  [view →] │  │ │
│         │ │ │ │                                                  │  │ │
│         │ │ │ THIS WEEK                                          │  │ │
│         │ │ │ ├─ 📢 Rival X started ads on "crm"      [view →] │  │ │
│         │ │ │ ├─ ⭐ Tool Z gained Staff Pick           [view →] │  │ │
│         │ │ │ └─ 💰 Widget Co changed pricing          [view →] │  │ │
│         │ │ │                                                    │  │ │
│         │ │ └────────────────────────────────────────────────────┘  │ │
│         │ │                                                          │ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Comparison: Before vs After User Journeys

```
┌─────────────────────────────────────────────────────────────────┐
│  TASK: "Which keywords should I target next?"                   │
│                                                                 │
│  BEFORE (current):                                              │
│  1. Go to Keywords tab                                          │
│  2. Look at current keywords                                    │
│  3. Switch to Ads tab to see ad landscape                       │
│  4. Switch to Competitors tab                                   │
│  5. Try to remember competitor keyword info                     │
│  6. Switch to Rankings tab to see rank trends                   │
│  7. Go back to Keywords tab                                     │
│  8. Open keyword suggestions                                    │
│  → 7 tab switches, heavy cognitive load                         │
│                                                                 │
│  AFTER (proposed):                                              │
│  1. Go to Visibility > Keywords                                 │
│  2. See keywords with inline ads/featured/competition columns   │
│  3. Click "Suggestions" → see competitor-derived suggestions    │
│  4. Expand a keyword row → see 30d chart + competitors ranked   │
│  → 0 section switches, all context in one view                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TASK: "What did my competitors do this week?"                  │
│                                                                 │
│  BEFORE (current):                                              │
│  1. Go to Overview, scroll to bottom for competitor changes     │
│  2. Only shows top 10 competitors' changes                      │
│  3. Switch to Competitors tab for the table                     │
│  4. Switch to Changes tab (only shows own changes!)             │
│  5. No unified competitor change view exists                    │
│  → Fragmented, incomplete picture                               │
│                                                                 │
│  AFTER (proposed):                                              │
│  1. Go to Market Intel > Competitors                            │
│  2. See comparison table + Activity Feed below it               │
│  3. Activity Feed merges: changes, reviews, ads, featured       │
│  4. Filter by competitor, type, or time range                   │
│  → Single view, complete picture, filterable                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TASK: "Optimize my listing description"                        │
│                                                                 │
│  BEFORE (current):                                              │
│  1. Go to Details tab to see current description                │
│  2. Switch to Compare tab to edit draft                         │
│  3. Switch to Keywords tab to check tracked keywords            │
│  4. Go back to Compare, try to include keywords                 │
│  5. Switch to Preview tab to see how it looks                   │
│  6. Realize something needs changing, go back to Compare        │
│  → 5+ tab switches, no keyword guidance while editing           │
│                                                                 │
│  AFTER (proposed):                                              │
│  1. Go to Listing Studio                                        │
│  2. See Listing Scorecard (description flagged as short)        │
│  3. Click Draft Editor → side-by-side with keyword density      │
│  4. Edit with inline keyword tracking                           │
│  5. Toggle to Live Preview without leaving section              │
│  → 0 section switches, guided workflow                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Migration Strategy: V2 Parallel System

### 11.1 Why V2 Instead of In-Place Migration?

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  RISK COMPARISON                                                │
│                                                                 │
│  In-Place Migration:                                            │
│  ├── ✗ 13 tabs modified simultaneously → high regression risk   │
│  ├── ✗ Users disrupted during development                       │
│  ├── ✗ Partial rollback impossible                              │
│  ├── ✗ A/B testing impossible                                   │
│  └── ✗ Must maintain backward compatibility at every step       │
│                                                                 │
│  V2 Parallel System:                                            │
│  ├── ✓ v1 untouched → zero regression risk                     │
│  ├── ✓ Users opt-in to test v2                                  │
│  ├── ✓ Instant rollback: just link back to v1                   │
│  ├── ✓ A/B testing: compare engagement metrics                  │
│  ├── ✓ Clean codebase: no legacy compromises                    │
│  └── ✓ Delete v1 when v2 is validated                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 URL Structure: V1 vs V2 Side by Side

```
V1 (current — untouched)                V2 (new — parallel)
────────────────────────────────────    ────────────────────────────────────
/{platform}/apps/{slug}                 /{platform}/apps/v2/{slug}
/{platform}/apps/{slug}/details         /{platform}/apps/v2/{slug}/studio
/{platform}/apps/{slug}/rankings        /{platform}/apps/v2/{slug}/visibility/rankings
/{platform}/apps/{slug}/changes         /{platform}/apps/v2/{slug}/intel/changes
/{platform}/apps/{slug}/reviews         /{platform}/apps/v2/{slug}/intel/reviews
/{platform}/apps/{slug}/similar         /{platform}/apps/v2/{slug}/intel/similar
/{platform}/apps/{slug}/featured        /{platform}/apps/v2/{slug}/visibility/featured
/{platform}/apps/{slug}/ads             /{platform}/apps/v2/{slug}/visibility/ads
/{platform}/apps/{slug}/competitors     /{platform}/apps/v2/{slug}/intel/competitors
/{platform}/apps/{slug}/keywords        /{platform}/apps/v2/{slug}/visibility/keywords
/{platform}/apps/{slug}/compare         /{platform}/apps/v2/{slug}/studio/draft
/{platform}/apps/{slug}/preview         /{platform}/apps/v2/{slug}/studio/preview
```

### 11.3 Next.js App Router Directory Structure

```
apps/dashboard/src/app/(dashboard)/[platform]/apps/
│
├── [slug]/                          ← V1 (existing, UNTOUCHED)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── app-nav.tsx
│   ├── details/
│   ├── rankings/
│   ├── ...all existing tabs
│   └── (all current files remain)
│
└── v2/                              ← V2 (new directory)
    └── [slug]/
        ├── layout.tsx               ← New: compact header + 4-section nav
        ├── page.tsx                 ← New: Dashboard (hub)
        ├── v2-nav.tsx               ← New: 4-section navigation component
        │
        ├── visibility/              ← Section 1: Visibility
        │   ├── layout.tsx           ← Sub-nav: Overview/Keywords/Rankings/Ads/Featured
        │   ├── page.tsx             ← Visibility Overview (score + breakdown)
        │   ├── keywords/
        │   │   └── page.tsx         ← Enhanced keyword table
        │   ├── rankings/
        │   │   └── page.tsx         ← Rank charts
        │   ├── ads/
        │   │   └── page.tsx         ← Ad heatmaps
        │   └── featured/
        │       └── page.tsx         ← Featured heatmaps
        │
        ├── intel/                   ← Section 2: Market Intel
        │   ├── layout.tsx           ← Sub-nav: Competitors/Similar/Reviews/Changes
        │   ├── page.tsx             ← Redirects to competitors (default)
        │   ├── competitors/
        │   │   └── page.tsx         ← Competitor table + activity feed
        │   ├── similar/
        │   │   └── page.tsx         ← Similar apps heatmaps
        │   ├── reviews/
        │   │   └── page.tsx         ← Review insights + list
        │   └── changes/
        │       └── page.tsx         ← Unified change log
        │
        └── studio/                  ← Section 3: Listing Studio
            ├── layout.tsx           ← Sub-nav: Current/Draft/Preview
            ├── page.tsx             ← Current listing + scorecard
            ├── draft/
            │   └── page.tsx         ← Side-by-side draft editor
            └── preview/
                └── page.tsx         ← Platform preview

Total new files: ~22 pages + ~5 layouts + ~5 components ≈ 32 files
```

### 11.4 Shared Code Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     CODE SHARING MODEL                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SHARED (used by both v1 and v2):                               │
│  ├── apps/dashboard/src/lib/api.ts          (all API functions) │
│  ├── apps/dashboard/src/lib/auth-context.tsx (auth)             │
│  ├── apps/dashboard/src/contexts/           (platform context)  │
│  ├── apps/dashboard/src/components/ui/      (shadcn components) │
│  └── @appranks/shared                       (platform config)   │
│                                                                 │
│  V2-ONLY (new components):                                      │
│  ├── apps/dashboard/src/components/v2/                          │
│  │   ├── health-score-bar.tsx               (visibility/power)  │
│  │   ├── alerts-card.tsx                    (dashboard alerts)  │
│  │   ├── section-nav.tsx                    (4-section nav)     │
│  │   ├── sub-nav-pills.tsx                  (pill navigation)   │
│  │   ├── visibility-trend-chart.tsx         (score over time)   │
│  │   ├── competitor-presets.tsx              (table presets)     │
│  │   ├── activity-feed.tsx                  (competitor feed)   │
│  │   ├── listing-scorecard.tsx              (completeness)      │
│  │   ├── unified-change-log.tsx             (merged changes)    │
│  │   ├── review-insights.tsx                (review summary)    │
│  │   └── keyword-table-enhanced.tsx         (w/ ads/featured)   │
│  │                                                              │
│  REUSABLE FROM V1 (imported as-is):                             │
│  ├── review-list.tsx                        (paginated reviews) │
│  ├── ad-history.tsx / AdHeatmap             (heatmap component) │
│  ├── featured-history.tsx                   (featured heatmap)  │
│  ├── RankingChart                           (line charts)       │
│  ├── shopify-preview.tsx etc.               (preview renderers) │
│  └── track-button.tsx, star-button.tsx      (action buttons)    │
│                                                                 │
│  Note: V1 components are imported, NOT copied.                  │
│  If a v1 component needs changes for v2, create a new          │
│  v2-specific wrapper/variant in components/v2/                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.5 V1 ↔ V2 Toggle UX

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Option A: Banner in v1 (recommended for initial rollout)       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✨ Try the new app detail experience!  [Switch to v2 →] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  In v2, show a "Back to classic view" link in the header:       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Icon] App Name          [Back to classic] [Track] [★]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Option B: User preference (for later)                          │
│                                                                 │
│  Settings > Preferences > App Detail View: [Classic / New]      │
│  Saved in user profile, auto-redirects based on preference      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.6 Phased Implementation Plan

```
Phase 0: Foundation                                    [~2 days]
──────────────────────────────────────────────────────
- Create v2 directory structure
- Create v2 layout with compact header
- Create v2-nav (4-section navigation)
- Create sub-nav-pills (reusable pill navigation)
- Add v1↔v2 toggle links
- Verify routing works end-to-end

Phase 1: Dashboard (Hub Page)                          [~3 days]
──────────────────────────────────────────────────────
- Health Score Bar component (visibility + power)
- Alerts Card component (detect significant changes)
- Visibility Snapshot card
- Competitive Snapshot card
- Listing Health card
- Wire up all API calls

Phase 2: Visibility Section                            [~4 days]
──────────────────────────────────────────────────────
- Visibility section layout + sub-nav
- Visibility Overview (score breakdown chart)
- Keywords page (enhanced table with ads/featured cols)
- Rankings page (reuse v1 chart components)
- Ads page (reuse v1 heatmap components)
- Featured page (reuse v1 heatmap components)

Phase 3: Market Intel Section                          [~4 days]
──────────────────────────────────────────────────────
- Intel section layout + sub-nav
- Competitors page (table with presets + activity feed)
- Similar Apps page (reuse v1 heatmaps)
- Reviews page (insights summary + enhanced list)
- Change Log page (unified: self + competitors)

Phase 4: Listing Studio Section                        [~3 days]
──────────────────────────────────────────────────────
- Studio section layout + sub-nav
- Current Listing page (scorecard + metadata cards)
- Draft Editor page (side-by-side + keyword density)
- Live Preview page (reuse v1 preview components)

Phase 5: Polish & Cross-References                     [~2 days]
──────────────────────────────────────────────────────
- Add trend indicators (Δ values) everywhere
- Cross-reference links between sections
- Loading states for all pages
- Empty states for untracked apps
- Responsive design audit
- Unit tests for new components

Phase 6: Cutover Preparation                           [~1 day]
──────────────────────────────────────────────────────
- V2 → default (redirect /apps/{slug} to /apps/v2/{slug})
- V1 accessible via /apps/classic/{slug}
- Monitor analytics for 2 weeks
- Delete v1 after validation

Total estimated phases: ~19 days
```

### 11.7 V2 Cutover & V1 Cleanup

```
Timeline:
─────────────────────────────────────────────────────────────────

Week 1-3:  Build v2 alongside v1
           V1 = default, V2 = opt-in via banner/link

Week 4:    V2 = default (redirect apps/{slug} → apps/v2/{slug})
           V1 = accessible via apps/classic/{slug}

Week 6:    Analyze metrics (engagement, bounce rate, feature usage)
           If v2 validated → schedule v1 deletion

Week 8:    Delete v1 code
           Rename v2 routes (remove /v2/ prefix)
           Set up 301 redirects from /v2/ URLs to clean URLs

Final URL structure (after cleanup):
/{platform}/apps/{slug}                          → Dashboard
/{platform}/apps/{slug}/visibility               → Visibility overview
/{platform}/apps/{slug}/visibility/keywords      → Keywords
/{platform}/apps/{slug}/visibility/rankings      → Rankings
/{platform}/apps/{slug}/visibility/ads           → Ads
/{platform}/apps/{slug}/visibility/featured      → Featured
/{platform}/apps/{slug}/intel                    → Competitors (default)
/{platform}/apps/{slug}/intel/competitors        → Competitors
/{platform}/apps/{slug}/intel/similar            → Similar Apps
/{platform}/apps/{slug}/intel/reviews            → Reviews
/{platform}/apps/{slug}/intel/changes            → Change Log
/{platform}/apps/{slug}/studio                   → Current Listing
/{platform}/apps/{slug}/studio/draft             → Draft Editor
/{platform}/apps/{slug}/studio/preview           → Live Preview
```

---

## Appendix A: Key Metrics Summary

| Metric | Where It Appears (Current) | Where It Should Appear (Proposed) |
|--------|---------------------------|-----------------------------------|
| Visibility Score | Header (layout), Overview | Header, Dashboard, Visibility overview |
| Power Score | Header (layout), Overview | Header, Dashboard |
| Rating | Header, Overview, Competitors, Reviews | Header, Dashboard, Intel/Competitors, Intel/Reviews |
| Review Count | Header, Overview, Competitors | Header, Dashboard, Intel/Competitors |
| Keyword Rank | Keywords, Rankings, Overview | Visibility/Keywords, Visibility/Rankings, Dashboard |
| Category Rank | Rankings, Overview | Visibility/Rankings, Dashboard |
| Ad Sightings | Ads, Rankings, Overview | Visibility/Keywords (inline), Visibility/Ads |
| Featured Placement | Featured, Overview | Visibility/Keywords (inline), Visibility/Featured, Dashboard |
| Competitor Metrics | Competitors | Intel/Competitors, Dashboard |
| App Changes | Changes, Overview | Intel/Changes, Intel/Competitors (feed), Dashboard |
| Similar Apps | Similar | Intel/Similar |
| Pricing | Header, Details, Competitors | Header, Studio, Intel/Competitors |

## Appendix B: Priority Matrix

```
                        HIGH IMPACT
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         │  Dashboard       │  Cross-refs in   │
         │  Redesign        │  Keyword table   │
         │                  │                  │
         │  Nav restructure │  Activity Feed   │
         │                  │                  │
LOW ─────┼──────────────────┼──────────────────┼───── HIGH
EFFORT   │                  │                  │    EFFORT
         │  Trend           │  Listing         │
         │  indicators      │  Scorecard       │
         │                  │                  │
         │  Table presets   │  Density toggle  │
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                        LOW IMPACT
```

**Start with top-left quadrant: high impact, low effort.**

---

*End of document. This analysis is based on the current codebase as of 2026-03-28.*
