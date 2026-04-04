# Notification Sistemi: Mevcut Durum Analizi & Yol Haritasi

> Tarih: 2026-04-04
> Proje: AppRanks (Shopify Tracking)

---

## 1. Mevcut Sistemin Analizi

### 1.1 Genel Mimari

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EVENT DETECTION                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Ranking      │  │  Competitor   │  │  Review      │  │  Keyword   │  │
│  │  Changes      │  │  Activity     │  │  Detection   │  │  Changes   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         └──────────────────┴────────────────┴───────────────┘          │
│                                    │                                    │
│                          ┌─────────▼──────────┐                        │
│                          │  Event Dispatcher   │                        │
│                          │  (event-dispatcher) │                        │
│                          └─────────┬──────────┘                        │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
           ┌────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
           │ email-instant  │  │ email-bulk  │  │notifications│
           │ (BullMQ)       │  │ (BullMQ)    │  │ (BullMQ)    │
           └───────────────┘  └────────────┘  └──────┬──────┘
                                                      │
                                            ┌─────────▼──────────┐
                                            │ Notification Worker │
                                            │ (Docker Container)  │
                                            │ Concurrency: 5      │
                                            │ Rate: 100/min       │
                                            │ Retry: 3x / 10s     │
                                            └─────────┬──────────┘
                                                      │
                                            ┌─────────▼──────────┐
                                            │ Notification Engine │
                                            │ (emitNotification)  │
                                            └─────────┬──────────┘
                                                      │
                                  ┌───────────────────┼───────────────────┐
                                  │                   │                   │
                        ┌─────────▼─────┐   ┌────────▼────────┐  ┌──────▼──────┐
                        │  Eligibility   │   │  Deduplication  │  │ Rate Limit  │
                        │  Check         │   │  (6h window)    │  │ (50/user/h) │
                        └─────────┬─────┘   └────────┬────────┘  └──────┬──────┘
                                  │                   │                  │
                                  └───────────┬───────┘──────────────────┘
                                              │ (passed)
                                  ┌───────────▼────────────┐
                                  │   Save to PostgreSQL    │
                                  │   (notifications table) │
                                  └───────────┬────────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │                               │
                    ┌─────────▼──────────┐          ┌─────────▼──────────┐
                    │   In-App Delivery   │          │   Web Push (VAPID) │
                    │                     │          │                     │
                    │ • SSE Stream (15s)  │          │ • Service Worker    │
                    │ • Bell Polling (60s)│          │ • OS Notification   │
                    │ • Notification Page │          │ • Click Tracking    │
                    └────────────────────┘          │ • Dismiss Tracking  │
                                                    │ • Delivery Log      │
                                                    └────────────────────┘
```

### 1.2 Teslimat Kanallari

```
┌────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION DELIVERY                        │
│                                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   IN-APP          │  │   WEB PUSH        │  │   EMAIL      │ │
│  │                    │  │   (VAPID)          │  │   (SMTP)     │ │
│  │ • Bell icon badge │  │ • Service Worker  │  │ • Instant Q  │ │
│  │ • Dropdown (10)   │  │ • OS notification │  │ • Bulk Q     │ │
│  │ • Full page       │  │ • Click → app     │  │ • Templates  │ │
│  │ • SSE stream      │  │ • Dismiss track   │  │ • Tracking   │ │
│  │ • Category filter │  │ • 24h TTL         │  │              │ │
│  │ • Read/Archive    │  │ • Vibration       │  │              │ │
│  │ • Priority colors │  │ • 5-fail deactive │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│         ▲                       ▲                     ▲        │
│         │                       │                     │        │
│    ALWAYS ON              OPT-IN (per type)     SEPARATE SYS  │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Notification Turleri ve Kategorileri

7 kategori, 23+ notification tipi:

| Kategori | Tipler | Aciklama |
|----------|--------|----------|
| **Ranking** | `ranking_top3_entry`, `ranking_top3_exit`, `ranking_significant_change`, `ranking_new_entry`, `ranking_dropped_out`, `ranking_category_change` | Uygulama siralama degisiklikleri |
| **Competitor** | `competitor_overtook`, `competitor_featured`, `competitor_review_surge`, `competitor_pricing_change` | Rakip aktiviteleri |
| **Review** | `review_new_positive`, `review_new_negative`, `review_velocity_spike` | Yorum bildirimleri |
| **Keyword** | `keyword_position_gained`, `keyword_position_lost`, `keyword_new_ranking` | Anahtar kelime degisiklikleri |
| **Featured** | `featured_new_placement`, `featured_removed` | One cikan uygulama degisiklikleri |
| **System** | `system_scrape_complete`, `system_scrape_failed` | Sistem bildirimleri |
| **Account** | `account_member_joined`, `account_limit_warning`, `account_limit_reached` | Hesap bildirimleri |

### 1.4 Notification Pipeline (Islem Adimlari)

```
Event Detected
     │
     ▼
┌─────────────────────┐
│ 1. Event Dispatcher  │  apps/scraper/src/events/event-dispatcher.ts
│    • Detect event     │
│    • Find affected    │
│      users            │
│    • Map to job type  │
│    • Enqueue job      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. BullMQ Queue      │  Queue: "notifications"
│    • Redis-backed     │  3 attempts, 10s backoff
│    • Job: userId,     │  Concurrency: 5
│      type, payload,   │  Rate: 100/min
│      sendPush?        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Notification       │  packages/shared/src/notifications/engine.ts
│    Engine              │
│    • Type enabled?     │  → notificationTypeConfigs
│    • User opted-in?    │  → userNotificationPreferences
│    • Duplicate?        │  → 6 saat icinde ayni dedupKey?
│    • Rate limit?       │  → 50/user/saat
│    • Template render   │  → {{variable}} substitution
│    • Save to DB        │  → notifications tablosu
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Push Delivery      │  apps/api/src/services/web-push.ts
│    (eger sendPush)     │
│    • Active subs?      │  → pushSubscriptions tablosu
│    • Web Push API      │  → VAPID imzali
│    • Delivery log      │  → notificationDeliveryLog
│    • Fail handling     │  → 410: deactivate, 5x fail: disable
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Client Delivery    │
│    • SSE Stream (15s)  │  apps/api/src/routes/notification-stream.ts
│    • Bell Polling(60s) │  apps/dashboard/src/components/notification-bell.tsx
│    • Service Worker    │  apps/dashboard/public/sw.js
│    • OS Notification   │  → title, body, icon, vibrate
│    • Click → navigate  │  → notification.url
└─────────────────────┘
```

### 1.5 Veritabani Semalari

6 tablo notification sistemi icin kullaniliyor (`packages/db/src/schema/notifications.ts`):

| Tablo | Amac | Onemli Kolonlar |
|-------|------|-----------------|
| `notifications` | Ana bildirim deposu | userId, accountId, type, category, title, body, url, icon, priority, isRead, readAt, isArchived, pushSent, pushSentAt, pushClicked, pushClickedAt, pushDismissed, pushError, eventData (JSONB), batchId, triggerJobId |
| `pushSubscriptions` | Web push cihaz abonelikleri | userId, endpoint, p256dh, auth, userAgent, isActive, lastPushAt, failureCount |
| `notificationTypeConfigs` | Global admin ayarlari | notificationType, inAppEnabled, pushDefaultEnabled, config (JSONB) |
| `userNotificationPreferences` | Kullanici tercihleri | userId, notificationType, inAppEnabled, pushEnabled |
| `notificationDeliveryLog` | Teslimat audit trail | notificationId, channel, pushSubscriptionId, status, statusCode, errorMessage, sentAt, interactedAt |
| `notificationTemplates` | Duzenlenebilir sablonlar | notificationType, titleTemplate, bodyTemplate, isCustomized, updatedAt, updatedBy |

### 1.6 Queue ve Worker Konfigurasyonu

| Parametre | Deger |
|-----------|-------|
| Queue adi | `notifications` |
| Worker container | `worker-notifications` (Docker) |
| Concurrency | 5 |
| Rate limit | 100 job/dk |
| Retry | 3 deneme, 10s exponential backoff |
| Memory limit | 512MB |
| DLQ | Basarisiz joblar `deadLetterJobs` tablosuna |
| VAPID keys | Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

### 1.7 In-App Bildirim Merkezi (Dashboard)

| Bilesen | Konum | Ozellikler |
|---------|-------|------------|
| Bell Icon | `components/notification-bell.tsx` | Okunmamis badge (99+ cap), dropdown (10 bildirim), 60s polling, tab gizlenince pause |
| Notifications Page | `app/(dashboard)/notifications/page.tsx` | Cursor pagination (30/sayfa), kategori filtresi, sadece okunmamis toggle, okundu isaretle, arsivle, priority renkleri |
| SSE Stream | `routes/notification-stream.ts` | 15s polling, heartbeat, grouping utilities, milestone detection, 90 gun retention |

