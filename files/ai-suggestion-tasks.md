# AI-Powered Keyword & Competitor Suggestions — Implementation Plan

**Label:** `ai-suggestion`
**Created:** 2026-03-29
**Status:** Planning

---

## Overview

Replace the current rule-based keyword suggestions (n-gram extraction) and competitor suggestions (Jaccard similarity) with AI-powered engines that understand semantic meaning, user intent, and market context. Keep the existing deterministic signals as inputs to the AI and merge results in a hybrid scoring model.

### Current State
- **Keyword suggestions:** N-gram extraction from app metadata with field weights (name=10x, subtitle=5x, etc.). Only finds keywords literally present in the text.
- **Competitor suggestions:** Jaccard set similarity across 4 dimensions (category, features, keywords, text). Only measures literal overlap.
- **AI integration:** Exists only for research project virtual app generation (OpenAI GPT-4o in `apps/api/src/routes/research.ts`).

### Target State
- AI understands app's value proposition and generates semantically relevant keywords
- AI evaluates competitor candidates on functional overlap, not just keyword/category overlap
- Hybrid scoring merges AI intelligence with existing data-driven signals
- All AI calls logged to `ai_logs` table with full cost tracking
- Cacheable results to minimize API costs

---

## Phase 0: Shared AI Service Layer
**Priority:** Urgent | **Depends on:** Nothing

### Problem
AI integration currently exists only in `apps/api/src/routes/research.ts` for virtual app generation. There's no reusable AI service layer — each new AI feature would duplicate OpenAI client setup, cost tracking, prompt management, and `ai_logs` insertion logic.

### Solution
Create `packages/shared/src/ai-service.ts`:

1. **OpenAI client initialization** — singleton with configurable timeout
2. **`callAI(options)` function** — wraps the full lifecycle:
   - Accepts: `systemPrompt`, `userPrompt`, `model` (default `gpt-4o-mini`), `temperature`, `maxTokens`, `responseFormat` (JSON schema), `metadata`
   - Returns: parsed response + token usage + duration
   - Handles: timeout, rate limits (429), JSON parse errors
3. **`logAICall(db, params)` function** — inserts into `ai_logs` table
4. **Cost calculation helper** — `computeCost(model, promptTokens, completionTokens)` with pricing table
5. **Retry logic** — configurable retry count for transient failures

### Type Definitions
```typescript
interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string; // default 'gpt-4o-mini'
  temperature?: number; // default 0.7
  maxTokens?: number; // default 4000
  responseFormat?: object; // JSON schema for structured output
  timeout?: number; // ms, default 120000
  retries?: number; // default 1
}

interface AICallResult {
  content: string;
  parsed?: any;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
}
```

### Files to Create/Modify
- **Create:** `packages/shared/src/ai-service.ts`
- **Modify:** `apps/api/src/routes/research.ts` — refactor to use shared service
- **Create:** `packages/shared/src/__tests__/ai-service.test.ts`

### Acceptance Criteria
- [ ] `ai-service.ts` module with `callAI()`, `logAICall()`, `computeCost()`
- [ ] Virtual app generation refactored to use the shared service (no behavior change)
- [ ] Unit tests for cost calculation, retry logic, response parsing
- [ ] All existing tests pass

---

## Phase 1: AI Keyword Suggestion Engine — Prompt Engineering & Core Logic
**Priority:** Urgent | **Depends on:** Phase 0

### Problem
Current n-gram keyword extraction misses:
- **Semantic keywords**: Terms users search that describe the app's function but aren't in the listing (e.g., 'inventory management' app missing 'stock control', 'warehouse', 'supply chain')
- **Long-tail variations**: Natural search queries like 'how to track inventory shopify'
- **Intent-based keywords**: What problems users are trying to solve
- **Category-adjacent keywords**: Keywords from related categories the app could rank for
- **Competitor keyword gaps**: Keywords competitors rank for but this app doesn't target

### Solution: ASO-Inspired AI Keyword Engine

#### ASO Weight Model (App Store Optimization)
The AI understands keyword importance hierarchy:

