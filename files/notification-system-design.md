# Browser Notification & Notification Center Design Document

> AppRanks.io Push Notification & In-App Notification System
> Created: 2026-03-29

---

## Table of Contents

1. [Vision & Strategy](#1-vision--strategy)
2. [Notification Types & Triggers](#2-notification-types--triggers)
3. [Technical Architecture](#3-technical-architecture)
4. [Web Push Infrastructure](#4-web-push-infrastructure)
5. [In-App Notification Center (User)](#5-in-app-notification-center-user)
6. [System Admin Notification Dashboard](#6-system-admin-notification-dashboard)
7. [Database Schema](#7-database-schema)
8. [API Endpoints](#8-api-endpoints)
9. [Worker & Event Pipeline](#9-worker--event-pipeline)
10. [User Preferences & Controls](#10-user-preferences--controls)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. Vision & Strategy

### Why Browser Notifications?

Email delivers value but has inherent delay — users check email periodically. Browser push notifications deliver **real-time, instant alerts** for time-sensitive marketplace events. Combined with an in-app notification center, users get:

1. **Instant awareness** — Know the moment a competitor overtakes you or your app hits #1
2. **Persistent history** — Never miss an alert; review all past notifications in the notification center
3. **Multi-channel coverage** — Email for detailed reports, push for urgent/time-sensitive alerts
4. **Re-engagement** — Push notifications bring users back to the dashboard, even when the tab is closed

### Core Principles

- **Push = urgent & actionable.** Don't spam. Only push when the user should act NOW or celebrate NOW.
- **Notification center = complete history.** Every event that generates a push also appears in the notification center, even if the user didn't have push enabled.
- **User control.** Users choose what they get pushed about. Defaults are conservative.
- **Admin visibility.** System admins can see exactly what was sent, to whom, when, and why.

### Relationship to Email System

Push notifications and emails serve **different purposes** and should coexist:

| Aspect | Email | Push Notification |
|--------|-------|-------------------|
| **Timing** | Scheduled (daily/weekly) | Real-time (event-driven) |
| **Detail** | Rich, detailed reports | Short, 1-2 line alerts |
| **Action** | Read at leisure | Act now / acknowledge |
| **Reach** | Works always (inbox) | Only if permission granted |
| **Use case** | Digests, summaries, campaigns | Alerts, milestones, urgent changes |

The same event can trigger BOTH an email and a push notification. For example, a ranking drop of 5+ positions triggers:
- **Push:** `"⚠️ Your app dropped from #3 to #8 for 'crm integration'"` (immediate)
- **Email:** Included in the next daily digest with full context (scheduled)

---

## 2. Notification Types & Triggers

### 2.1 Notification Category Matrix

| Category | Type | Trigger | Priority | Default Push | Default In-App |
|----------|------|---------|----------|-------------|----------------|
| **Ranking** | `ranking_top3_entry` | App enters top 3 for a keyword | High | ✅ ON | ✅ ON |
| **Ranking** | `ranking_top3_exit` | App exits top 3 for a keyword | High | ✅ ON | ✅ ON |
| **Ranking** | `ranking_significant_change` | Position changes by 5+ spots | Medium | ✅ ON | ✅ ON |
| **Ranking** | `ranking_new_entry` | App appears for a new keyword | Medium | ⬚ OFF | ✅ ON |
| **Ranking** | `ranking_dropped_out` | App no longer ranks for keyword | High | ✅ ON | ✅ ON |
| **Ranking** | `category_rank_change` | Category position changes by 3+ | Medium | ⬚ OFF | ✅ ON |
| **Competitor** | `competitor_overtook` | Competitor passes your app on keyword | High | ✅ ON | ✅ ON |
| **Competitor** | `competitor_featured` | Competitor gets featured placement | Medium | ⬚ OFF | ✅ ON |
| **Competitor** | `competitor_review_surge` | Competitor gets 10+ reviews in 24h | Medium | ⬚ OFF | ✅ ON |
| **Competitor** | `competitor_pricing_change` | Competitor changes pricing | Low | ⬚ OFF | ✅ ON |
| **Review** | `review_new_positive` | New 4-5 star review on your app | Low | ⬚ OFF | ✅ ON |
| **Review** | `review_new_negative` | New 1-2 star review on your app | High | ✅ ON | ✅ ON |
| **Review** | `review_milestone` | Review count hits 100/250/500/1000 | Medium | ✅ ON | ✅ ON |
| **Milestone** | `milestone_rank_first` | App reaches #1 for a keyword | High | ✅ ON | ✅ ON |
| **Milestone** | `milestone_rating_threshold` | Rating crosses 4.0/4.5/4.8 | Medium | ✅ ON | ✅ ON |
| **Milestone** | `milestone_best_week` | Best ranking week ever | Medium | ✅ ON | ✅ ON |
| **Featured** | `featured_added` | Your app gets featured | High | ✅ ON | ✅ ON |
| **Featured** | `featured_removed` | Your app loses featured status | High | ✅ ON | ✅ ON |
| **System** | `system_welcome` | User registers | — | ⬚ OFF | ✅ ON |
| **System** | `system_scrape_complete` | Daily scrape finished for platform | Low | ⬚ OFF | ✅ ON |
| **System** | `system_account_limit` | Approaching tracked app/keyword limit | Medium | ⬚ OFF | ✅ ON |
| **System** | `system_app_added` | Team member added a new tracked app | Low | ⬚ OFF | ✅ ON |
| **System** | `system_member_joined` | New team member accepted invitation | Low | ⬚ OFF | ✅ ON |

### 2.2 Notification Type Registry

```typescript
enum NotificationType {
  // Ranking events
  RANKING_TOP3_ENTRY = 'ranking_top3_entry',
  RANKING_TOP3_EXIT = 'ranking_top3_exit',
  RANKING_SIGNIFICANT_CHANGE = 'ranking_significant_change',
  RANKING_NEW_ENTRY = 'ranking_new_entry',
  RANKING_DROPPED_OUT = 'ranking_dropped_out',
  CATEGORY_RANK_CHANGE = 'category_rank_change',

  // Competitor events
  COMPETITOR_OVERTOOK = 'competitor_overtook',
  COMPETITOR_FEATURED = 'competitor_featured',
  COMPETITOR_REVIEW_SURGE = 'competitor_review_surge',
  COMPETITOR_PRICING_CHANGE = 'competitor_pricing_change',

  // Review events
  REVIEW_NEW_POSITIVE = 'review_new_positive',
  REVIEW_NEW_NEGATIVE = 'review_new_negative',
  REVIEW_MILESTONE = 'review_milestone',

  // Milestone events
  MILESTONE_RANK_FIRST = 'milestone_rank_first',
  MILESTONE_RATING_THRESHOLD = 'milestone_rating_threshold',
  MILESTONE_BEST_WEEK = 'milestone_best_week',

  // Featured events
  FEATURED_ADDED = 'featured_added',
  FEATURED_REMOVED = 'featured_removed',

  // System events
  SYSTEM_WELCOME = 'system_welcome',
  SYSTEM_SCRAPE_COMPLETE = 'system_scrape_complete',
  SYSTEM_ACCOUNT_LIMIT = 'system_account_limit',
  SYSTEM_APP_ADDED = 'system_app_added',
  SYSTEM_MEMBER_JOINED = 'system_member_joined',
}
```

### 2.3 Notification Content Templates

Each notification type has a structured content template:

```typescript
interface NotificationContent {
  title: string;        // Short headline (max 65 chars for push)
  body: string;         // Description (max 200 chars for push)
  icon?: string;        // Notification icon URL (app icon or platform icon)
  badge?: string;       // Small badge icon for mobile
  url: string;          // Deep link — where to go when clicked
  tag?: string;         // Group tag — replaces previous notification with same tag
  data: Record<string, any>; // Structured data for the notification center
}
```

**Example Content Per Type:**

| Type | Title | Body | Deep Link |
|------|-------|------|-----------|
| `ranking_top3_entry` | `{appName} entered top 3!` | `Now ranked #2 for "{keyword}" on {platform} (was #{oldPos})` | `/keywords/{slug}` |
| `ranking_significant_change` | `{appName} {direction} {positions} spots` | `"{keyword}": #{oldPos} → #{newPos} on {platform}` | `/keywords/{slug}` |
| `competitor_overtook` | `{competitorName} overtook you` | `Now #{compPos} vs your #{yourPos} for "{keyword}"` | `/competitors` |
| `review_new_negative` | `New {rating}-star review` | `"{first60CharsOfReview}..."` | `/apps/{slug}/reviews` |
| `milestone_rank_first` | `#{1} — {appName} is #1!` | `Reached the top for "{keyword}" on {platform}` | `/keywords/{slug}` |
| `featured_added` | `{appName} is now featured!` | `Featured in {categoryName} on {platform}` | `/apps/{slug}` |

---

## 3. Technical Architecture

### 3.1 Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION SYSTEM                           │
│                                                                      │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐  │
│  │   TRIGGERS   │───▶│  NOTIFICATION    │───▶│  DELIVERY          │  │
│  │              │    │  ENGINE          │    │  CHANNELS          │  │
│  │ · Scraper    │    │                  │    │                    │  │
│  │   results    │    │ · Event intake   │    │ · Web Push (VAPID) │  │
│  │ · User       │    │ · Eligibility    │    │ · In-App (DB)      │  │
│  │   actions    │    │ · Rate limiting  │    │ · Email (existing) │  │
│  │ · Cron jobs  │    │ · Dedup         │    │                    │  │
│  │ · System     │    │ · Content build  │    └────────────────────┘  │
│  │   events     │    │ · Fan-out       │                             │
│  └─────────────┘    └──────────────────┘                             │
│                                                                      │
│  ┌────────────────────┐    ┌──────────────────────────────────────┐  │
│  │  USER NOTIFICATION │    │  ADMIN NOTIFICATION DASHBOARD        │  │
│  │  CENTER            │    │                                      │  │
│  │                    │    │  · Sent log (who/when/why/how)       │  │
│  │  · Bell icon       │    │  · Delivery stats                   │  │
│  │  · Unread count    │    │  · Per-user/type breakdown          │  │
│  │  · History list    │    │  · Push subscription management     │  │
│  │  · Mark as read    │    │  · Manual send capability           │  │
│  │  · Preferences     │    │                                      │  │
│  └────────────────────┘    └──────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Push Protocol** | Web Push API (RFC 8030) | Standard, works across browsers |
| **Push Auth** | VAPID (Voluntary Application Server Identification) | No third-party service needed, free |
| **Push Library** | `web-push` npm package | Mature, handles VAPID signing & payload encryption |
| **Service Worker** | Next.js custom SW (`public/sw.js`) | Handles push events when app is closed |
| **Notification Store** | PostgreSQL `notifications` table | Persistent, queryable history |
| **Real-time Delivery** | Server-Sent Events (SSE) or polling | In-app live notification updates |
| **Job Queue** | BullMQ (existing) | Notification send jobs, same infra as scraper |

### 3.3 Web Push Flow

```
┌─────────┐  1. Register SW    ┌──────────────┐
│ Browser  │──────────────────▶│ Service Worker│
│ (Next.js)│                   │ (sw.js)       │
│          │  2. Subscribe      │               │
│          │──────PushManager──▶│               │
│          │                   └───────┬────────┘
│          │  3. Send subscription          │
│          │──────POST /api───────────▶┌────▼────────┐
│          │                          │ API Server   │
│          │                          │ (Fastify)    │
│          │                          │              │
│          │                          │ Store sub in │
│          │                          │ push_subs    │
│          │                          └──────────────┘
│          │                                │
│          │                          [Later, event occurs]
│          │                                │
│          │  5. Push message         ┌─────▼──────────┐
│          │◀────── encrypted ────────│ Worker         │
│          │                          │ web-push lib   │
│          │  6. SW receives push     │ sends to push  │
│          │  7. Show notification    │ service (FCM/  │
│          │  8. User clicks → open   │ Mozilla/Apple) │
│          │     dashboard URL        └────────────────┘
└─────────┘
```

**Key Technical Details:**

1. **VAPID Keys:** Generate once, store in env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Public key shared with frontend for subscription.
2. **Push Subscription Object:** Browser returns `{ endpoint, keys: { p256dh, auth } }`. Stored per-user in DB. A user can have multiple subscriptions (multiple browsers/devices).
3. **Payload Encryption:** `web-push` handles AES-128-GCM encryption automatically. Max payload: 4KB.
4. **Push Service:** Browser-specific (FCM for Chrome, Mozilla Push for Firefox, APNs for Safari 16+). We don't interact with these directly — `web-push` lib handles it via the standard endpoint URL.
5. **Service Worker Lifecycle:** SW persists even when the tab is closed. It wakes up on push events to show notifications.

---

## 4. Web Push Infrastructure

### 4.1 VAPID Key Generation (One-time Setup)

```typescript
import webPush from 'web-push';

// Generate once, store as environment variables
const vapidKeys = webPush.generateVAPIDKeys();
// VAPID_PUBLIC_KEY=BNx... (share with frontend)
// VAPID_PRIVATE_KEY=abc... (keep secret on server)
// VAPID_SUBJECT=mailto:notifications@appranks.io
```

### 4.2 Service Worker (`apps/dashboard/public/sw.js`)

```javascript
// Service Worker for Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming push messages
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  // data: { title, body, icon, badge, url, tag, notificationId }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/notification-icon-192.png',
    badge: data.badge || '/icons/notification-badge-72.png',
    tag: data.tag,           // Groups/replaces similar notifications
    renotify: !!data.tag,    // Vibrate even if replacing
    data: {
      url: data.url,         // Deep link for click handler
      notificationId: data.notificationId,
    },
    actions: data.actions || [],
    timestamp: data.timestamp || Date.now(),
    requireInteraction: data.priority === 'high', // Keep visible for important alerts
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click — open the deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const notificationId = event.notification.data?.notificationId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a dashboard window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes('appranks.io') && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url,
            notificationId,
          });
          return;
        }
      }
      // Otherwise, open a new window
      return clients.openWindow(url);
    })
  );

  // Report click to API (for analytics)
  if (notificationId) {
    fetch(`/api/notifications/${notificationId}/clicked`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  }
});

// Handle notification close (dismiss without clicking)
self.addEventListener('notificationclose', (event) => {
  const notificationId = event.notification.data?.notificationId;
  if (notificationId) {
    fetch(`/api/notifications/${notificationId}/dismissed`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  }
});
```

### 4.3 Frontend Push Subscription (`apps/dashboard/src/lib/push-notifications.ts`)

```typescript
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return null;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return registration;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to our API
  await fetch('/api/notifications/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    await fetch('/api/notifications/push-subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }
}

export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
```

### 4.4 Server-Side Push Sending

```typescript
import webPush from 'web-push';

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,        // 'mailto:notifications@appranks.io'
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url: string;
  tag?: string;
  priority?: 'high' | 'medium' | 'low';
  notificationId: string;
  actions?: Array<{ action: string; title: string }>;
  timestamp?: number;
}

async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  payload: PushPayload,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const result = await webPush.sendNotification(
      subscription as webPush.PushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400,  // 24 hours — how long push service holds the message
        urgency: payload.priority === 'high' ? 'high' : 'normal',
        topic: payload.tag,  // Replaces previous push with same topic
      },
    );
    return { success: true, statusCode: result.statusCode };
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or invalid — remove from DB
      return { success: false, statusCode: error.statusCode, error: 'subscription_expired' };
    }
    return { success: false, statusCode: error.statusCode, error: error.message };
  }
}
```

---

## 5. In-App Notification Center (User)

### 5.1 Bell Icon & Unread Badge

Located in the dashboard header (navbar), always visible:

```
┌────────────────────────────────────────────────────────────────┐
│  [AppRanks logo]   Keywords   Apps   Competitors     🔔 (3)  👤│
└────────────────────────────────────────────────────────────────┘
                                                        ▲
                                                   Bell icon with
                                                   unread count badge
```

**Behavior:**
- Shows unread count as a red badge (e.g., `3`)
- Badge disappears when count is 0
- Count maxes out at `99+`
- Clicking opens the notification dropdown/panel
- Unread count fetched via `GET /api/notifications/unread-count` on page load
- Updates via polling (every 60 seconds) or SSE for real-time

### 5.2 Notification Dropdown Panel

Clicking the bell opens a dropdown panel (not a separate page):

```
┌─────────────────────────────────────────────┐
│  Notifications                    Mark all  │
│                                   as read   │
├─────────────────────────────────────────────┤
│                                             │
│  ● Today                                    │
│  ┌─────────────────────────────────────────┐│
│  │ 🎯 Your app entered top 3!             ││
│  │ #2 for "crm integration" on Shopify    ││
│  │ 2 hours ago                            ││
│  │ ─────────────────────────────────────── ││
│  │ ⚠️ Competitor overtook you             ││
│  │ HubSpot CRM passed you for "sales app" ││
│  │ 3 hours ago                            ││
│  │ ─────────────────────────────────────── ││
│  │ ⭐ New 1-star review                   ││
│  │ "The app is slow and crashes often..."  ││
│  │ 5 hours ago                            ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ○ Yesterday                                │
│  ┌─────────────────────────────────────────┐│
│  │ 🏆 Milestone! 500 reviews reached      ││
│  │ Your Shopify app hit 500 total reviews  ││
│  │ Yesterday at 14:30                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [View all notifications →]                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Shows last 10 notifications grouped by day
- Unread notifications have a blue dot (●) and slightly highlighted background
- Clicking a notification: marks as read + navigates to the deep link URL
- "Mark all as read" button at top
- "View all notifications" links to full notification center page
- Each notification shows: icon, title, body preview, relative time

### 5.3 Full Notification Center Page

**Route:** `/notifications`

```
┌─────────────────────────────────────────────────────────────────┐
│  Notifications                                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [All] [Ranking] [Competitor] [Reviews] [Milestones]      │   │
│  │ [System]                                                  │   │
│  │                                                           │   │
│  │ ┌─────┐ [Mark all as read]   [Notification settings ⚙]  │   │
│  │ │Filter│                                                  │   │
│  │ └─────┘                                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Today — March 29, 2026                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● 🎯  Your app entered top 3!                            │   │
│  │       Acme CRM ranked #2 for "crm integration"           │   │
│  │       on Shopify marketplace                              │   │
│  │       2 hours ago                                ── ✕ ── │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ● ⚔️  HubSpot CRM overtook you                           │   │
│  │       Now #3 vs your #4 for "sales automation"            │   │
│  │       on Shopify marketplace                              │   │
│  │       3 hours ago                                ── ✕ ── │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │   ⭐  New 1-star review on Acme CRM                      │   │
│  │       "The app is slow and crashes often when..."         │   │
│  │       Shopify marketplace                                 │   │
│  │       5 hours ago                                ── ✕ ── │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Yesterday — March 28, 2026                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   🏆  Milestone! 500 reviews reached                     │   │
│  │       Acme CRM hit 500 total reviews on Shopify           │   │
│  │       Yesterday at 14:30                         ── ✕ ── │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │   📊  Daily scrape complete                               │   │
│  │       Shopify data updated — 3 ranking changes detected   │   │
│  │       Yesterday at 06:12                         ── ✕ ── │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Load more ↓]                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Category tabs:** Filter by notification type (Ranking, Competitor, Reviews, etc.)
- **Mark all as read:** Bulk action
- **Individual dismiss:** ✕ button to archive/hide a notification
- **Grouped by day** with date headers
- **Unread indicator:** Blue dot (●) for unread notifications
- **Click to navigate:** Each notification is a link to the relevant dashboard page
- **Infinite scroll / pagination:** "Load more" button or infinite scroll
- **Settings shortcut:** Quick link to notification preferences

---

## 6. System Admin Notification Dashboard

### 6.1 Notification Overview Dashboard

**Route:** `/system-admin/notifications`

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 Notification Management                                     │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Sent Today  │  Sent Week   │  Push Subs   │  Click Rate        │
│    234       │    1,847     │    89/127     │    24.3%           │
│  ▲ +18 vs   │  ▲ +12% vs   │  (70% of     │  ▲ +3.1%          │
│  yesterday   │  last week   │   users)     │  vs last week      │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                                                                  │
│  [Tabs: All | By Type | By User | Push Subscriptions | Settings]│
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NOTIFICATION LOG                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Filter: [Type ▼] [Channel ▼] [User ▼] [Date range]       │  │
│  │         [Status ▼] [Search...]                            │  │
│  ├──────┬──────────┬───────────┬─────────┬────────┬─────────┤  │
│  │ User │ Type     │ Title     │ Channel │ Status │ Sent at │  │
│  ├──────┼──────────┼───────────┼─────────┼────────┼─────────┤  │
│  │ john │ ranking  │ Entered   │ Push    │ Clicked│ 14:30   │  │
│  │ @..  │ _top3    │ top 3!    │ + InApp │        │         │  │
│  ├──────┼──────────┼───────────┼─────────┼────────┼─────────┤  │
│  │ sara │ competi  │ HubSpot   │ InApp   │ Read   │ 14:28   │  │
│  │ @..  │ tor_over │ overtook  │ only    │        │         │  │
│  ├──────┼──────────┼───────────┼─────────┼────────┼─────────┤  │
│  │ dev  │ review   │ New 1-star│ Push    │ Sent   │ 14:15   │  │
│  │ @..  │ _neg     │ review    │ + InApp │ (unread│         │  │
│  │      │          │           │         │  )     │         │  │
│  └──────┴──────────┴───────────┴─────────┴────────┴─────────┘  │
│                                                                  │
│  [← Prev]  Page 1 of 84  [Next →]                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Notification Detail View

**Route:** `/system-admin/notifications/:id`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Notifications                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NOTIFICATION DETAILS                                            │
│                                                                  │
│  ID:        notif_abc123                                         │
│  Type:      ranking_top3_entry                                   │
│  Created:   March 29, 2026 at 14:30:12 UTC                      │
│                                                                  │
│  ── WHO ──                                                       │
│  User:      John Doe (john@example.com)                          │
│  Account:   Acme Corp                                            │
│  Role:      owner                                                │
│                                                                  │
│  ── WHAT ──                                                      │
│  Title:     "Your app entered top 3!"                            │
│  Body:      "Acme CRM ranked #2 for 'crm integration' on        │
│              Shopify marketplace (was #5)"                        │
│  Deep Link: /keywords/crm-integration                            │
│                                                                  │
│  ── WHY ──                                                       │
│  Trigger:   Keyword ranking change detected during Shopify       │
│             scrape at 14:28 UTC                                  │
│  Event Data:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ {                                                       │    │
│  │   "appId": "uuid-...",                                  │    │
│  │   "appName": "Acme CRM",                               │    │
│  │   "keywordId": "uuid-...",                              │    │
│  │   "keyword": "crm integration",                        │    │
│  │   "platform": "shopify",                               │    │
│  │   "oldPosition": 5,                                    │    │
│  │   "newPosition": 2,                                    │    │
│  │   "change": 3,                                         │    │
│  │   "scrapeJobId": "job-..."                             │    │
│  │ }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── HOW (Delivery) ──                                            │
│  ┌──────────┬──────────┬──────────────┬──────────────────┐      │
│  │ Channel  │ Status   │ Delivered at │ Interacted at    │      │
│  ├──────────┼──────────┼──────────────┼──────────────────┤      │
│  │ In-App   │ Read     │ 14:30:12     │ Read at 14:35    │      │
│  │ Push     │ Clicked  │ 14:30:14     │ Clicked at 14:31 │      │
│  │ Email    │ Skipped  │ —            │ — (included in   │      │
│  │          │          │              │   daily digest)   │      │
│  └──────────┴──────────┴──────────────┴──────────────────┘      │
│                                                                  │
│  Push delivery details:                                          │
│  · Endpoint: https://fcm.googleapis.com/fcm/send/...            │
│  · Status code: 201 Created                                      │
│  · TTL: 86400                                                    │
│  · Push sent at: 14:30:13.442                                    │
│  · Subscription: Chrome on MacOS (subscribed 2026-03-15)         │
│                                                                  │
│  [Resend Push]  [Send as Email]  [View User's Notifications]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 By Type Breakdown

**Tab:** "By Type"

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATION STATS BY TYPE                                      │
│  Period: [Last 7 days ▼]                                         │
│                                                                  │
│  ┌────────────────────────┬───────┬───────┬────────┬──────────┐ │
│  │ Type                   │ Sent  │ Push  │ Read   │ Clicked  │ │
│  │                        │ Total │ Sent  │ Rate   │ Rate     │ │
│  ├────────────────────────┼───────┼───────┼────────┼──────────┤ │
│  │ ranking_top3_entry     │  45   │  38   │ 89%    │ 52%      │ │
│  │ ranking_top3_exit      │  23   │  20   │ 91%    │ 61%      │ │
│  │ ranking_significant    │ 312   │ 210   │ 67%    │ 28%      │ │
│  │ competitor_overtook    │  89   │  72   │ 85%    │ 47%      │ │
│  │ review_new_negative    │  18   │  15   │ 94%    │ 71%      │ │
│  │ review_new_positive    │ 156   │  12   │ 45%    │ 15%      │ │
│  │ milestone_rank_first   │   7   │   7   │ 100%   │ 86%      │ │
│  │ featured_added         │   3   │   3   │ 100%   │ 100%     │ │
│  │ system_scrape_complete │ 847   │   0   │ 12%    │ 5%       │ │
│  └────────────────────────┴───────┴───────┴────────┴──────────┘ │
│                                                                  │
│  📊 [Bar chart showing volume by type over last 7 days]          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 By User Breakdown

**Tab:** "By User"

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATION STATS BY USER                                      │
│  Period: [Last 7 days ▼]                                         │
│                                                                  │
│  ┌────────────────┬──────────┬───────┬──────┬────────┬────────┐ │
│  │ User           │ Account  │ Total │ Push │ Unread │ Push   │ │
│  │                │          │ Sent  │ Subs │ Count  │ Status │ │
│  ├────────────────┼──────────┼───────┼──────┼────────┼────────┤ │
│  │ john@acme.com  │ Acme     │  87   │  2   │   3    │ Active │ │
│  │ sara@beta.com  │ Beta     │  64   │  1   │   0    │ Active │ │
│  │ dev@startup.io │ Startup  │ 124   │  0   │  41    │ None   │ │
│  │ admin@big.co   │ BigCorp  │  45   │  1   │   2    │ Active │ │
│  └────────────────┴──────────┴───────┴──────┴────────┴────────┘ │
│                                                                  │
│  Click any user to see their notification history & preferences  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Push Subscription Management

**Tab:** "Push Subscriptions"

```
┌─────────────────────────────────────────────────────────────────┐
│  PUSH SUBSCRIPTION MANAGEMENT                                    │
│                                                                  │
│  Total subscriptions: 127                                        │
│  Active: 89  ·  Expired: 31  ·  Failed: 7                       │
│                                                                  │
│  ┌────────────────┬──────────────┬───────────┬────────┬───────┐ │
│  │ User           │ Browser      │ Subscribed│ Last   │Status │ │
│  │                │              │ at        │ Push   │       │ │
│  ├────────────────┼──────────────┼───────────┼────────┼───────┤ │
│  │ john@acme.com  │ Chrome/Mac   │ Mar 15    │ Today  │Active │ │
│  │ john@acme.com  │ Chrome/Phone │ Mar 20    │ Today  │Active │ │
│  │ sara@beta.com  │ Firefox/Win  │ Feb 28    │ Mar 27 │Active │ │
│  │ dev@startup.io │ Safari/Mac   │ Jan 10    │ Feb 15 │Expired│ │
│  └────────────────┴──────────────┴───────────┴────────┴───────┘ │
│                                                                  │
│  [Cleanup expired subscriptions]                                 │
│  [Send test push to all active →]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 Manual Send & Test

**Route:** `/system-admin/notifications/send`

```
┌─────────────────────────────────────────────────────────────────┐
│  SEND TEST NOTIFICATION                                          │
│                                                                  │
│  Target:                                                         │
│  ○ Specific user     [Search user... ▼]                          │
│  ○ All users in account [Search account... ▼]                    │
│  ● All users with active push subscriptions                      │
│                                                                  │
│  Channels:                                                       │
│  [✅ In-App]  [✅ Push]                                          │
│                                                                  │
│  Content:                                                        │
│  Type:   [ranking_top3_entry ▼]  (auto-fills template)           │
│  Title:  [This is a test notification              ]             │
│  Body:   [Testing the notification system          ]             │
│  URL:    [/dashboard                               ]             │
│                                                                  │
│  [Preview]  [Send Test]                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.7 Notification Settings (Admin)

**Tab:** "Settings"

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATION SYSTEM SETTINGS                                    │
│                                                                  │
│  GLOBAL TOGGLES                                                  │
│  ┌──────────────────────────┬────────┬──────────────────┐       │
│  │ Notification Type        │ In-App │ Push Default     │       │
│  ├──────────────────────────┼────────┼──────────────────┤       │
│  │ ranking_top3_entry       │ ✅ ON  │ ✅ ON            │       │
│  │ ranking_top3_exit        │ ✅ ON  │ ✅ ON            │       │
│  │ ranking_significant      │ ✅ ON  │ ✅ ON            │       │
│  │ ranking_new_entry        │ ✅ ON  │ ⬚ OFF           │       │
│  │ competitor_overtook      │ ✅ ON  │ ✅ ON            │       │
│  │ competitor_featured      │ ✅ ON  │ ⬚ OFF           │       │
│  │ review_new_positive      │ ✅ ON  │ ⬚ OFF           │       │
│  │ review_new_negative      │ ✅ ON  │ ✅ ON            │       │
│  │ milestone_rank_first     │ ✅ ON  │ ✅ ON            │       │
│  │ system_scrape_complete   │ ✅ ON  │ ⬚ OFF           │       │
│  └──────────────────────────┴────────┴──────────────────┘       │
│                                                                  │
│  RATE LIMITS                                                     │
│  Max push notifications per user per hour:  [10]                 │
│  Max push notifications per user per day:   [50]                 │
│  Batch window (group events within N min):  [5]                  │
│  Quiet hours (user timezone):  [22:00] to [07:00]                │
│                                                                  │
│  NOTIFICATION RETENTION                                          │
│  Keep in-app notifications for: [90] days                        │
│  Auto-cleanup expired push subscriptions after: [30] days        │
│                                                                  │
│  [Save Changes]                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### 7.1 New Tables

```sql
-- Push notification subscriptions (one per browser/device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,                    -- Push service URL (from browser)
  p256dh VARCHAR(255) NOT NULL,                    -- Public key for encryption
  auth VARCHAR(255) NOT NULL,                      -- Auth secret for encryption
  user_agent TEXT,                                 -- Browser/device info for admin display
  is_active BOOLEAN NOT NULL DEFAULT true,         -- Set to false on 410/404 response
  last_push_at TIMESTAMPTZ,                        -- When we last sent to this subscription
  failure_count INTEGER NOT NULL DEFAULT 0,        -- Consecutive failures
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- All notifications (in-app + push source of truth)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,                       -- NotificationType enum value
  category VARCHAR(20) NOT NULL,                   -- 'ranking' | 'competitor' | 'review' | 'milestone' | 'featured' | 'system'
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  url VARCHAR(500),                                -- Deep link for click navigation
  icon VARCHAR(500),                               -- Icon URL
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  event_data JSONB NOT NULL DEFAULT '{}',          -- Structured trigger data (app, keyword, positions, etc.)

  -- In-app status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,      -- User dismissed / hidden

  -- Push delivery
  push_sent BOOLEAN NOT NULL DEFAULT false,        -- Whether push was attempted
  push_sent_at TIMESTAMPTZ,
  push_clicked BOOLEAN NOT NULL DEFAULT false,
  push_clicked_at TIMESTAMPTZ,
  push_dismissed BOOLEAN NOT NULL DEFAULT false,
  push_error TEXT,                                  -- Error message if push failed

  -- Metadata
  trigger_job_id VARCHAR(255),                     -- BullMQ job ID that triggered this
  batch_id UUID,                                   -- If part of a batched notification group
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification type configuration (admin-managed defaults)
CREATE TABLE IF NOT EXISTS notification_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL UNIQUE,   -- NotificationType enum value
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,    -- Global in-app toggle
  push_default_enabled BOOLEAN NOT NULL DEFAULT false, -- Default push setting for new users
  config JSONB NOT NULL DEFAULT '{}',              -- Type-specific config (thresholds, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user notification preferences (overrides defaults)
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,          -- NotificationType enum value
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,     -- User opted in/out of push for this type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Notification delivery log (tracks every push send attempt for admin dashboard)
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL,                    -- 'push' | 'in_app'
  push_subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL,                     -- 'sent' | 'delivered' | 'clicked' | 'dismissed' | 'failed' | 'expired' | 'skipped'
  status_code INTEGER,                             -- HTTP status from push service
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interacted_at TIMESTAMPTZ                        -- When user read/clicked
);
```

### 7.2 Indexes

```sql
-- Push subscriptions
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subs_active ON push_subscriptions(user_id) WHERE is_active = true;

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = false AND is_archived = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_account ON notifications(account_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_category ON notifications(category);

-- User preferences
CREATE INDEX idx_notif_prefs_user ON user_notification_preferences(user_id);

-- Delivery log
CREATE INDEX idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX idx_delivery_log_sent ON notification_delivery_log(sent_at DESC);
CREATE INDEX idx_delivery_log_status ON notification_delivery_log(status);
```

### 7.3 User Table Changes

```sql
-- Add push notification global toggle to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
-- Becomes true when user grants browser permission and subscribes
```

---

## 8. API Endpoints

### 8.1 User-Facing (Auth Required)

```
# Push subscription management
POST   /api/notifications/push-subscription          # Register push subscription
DELETE /api/notifications/push-subscription           # Remove push subscription
GET    /api/notifications/push-status                 # Get current push permission/subscription status

# Notification center
GET    /api/notifications                             # List notifications (paginated, filterable by category)
GET    /api/notifications/unread-count                # Get unread count (for bell badge)
POST   /api/notifications/:id/read                    # Mark single notification as read
POST   /api/notifications/read-all                    # Mark all as read
POST   /api/notifications/:id/archive                 # Archive/dismiss a notification
POST   /api/notifications/:id/clicked                 # Report push click (from SW)
POST   /api/notifications/:id/dismissed               # Report push dismiss (from SW)

# Notification preferences
GET    /api/notifications/preferences                 # Get user's notification preferences
PATCH  /api/notifications/preferences                 # Update preferences (bulk)
PATCH  /api/notifications/preferences/:type           # Update preference for specific type
```

### 8.2 System Admin

```
# Notification log & analytics
GET    /api/system-admin/notifications                # List all notifications (paginated, filterable)
GET    /api/system-admin/notifications/:id            # Notification detail (with delivery log)
GET    /api/system-admin/notifications/stats           # Aggregate stats (by type, by user, by period)
GET    /api/system-admin/notifications/stats/by-type   # Breakdown by notification type
GET    /api/system-admin/notifications/stats/by-user   # Breakdown by user

# Push subscription management
GET    /api/system-admin/push-subscriptions            # List all push subscriptions
DELETE /api/system-admin/push-subscriptions/expired     # Cleanup expired subscriptions

# Notification type configuration
GET    /api/system-admin/notification-configs           # List all type configs
PATCH  /api/system-admin/notification-configs/:type     # Update config for a type

# Manual send
POST   /api/system-admin/notifications/send            # Send a notification to user(s)
POST   /api/system-admin/notifications/send-test-push   # Send test push to admin
```

---

## 9. Worker & Event Pipeline

### 9.1 Notification Event Flow

```
┌────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  EVENT SOURCE  │────▶│  NOTIFICATION ENGINE │────▶│  DELIVERY        │
│                │     │                      │     │                  │
│ · Scraper job  │     │ 1. Identify event    │     │ · Write to DB    │
│   completes    │     │ 2. Find affected     │     │   (in-app)       │
│ · User action  │     │    users             │     │ · Send web push  │
│ · Cron job     │     │ 3. Check eligibility │     │   (if enabled)   │
│ · System event │     │    per user:         │     │ · Log delivery   │
│                │     │    - type enabled?   │     │   attempt        │
│                │     │    - user opted in?  │     │                  │
│                │     │    - rate limit ok?  │     │                  │
│                │     │    - quiet hours?    │     │                  │
│                │     │    - dedup check?    │     │                  │
│                │     │ 4. Build content     │     │                  │
│                │     │ 5. Fan out per user  │     │                  │
└────────────────┘     └─────────────────────┘     └──────────────────┘
```

### 9.2 Integration with Existing Scraper Jobs

Notifications are triggered at the end of existing scraper processing, not as separate jobs:

```typescript
// In keyword ranking processor (after saving rankings to DB)
async function afterKeywordRankingProcessed(results: RankingResult[]) {
  for (const result of results) {
    const change = result.newPosition - result.oldPosition;

    // Top 3 entry
    if (result.newPosition <= 3 && result.oldPosition > 3) {
      await notificationEngine.emit('ranking_top3_entry', {
        appId: result.appId,
        keywordId: result.keywordId,
        keyword: result.keyword,
        platform: result.platform,
        oldPosition: result.oldPosition,
        newPosition: result.newPosition,
      });
    }

    // Significant change (5+ positions)
    if (Math.abs(change) >= 5) {
      await notificationEngine.emit('ranking_significant_change', {
        appId: result.appId,
        keywordId: result.keywordId,
        keyword: result.keyword,
        platform: result.platform,
        oldPosition: result.oldPosition,
        newPosition: result.newPosition,
        change,
      });
    }

    // ... similar checks for other ranking events
  }
}

// In review processor
async function afterReviewProcessed(review: ReviewData) {
  const type = review.rating <= 2 ? 'review_new_negative' : 'review_new_positive';
  await notificationEngine.emit(type, {
    appId: review.appId,
    platform: review.platform,
    rating: review.rating,
    reviewerName: review.author,
    reviewSnippet: review.body?.substring(0, 100),
  });
}
```

### 9.3 Notification Engine

```typescript
class NotificationEngine {
  /**
   * Main entry point. Called by scraper/system when an event occurs.
   * Finds all affected users, checks eligibility, creates notifications,
   * and dispatches push notifications.
   */
  async emit(type: NotificationType, eventData: Record<string, any>): Promise<void> {
    // 1. Find affected users (who tracks this app/keyword?)
    const affectedUsers = await this.findAffectedUsers(type, eventData);

    // 2. For each user, check eligibility and create notification
    for (const user of affectedUsers) {
      const eligible = await this.checkEligibility(user, type);
      if (!eligible) continue;

      // 3. Build notification content
      const content = this.buildContent(type, eventData, user);

      // 4. Save to DB (always — this is the in-app notification)
      const notification = await this.saveNotification(user, type, content, eventData);

      // 5. Send push if user has push enabled for this type
      if (await this.shouldSendPush(user, type)) {
        await this.sendPush(user, notification);
      }
    }
  }

  private async findAffectedUsers(type: NotificationType, data: Record<string, any>): Promise<User[]> {
    // For app-related events: find all users in accounts that track this app
    if (data.appId) {
      return db.query(`
        SELECT DISTINCT u.* FROM users u
        JOIN account_tracked_apps ata ON ata.account_id = u.account_id
        WHERE ata.app_id = $1 AND u.is_active = true
      `, [data.appId]);
    }
    // For system events: specific user or all users in account
    // ...
  }

  private async checkEligibility(user: User, type: NotificationType): Promise<boolean> {
    // 1. Is notification type globally enabled?
    const config = await this.getTypeConfig(type);
    if (!config.in_app_enabled) return false;

    // 2. Has user opted out of this type?
    const pref = await this.getUserPreference(user.id, type);
    if (pref && !pref.in_app_enabled) return false;

    // 3. Rate limit check
    if (await this.isRateLimited(user.id)) return false;

    // 4. Dedup check (same event within last N minutes)
    if (await this.isDuplicate(user.id, type, /* eventKey */)) return false;

    return true;
  }
}
```

### 9.4 Batching Strategy

To avoid notification spam, events within a short window are batched:

```typescript
// If multiple ranking changes happen in the same scrape cycle,
// batch them into a single notification:

// Instead of 5 separate notifications:
//   "App moved from #5 to #3 for 'crm'"
//   "App moved from #8 to #6 for 'sales'"
//   ...

// Send one batched notification:
//   Title: "5 ranking changes detected"
//   Body: "Acme CRM: 3 improved, 2 dropped across Shopify keywords"
//   URL: /keywords (overview page)

const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// During this window, events accumulate. After the window closes,
// if there are more than 3 events of the same category for the same user,
// they get merged into a single notification.
```

### 9.5 Quiet Hours

```typescript
function isQuietHours(user: User): boolean {
  const userLocalTime = toTimezone(new Date(), user.timezone);
  const hour = userLocalTime.getHours();
  // Quiet hours: 22:00 - 07:00 in user's timezone
  return hour >= 22 || hour < 7;
}

// During quiet hours:
// - In-app notifications: still created (visible when user opens app)
// - Push notifications: queued and sent at 07:00 local time
```

---

## 10. User Preferences & Controls

### 10.1 Notification Settings Page

**Route:** `/settings/notifications` (tab within existing settings page)

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings > Notifications                                        │
│                                                                  │
│  BROWSER PUSH NOTIFICATIONS                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Push notifications are: [Enabled ✅]                     │   │
│  │                                                           │   │
│  │  Status: Active (Chrome on MacOS)                         │   │
│  │  Subscribed since: March 15, 2026                         │   │
│  │                                                           │   │
│  │  [Disable Push Notifications]                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  — or if not subscribed: —                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Get instant alerts in your browser when important        │   │
│  │  changes happen to your tracked apps.                     │   │
│  │                                                           │   │
│  │  [Enable Push Notifications]                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  NOTIFICATION PREFERENCES                                        │
│  Choose which notifications you receive and how:                 │
│                                                                  │
│  ┌────────────────────────────────┬─────────┬──────────────┐    │
│  │ Event                         │ In-App  │ Push         │    │
│  ├────────────────────────────────┼─────────┼──────────────┤    │
│  │ 📊 RANKING                    │         │              │    │
│  │ App enters top 3              │ [✅]    │ [✅]         │    │
│  │ App exits top 3               │ [✅]    │ [✅]         │    │
│  │ Significant rank change (5+)  │ [✅]    │ [✅]         │    │
│  │ New keyword entry             │ [✅]    │ [⬚]         │    │
│  │ Dropped from keyword          │ [✅]    │ [✅]         │    │
│  │ Category rank change          │ [✅]    │ [⬚]         │    │
│  │                               │         │              │    │
│  │ ⚔️ COMPETITORS                │         │              │    │
│  │ Competitor overtook you       │ [✅]    │ [✅]         │    │
│  │ Competitor got featured       │ [✅]    │ [⬚]         │    │
│  │ Competitor review surge       │ [✅]    │ [⬚]         │    │
│  │ Competitor pricing change     │ [✅]    │ [⬚]         │    │
│  │                               │         │              │    │
│  │ ⭐ REVIEWS                    │         │              │    │
│  │ New positive review (4-5★)    │ [✅]    │ [⬚]         │    │
│  │ New negative review (1-2★)    │ [✅]    │ [✅]         │    │
│  │ Review milestone              │ [✅]    │ [✅]         │    │
│  │                               │         │              │    │
│  │ 🏆 MILESTONES                 │         │              │    │
│  │ Reached #1 for keyword        │ [✅]    │ [✅]         │    │
│  │ Rating threshold crossed      │ [✅]    │ [✅]         │    │
│  │ Best week ever                │ [✅]    │ [✅]         │    │
│  │                               │         │              │    │
│  │ ⭐ FEATURED                   │         │              │    │
│  │ App got featured              │ [✅]    │ [✅]         │    │
│  │ App lost featured status      │ [✅]    │ [✅]         │    │
│  │                               │         │              │    │
│  │ ⚙️ SYSTEM                     │         │              │    │
│  │ Daily scrape complete         │ [✅]    │ [⬚]         │    │
│  │ Account limit warning         │ [✅]    │ [⬚]         │    │
│  │ Team member joined            │ [✅]    │ [⬚]         │    │
│  └────────────────────────────────┴─────────┴──────────────┘    │
│                                                                  │
│  QUIET HOURS                                                     │
│  Pause push notifications during:                                │
│  From: [22:00] To: [07:00] (Europe/Istanbul)                     │
│  Push notifications during quiet hours will be sent at 07:00     │
│                                                                  │
│  [Save Preferences]                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Push Permission Request UX

Don't request push permission on first visit. Use a **two-step approach:**

1. **Soft Ask (in-app prompt):** After user has been active for 3+ days or tracked 2+ apps, show an in-app banner:
   ```
   ┌──────────────────────────────────────────────────────────┐
   │  🔔 Get instant alerts when your rankings change         │
   │  Enable browser notifications to stay on top of          │
   │  competitor moves and ranking changes.                    │
   │                                                           │
   │  [Enable Notifications]         [Maybe Later]             │
   └──────────────────────────────────────────────────────────┘
   ```

2. **Browser Permission Dialog:** Only triggered when user clicks "Enable Notifications". This ensures the native browser dialog appears at a moment of intent, not randomly.

3. **If Denied:** Don't show the banner again for 30 days. Show a "Notifications blocked" hint in settings with instructions to unblock via browser settings.

---

## 11. Implementation Phases

### Phase 0: Database Schema & Core Infrastructure
**Priority: 1 (Urgent) — Foundation for everything**

- Create database migration for all notification tables (`notifications`, `push_subscriptions`, `notification_type_configs`, `user_notification_preferences`, `notification_delivery_log`)
- Add Drizzle schema definitions
- Add `push_notifications_enabled` column to users table
- Generate VAPID keys and add to environment configuration
- Install `web-push` npm package in scraper/worker package
- Seed default notification type configs

### Phase 1: In-App Notification Center (Backend)
**Priority: 2 (High) — User-facing notifications without push**

- Build notification engine (`NotificationEngine` class in shared/worker)
- Implement notification CRUD API endpoints (list, unread-count, mark-read, archive)
- Implement notification preferences API endpoints
- Integrate notification triggers into existing scraper job processors:
  - Keyword ranking processor → ranking events
  - Review processor → review events
  - App details processor → competitor events
  - Featured apps processor → featured events
- Add batching logic for multi-event scenarios
- Add rate limiting and dedup checks
- Add eligibility checks (type config, user preferences)

### Phase 2: In-App Notification Center (Frontend)
**Priority: 2 (High) — UI for notification center**

- Bell icon component with unread badge in dashboard navbar
- Notification dropdown panel (last 10 notifications)
- Full notification center page (`/notifications`) with:
  - Category tabs (All, Ranking, Competitor, Reviews, etc.)
  - Mark as read / mark all as read
  - Archive/dismiss
  - Infinite scroll / pagination
  - Day-grouped layout
- Notification preferences UI in settings page
- Polling for unread count (every 60s)
- Click-through to deep links

### Phase 3: Web Push Notifications
**Priority: 3 (Medium) — Browser push delivery**

- Service worker (`sw.js`) for push event handling
- Push subscription registration flow (frontend)
- Push subscription API endpoints (register, unregister, status)
- Server-side push sending via `web-push` library
- Push click/dismiss tracking
- Two-step permission request UX (soft ask banner → browser dialog)
- Quiet hours support (queue during quiet, send at 07:00)
- Subscription expiry handling (auto-cleanup on 410/404)

### Phase 4: System Admin Notification Dashboard
**Priority: 3 (Medium) — Admin visibility**

- Notification overview dashboard (`/system-admin/notifications`)
  - Stats cards (sent today/week, push subs, click rate)
  - Notification log table (filterable, paginated)
- Notification detail view (who/what/when/why/how)
- Stats by type breakdown
- Stats by user breakdown
- Push subscription management page
- Manual send / test push capability
- Notification type configuration UI (global toggles, thresholds)

### Phase 5: Advanced Features
**Priority: 4 (Low) — Polish and optimization**

- SSE (Server-Sent Events) for real-time notification count updates (replace polling)
- Milestone detection engine (best week ever, rating thresholds, review milestones)
- Notification grouping/threading (related notifications grouped visually)
- Notification sound/vibration customization
- Export notification history (CSV)
- Notification retention cleanup job (auto-delete after 90 days)
- A/B testing notification content
- Cross-tab notification sync (mark as read in one tab → updates in others)

---

## Appendix A: Browser Support

| Browser | Push API | Service Worker | Notes |
|---------|----------|---------------|-------|
| Chrome 50+ | ✅ | ✅ | Uses FCM (Firebase Cloud Messaging) |
| Firefox 44+ | ✅ | ✅ | Uses Mozilla Push Service |
| Edge 17+ | ✅ | ✅ | Uses WNS (Windows Push Notification Service) |
| Safari 16+ | ✅ | ✅ | Uses APNs (Apple Push Notification service), macOS Ventura+ |
| Safari iOS 16.4+ | ✅ | ✅ | Requires PWA "Add to Home Screen" |

**Coverage:** ~95% of desktop users, ~85% of mobile users (iOS requires PWA install).

## Appendix B: Push Notification Size Limits

- **Title:** Recommended max 65 characters (truncated by OS after that)
- **Body:** Recommended max 200 characters for readability
- **Payload:** Max 4KB total (encrypted, including all JSON data)
- **Icon:** 192x192px recommended (PNG)
- **Badge:** 72x72px (monochrome, for mobile notification bar)

## Appendix C: Rate Limiting Strategy

```
Per user, per hour:
  - Max 10 push notifications
  - Max 50 in-app notifications
  - If exceeded, batch remaining into a single "N events happened" notification

Per user, per notification type:
  - ranking_significant_change: max 5/hour, 20/day
  - competitor_overtook: max 3/hour, 15/day
  - review_new_positive: max 3/hour, 15/day
  - milestone_*: max 2/day
  - system_*: max 5/day

Dedup window:
  - Same (user + type + appId + keywordId) within 6 hours → skip
  - Same (user + type + appId) within 1 hour → skip
```
