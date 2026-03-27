# Multi-Platform UX Improvement Plan

## Context

The dashboard currently has a flat sidebar accordion listing all enabled platforms, each expanding to 5-7 sub-nav items. The cross-platform overview (`/overview`) shows static platform cards. This UX doesn't scale well: single-platform users see clutter, new users get no guidance, and there's no way to discover/request platforms. We need a UX that gracefully serves 5 personas — from first-time users to power users with 10+ platforms.

## Personas

1. **Fresh Start** — Just signed up, no apps tracked, doesn't know which platforms to use
2. **Single-Platform** — Only uses 1 platform, doesn't want to see 10 others cluttering the UI
3. **Explorer** — Has apps on multiple platforms, tracking 1, wants to discover more
4. **Power User** — Multiple platforms all added, wants unified cross-platform management
5. **Platform Requester** — Has apps on platforms not yet supported, wants to request them

---

## Part 1: Hybrid Navigation (Top Bar + Mini Sidebar)

### Current Problem
The full-width sidebar accordion lists all enabled platforms vertically, each with 5-7 sub-items. Takes up too much horizontal space, clutters the UI for single-platform users, gives no hint that more platforms exist.

### New Design: Top Bar + Icon Sidebar

**Remove the current full sidebar.** Replace with two navigation layers:

#### 1a. Top Bar (full width, always visible)

```
┌──────────────────────────────────────────────────────────┐
│ AppRanks    [● Shopify ▼] [+]    2/11 platforms    ⚙  👤 │
└──────────────────────────────────────────────────────────┘
```

- **Logo** (left) — links to `/overview`
- **Platform Dropdown** — shows active platform with brand color dot, click to switch. Dropdown lists all enabled platforms with colored dots. Selecting navigates to `/{platformId}/{currentSection}` (preserves context)
- **[+] Add Platform** button — opens Platform Discovery Sheet (Part 3)
- **"N/11 platforms"** badge — subtle, clickable, opens Platform Discovery Sheet
- **Settings gear** — links to `/settings`
- **User avatar/menu** — logout, profile

**File:** New `apps/dashboard/src/components/top-bar.tsx`

#### 1b. Mini Icon Sidebar (56px wide, left side)

```
┌────┐
│ 📊 │  Overview
│ 📱 │  Apps
│ ⭐ │  Competitors
│ 🔍 │  Keywords
│ 📂 │  Categories
│ ✨ │  Featured
│    │
│    │
│────│
│ ⚙  │  Settings (mobile only, desktop has it in top bar)
└────┘
```

- Icon-only navigation for the **active platform's** pages
- Hover → tooltip with page name
- Active page: highlighted with platform's brand color accent (left border or background tint)
- Items change based on platform capabilities (e.g., no Keywords for Zoom)
- On mobile: collapses to hamburger menu in top bar

**File:** New `apps/dashboard/src/components/icon-sidebar.tsx`

#### 1c. Layout Change

**File:** `apps/dashboard/src/app/(dashboard)/layout.tsx`

Current: `<Sidebar>` + main content
New: `<TopBar>` + `<IconSidebar>` + main content (wider content area)

```
┌──────────────────────────────────────────────────────────┐
│                    Top Bar                                │
├────┬─────────────────────────────────────────────────────┤
│ 📊 │                                                     │
│ 📱 │           Main Content (wider than before)          │
│ ⭐ │                                                     │
│ 🔍 │                                                     │
│ 📂 │                                                     │
│ ✨ │                                                     │
└────┴─────────────────────────────────────────────────────┘
```

#### 1d. Mobile Behavior
- Top bar stays, but platform dropdown moves to hamburger menu
- Icon sidebar hidden, replaced by hamburger → Sheet with full nav items (labels + icons)
- Existing `MobileSidebar` pattern reused with new content

#### Implementation
- Delete accordion logic from current `sidebar.tsx` (lines 226-285)
- Create `top-bar.tsx`: logo, platform dropdown, [+] button, N/11 badge, settings, user menu
- Create `icon-sidebar.tsx`: icon-only nav from `getNavItems(activePlatformId)`
- Update `layout.tsx`: replace `<Sidebar>` with `<TopBar>` + `<IconSidebar>`
- `activePlatformId` derived from URL via existing `extractPlatform(pathname)`
- Platform dropdown uses existing `enabledPlatforms` from `useAuth()`

---

## Part 2: Cross-Platform Hub (Redesigned `/overview`)

### Current Problem
Static grid of platform cards. No onboarding, no discovery, no aggregated insights.