| Source | Weight | Rationale |
|--------|--------|----------|
| App Title/Name | 10x | Highest ranking signal — keywords here rank strongest |
| Subtitle/Tagline | 7x | Second strongest ranking signal |
| Introduction (first 100 chars) | 5x | Above-the-fold visibility |
| Features list | 4x | Indexed and user-visible |
| Category names | 3x | Broad relevance signal |
| Full description | 2x | Indexed but diluted by length |
| Category features/subcategories | 2x | Taxonomy signal |
| Pricing plan names/features | 1x | Niche signal (e.g., 'enterprise', 'free plan') |
| Developer name | 0.5x | Brand keyword potential |

#### Input Data (sent to AI)
```json
{
  "app": {
    "name": "...",
    "subtitle": "...",
    "introduction": "...",
    "description": "... (truncated to 1000 chars)",
    "features": ["..."],
    "categories": [{"title": "...", "subcategories": [...]}],
    "pricingPlans": [{"name": "...", "features": [...]}],
    "developer": "...",
    "integrations": ["..."],
    "languages": ["..."],
    "badges": ["..."]
  },
  "context": {
    "platform": "shopify",
    "existingTrackedKeywords": ["..."],
    "competitorKeywords": ["... (keywords competitors rank for)"],
    "categoryTopKeywords": ["... (popular keywords in same categories)"],
    "ngramSuggestions": ["... (top 20 from current system)"]
  }
}
```

#### AI System Prompt — 5-Tier Keyword Model
The AI acts as an **ASO specialist** and generates keywords in 5 tiers:

| Tier | Score Range | Description | Example |
|------|------------|-------------|---------|
| 1 — Direct Match | 90-100 | Keywords directly describing the app's primary function | 'email marketing', 'inventory management' |
| 2 — Feature Keywords | 70-89 | Keywords from specific features | 'abandoned cart recovery', 'A/B testing' |
| 3 — Problem/Intent | 50-69 | Problems the app solves or user intents | 'reduce cart abandonment', 'increase conversion rate' |
| 4 — Adjacent/Semantic | 30-49 | Related terms from adjacent categories/semantic expansions | 'newsletter', 'drip campaign', 'subscriber management' |
| 5 — Long-tail Opportunities | 10-29 | Multi-word search phrases with lower competition | 'best free email app for small business' |

#### Output Schema
```json
{
  "appSummary": "2-sentence app summary",
  "primaryCategory": "...",
  "targetAudience": "...",
  "keywords": [
    {
      "keyword": "email marketing automation",
      "tier": 2,
      "score": 82,
      "rationale": "Core feature visible in subtitle and introduction",
      "source": "subtitle, features",
      "competitiveness": "high",
      "searchIntent": "transactional"
    }
  ]
}
```

#### Hybrid Scoring: AI + N-gram Merge
- Keyword in both AI and n-gram results → boost score by 20%
- N-gram-only keywords → keep (proven to be in metadata)
- AI-only keywords → use AI score directly
- Sort by merged score, deduplicate, return top N

#### Model Selection
- **Primary:** `gpt-4o-mini` (cost-effective for keyword generation, ~$0.15/1M input, ~$0.60/1M output)
- **Fallback for complex apps:** `gpt-4o` (if mini produces low-quality results)
- Estimated cost per call: ~$0.003-0.008 with gpt-4o-mini

### Files to Create/Modify
- **Create:** `packages/shared/src/ai-keyword-suggestions.ts`
- **Create:** `packages/shared/src/__tests__/ai-keyword-suggestions.test.ts`

### Acceptance Criteria
- [ ] System prompt follows ASO 5-tier model
- [ ] Input builder collects all metadata + context (tracked keywords, competitor keywords, n-gram top 20)
- [ ] Structured output with JSON schema validation
- [ ] Hybrid merge function combining AI + n-gram results
- [ ] Platform-aware prompt (Shopify vs Salesforce etc.)
- [ ] Unit tests for input building, response parsing, score merging
- [ ] 30-50 keywords generated per call

---

## Phase 2: AI Competitor Suggestion Engine — Prompt Engineering & Core Logic
**Priority:** Urgent | **Depends on:** Phase 0