### 1.8 Web Push Altyapisi

```
┌──────────────────────────────────────────────────────────────┐
│                    WEB PUSH FLOW                              │
│                                                              │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │  Dashboard    │     │  API Server   │     │  Push Service │  │
│  │  (Client)     │     │  (Backend)    │     │  (Google/     │  │
│  │              │     │              │     │   Mozilla)    │  │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘  │
│         │                    │                     │          │
│   1. subscribeToPush()       │                     │          │
│   ────────────────────►      │                     │          │
│   (VAPID public key +        │                     │          │
│    PushManager.subscribe)    │                     │          │
│         │                    │                     │          │
│   2. POST /push-subscription │                     │          │
│   ────────────────────►      │                     │          │
│   (endpoint, p256dh, auth)   │                     │          │
│         │                    │                     │          │
│         │              3. Save to DB               │          │
│         │              (pushSubscriptions)          │          │
│         │                    │                     │          │
│         │          4. New notification event        │          │
│         │              ┌─────▼─────┐               │          │
│         │              │ Worker    │               │          │
│         │              │ process   │               │          │
│         │              └─────┬─────┘               │          │
│         │                    │                     │          │
│         │          5. webpush.sendNotification()    │          │
│         │              ────────────────────────►    │          │
│         │              (VAPID signed, 24h TTL)      │          │
│         │                    │                     │          │
│         │                    │    6. Deliver to SW  │          │
│         │              ◄────────────────────────    │          │
│   ◄─────┤              (push event)               │          │
│         │                    │                     │          │
│   7. SW: showNotification()  │                     │          │
│   8. Click → navigate        │                     │          │
│   9. POST /:id/read          │                     │          │
│   ────────────────────►      │                     │          │
│         │                    │                     │          │
└─────────┴────────────────────┴─────────────────────┴──────────┘
```

### 1.9 Admin Dashboard Ozellikleri

| Sayfa | URL | Ozellikler |
|-------|-----|------------|
| Notification Stats | `/system-admin/notifications` | Total, Read Rate, Push Sent, Push Click Rate, Failed, Last 24h; filtreleme; pagination |
| Notification Templates | `/system-admin/notification-templates` | 7 kategori, 23 template; edit/preview/reset; degisken picker; canli onizleme |
| Queue Monitor | `/system-admin/queues` | Notifications queue durumu (active, waiting, failed, completed, delayed) |
| DLQ Management | `/system-admin/dlq` | Basarisiz notification job'lari; replay; silme |

### 1.10 Preference Sistemi

```
┌─────────────────────────────────────────────────────┐
│              PREFERENCE RESOLUTION                   │
│                                                     │
│  ┌──────────────────┐                               │
│  │ Global Defaults   │  notificationTypeConfigs      │
│  │ (Admin tanımlar)  │  inAppEnabled: true/false     │
│  │                    │  pushDefaultEnabled: true/false│
│  └────────┬─────────┘                               │
│           │                                         │
│           ▼                                         │
│  ┌──────────────────┐                               │
│  │ User Override     │  userNotificationPreferences  │
│  │ (Kullanıcı secer) │  inAppEnabled: null → default │
│  │                    │  pushEnabled: null → default   │
│  └────────┬─────────┘                               │
│           │                                         │
│           ▼                                         │
│  ┌──────────────────┐                               │
│  │ Final Decision    │                               │
│  │ User > Global     │                               │
│  │ null → fallback   │                               │
│  └──────────────────┘                               │
│                                                     │
│  Push Default ON:  ranking_top3_entry/exit,          │
│    competitor_overtook, competitor_pricing_change,    │
│    review_new_negative, account_limit_warning/reached,│
│    system_scrape_failed                              │
│                                                     │
│  Push Default OFF: Diger tum tipler                  │
└─────────────────────────────────────────────────────┘
```

### 1.11 Event → Notification Eslesmesi

| Event | Notification Type | Email Type |
|-------|-------------------|------------|
| `ranking_top3_entry` | `ranking_top3_entry` | `email_ranking_alert` |
| `ranking_top3_exit` | `ranking_top3_exit` | `email_ranking_alert` |
| `ranking_significant_change` | `ranking_significant_change` | `email_ranking_alert` |
| `competitor_overtook` | `competitor_overtook` | `email_competitor_alert` |
| `competitor_featured` | `competitor_featured` | `email_competitor_alert` |
| `competitor_review_surge` | `competitor_review_surge` | `email_competitor_alert` |
| `competitor_pricing_change` | `competitor_pricing_change` | `email_competitor_alert` |
| `review_new_positive` | `review_new_positive` | `email_review_alert` |
| `review_new_negative` | `review_new_negative` | `email_review_alert` |
| `featured_new_placement` | `featured_new_placement` | `email_ranking_alert` |
| `featured_removed` | `featured_removed` | `email_ranking_alert` |
| `system_scrape_complete` | `system_scrape_complete` | *(yok)* |
| `system_scrape_failed` | `system_scrape_failed` | *(yok)* |
| `account_member_joined` | `account_member_joined` | *(yok)* |
| `account_limit_warning` | `account_limit_warning` | *(yok)* |
| `account_limit_reached` | `account_limit_reached` | *(yok)* |

### 1.12 Template Sistemi

- **23 hardcoded default template** (title + body) → `packages/shared/src/notification-types.ts`
- **DB override** → `notificationTemplates` tablosu, admin'den duzenlenebilir
- **`{{variable}}` placeholder** sistemi → `renderTemplate()` ile substitution
- **Sample data** → `buildNotificationSampleData()` ile preview
- **Kategori bazli degiskenler:**
  - Ranking: appName, appSlug, platform, position, previousPosition, change, keyword, categoryName
  - Competitor: competitorName, competitorSlug, appName, keyword, position, surfaceName, reviewCount
  - Review: appName, appSlug, platform, rating, reviewCount
  - Keyword: appName, appSlug, platform, keyword, position, previousPosition, change
  - Featured: appName, appSlug, platform, surfaceName
  - System: scraperType, platform, errorMessage
  - Account: memberName, memberEmail, limitType, current, max

---

## 2. Eksiklikler ve Iyilestirme Alanlari

### 2.1 Kritik Eksiklikler (Core Feature Blocker)

| # | Eksiklik | Etki | Oncelik |
|---|----------|------|---------|
| C1 | Push subscription API endpoint eksik | Web push aboneligi calismıyor — client `POST /push-subscription` cagiriyor ama endpoint yok | KRITIK |
| C2 | Push dismiss tracking endpoint eksik | Service worker `POST /:id/dismiss` cagiriyor ama endpoint yok | KRITIK |
| C3 | Notification batching/grouping yok | Ayni anda 20 ranking degisikligi olursa 20 ayri bildirim gidiyor — spam | YUKSEK |

### 2.2 Yuksek Oncelikli Eksiklikler

| # | Eksiklik | Etki |
|---|----------|------|
| H1 | Quiet hours yok (notification icin) | Kullanıcılar gece bildirim aliyor |
| H2 | Per-type rate limiting yok | Ayni tipte sinirsiz bildirim gidebilir (genel 50/saat var ama tip bazli yok) |
| H3 | Push permission request banner yok | Push adoption dusuk — soft-ask UX'i yok |
| H4 | SSE client entegrasyonu yok | Dashboard SSE stream'i kullanmiyor, 60s polling ile calisiyor |
| H5 | Notification retention cleanup yok | 90 gunluk policy tanimli ama cleanup cron'u yok — DB buyuyor |

### 2.3 Orta Oncelikli Eksiklikler

| # | Eksiklik | Etki |
|---|----------|------|
| M1 | Notification grouping/threading UI yok | "5 ranking change" collapse yok — liste kalabalik |
| M2 | Admin analytics dashboard yetersiz | Sadece toplam stats, tip/kullanici bazli analiz yok |
| M3 | Admin broadcast notification yok | Admin'den manual bildirim gonderilemıyor |
| M4 | Do Not Disturb (DND) modu yok | Kullanici tum bildirimleri gecici olarak durduramıyor |
| M5 | Ayrı notification settings sayfasi yok | Email ve notification ayarlari ayni sayfada karisik |
| M6 | Cross-tab notification sync yok | Bir tab'da okundu isareti diger tab'lara yansımiyor |
| M7 | Notification scheduling yok | Zamanlanmis bildirim gonderilemıyor |