### New Design: Persona-Adaptive Hub

**File:** `apps/dashboard/src/app/(dashboard)/overview/page.tsx`

Detect user state from `enabledPlatforms.length` + aggregated stats and render accordingly:

#### 2a. New User State (0 tracked apps across all platforms)

```
┌─────────────────────────────────────────────────┐
│  Welcome to AppRanks                            │
│  Track, analyze, and optimize your app store    │
│  presence across 11+ marketplaces.              │
│                                                 │
│  [● ● ● ● ● ● ● ● ● ● ●] ← 11 platform icons │
│                                                 │
│  [ Get Started — Add Your First App ]           │
└─────────────────────────────────────────────────┘

┌─ Step 1 ──────┐  ┌─ Step 2 ──────┐  ┌─ Step 3 ──────┐
│ Choose Your   │  │ Add Your      │  │ Track Keywords│
│ Platform      │  │ First App     │  │ & Competitors │
│ [Select →]    │  │ [Search →]    │  │ (coming next) │
└───────────────┘  └───────────────┘  └───────────────┘

── All 11 Platforms ──────────────────────────────
[Platform cards grid — enabled ones have "Go to Dashboard",
 disabled ones have "Enable Platform" button]

── Don't see your platform? ──────────────────────
[Request a Platform]
```

#### 2b. Single-Platform User (1 platform with tracked apps)

```
┌─ Account Usage (compact row) ───────────────────┐
│ 3/10 Apps  12/50 Keywords  2/10 Competitors     │
└─────────────────────────────────────────────────┘

┌─ Shopify App Store ─────────────────────────────┐
│ 3 Apps   12 Keywords   2 Competitors            │
│ [ Go to Shopify Dashboard → ]                   │
└─────────────────────────────────────────────────┘

── Expand Your Tracking ──────────────────────────
  AppRanks supports 10 more platforms:
  [Salesforce] [Canva] [Wix] [WordPress] ... [+]
  (horizontal scrollable mini-cards with "Enable")

── Don't see your platform? ──────────────────────
[Request a Platform]
```

#### 2c. Multi-Platform User (2+ platforms with tracked apps)

```
┌─ Account Usage (compact row) ───────────────────┐

┌─ Cross-Platform Summary ────────────────────────┐
│ Total: 8 Apps  25 Keywords  6 Competitors       │
│ across 3 platforms                              │
└─────────────────────────────────────────────────┘

┌─ Platform Cards Grid (existing, enhanced) ──────┐
│ Each card: stats + quick actions (Add App, etc.)│
│ Sorted by activity (most tracked items first)   │
└─────────────────────────────────────────────────┘

── Discover More (if < 11 enabled) ───────────────
── Don't see your platform? ──────────────────────
```

#### 2d. "Request a Platform" CTA (all personas, bottom of page)

A Card with soft gradient:
- "Don't see your platform?"
- "We're always expanding. Tell us which marketplace you'd like us to support."
- Button: "Request a Platform" → opens dialog

---

## Part 3: Platform Discovery & Management

### 3a. Platform Discovery Sheet

**New component:** `apps/dashboard/src/components/platform-discovery-sheet.tsx`

Triggered by: `[+]` button in top bar, "Enable Platform" buttons, "Explore More" section.

Uses shadcn `Sheet` (side="right"):

```
┌─ Platform Catalog ──── 11 platforms available ──┐
│ [Search platforms...]                           │
│                                                 │
│ ● Shopify — Shopify App Store                   │
│   Reviews · Keywords · Featured · Ads · Similar │
│   [✓ Active]  [Go to Dashboard →]               │
│                                                 │
│ ○ Wix — Wix App Market                         │
│   Reviews · Keywords · Featured · Pricing       │
│   [Enable Platform]                             │
│                                                 │
│ ○ Zoom — Zoom App Marketplace          [Beta]   │
│   Keywords · Featured                           │
│   [Enable Platform]                             │
│                                                 │
│ ... (all 11 platforms)                          │
│                                                 │
│ ── Missing a platform? ────────────────────     │
│ [Request a Platform]                            │
└─────────────────────────────────────────────────┘
```

### 3b. Self-Service Platform Enable/Disable