### Problem
Jaccard similarity measures literal set overlap, not meaning. Two apps can be direct competitors with zero Jaccard score if they use different vocabulary.

Misses:
- **Functional competitors:** Apps solving same problem with different feature sets
- **Value proposition overlap:** 'boost sales' vs 'increase revenue' = zero text overlap
- **Market positioning:** Same customer segment, similar pricing
- **Cross-category competitors:** Not in same categories but serving same need
- **Indirect competitors:** Compete for same budget/need

### Solution: AI Competitive Intelligence

#### Input Data
```json
{
  "trackedApp": {
    "name": "...", "subtitle": "...", "introduction": "...",
    "description": "... (800 chars)", "features": ["..."],
    "categories": [{"title": "..."}],
    "pricingPlans": [{"name": "...", "price": "...", "features": [...]}],
    "integrations": ["..."],
    "averageRating": 4.5, "ratingCount": 120, "badges": ["..."]
  },
  "candidateApps": [
    {
      "slug": "...", "name": "...", "subtitle": "...",
      "introduction": "... (200 chars)", "features": ["... (top 5)"],
      "categories": ["..."], "pricingHint": "...",
      "averageRating": 4.2, "ratingCount": 85,
      "jaccardScore": { "overall": 0.35, "category": 0.5, "keyword": 0.2, "text": 0.3, "feature": 0.4 },
      "sharedKeywords": ["..."], "sharedCategories": ["..."]
    }
  ],
  "context": {
    "platform": "shopify",
    "existingCompetitors": ["..."],
    "trackedKeywords": ["..."]
  }
}
```

#### AI Evaluation — 6 Dimensions

| Dimension | Weight | Description |
|-----------|--------|------------|
| Value Proposition Overlap | 30% | Do both apps solve the same core problem? |
| Target Audience Match | 20% | Same customer segment? (small merchants vs enterprise) |
| Feature Functionality Overlap | 20% | Similar capabilities, even if described differently? |
| Market Positioning | 15% | Similar pricing tier and market approach? |
| Keyword/Search Overlap | 10% | Users searching for one would also consider the other? |
| Category Proximity | 5% | Shared or adjacent categories? |

#### Competitor Classification
- **`direct`**: Solves same problem for same audience with similar approach
- **`indirect`**: Solves same problem differently, or adjacent problem for same audience
- **`alternative`**: Different approach entirely but competes for same budget/need
- **`aspirational`**: Market leader that the tracked app could learn from

#### Output Schema
```json
{
  "trackedAppAnalysis": {
    "coreValueProposition": "...",
    "targetSegment": "...",
    "pricingTier": "free|budget|mid-market|enterprise",
    "keyDifferentiators": ["..."]
  },
  "competitors": [
    {
      "slug": "app-slug",
      "aiScore": 85,
      "competitorType": "direct",
      "rationale": "Both apps provide email marketing automation for Shopify merchants, with similar pricing tiers and feature sets.",
      "dimensions": {
        "valueProposition": 90,
        "targetAudience": 85,
        "featureOverlap": 80,
        "marketPositioning": 75,
        "searchOverlap": 70,
        "categoryProximity": 95
      },
      "threatLevel": "high",
      "differentiators": ["Focus on AI-powered content", "Higher price point"]
    }
  ]
}
```

#### Hybrid Scoring: AI + Jaccard Merge
- Final score = **0.6 x AI score (normalized to 0-1) + 0.4 x Jaccard overall**
- AI score > 70 but Jaccard < 0.1 → flagged as "semantic competitor" (missed by traditional analysis)
- Jaccard > 0.5 but AI score < 30 → flagged as "superficially similar"

#### Candidate Pre-filtering (token cost management)
1. Start with Jaccard-based top 48 candidates
2. Add any from `similar_app_sightings` not already in list
3. Cap at 60 candidates max (~8K tokens for candidate data)
4. Compress: name, subtitle, top 5 features only

### Files to Create/Modify
- **Create:** `packages/shared/src/ai-competitor-suggestions.ts`
- **Create:** `packages/shared/src/__tests__/ai-competitor-suggestions.test.ts`