### 2.4 Dusuk Oncelikli Eksiklikler

| # | Eksiklik | Etki |
|---|----------|------|
| L1 | Mobile push yok (Firebase/APNs) | Sadece web push, mobil destek yok |
| L2 | Webhook entegrasyonu yok (Slack/Discord) | Harici kanallara bildirim gonderilemıyor |
| L3 | Notification ses konfigurasyonu yok | Push'ta ses/vibrasyon tercihi yok |
| L4 | Notification priority queue yok | Urgent ve low-priority ayni sirada isleniyor |
| L5 | SSE reconnection logic yok | Baglanti koparsa otomatik yeniden baglanma yok |

---

## 3. Ideal Notification Sistemi Mimarisi

### 3.1 Hedef Mimari

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              EVENT LAYER                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Scraper   │ │ API      │ │ Cron     │ │ Admin    │ │ System Events    │ │
│  │ Events    │ │ Events   │ │ Events   │ │ Broadcast│ │ (health, limits) │ │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘ └────────┬─────────┘ │
│        └─────────────┴───────────┴─────────────┴────────────────┘          │
│                                    │                                        │
│                          ┌─────────▼──────────┐                            │
│                          │   Event Dispatcher   │                            │
│                          │   + Priority Router  │                            │
│                          └─────────┬──────────┘                            │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                                │
         ┌──────────▼──────────┐          ┌──────────▼──────────┐
         │ notifications-urgent │          │ notifications-normal │
         │ (BullMQ - Priority)  │          │ (BullMQ - Standard)  │
         │ No rate limit        │          │ Rate: 100/min        │
         │ Concurrency: 3      │          │ Concurrency: 5       │
         └──────────┬──────────┘          └──────────┬──────────┘
                    │                                │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │     Notification Engine       │
                    │  ┌────────┐ ┌────────────┐   │
                    │  │Eligible│ │Dedup (6h)  │   │
                    │  │Check   │ │+ Rate Limit│   │
                    │  └────┬───┘ └─────┬──────┘   │
                    │       └─────┬─────┘           │
                    │             │                  │
                    │  ┌──────────▼──────────┐      │
                    │  │  Quiet Hours Check   │      │
                    │  │  + DND Mode Check    │      │
                    │  └──────────┬──────────┘      │
                    │             │                  │
                    │  ┌──────────▼──────────┐      │
                    │  │  Batching Engine     │      │
                    │  │  (5min window,       │      │
                    │  │   3+ merge)          │      │
                    │  └──────────┬──────────┘      │
                    │             │                  │
                    │  ┌──────────▼──────────┐      │
                    │  │  Template Render     │      │
                    │  │  + Save to DB        │      │
                    │  └──────────┬──────────┘      │
                    └─────────────┼──────────────────┘
                                  │
                  ┌───────────────┼───────────────────┐
                  │               │                   │
        ┌─────────▼────┐  ┌──────▼──────┐  ┌─────────▼────────┐
        │  In-App       │  │  Web Push    │  │  External         │
        │               │  │  (VAPID)     │  │  (Webhook)        │
        │ • SSE (real)  │  │ • SW push    │  │ • Slack           │
        │ • Bell badge  │  │ • OS notify  │  │ • Discord         │
        │ • Full page   │  │ • Click/     │  │ • Custom webhook  │
        │ • Cross-tab   │  │   dismiss    │  │                   │
        │   sync        │  │   tracking   │  │                   │
        └──────────────┘  └─────────────┘  └───────────────────┘
                  │               │                   │
        ┌─────────▼───────────────▼───────────────────▼────────┐
        │              Monitoring & Observability                │
        │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
        │  │ Delivery  │ │ Health   │ │ Analytics│ │ Alert    ││
        │  │ Log       │ │ Metrics  │ │ Dashboard│ │ Rules    ││
        │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
        └──────────────────────────────────────────────────────┘