**New API endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/account/platforms` | Enable a platform for account |
| `DELETE` | `/api/account/platforms/:platform` | Disable a platform |

**File:** `apps/api/src/routes/account.ts`

Logic:
- Check `account.limits.maxPlatforms` vs current `enabledPlatforms.length`
- Insert/delete from `account_platforms` table
- Only `owner` and `editor` roles can manage
- Dashboard calls `refreshUser()` after to update `AuthContext`

Currently platform management is system-admin only. These new endpoints mirror that logic with limit checks.

### 3c. "Request a Platform" Feature

**New DB table:** `platform_requests`

| Column | Type |
|--------|------|
| id | uuid PK |
| account_id | uuid FK |
| user_id | uuid FK |
| platform_name | varchar (required) |
| marketplace_url | varchar (optional) |
| notes | text (optional) |
| status | varchar (pending/noted/shipped) |
| created_at | timestamp |

**New API endpoint:** `POST /api/account/platform-requests`

**New component:** `apps/dashboard/src/components/platform-request-dialog.tsx`
- Simple form: Platform name (required), Marketplace URL (optional), Notes (optional)
- Success state: "Thanks! We'll review your request."

**Admin view:** Add "Platform Requests" section in system-admin with request counts.

**Files:**
- `packages/db/src/schema/platform-requests.ts` — DB table
- `packages/db/src/migrations/` — migration file
- `apps/api/src/routes/account.ts` — POST endpoint
- `apps/api/src/routes/system-admin.ts` — GET endpoint for admin

---

## Part 4: Post-Login Redirect & Onboarding

### 4a. Change Post-Login/Register Redirect

**File:** `apps/dashboard/src/lib/auth-context.tsx`

Change lines 273 and 300 from:
```typescript
router.push("/shopify/overview");
```
to:
```typescript
router.push("/overview");
```

This sends all users to the persona-adaptive hub instead of hardcoding Shopify.

### 4b. Enhanced Empty States

**File:** `apps/dashboard/src/app/(dashboard)/[platform]/overview/page.tsx`

When a platform has 0 tracked apps, replace the current "No apps yet" text with:

```
┌─────────────────────────────────────────────────┐
│ [Platform Icon]                                 │
│ Start Tracking on {Platform Name}               │
│                                                 │
│ [═══════ Search for your app... ═══════]        │
│ ← inline AppSearchBar                          │
│                                                 │
│ Search for your app by name to start tracking   │
│ rankings, keywords, and competitors.            │
│                                                 │
│ Don't have an app on {platform}?                │
│ [Explore other platforms →]                     │
└─────────────────────────────────────────────────┘
```

---

## Part 5: Power User Navigation

### 5a. Platform Switcher (Cmd+K)

**New component:** `apps/dashboard/src/components/platform-switcher.tsx`

Keyboard shortcut `Cmd+K` opens a quick-switch palette:
- List of enabled platforms with brand colors
- Type to filter
- Enter navigates to the selected platform's **current section** (e.g., if on `/shopify/keywords`, switching to salesforce goes to `/salesforce/keywords`)
- Rendered at layout level: `apps/dashboard/src/app/(dashboard)/layout.tsx`

### 5b. Breadcrumb Context Bar

**Integrated into top bar** (not a separate component):

```
AppRanks    [● Shopify ▼] > Keywords > rank-tracker    [+]  2/11  ⚙  👤
```

- Breadcrumb trail shows: Platform > Section > Detail
- Platform name is the dropdown itself (acts as both breadcrumb and switcher)
- Keeps the top bar informative without adding a separate bar

---

## Part 6: Technical Cleanup

### 6a. Consolidate Platform Display Constants

**Currently duplicated in 3 places:**
- `apps/dashboard/src/components/sidebar.tsx` (lines 39-65) — `PLATFORM_LABELS`, `PLATFORM_COLORS`
- `apps/dashboard/src/app/(dashboard)/overview/page.tsx` (lines 12-76) — `PLATFORM_BRANDS`
- `apps/dashboard/src/lib/platform-display.ts` (lines 1-29) — `PLATFORM_LABELS`, `PLATFORM_COLORS`

**Consolidate all into** `apps/dashboard/src/lib/platform-display.ts`:
```typescript
export const PLATFORM_DISPLAY: Record<PlatformId, {
  label: string;
  shortLabel: string;  // "Google WS" etc.
  color: string;
  gradient: string;
  borderTop: string;
  textAccent: string;
}>;
```

Update all consumers to import from this single file.

### 6b. Fix: Add HubSpot to ALL_PLATFORMS

`overview/page.tsx` line 78 is missing `hubspot` from `ALL_PLATFORMS` array.

---

## New Components Summary

| Component | File | Purpose |
|-----------|------|---------|
| `TopBar` | `components/top-bar.tsx` | Platform dropdown, [+], breadcrumb, settings, user |
| `IconSidebar` | `components/icon-sidebar.tsx` | 56px icon-only page nav for active platform |
| `PlatformDiscoverySheet` | `components/platform-discovery-sheet.tsx` | Full platform catalog |
| `PlatformRequestDialog` | `components/platform-request-dialog.tsx` | Request new platform form |
| `PlatformSwitcher` | `components/platform-switcher.tsx` | Cmd+K quick switcher |
| `OnboardingHero` | `components/onboarding-hero.tsx` | Welcome state for /overview |
| `EmptyPlatformState` | `components/empty-platform-state.tsx` | Enhanced empty state |

## Files to Modify

| File | Change |
|------|--------|
| `apps/dashboard/src/app/(dashboard)/layout.tsx` | Replace Sidebar with TopBar + IconSidebar |
| `apps/dashboard/src/app/(dashboard)/overview/page.tsx` | Complete redesign with persona-adaptive hub |
| `apps/dashboard/src/lib/auth-context.tsx` | Change post-login redirect to `/overview` |
| `apps/dashboard/src/lib/platform-display.ts` | Consolidate all platform display constants |
| `apps/dashboard/src/components/sidebar.tsx` | Remove or repurpose (mobile sheet content) |
| `apps/api/src/routes/account.ts` | Add platform enable/disable + request endpoints |
| `apps/api/src/routes/system-admin.ts` | Add platform requests admin view |
| `packages/db/src/schema/platform-requests.ts` | New DB table |

## New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/account/platforms` | Self-service enable platform |
| `DELETE` | `/api/account/platforms/:platform` | Self-service disable platform |
| `POST` | `/api/account/platform-requests` | Submit platform request |
| `GET` | `/api/system-admin/platform-requests` | Admin view requests |