### Acceptance Criteria
- [ ] System prompt evaluates 6 competitor dimensions
- [ ] Competitor type classification (direct/indirect/alternative/aspirational)
- [ ] Hybrid scoring merging AI + Jaccard
- [ ] Candidate pre-filtering to control token costs
- [ ] Platform-aware prompt
- [ ] Unit tests for input building, score merging, classification

---

## Phase 3: Database — AI Suggestion Cache Tables
**Priority:** High | **Depends on:** Nothing (can be done in parallel with Phase 1-2)

### Problem
AI calls cost money and take 3-10 seconds. We need to cache results so:
- Repeated visits don't re-call the AI
- Cost is controlled
- Results are available instantly after first generation

### Solution
Create two new tables for caching AI suggestion results.

#### Table: `ai_keyword_suggestions`
```sql
CREATE TABLE ai_keyword_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  -- AI analysis
  app_summary TEXT,
  primary_category TEXT,
  target_audience TEXT,
  -- Results
  keywords JSONB NOT NULL DEFAULT '[]', -- array of AI keyword objects
  ngram_keywords JSONB NOT NULL DEFAULT '[]', -- preserved n-gram results for comparison
  merged_keywords JSONB NOT NULL DEFAULT '[]', -- final hybrid-scored results
  -- Metadata
  model VARCHAR(50) NOT NULL,
  ai_log_id UUID REFERENCES ai_logs(id),
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER,
  -- Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, generating, success, error
  error_message TEXT,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP, -- cache expiry (e.g., 7 days)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ai_kw_suggestions_app ON ai_keyword_suggestions(account_id, app_id);
CREATE INDEX idx_ai_kw_suggestions_expires ON ai_keyword_suggestions(expires_at);
```

#### Table: `ai_competitor_suggestions`
```sql
CREATE TABLE ai_competitor_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  -- AI analysis of tracked app
  core_value_proposition TEXT,
  target_segment TEXT,
  pricing_tier VARCHAR(20),
  key_differentiators JSONB DEFAULT '[]',
  -- Results
  competitors JSONB NOT NULL DEFAULT '[]', -- array of AI competitor objects
  jaccard_competitors JSONB NOT NULL DEFAULT '[]', -- preserved Jaccard results
  merged_competitors JSONB NOT NULL DEFAULT '[]', -- final hybrid-scored results
  -- Metadata
  model VARCHAR(50) NOT NULL,
  ai_log_id UUID REFERENCES ai_logs(id),
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER,
  -- Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ai_comp_suggestions_app ON ai_competitor_suggestions(account_id, app_id);
CREATE INDEX idx_ai_comp_suggestions_expires ON ai_competitor_suggestions(expires_at);
```

### Cache Strategy
- Default TTL: 7 days (configurable)
- Auto-invalidate when: app snapshot changes, new competitors added, new keywords tracked
- Manual regenerate button in UI
- Background job to clean expired caches

### Files to Create/Modify
- **Create:** `packages/db/src/schema/ai-suggestions.ts`
- **Create:** `packages/db/src/migrations/0096_ai_suggestion_cache_tables.sql`
- **Modify:** `packages/db/src/migrations/meta/_journal.json`
- **Modify:** `packages/db/src/schema/index.ts` (export new tables)

### Acceptance Criteria
- [ ] Both tables created with proper indexes and foreign keys
- [ ] Migration applies cleanly (idempotent with IF NOT EXISTS)
- [ ] Journal entry added
- [ ] Schema exports updated
- [ ] Cache TTL configurable

---

## Phase 4: API Endpoints — AI Keyword Suggestions
**Priority:** High | **Depends on:** Phase 0, Phase 1, Phase 3

### Problem
Need API endpoints to trigger AI keyword generation and serve cached results.

### Solution

#### New Endpoint: `POST /api/account/tracked-apps/:slug/ai-keyword-suggestions/generate`
- Triggers AI keyword generation for a tracked app
- Checks cache first — if valid cache exists and not expired, returns it
- If no cache or expired: calls AI, merges with n-gram, stores in cache, returns
- Logs to `ai_logs`
- Returns: merged keyword suggestions with tier, score, rationale