```

### 3.2 Temel Prensipler

1. **Urgent vs Normal ayirimi** — Account limit, system failure gibi kritik bildirimler oncelikli islenmeli
2. **Batching** — Ayni kategorideki cok sayida bildirim birlestirilmeli (5dk pencere)
3. **Quiet hours + DND** — Kullanici tercihine gore bildirim zamanlama
4. **Cross-tab sync** — Tum acik tablarda anlik guncelleme
5. **Multi-channel delivery** — In-app + push + webhook (Slack/Discord)
6. **Graceful degradation** — Push calismazsa in-app her zaman calismali
7. **Full observability** — Her teslimat loglaniyor, metrikler izlenebiliyor

---

## 4. Yol Haritasi: Tasklar ve Alt Tasklar

### FAZA 1: Kritik Eksikliklerin Giderilmesi (Oncelik: KRITIK)

---

#### TASK 1.1: Push Subscription & Dismiss Endpoint'leri — [PLA-686](https://linear.app/plan-b-side-projects/issue/PLA-686/phase-1-push-subscription-and-dismiss-endpoints)

**Problem:** Client-side push subscription kodu `POST/DELETE /api/notifications/push-subscription` ve `POST /:id/dismiss` endpoint'lerini cagiriyor ama bu endpoint'ler API'da tanimli degil. Web push aboneligi ve dismiss tracking calismıyor.

**Root Cause:**
- `apps/dashboard/src/lib/push-notifications.ts` bu endpoint'leri cagiriyor (subscribeToPush, unsubscribeFromPush)
- `apps/dashboard/public/sw.js` dismiss tracking icin `POST /:id/dismiss` cagiriyor
- `apps/api/src/routes/notifications.ts` dosyasinda bu route'lar tanimlanmamis
- `apps/api/src/services/web-push.ts` dosyasinda `registerSubscription()` ve `unregisterSubscription()` fonksiyonlari var ama route'lar yok

**Alt Tasklar:**

- [ ] **1.1.1 — Push subscription endpoint'leri**
  - `POST /api/notifications/push-subscription` — yeni subscription kaydi
    - Body: `{ endpoint, keys: { p256dh, auth }, userAgent? }`
    - `registerSubscription(db, userId, subscription, userAgent)` cagir
    - Response: `{ success: true, subscriptionId }`
  - `DELETE /api/notifications/push-subscription` — subscription iptal
    - Body: `{ endpoint }`
    - `unregisterSubscription(db, userId, endpoint)` cagir
    - Response: `{ success: true }`
  - `GET /api/notifications/push-subscription/status` — mevcut subscription durumu
    - Response: `{ isSubscribed: boolean, subscriptionCount: number }`
  - `GET /api/notifications/push/vapid-key` — VAPID public key
    - Response: `{ vapidPublicKey: string }`

- [ ] **1.1.2 — Dismiss tracking endpoint**
  - `POST /api/notifications/:id/dismiss` — push bildirimini kapatma kaydi
    - `notifications` tablosunda `pushDismissed = true` guncelle
    - `notificationDeliveryLog`'a dismiss event kaydet
    - Response: `{ success: true }`

- [ ] **1.1.3 — Push subscription testleri**
  - Subscription kayit testi
  - Subscription iptal testi
  - Duplicate subscription handling testi
  - Dismiss tracking testi
  - VAPID key endpoint testi

**Dosyalar:**
- `apps/api/src/routes/notifications.ts` (guncelle: 4 yeni endpoint)
- `apps/api/src/routes/notifications.test.ts` (guncelle)

**Acceptance Criteria:**
- Push subscription frontend'den basariyla kaydediliyor
- Subscription iptal edilebiliyor
- Dismiss event'leri DB'ye kaydediliyor
- VAPID public key endpoint'i calisiyor

---

#### TASK 1.2: Notification Batching Engine — [PLA-687](https://linear.app/plan-b-side-projects/issue/PLA-687/phase-1-notification-batching-engine)

**Problem:** Ayni anda 20 ranking degisikligi olursa 20 ayrı bildirim gonderiliyor. Bu notification spam'e neden oluyor.

**Root Cause:**
- Email sistemi icin batching var (`apps/scraper/src/email/alert-batching.ts`) ama notification'lar icin yok
- Event dispatcher her event icin ayrı notification job olusturuyor
- Notification engine'de batching/merge logic yok

**Alt Tasklar:**

- [ ] **1.2.1 — Notification batching modulu**
  - `apps/scraper/src/notifications/batching.ts` olustur
  - Batch window: 5 dakika (konfigurasyonda degistirilebilir)
  - Merge threshold: 3+ ayni kategorideki event birlestir
  - Batch key: `userId + category + 5dk pencere`
  - Birlestirme formati: "{{count}} ranking changes for {{appName}}" gibi ozet
  - Timer-based flush: 5dk dolunca batch'i isle
  - Urgent notification'lar batching'i bypass etsin

- [ ] **1.2.2 — Event dispatcher entegrasyonu**
  - `event-dispatcher.ts`'de notification enqueue oncesi batch check
  - Batch window aciksa: event'i batch'e ekle, job olusturma
  - Batch window kapaninca: merged notification job olustur
  - Redis'te batch state tutma (multi-instance uyumu icin)

- [ ] **1.2.3 — Batched notification template'leri**
  - Her kategori icin batch template:
    - Ranking: "{{count}} ranking changes for your apps"
    - Competitor: "{{count}} competitor updates"
    - Review: "{{count}} new reviews"
    - Keyword: "{{count}} keyword position changes"
  - Body'de top 3 event ozeti + "and X more..."
  - Batch notification'in URL'i notification center'a yonlensin

- [ ] **1.2.4 — Batching testleri**
  - 3'ten az event: ayri bildirimler
  - 3+ event: birlestirilmis bildirim
  - Farkli kategori event'leri: ayri batch'ler
  - Urgent event: bypass testi
  - Multi-instance Redis batch state testi

**Dosyalar:**
- `apps/scraper/src/notifications/batching.ts` (yeni)
- `apps/scraper/src/events/event-dispatcher.ts` (guncelle)
- `packages/shared/src/notification-types.ts` (guncelle: batch template'leri)
- `apps/scraper/src/__tests__/notifications/batching.test.ts` (yeni)

**Acceptance Criteria:**
- 5dk icerisinde 3+ ayni kategorideki event tek bildirim olarak gonderiliyor
- Urgent notification'lar batching'i bypass ediyor
- Batch ozet template'leri dogru render ediliyor
- Multi-instance ortamda batch state tutarli

---

#### TASK 1.3: Notification Retention Cleanup — [PLA-688](https://linear.app/plan-b-side-projects/issue/PLA-688/phase-1-notification-retention-cleanup)

**Problem:** 90 gunluk retention policy tanimli ama cleanup cron'u yok. Notifications tablosu surekli buyuyor.

**Root Cause:**
- `notification-stream.ts`'de `getRetentionCutoff(90)` fonksiyonu var ama sadece read endpoint'lerinde filtreleme icin kullaniliyor
- Eski kayitlari silen cron job yok
- Delivery log'lar da temizlenmiyor

**Alt Tasklar:**

- [ ] **1.3.1 — Retention cleanup cron job**
  - Gunluk cron (her gun 03:00 UTC)
  - `notifications` tablosundan 90 gundan eski kayitlari sil
  - `notificationDeliveryLog` tablosundan 90 gundan eski kayitlari sil
  - Batch silme: 1000'lik parcalar halinde (buyuk DELETE'lerden kacin)
  - Silme oncesi istatistik logla: kac kayit silinecek

- [ ] **1.3.2 — Retention konfigurasyonu**
  - `NOTIFICATION_RETENTION_DAYS` env var (default: 90)
  - Admin dashboard'dan retention suresi ayarlama
  - `GET /api/system-admin/notifications/retention` — mevcut ayar + istatistik
  - `PATCH /api/system-admin/notifications/retention` — sure guncelle

- [ ] **1.3.3 — Cleanup testleri**
  - 90 gundan eski bildirimler siliniyor
  - 90 gundan yeni bildirimler korunuyor
  - Delivery log'lar da temizleniyor
  - Batch silme dogru calisiyor

**Dosyalar:**
- `apps/scraper/src/notifications/retention-cleanup.ts` (yeni)
- `apps/scraper/src/scheduler.ts` (guncelle: cleanup cron ekle)
- `apps/api/src/routes/admin-notifications.ts` (guncelle)
- `apps/scraper/src/__tests__/notifications/retention-cleanup.test.ts` (yeni)

**Acceptance Criteria:**
- 90 gundan eski bildirimler ve delivery log'lar gunluk olarak temizleniyor
- Retention suresi admin'den konfigurasyonda
- Buyuk tablolarda performans sorunu yok (batch silme)

---

### FAZA 2: Kullanici Deneyimi Iyilestirmeleri (Oncelik: YUKSEK)

---

#### TASK 2.1: Quiet Hours & Do Not Disturb — [PLA-689](https://linear.app/plan-b-side-projects/issue/PLA-689/phase-2-quiet-hours-and-do-not-disturb-mode)

**Problem:** Kullanicilar gece push bildirimi aliyor. Bildirimleri gecici olarak durdurma imkani yok.

**Root Cause:**
- Email sistemi icin quiet hours var (`apps/scraper/src/email/alert-batching.ts`, 22:00-07:00) ama notification'lar icin yok
- DND modu yok
- Notification engine'de zaman bazli kontrol yok

**Alt Tasklar:**

- [ ] **2.1.1 — Quiet hours implementasyonu**
  - `userNotificationPreferences`'a yeni kolonlar: `quietHoursStart`, `quietHoursEnd`, `timezone`
  - Notification engine'de quiet hours check ekle
  - Quiet hours icinde push gonderme, sadece in-app kaydet
  - Quiet hours bitince birikenleri push olarak gonder (opsiyonel, konfigurasyon ile)
  - Default: 22:00 - 07:00 (kullanici timezone'u)

- [ ] **2.1.2 — Do Not Disturb modu**
  - `userNotificationPreferences`'a `dndEnabled`, `dndUntil` (nullable timestamp) kolonlari
  - DND aktifken: push gonderme, in-app kaydet
  - DND sureli: "2 saat DND", "Yarina kadar DND" secenekleri
  - Urgent notification'lar (account_limit_reached, system_scrape_failed) DND'yi bypass etsin

- [ ] **2.1.3 — Quiet hours / DND API**
  - `PATCH /api/notifications/preferences/quiet-hours` — { start, end, timezone }
  - `POST /api/notifications/dnd` — { duration: '2h' | '8h' | 'until_tomorrow' | 'manual' }
  - `DELETE /api/notifications/dnd` — DND'yi kapat
  - `GET /api/notifications/dnd/status` — DND durumu

- [ ] **2.1.4 — Dashboard UI**
  - Notification settings sayfasinda quiet hours konfigurasyonu
  - Saat baslangic/bitis picker + timezone secimi
  - Bell icon'un yaninda DND toggle butonu
  - DND aktifken bell icon'da "moon" ikonu goster
  - DND sure secimi dropdown: 2 saat, 8 saat, yarina kadar

- [ ] **2.1.5 — Testler**
  - Quiet hours icinde push gonderilmeme testi
  - Quiet hours disinda push gonderilme testi
  - DND aktifken push gonderilmeme testi
  - Urgent notification DND bypass testi
  - DND suresi dolunca otomatik kapanma testi

**Dosyalar:**
- `packages/db/src/schema/notifications.ts` (guncelle: quiet hours + DND kolonlari)
- `packages/shared/src/notifications/engine.ts` (guncelle: quiet hours check)
- `apps/api/src/routes/notifications.ts` (guncelle: quiet hours + DND endpoint'leri)
- `apps/dashboard/src/components/notification-bell.tsx` (guncelle: DND toggle)
- `apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx` (yeni)

**Acceptance Criteria:**
- Quiet hours icinde push bildirimi gonderilmiyor
- DND aktifken tum push'lar durduruluyor (urgent haric)
- DND suresi dolunca otomatik olarak kapaniyor
- Dashboard'da quiet hours ve DND yonetimi mevcut

---

#### TASK 2.2: Push Permission Request Banner — [PLA-690](https://linear.app/plan-b-side-projects/issue/PLA-690/phase-2-push-permission-request-banner)

**Problem:** Web push adoption dusuk. Kullaniciya push izni istemek icin UX akisi yok. Browser'in native izin diyalogu direkt gostermek low-conversion.

**Root Cause:**
- `push-notifications.ts`'de subscribeToPush() var ama trigger eden UI yok
- Soft-ask (on-banner) → hard-ask (browser dialog) iki adimli akis yok
- Push adoption metrikleri takip edilmiyor

**Alt Tasklar:**

- [ ] **2.2.1 — Push permission banner component**
  - Dismissible banner: "Enable push notifications to stay updated on your app rankings"
  - "Enable" butonu → browser permission dialog
  - "Not now" → 30 gun sonra tekrar goster
  - "Never" → bir daha gosterme
  - Gosterim kosullari:
    - Kullanici en az 3 gundur kayitli
    - En az 2 app track ediyor
    - Daha once "never" demedi
    - Son 30 gunde "not now" demedi
    - Push zaten enabled degilse

- [ ] **2.2.2 — Banner state yonetimi**
  - `localStorage`'da banner state: `{ dismissed: boolean, dismissedAt: timestamp, neverShow: boolean }`
  - Server-side: push subscription durumunu kontrol et
  - Banner sadece dashboard layout'ta goster (login/signup'ta degil)

- [ ] **2.2.3 — Push adoption tracking**
  - Metrikler: banner_shown, banner_dismissed, permission_granted, permission_denied, subscription_active
  - Admin dashboard'da push adoption stats kartlari
  - `GET /api/system-admin/notifications/push-stats` endpoint

- [ ] **2.2.4 — Testler**
  - Banner gosterim kosullari testi
  - "Not now" → 30 gun sonra tekrar gosterim testi
  - "Never" → bir daha gostermeme testi
  - Permission granted → subscription kaydi testi
  - Permission denied → graceful handling testi

**Dosyalar:**
- `apps/dashboard/src/components/push-permission-banner.tsx` (yeni)
- `apps/dashboard/src/app/(dashboard)/layout.tsx` (guncelle: banner ekle)
- `apps/api/src/routes/admin-notifications.ts` (guncelle: push stats)
- `apps/dashboard/src/__tests__/components/push-permission-banner.test.ts` (yeni)

**Acceptance Criteria:**
- Uygun kullanicilara push izni banner'i gosteriliyor
- "Not now" 30 gun sonra tekrar gosteriyor
- "Never" kalici olarak gizliyor
- Push izni verilince subscription otomatik olusturuluyor
- Admin'de push adoption metrikleri gorulüyor

---

#### TASK 2.3: SSE Client Entegrasyonu & Real-Time Delivery — [PLA-691](https://linear.app/plan-b-side-projects/issue/PLA-691/phase-2-sse-client-integration-and-real-time-delivery)

**Problem:** Dashboard bildirim icin 60s polling kullaniyor. SSE stream backend'de hazir ama client entegrasyonu yok. Bildirimler 60 saniyeye kadar gecikebilir.

**Root Cause:**
- `notification-stream.ts` SSE endpoint'i var (`GET /api/notifications/stream`)
- `notification-bell.tsx` 60s interval ile `GET /unread-count` polling yapiyor
- EventSource client kodu yok

**Alt Tasklar:**

- [ ] **2.3.1 — SSE client hook**
  - `useNotificationStream()` custom React hook
  - EventSource baglantisi `GET /api/notifications/stream`
  - Event handler'lar: `unread-count`, `notification`, `heartbeat`
  - Otomatik reconnection: exponential backoff (1s, 2s, 4s, 8s, max 30s)
  - Tab hidden/visible durumunda connect/disconnect
  - Auth token'i query param olarak gonder (SSE header destegi yok)

- [ ] **2.3.2 — Bell component SSE entegrasyonu**
  - `notification-bell.tsx`'de 60s polling'i kaldir
  - `useNotificationStream()` hook'u ile real-time unread count
  - Yeni bildirim gelince bell'de animasyon (shake/pulse)
  - Dropdown acikken yeni bildirim gelince otomatik prepend

- [ ] **2.3.3 — Notification page SSE entegrasyonu**
  - Notifications page'de yeni bildirim gelince otomatik goster
  - "New notifications" banner (tiklayinca scroll to top + load new)
  - Read/archive islemlerinde unread count anlik guncelleme

- [ ] **2.3.4 — SSE backend iyilestirmeleri**
  - Polling interval'i 15s'den 5s'e dusur (SSE icin)
  - Connection sayisi limiti: kullanici basina max 3 SSE baglantisi
  - Heartbeat interval'i 30s'e cikar (15s gereksiz)
  - SSE connection metrikleri (aktif baglanti sayisi)

- [ ] **2.3.5 — Testler**
  - SSE baglantisi kurulma testi
  - Reconnection testi (baglanti kopma senaryosu)
  - Tab hidden/visible davranisi testi
  - Yeni bildirim gelince UI guncelleme testi

**Dosyalar:**
- `apps/dashboard/src/hooks/useNotificationStream.ts` (yeni)
- `apps/dashboard/src/components/notification-bell.tsx` (guncelle)
- `apps/dashboard/src/app/(dashboard)/notifications/page.tsx` (guncelle)
- `apps/api/src/routes/notification-stream.ts` (guncelle)

**Acceptance Criteria:**
- Bildirimler 5 saniye icinde dashboard'da gorunuyor (polling yerine SSE)
- SSE baglantisi kopunca otomatik reconnect oluyor
- Bell icon'da yeni bildirim animasyonu var
- Tab gizlenince SSE baglantisi kapaniyor, acilinca tekrar baglanıyor

---

#### TASK 2.4: Notification Grouping/Threading UI — [PLA-692](https://linear.app/plan-b-side-projects/issue/PLA-692/phase-2-notification-groupingthreading-ui)

**Problem:** Ayni kategorideki bildirimler tek tek listeleniyor. 20 ranking degisikligi 20 satir kapliyor.

**Root Cause:**
- `notification-stream.ts`'de `groupNotifications()` fonksiyonu var ama UI'da kullanilmiyor
- Notification page ve bell dropdown'da flat liste

**Alt Tasklar:**

- [ ] **2.4.1 — Grouped notification component**
  - `NotificationGroup` component: collapsed view (kategori baslik + count + son bildirim preview)
  - Expand/collapse toggle
  - Expanded view: gruptaki tum bildirimler
  - "Mark all in group as read" butonu

- [ ] **2.4.2 — Bell dropdown grouping**
  - Dropdown'da en fazla 5 grup goster
  - Her grup: kategori icon + "X new [category] notifications" + son bildirim ozeti
  - Tiklayinca notification center'a git (ilgili kategori filtresi ile)

- [ ] **2.4.3 — Notification page grouping**
  - "Group by category" toggle (default: off)
  - Grouped modda: her kategori collapsible section
  - Section basliginda: kategori adi + count + son guncelleme zamani
  - Individual modda: mevcut flat liste

- [ ] **2.4.4 — Testler**
  - Grouping logic testi
  - Expand/collapse davranisi testi
  - "Mark all in group as read" testi
  - Empty group handling testi

**Dosyalar:**
- `apps/dashboard/src/components/notification-group.tsx` (yeni)
- `apps/dashboard/src/components/notification-bell.tsx` (guncelle)
- `apps/dashboard/src/app/(dashboard)/notifications/page.tsx` (guncelle)

**Acceptance Criteria:**
- Ayni kategorideki bildirimler gruplanarak gosteriliyor
- Expand/collapse ile detaylara ulasiliyor
- Bell dropdown'da gruplu ozet gorunuyor
- Grup bazinda toplu "okundu" isareti calisiyor

---

#### TASK 2.5: Ayri Notification Settings Sayfasi — [PLA-693](https://linear.app/plan-b-side-projects/issue/PLA-693/phase-2-dedicated-notification-settings-page)

**Problem:** Notification tercihleri email preferences sayfasinda karisik. Kullanici notification ayarlarini kolayca bulamiyor.

**Root Cause:**
- `settings/email-preferences/page.tsx` hem email hem notification tercihlerini gosteriyor
- Quiet hours, DND, push, ses gibi notification-specific ayarlar icin alan yok

**Alt Tasklar:**

- [ ] **2.5.1 — Notification settings sayfasi**
  - `/settings/notifications` route'u
  - Sections:
    - **Push Notifications**: Enable/disable toggle, subscription durumu, test push butonu
    - **Quiet Hours**: Start/end saat, timezone
    - **Do Not Disturb**: Toggle + sure secimi
    - **Per-Category Preferences**: Her kategori icin in-app ve push toggle'lari
    - **Advanced**: Batching tercihi, ses/vibrasyon (gelecekte)

- [ ] **2.5.2 — Settings navigation**
  - Sol sidebar'da "Notifications" linki (Email Preferences'in altinda)
  - Settings page header'da "Email" ve "Notifications" tab'lari

- [ ] **2.5.3 — Test push butonu**
  - "Send test notification" butonu
  - Tiklayinca in-app + push test bildirimi gonder
  - Kullanicinin push subscription'inin calistigini dogrula

**Dosyalar:**
- `apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx` (yeni)
- `apps/dashboard/src/app/(dashboard)/settings/layout.tsx` (guncelle: navigation)
- `apps/api/src/routes/notifications.ts` (guncelle: test push endpoint)

**Acceptance Criteria:**
- Notification ayarlari ayrı sayfada, kategorize edilmis
- Push abonelik durumu gorunuyor ve yonetilebilıyor
- Test push butonu calisiyor
- Quiet hours ve DND bu sayfadan yonetilebiliyor

---

### FAZA 3: Admin & Monitoring (Oncelik: YUKSEK)

---

#### TASK 3.1: Notification Analytics Dashboard — [PLA-694](https://linear.app/plan-b-side-projects/issue/PLA-694/phase-3-notification-analytics-dashboard)

**Problem:** Admin dashboard'da sadece toplam stats var. Tip bazli, zaman bazli, kullanici bazli analiz yok.

**Alt Tasklar:**

- [ ] **3.1.1 — Analytics veri toplama**
  - `notification_daily_stats` tablosu: date, notification_type, category, sent, read, push_sent, push_clicked, push_dismissed, archived
  - Gunluk cron: onceki gunun verilerini aggregate et
  - 90 gunluk retention

- [ ] **3.1.2 — Analytics API endpoint'leri**
  - `GET /api/system-admin/notifications/analytics/overview` — son 30 gun ozet
  - `GET /api/system-admin/notifications/analytics/trends?metric=read_rate&period=30d`
  - `GET /api/system-admin/notifications/analytics/by-type` — tip bazli karsilastirma
  - `GET /api/system-admin/notifications/analytics/by-category` — kategori bazli
  - `GET /api/system-admin/notifications/analytics/push` — push adoption ve engagement
  - `GET /api/system-admin/notifications/analytics/delivery` — delivery success/fail rates

- [ ] **3.1.3 — Analytics dashboard UI**
  - Overview kartlari: Total Sent, Read Rate, Push Sent, Push Click Rate, Active Push Subs
  - Trend grafikleri: son 30 gun (sent, read, push_clicked)
  - Tip bazli karsilastirma tablosu (en cok okunan/gozardi edilen tipler)
  - Push adoption funnel: Total Users → Push Enabled → Active Subscribers → Clicked
  - Delivery success rate by channel (in-app vs push)
  - Category breakdown pie chart

- [ ] **3.1.4 — Testler**
  - Aggregation cron testi
  - Analytics endpoint'leri testi
  - Empty data handling testi

**Dosyalar:**
- `packages/db/src/schema/notifications.ts` (guncelle: notification_daily_stats tablosu)
- `apps/scraper/src/notifications/stats-aggregator.ts` (yeni)
- `apps/api/src/routes/notification-analytics.ts` (yeni)
- `apps/dashboard/src/app/(dashboard)/system-admin/notification-analytics/page.tsx` (yeni)

**Acceptance Criteria:**
- Gunluk notification metrikleri otomatik aggregate ediliyor
- Admin dashboard'da trend grafikleri ve tip bazli analiz mevcut
- Push adoption funnel gorulüyor
- Delivery success rate izlenebiliyor

---

#### TASK 3.2: Admin Broadcast Notifications — [PLA-695](https://linear.app/plan-b-side-projects/issue/PLA-695/phase-3-admin-broadcast-notifications)

**Problem:** Admin'den kullanicilara manual bildirim gonderilemıyor. Sistem duyurulari, bakim bildirimleri icin mekanizma yok.

**Alt Tasklar:**

- [ ] **3.2.1 — Broadcast notification API**
  - `POST /api/system-admin/notifications/broadcast` — tum kullanicilara bildirim
    - Body: `{ title, body, url?, category: 'system', priority, targetAudience }`
    - Target audience: `all`, `active_last_7d`, `active_last_30d`, `plan:pro`, `specific_users: [userId]`
  - `GET /api/system-admin/notifications/broadcasts` — gecmis broadcast'ler
  - `GET /api/system-admin/notifications/broadcasts/:id` — broadcast detay + delivery stats

- [ ] **3.2.2 — Broadcast processing**
  - Buyuk kullanici listesi icin batch processing (100'lik parcalar)
  - BullMQ job olarak isle (anlik degil, queue uzerinden)
  - Her kullaniciya ayri notification kaydi olustur
  - Push + in-app ayni anda

- [ ] **3.2.3 — Broadcast dashboard UI**
  - "Send Broadcast" formu: title, body, URL, priority, target audience
  - Gonderim oncesi preview + "Kac kisiye gidecek?" bilgisi
  - Broadcast history tablosu (tarih, baslik, alici sayisi, read rate)

- [ ] **3.2.4 — Testler**
  - Broadcast tum kullanicilara testi
  - Target audience filtresi testi
  - Batch processing testi
  - Broadcast stats testi

**Dosyalar:**
- `apps/api/src/routes/admin-notifications.ts` (guncelle)
- `apps/scraper/src/notifications/broadcast.ts` (yeni)
- `apps/dashboard/src/app/(dashboard)/system-admin/notifications/page.tsx` (guncelle)

**Acceptance Criteria:**
- Admin tum kullanicilara veya hedef kitleye bildirim gonderebiliyor
- Broadcast islemleri queue uzerinden batch olarak isleniyor
- Broadcast history ve delivery stats gorulüyor
- Gonderim oncesi preview ve alici sayisi gosteriliyor

---

#### TASK 3.3: Notification Health Monitoring — [PLA-696](https://linear.app/plan-b-side-projects/issue/PLA-696/phase-3-notification-health-monitoring)

**Problem:** Notification worker'in saglik durumu, delivery basari orani, queue derinligi anlik izlenemiyor.

**Alt Tasklar:**

- [ ] **3.3.1 — Worker health metrikleri**
  - Notification worker'da metrik toplama:
    - `processed_total`, `failed_total`, `processing_duration_ms`
    - `push_sent_total`, `push_failed_total`
    - `dedup_skipped_total`, `rate_limited_total`, `eligibility_blocked_total`
  - 1dk rolling averages
  - Worker `/health` endpoint'ine metrikler ekle

- [ ] **3.3.2 — Alert rule'lari**
  - Task 2.2 (email alert rules) sistemine notification-specific rule'lar ekle:
    - `notification_queue_depth > 100` → alert (30dk cooldown)
    - `notification_error_rate_1h > 0.1` → alert (60dk cooldown)
    - `push_failure_rate_1h > 0.2` → alert (60dk cooldown)
    - `notification_dlq_depth > 5` → alert (120dk cooldown)

- [ ] **3.3.3 — Health dashboard**
  - Admin'de notification system health sayfasi
  - Worker status karti (healthy/degraded/unhealthy)
  - Queue depth grafigi
  - Delivery rate grafigi (son 1 saat)
  - Push delivery success rate
  - Son 10 hata listesi

- [ ] **3.3.4 — Testler**
  - Metrik toplama testi
  - Health status hesaplama testi (healthy/degraded/unhealthy kosullari)

**Dosyalar:**
- `apps/scraper/src/notifications/worker-metrics.ts` (yeni)
- `apps/scraper/src/notification-worker.ts` (guncelle)
- `apps/api/src/routes/system-admin.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/notification-health/page.tsx` (yeni)

**Acceptance Criteria:**
- Worker processing rate, error rate, push success rate anlık gorulüyor
- Queue depth ve error rate threshold'lari asildiginda alert gidiyor
- Admin dashboard'da notification system health sayfasi mevcut

---

### FAZA 4: Gelismis Ozellikler (Oncelik: ORTA)

---

#### TASK 4.1: Cross-Tab Notification Sync — [PLA-697](https://linear.app/plan-b-side-projects/issue/PLA-697/phase-4-cross-tab-notification-sync)

**Problem:** Kullanici bir tab'da bildirimi okundu olarak isaretlerse diger tab'lar guncellenmıyor.

**Alt Tasklar:**

- [ ] **4.1.1 — BroadcastChannel implementation**
  - `useNotificationSync()` hook
  - BroadcastChannel API: `'notification-sync'` kanal adi
  - Event'ler: `{ type: 'read', id }`, `{ type: 'read-all' }`, `{ type: 'archive', id }`, `{ type: 'new', notification }`
  - Fallback: `localStorage` event listener (BroadcastChannel desteklemeyen browser'lar icin)

- [ ] **4.1.2 — Component entegrasyonu**
  - notification-bell.tsx: diger tab'dan read/new event gelince unread count guncelle
  - notifications/page.tsx: diger tab'dan read/archive event gelince UI guncelle
  - Debounce: 100ms icindeki coklu event'leri birlestir

- [ ] **4.1.3 — Testler**
  - Cross-tab read sync testi
  - Cross-tab read-all sync testi
  - Cross-tab new notification testi
  - BroadcastChannel → localStorage fallback testi

**Dosyalar:**
- `apps/dashboard/src/hooks/useNotificationSync.ts` (yeni)
- `apps/dashboard/src/components/notification-bell.tsx` (guncelle)
- `apps/dashboard/src/app/(dashboard)/notifications/page.tsx` (guncelle)

**Acceptance Criteria:**
- Bir tab'da okundu isareti diger tab'larda anlik yansıyor
- Yeni bildirim tum acik tab'larda anlik gorunuyor
- BroadcastChannel desteklemeyen browser'larda localStorage fallback calisiyor

---

#### TASK 4.2: Per-Type Rate Limiting — [PLA-698](https://linear.app/plan-b-side-projects/issue/PLA-698/phase-4-per-type-notification-rate-limiting)

**Problem:** Genel rate limit 50/user/saat var ama tip bazli limit yok. Ayni tipte sinirsiz bildirim gidebilir.

**Alt Tasklar:**

- [ ] **4.2.1 — Per-type rate limit konfigurasyonu**
  - `notificationTypeConfigs`'a `rateLimitPerHour` kolonu ekle
  - Default'lar:
    - ranking_significant_change: 10/saat
    - competitor_overtook: 5/saat
    - review_new_positive/negative: 20/saat
    - keyword_position_gained/lost: 15/saat
    - system_scrape_complete: 1/saat
    - Diger: 10/saat (default)

- [ ] **4.2.2 — Rate limiter implementasyonu**
  - Notification engine'de per-type check ekle
  - Sliding window counter: Redis INCR + EXPIRE (1 saat TTL)
  - Key: `notif_rate:{userId}:{type}`
  - Limit asildiginda: log + skip (bildirim gonderme, kayda al)
  - Admin override: belirli tipler icin limit degistirilebilir

- [ ] **4.2.3 — Rate limit monitoring**
  - Admin dashboard'da hangi tipler ne siklikta rate limited oluyor
  - Rate limited notification count metrikleri
  - `GET /api/system-admin/notifications/rate-limits` endpoint

- [ ] **4.2.4 — Testler**
  - Per-type limit asildiginda skip testi
  - Farkli tipler bagimsiz limit testi
  - Sliding window dogru calismasi testi
  - Admin override testi

**Dosyalar:**
- `packages/db/src/schema/notifications.ts` (guncelle: rateLimitPerHour kolonu)
- `packages/shared/src/notifications/engine.ts` (guncelle: per-type rate check)
- `apps/api/src/routes/admin-notifications.ts` (guncelle)

**Acceptance Criteria:**
- Her bildirim tipi icin ayri rate limit uygulanıyor
- Limit asıldığında bildirim atlanıp loglanıyor
- Admin'den per-type rate limit duzenleniyor

---

#### TASK 4.3: Notification Scheduling — [PLA-699](https://linear.app/plan-b-side-projects/issue/PLA-699/phase-4-notification-scheduling)

**Problem:** Zamanlanmis bildirim gonderilemıyor. Admin belirli bir zamanda bildirim planlamak istiyor.

**Alt Tasklar:**

- [ ] **4.3.1 — Scheduled notification enqueue**
  - `enqueueNotification()` fonksiyonuna `delay` parametresi ekle
  - BullMQ delayed job olarak kuyrukla
  - `scheduledFor` timestamp'i notification record'a kaydet

- [ ] **4.3.2 — Scheduled notification yonetimi**
  - `GET /api/system-admin/notifications/scheduled` — planlanmis bildirimler
  - `DELETE /api/system-admin/notifications/scheduled/:jobId` — iptal et
  - `PATCH /api/system-admin/notifications/scheduled/:jobId` — zamani guncelle
  - Admin dashboard'da "Scheduled" tab

- [ ] **4.3.3 — Testler**
  - Delayed job olusturma testi
  - Iptal testi
  - Zaman guncelleme testi

**Dosyalar:**
- `apps/scraper/src/queue.ts` (guncelle: delay desteği)
- `apps/api/src/routes/admin-notifications.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/notifications/page.tsx` (guncelle)

**Acceptance Criteria:**
- Admin gelecek bir tarih/saat icin bildirim planlayabiliyor
- Planlanmis bildirimler listeleniyor, iptal edilebiliyor, zamani guncellenebiliyor

---

#### TASK 4.4: Webhook/External Delivery (Slack/Discord) — [PLA-700](https://linear.app/plan-b-side-projects/issue/PLA-700/phase-4-webhookexternal-delivery-slackdiscord)

**Problem:** Bildirimler sadece in-app ve web push olarak gonderiliyor. Slack, Discord gibi harici kanallara gondermek mumkun degil.

**Alt Tasklar:**

- [ ] **4.4.1 — Webhook konfigurasyonu**
  - `userNotificationPreferences`'a `webhookUrl`, `webhookEnabled` kolonlari
  - Webhook format: Slack-compatible JSON payload
  - `PATCH /api/notifications/preferences/webhook` — { url, enabled }

- [ ] **4.4.2 — Webhook delivery**
  - Notification engine'de webhook check ekle
  - Push sonrasi webhook gonder (eger enabled)
  - Webhook payload:
    ```json
    {
      "text": "{{title}}: {{body}}",
      "blocks": [{ "type": "section", "text": { "type": "mrkdwn", "text": "..." } }]
    }
    ```
  - Retry: 2 deneme, 5s backoff
  - Delivery log: channel = "webhook"

- [ ] **4.4.3 — Webhook yonetim UI**
  - Settings'te webhook URL input
  - "Test webhook" butonu
  - Webhook delivery history

- [ ] **4.4.4 — Testler**
  - Webhook delivery testi
  - Webhook fail + retry testi
  - Invalid URL handling testi
  - Slack payload format testi

**Dosyalar:**
- `packages/db/src/schema/notifications.ts` (guncelle: webhook kolonlari)
- `apps/scraper/src/notifications/webhook-delivery.ts` (yeni)
- `apps/scraper/src/notifications/process-notification.ts` (guncelle)
- `apps/api/src/routes/notifications.ts` (guncelle: webhook preferences)
- `apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx` (guncelle)

**Acceptance Criteria:**
- Kullanicilar Slack/Discord webhook URL'i tanimlayabiliyor
- Bildirimler webhook uzerinden gonderiliyor
- Webhook test butonu calisiyor
- Delivery log'da webhook teslimat kayitlari var

---

### FAZA 5: Optimizasyon & Gelismis (Oncelik: DUSUK)

---

#### TASK 5.1: Notification Priority Queue — [PLA-701](https://linear.app/plan-b-side-projects/issue/PLA-701/phase-5-notification-priority-queue)

**Problem:** Urgent ve low-priority bildirimler ayni kuyrukta FIFO sirasiyla isleniyor. Urgent bildirimler gecikmeli olabiliyor.

**Alt Tasklar:**

- [ ] **5.1.1 — Priority-based queue routing**
  - Urgent tipler (account_limit_reached, system_scrape_failed): ayri urgent queue veya BullMQ priority
  - BullMQ priority support: `{ priority: 1 }` (1 = en yuksek)
  - Event dispatcher'da priority mapping: tip → priority

- [ ] **5.1.2 — Priority testleri**
  - Urgent bildirimler normal'den once isleniyor testi
  - Mixed priority queue davranisi testi

**Dosyalar:**
- `apps/scraper/src/queue.ts` (guncelle: priority support)
- `apps/scraper/src/events/event-dispatcher.ts` (guncelle: priority mapping)

---

#### TASK 5.2: Mobile Push (Firebase/APNs) — [PLA-702](https://linear.app/plan-b-side-projects/issue/PLA-702/phase-5-mobile-push-support-firebaseapns)

**Problem:** Sadece web push (VAPID) destegi var. Mobil cihazlara push gondermek mumkun degil.

**Alt Tasklar:**

- [ ] **5.2.1 — Firebase Cloud Messaging entegrasyonu**
  - `firebase-admin` SDK kurulumu
  - FCM device token kaydi: `POST /api/notifications/push-subscription` (type: 'fcm')
  - `pushSubscriptions` tablosuna `type` kolonu: 'web' | 'fcm' | 'apns'
  - FCM gonderi fonksiyonu: `sendFcmNotification(token, payload)`

- [ ] **5.2.2 — Multi-platform delivery**
  - `sendPushToUser()` fonksiyonunu genislet: web + FCM + APNs
  - Platform bazli payload formatlama
  - Platform bazli delivery log

- [ ] **5.2.3 — Testler**
  - FCM token kayit testi
  - FCM gonderim testi
  - Multi-platform delivery testi

**Dosyalar:**
- `apps/api/src/services/web-push.ts` (guncelle → `push-service.ts` olarak yeniden adlandir)
- `packages/db/src/schema/notifications.ts` (guncelle: subscription type kolonu)
- `apps/api/src/routes/notifications.ts` (guncelle)

---

#### TASK 5.3: Notification Sound & Vibration Preferences — [PLA-703](https://linear.app/plan-b-side-projects/issue/PLA-703/phase-5-notification-sound-and-vibration-preferences)

**Problem:** Push bildirimlerinde ses ve vibrasyon tercihi yok. Sabit vibrasyon pattern'i var.

**Alt Tasklar:**

- [ ] **5.3.1 — Sound/vibration preferences**
  - `userNotificationPreferences`'a `soundEnabled`, `vibrationEnabled` kolonlari
  - Service worker'da preference'a gore sound/vibration
  - Default notification sesi secimi

- [ ] **5.3.2 — Settings UI**
  - Notification settings sayfasinda ses ve vibrasyon toggle'lari
  - Ses preview butonu
  - Vibrasyon preview butonu

**Dosyalar:**
- `packages/db/src/schema/notifications.ts` (guncelle)
- `apps/dashboard/public/sw.js` (guncelle)
- `apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx` (guncelle)

---

## 5. Onceliklendirme Ozeti

| Faz | Task | Linear | Oncelik | Tahmini Karmasiklik | Bagimlilik |
|-----|------|--------|---------|---------------------|------------|
| 1 | 1.1 Push Subscription & Dismiss Endpoints | [PLA-686](https://linear.app/plan-b-side-projects/issue/PLA-686) | KRITIK | Dusuk | - |
| 1 | 1.2 Notification Batching Engine | [PLA-687](https://linear.app/plan-b-side-projects/issue/PLA-687) | KRITIK | Yuksek | - |
| 1 | 1.3 Notification Retention Cleanup | [PLA-688](https://linear.app/plan-b-side-projects/issue/PLA-688) | YUKSEK | Dusuk | - |
| 2 | 2.1 Quiet Hours & DND | [PLA-689](https://linear.app/plan-b-side-projects/issue/PLA-689) | YUKSEK | Orta | - |
| 2 | 2.2 Push Permission Banner | [PLA-690](https://linear.app/plan-b-side-projects/issue/PLA-690) | YUKSEK | Orta | 1.1 |
| 2 | 2.3 SSE Client & Real-Time | [PLA-691](https://linear.app/plan-b-side-projects/issue/PLA-691) | YUKSEK | Orta | - |
| 2 | 2.4 Grouping/Threading UI | [PLA-692](https://linear.app/plan-b-side-projects/issue/PLA-692) | ORTA | Orta | 1.2 |
| 2 | 2.5 Notification Settings Page | [PLA-693](https://linear.app/plan-b-side-projects/issue/PLA-693) | ORTA | Dusuk | 2.1 |
| 3 | 3.1 Analytics Dashboard | [PLA-694](https://linear.app/plan-b-side-projects/issue/PLA-694) | ORTA | Yuksek | - |
| 3 | 3.2 Admin Broadcast | [PLA-695](https://linear.app/plan-b-side-projects/issue/PLA-695) | ORTA | Orta | - |
| 3 | 3.3 Health Monitoring | [PLA-696](https://linear.app/plan-b-side-projects/issue/PLA-696) | YUKSEK | Orta | - |
| 4 | 4.1 Cross-Tab Sync | [PLA-697](https://linear.app/plan-b-side-projects/issue/PLA-697) | ORTA | Dusuk | 2.3 |
| 4 | 4.2 Per-Type Rate Limiting | [PLA-698](https://linear.app/plan-b-side-projects/issue/PLA-698) | ORTA | Orta | - |
| 4 | 4.3 Notification Scheduling | [PLA-699](https://linear.app/plan-b-side-projects/issue/PLA-699) | DUSUK | Dusuk | - |
| 4 | 4.4 Webhook Delivery (Slack/Discord) | [PLA-700](https://linear.app/plan-b-side-projects/issue/PLA-700) | DUSUK | Orta | - |
| 5 | 5.1 Priority Queue | [PLA-701](https://linear.app/plan-b-side-projects/issue/PLA-701) | DUSUK | Dusuk | - |
| 5 | 5.2 Mobile Push (Firebase) | [PLA-702](https://linear.app/plan-b-side-projects/issue/PLA-702) | DUSUK | Yuksek | 1.1 |
| 5 | 5.3 Sound & Vibration Prefs | [PLA-703](https://linear.app/plan-b-side-projects/issue/PLA-703) | DUSUK | Dusuk | 2.5 |

### Onerilen Uygulama Sirasi

**Sprint 1 (Kritik Fix):** 1.1 + 1.3 + 1.2
**Sprint 2 (UX):** 2.1 + 2.2 + 2.3
**Sprint 3 (UX + Admin):** 2.4 + 2.5 + 3.3
**Sprint 4 (Analytics + Broadcast):** 3.1 + 3.2
**Sprint 5 (Gelismis):** 4.1 + 4.2
**Sprint 6 (Opsiyonel):** 4.3 + 4.4 + 5.1 + 5.2 + 5.3

---

## 6. Veritabani Degisiklikleri Ozeti

| Tablo/Kolon | Tur | Faz |
|-------------|-----|-----|
| `notification_daily_stats` | Yeni tablo | 3.1 |
| `userNotificationPreferences.quietHoursStart` | Kolon ekleme | 2.1 |
| `userNotificationPreferences.quietHoursEnd` | Kolon ekleme | 2.1 |
| `userNotificationPreferences.timezone` | Kolon ekleme | 2.1 |
| `userNotificationPreferences.dndEnabled` | Kolon ekleme | 2.1 |
| `userNotificationPreferences.dndUntil` | Kolon ekleme | 2.1 |
| `userNotificationPreferences.webhookUrl` | Kolon ekleme | 4.4 |
| `userNotificationPreferences.webhookEnabled` | Kolon ekleme | 4.4 |
| `userNotificationPreferences.soundEnabled` | Kolon ekleme | 5.3 |
| `userNotificationPreferences.vibrationEnabled` | Kolon ekleme | 5.3 |
| `notificationTypeConfigs.rateLimitPerHour` | Kolon ekleme | 4.2 |
| `pushSubscriptions.type` | Kolon ekleme | 5.2 |
| `notifications.scheduledFor` | Kolon ekleme | 4.3 |

---

## 7. Ortam Degiskenleri (Mevcut + Yeni)

```env
# Mevcut
VAPID_PUBLIC_KEY=          # Web Push VAPID public key
VAPID_PRIVATE_KEY=         # Web Push VAPID private key
VAPID_SUBJECT=             # Web Push contact (mailto:)