## New DB Migration

- `platform_requests` table (id, account_id, user_id, platform_name, marketplace_url, notes, status, created_at)

---

## Implementation Order

### Phase 1 — Foundation
1. Consolidate `PLATFORM_LABELS`/`PLATFORM_COLORS`/`PLATFORM_BRANDS` into `platform-display.ts`
2. Fix HubSpot missing from `ALL_PLATFORMS`
3. Change post-login/register redirect to `/overview`
4. Build self-service platform enable/disable API endpoints

### Phase 2 — Navigation Overhaul
5. Create `TopBar` component (logo, platform dropdown, [+], breadcrumb, settings, user)
6. Create `IconSidebar` component (56px icon-only nav for active platform)
7. Update `layout.tsx`: replace `<Sidebar>` with `<TopBar>` + `<IconSidebar>`
8. Handle mobile: hamburger menu → Sheet with full nav
9. Remove/repurpose old `sidebar.tsx`

### Phase 3 — Overview Hub
10. Build `OnboardingHero` component (welcome state for new users)
11. Build `EmptyPlatformState` component
12. Redesign `/overview` page with persona-adaptive sections
13. Add cross-platform aggregated stats for multi-platform users

### Phase 4 — Discovery & Request
14. Build `PlatformDiscoverySheet` component
15. Create `platform_requests` DB table + migration
16. Add platform request API endpoint
17. Build `PlatformRequestDialog` component
18. Add admin view for platform requests in system-admin

### Phase 5 — Power User Nav
19. Build `PlatformSwitcher` (Cmd+K) component
20. Wire into dashboard layout

### Phase 6 — Polish
21. Enhanced empty states on platform overview pages
22. Animations/transitions for platform switching
23. Mobile optimizations
24. Tests for all new components and API endpoints

## Verification

1. **New user flow**: Register → lands on `/overview` → sees onboarding hero with 11 platforms → picks platform → searches app → starts tracking
2. **Single-platform user**: Top bar shows 1 platform in dropdown → icon sidebar shows that platform's nav → overview shows their stats + "Explore More"
3. **Multi-platform user**: Dropdown lists all platforms → switch preserves current section → overview shows aggregated stats
4. **Platform discovery**: Click [+] → Sheet opens with all 11 platforms → enable/disable → refreshes top bar dropdown
5. **Platform request**: Click "Request a Platform" → form dialog → submit → success → admin can see in system-admin
6. **Cmd+K switcher**: Press Cmd+K → type platform name → Enter → navigates to same section on new platform
7. **Mobile**: Hamburger menu → Sheet with platform list + nav items
8. Run `npm test` to verify all existing + new tests pass