#### Modified Endpoint: `GET /api/account/tracked-apps/:slug/keyword-suggestions`
- Add `?source=all|ngram|ai` query parameter (default: `all`)
  - `all`: returns AI merged results if cached, falls back to n-gram only
  - `ngram`: returns only n-gram results (current behavior)
  - `ai`: returns only AI results (requires cache)
- Add `aiStatus` field to response: `available | generating | expired | not_generated`
- Add `aiGeneratedAt` field when AI results available

#### Data Collection for AI Prompt
The endpoint needs to gather context data before calling AI:
1. App metadata from latest snapshot (name, subtitle, intro, description, features, categories, pricing, integrations, developer, badges)
2. Currently tracked keywords for this app (from `account_tracked_keywords`)
3. Competitor keywords (keywords that the app's competitors rank for, from `app_keyword_rankings`)
4. Category popular keywords (top keywords in the app's categories)
5. Top 20 n-gram suggestions (from existing `extractKeywordsFromAppMetadata`)

### Files to Create/Modify
- **Modify:** `apps/api/src/routes/account-tracking.ts` — add generate endpoint, modify GET endpoint
- **Create:** `apps/api/src/__tests__/ai-keyword-suggestions.test.ts`

### Acceptance Criteria
- [ ] POST endpoint triggers AI generation and returns results
- [ ] GET endpoint supports `?source=` filter
- [ ] Cache hit returns instantly without AI call
- [ ] Cache miss triggers generation
- [ ] All context data (tracked keywords, competitor keywords, n-gram) collected and sent to AI
- [ ] AI call logged to `ai_logs`
- [ ] Error handling: timeout, rate limit, quota
- [ ] Tests for cache logic, endpoint responses

---

## Phase 5: API Endpoints — AI Competitor Suggestions
**Priority:** High | **Depends on:** Phase 0, Phase 2, Phase 3

### Problem
Need API endpoints to trigger AI competitor analysis and serve cached results.

### Solution

#### New Endpoint: `POST /api/account/tracked-apps/:slug/ai-competitor-suggestions/generate`
- Triggers AI competitor analysis
- Gathers Jaccard candidates first (reuses existing competitor-suggestions logic)
- Enriches candidates with additional data (introduction, features, pricing)
- Calls AI with tracked app + candidates
- Merges AI scores with Jaccard scores
- Stores in cache, returns

#### Modified Endpoint: `GET /api/account/tracked-apps/:slug/competitor-suggestions`
- Add `?source=all|jaccard|ai` query parameter (default: `all`)
  - `all`: returns AI merged results if cached, falls back to Jaccard only
  - `jaccard`: returns only Jaccard results (current behavior)
  - `ai`: returns only AI results (requires cache)
- Each suggestion gains new fields:
  - `competitorType`: direct | indirect | alternative | aspirational
  - `rationale`: AI-generated explanation
  - `threatLevel`: low | medium | high
  - `differentiators`: what makes them different
  - `aiScore`: AI-provided score (separate from Jaccard)
  - `mergedScore`: hybrid AI + Jaccard score
- Add `aiStatus` field to response

#### Data Collection for AI Prompt
1. Tracked app full metadata (latest snapshot)
2. Top 48 Jaccard candidates with their metadata (name, subtitle, introduction, top 5 features, categories, pricing)
3. Similar app sightings for bonus signal
4. Already-added competitors list (to exclude from suggestions)
5. Tracked keywords for this app
6. Shared keywords between tracked app and each candidate

### Files to Create/Modify
- **Modify:** `apps/api/src/routes/account-tracking.ts` — add generate endpoint, modify GET
- **Create:** `apps/api/src/__tests__/ai-competitor-suggestions.test.ts`

### Acceptance Criteria
- [ ] POST endpoint triggers AI analysis and returns results
- [ ] GET endpoint supports `?source=` filter
- [ ] Cache and error handling
- [ ] Each competitor has type, rationale, threat level, differentiators
- [ ] Hybrid score merges AI + Jaccard properly
- [ ] Tests

---

## Phase 6: Dashboard UI — AI Keyword Suggestions
**Priority:** Medium | **Depends on:** Phase 4

### Problem
The current `metadata-keyword-suggestions.tsx` component only shows n-gram results with field source attribution. Need to integrate AI suggestions with a richer UI.

### Solution

#### Modify `apps/dashboard/src/components/metadata-keyword-suggestions.tsx`
1. **AI Generation Button**: "Generate AI Suggestions" button (purple/accent color, AI icon)
   - Shows loading state during generation (animated progress steps like virtual app generation)
   - Disabled while generating, shows "Regenerate" after first generation
   - Shows last generated timestamp

2. **Suggestion Cards with Tier Badges**:
   - Each keyword shows its tier as a colored badge:
     - Tier 1 (Direct): green
     - Tier 2 (Feature): blue
     - Tier 3 (Intent): orange
     - Tier 4 (Adjacent): purple
     - Tier 5 (Long-tail): gray
   - Score displayed as a small progress bar or number
   - Rationale shown on hover/expand
   - Competitiveness indicator (low/medium/high as colored dots)
   - Search intent tag (navigational/informational/transactional)

3. **Source Toggle**: Tabs or toggle for "All", "AI Suggestions", "Metadata (N-gram)"
   - Shows count per source
   - "All" merges and deduplicates

4. **Keyword Actions** (existing, enhanced):
   - Add to tracking (existing)
   - Search in platform (existing)
   - Copy to clipboard (new)
   - View competitors ranking for this keyword (new — links to keyword detail page)

5. **AI Insights Summary** (new section at top):
   - App summary from AI
   - Target audience
   - Primary category
   - "Based on analysis of X metadata fields, Y competitor keywords, and Z tracked keywords"

### Files to Modify
- **Modify:** `apps/dashboard/src/components/metadata-keyword-suggestions.tsx`

### Acceptance Criteria
- [ ] AI generation button triggers API call
- [ ] Loading state with progress steps
- [ ] Tier badges with color coding
- [ ] Source toggle (All/AI/N-gram)
- [ ] AI insights summary section
- [ ] Responsive design
- [ ] Empty state for no AI results yet

---

## Phase 7: Dashboard UI — AI Competitor Suggestions
**Priority:** Medium | **Depends on:** Phase 5

### Problem
The current `competitor-suggestions.tsx` component shows Jaccard-based results with similarity breakdown. Need to integrate AI analysis with richer competitive intelligence.

### Solution

#### Modify `apps/dashboard/src/components/competitor-suggestions.tsx`
1. **AI Analysis Button**: "Analyze Competitors with AI" button
   - Loading state with progress animation
   - Shows last analyzed timestamp

2. **Enhanced Competitor Cards**:
   - **Competitor Type Badge**: direct (red), indirect (orange), alternative (blue), aspirational (purple)
   - **Threat Level Indicator**: high (red pulse), medium (yellow), low (green)
   - **AI Rationale**: 1-2 sentences explaining why this is a competitor (expandable)
   - **Differentiators**: chips showing key differences
   - **Merged Score**: combined AI + Jaccard score with breakdown tooltip
   - Existing: icon, name, rating, pricing, category ranks

3. **Source Toggle**: Tabs for "All", "AI Analysis", "Data-driven (Jaccard)"
   - "AI Analysis" tab can show additional fields not visible in Jaccard mode

4. **Tracked App Analysis Panel** (new, shown when AI data available):
   - Core value proposition identified by AI
   - Target segment
   - Pricing tier positioning
   - Key differentiators vs competitors
   - Competitive landscape summary

5. **Semantic Competitor Alerts** (new):
   - Highlight "semantic competitors" (high AI score, low Jaccard) — "Missed by data analysis, detected by AI"
   - Highlight "superficially similar" (high Jaccard, low AI score) — "Shares keywords but different purpose"

### Files to Modify
- **Modify:** `apps/dashboard/src/components/competitor-suggestions.tsx`

### Acceptance Criteria
- [ ] AI analysis button triggers API call
- [ ] Competitor type badges with color coding
- [ ] Threat level indicators
- [ ] AI rationale expandable section
- [ ] Source toggle
- [ ] Tracked app analysis panel
- [ ] Semantic competitor alerts
- [ ] Responsive design

---

## Phase 8: Background Job — Cache Refresh & Cleanup
**Priority:** Low | **Depends on:** Phase 3, Phase 4, Phase 5

### Problem
AI suggestion caches expire after 7 days. Need automated refresh for active apps and cleanup of expired entries.

### Solution

#### Create `apps/scraper/src/jobs/refresh-ai-suggestions.ts`
1. **Find stale caches**: Query `ai_keyword_suggestions` and `ai_competitor_suggestions` where `expires_at < NOW()` and the app is actively tracked
2. **Re-generate**: Call AI for each stale entry (rate-limited, max 10 per run)
3. **Cleanup**: Delete expired entries for apps no longer tracked
4. **Auto-invalidation**: When a new app snapshot is scraped, mark related AI caches as `stale`
5. **Schedule**: Run daily via BullMQ cron

#### Cost Controls
- Max AI calls per day: configurable (default 50)
- Per-account daily limit: configurable (default 10)
- Skip if budget exceeded for the month
- Log all spending to `ai_logs`

### Files to Create/Modify
- **Create:** `apps/scraper/src/jobs/refresh-ai-suggestions.ts`
- **Modify:** `apps/scraper/src/scheduler.ts` (add cron schedule)

### Acceptance Criteria
- [ ] Stale cache detection and refresh
- [ ] Expired entry cleanup
- [ ] Auto-invalidation on new snapshots
- [ ] Cost controls (daily/monthly limits)
- [ ] Rate limiting between AI calls
- [ ] Runs on BullMQ cron schedule

---

## Phase 9: Rate Limiting & Cost Controls
**Priority:** Low | **Depends on:** Phase 4, Phase 5

### Problem
AI calls cost money. Need guardrails to prevent cost spikes.

### Solution

#### Per-Account Rate Limiting
- Max AI keyword generations per day per account: 5
- Max AI competitor analyses per day per account: 5
- Max total AI calls per day per account: 15
- Cooldown period: 1 hour between regenerations for same app

#### Global Cost Controls
- Monthly budget cap: configurable via env var (default $50)
- Alert at 80% of budget
- Hard stop at 100% (return cached results only)
- Cost dashboard in system-admin AI logs page

#### Implementation
- Track call counts in Redis (TTL-based counters)
- Check budget from `ai_logs` table (sum of `cost_usd` for current month)
- Return 429 with helpful message when limits hit

### Files to Create/Modify
- **Modify:** `apps/api/src/routes/account-tracking.ts` (add rate limit checks)
- **Create:** `packages/shared/src/ai-rate-limiter.ts`

### Acceptance Criteria
- [ ] Per-account daily limits enforced
- [ ] Cooldown between regenerations
- [ ] Monthly budget tracking
- [ ] 429 responses with clear messages
- [ ] System admin can view cost dashboard

---

## Summary — Task Dependency Graph

```
Phase 0 (AI Service Layer) ─────┬──→ Phase 1 (AI Keywords Core) ──→ Phase 4 (API Keywords) ──→ Phase 6 (UI Keywords)
                                 │
                                 ├──→ Phase 2 (AI Competitors Core) ──→ Phase 5 (API Competitors) ──→ Phase 7 (UI Competitors)
                                 │
Phase 3 (DB Cache Tables) ──────┤
                                 │
                                 ├──→ Phase 8 (Background Refresh) ── depends on Phase 4, 5
                                 │
                                 └──→ Phase 9 (Rate Limiting) ── depends on Phase 4, 5
```

## Estimated Token Costs

| Feature | Model | Input Tokens | Output Tokens | Cost per Call |
|---------|-------|-------------|---------------|---------------|
| Keyword Suggestions | gpt-4o-mini | ~3,000 | ~2,000 | ~$0.002 |
| Competitor Analysis | gpt-4o-mini | ~6,000 | ~3,000 | ~$0.003 |
| Complex apps (fallback) | gpt-4o | ~5,000 | ~3,000 | ~$0.04 |

With 7-day cache TTL and ~100 active tracked apps:
- Weekly cost: ~$0.50-1.00 (gpt-4o-mini only)
- Monthly cost: ~$2.00-4.00