# Yeni (Task 1.3)
NOTIFICATION_RETENTION_DAYS=90   # Bildirim saklama suresi

# Yeni (Task 5.2)
FIREBASE_PROJECT_ID=             # Firebase Cloud Messaging
FIREBASE_PRIVATE_KEY=            # FCM service account key
FIREBASE_CLIENT_EMAIL=           # FCM service account email
```

---

## 8. Dosya Referanslari (Mevcut Sistem)

| Bilesen | Dosya | Satir |
|---------|-------|-------|
| DB Schema | `packages/db/src/schema/notifications.ts` | Tum |
| Notification Types | `packages/shared/src/notification-types.ts` | Tum |
| Template Registry | `packages/shared/src/template-registry.ts` | 134-241 |
| Notification Engine | `packages/shared/src/notifications/engine.ts` | Tum |
| Queue Config | `apps/scraper/src/queue.ts` | 14, 100-119, 141-149 |
| Notification Worker | `apps/scraper/src/notification-worker.ts` | Tum |
| Job Processor | `apps/scraper/src/notifications/process-notification.ts` | Tum |
| Event Dispatcher | `apps/scraper/src/events/event-dispatcher.ts` | Tum |
| Web Push Service | `apps/api/src/services/web-push.ts` | Tum |
| User API Routes | `apps/api/src/routes/notifications.ts` | Tum |
| SSE Stream | `apps/api/src/routes/notification-stream.ts` | Tum |
| Admin API Routes | `apps/api/src/routes/admin-notifications.ts` | Tum |
| Template Routes | `apps/api/src/routes/templates.ts` | 77-231 |
| Service Worker | `apps/dashboard/public/sw.js` | Tum |
| Push Client Lib | `apps/dashboard/src/lib/push-notifications.ts` | Tum |
| Bell Component | `apps/dashboard/src/components/notification-bell.tsx` | Tum |
| Notifications Page | `apps/dashboard/src/app/(dashboard)/notifications/page.tsx` | Tum |
| Admin Dashboard | `apps/dashboard/src/app/(dashboard)/system-admin/notifications/page.tsx` | Tum |
| Templates Admin | `apps/dashboard/src/app/(dashboard)/system-admin/notification-templates/page.tsx` | Tum |
| Docker Config | `docker-compose.prod.yml` | 243-270 |
