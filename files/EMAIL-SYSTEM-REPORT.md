# Email Sistemi: Mevcut Durum Analizi & Yol Haritasi

> Tarih: 2026-04-03 | Güncelleme: 2026-04-05
> Proje: AppRanks (Shopify Tracking)

---

## 1. Mevcut Sistemin Analizi

### 1.1 Genel Mimari

Email sistemi **iki kuyruklu (dual-queue)** bir mimari uzerine kurulu:

```
                    ┌──────────────────┐
                    │    API Server     │
                    │  (apps/api)       │
                    └────────┬─────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
     ┌─────────▼──────────┐     ┌──────────▼─────────┐
     │  email-instant      │     │  email-bulk         │
     │  (BullMQ Queue)     │     │  (BullMQ Queue)     │
     │  Redis-backed       │     │  Redis-backed       │
     └─────────┬──────────┘     └──────────┬─────────┘
               │                           │
     ┌─────────▼──────────┐     ┌──────────▼─────────┐
     │  Email Instant      │     │  Email Bulk         │
     │  Worker (Docker)    │     │  Worker (Docker)    │
     │  Concurrency: 3     │     │  Concurrency: 5     │
     │  Retry: 3x / 5s     │     │  Retry: 2x / 30s    │
     │  Rate: unlimited    │     │  Rate: 50/min        │
     └─────────┬──────────┘     └──────────┬─────────┘
               │                           │
               └─────────────┬─────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Email Pipeline  │
                    │   (6 steps)       │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   SMTP (nodemailer)│
                    └──────────────────┘
```

### 1.2 Kuyruk Sistemi (AKTIF)

Queue sistemi **BullMQ** uzerinde calisiyor, Redis-backed.

| Queue | Concurrency | Rate Limit | Retry | Backoff | Container |
|-------|-------------|------------|-------|---------|-----------|
| `email-instant` | 3 | Yok | 3 deneme | 5s exponential | `worker-email-instant` (512MB) |
| `email-bulk` | 5 | 50/dk | 2 deneme | 30s exponential | `worker-email-bulk` (1GB) |
| `notifications` | - | - | - | - | `worker-notifications` (512MB) |

Her iki worker da **ayri Docker container** olarak deploy ediliyor (`Dockerfile.worker-email`, node:22-alpine).

### 1.3 Email Pipeline (6 Adim)

Her email gonderilmeden once su pipeline'dan gecer (`apps/scraper/src/email/pipeline.ts`):

1. **Eligibility Check** — Global, account ve user-level kontroller
2. **Unsubscribe Token** — 32-byte hex token uretimi
3. **DB Log** — `email_logs` tablosuna "queued" statususyle kayit
4. **Tracking Injection** — 1x1 pixel + link rewriting (opsiyonel `skipTracking`)
5. **Header Build** — RFC 8058 List-Unsubscribe headers
6. **SMTP Send** — nodemailer ile gonderim

### 1.4 Eligibility Kontrolleri

5 katmanli kontrol (`apps/scraper/src/email/eligibility.ts`):

1. Global email type enable/disable (`email_type_configs` tablosu)
2. Account-level override (`email_type_account_overrides` tablosu)
3. User opt-out tercihleri (`user_email_preferences` tablosu)
4. Frekans limiti (email type basina saat bazli)
5. Deduplication (ayni email 1 saat icinde tekrar gonderilmez)

### 1.5 Email Turleri

#### Instant (Transactional) Emailler
| Tur | Tetikleme | Dosya |
|-----|-----------|-------|
| `email_password_reset` | Sifre sifirlama talebi | `templates/transactional/password-reset.ts` |
| `email_verification` | Email dogrulama | `templates/transactional/email-verification.ts` |
| `email_welcome` | Kayit sonrasi | `welcome-template.ts` |
| `email_invitation` | Takim davet | `templates/transactional/invitation.ts` |
| `email_login_alert` | Supheli giris | `templates/transactional/login-alert.ts` |
| `email_2fa_code` | 2FA kodu | `templates/transactional/two-factor-code.ts` |

#### Bulk (Marketing/Bildirim) Emailler
| Tur | Tetikleme | Dosya |
|-----|-----------|-------|
| `email_daily_digest` | Gunluk cron | `digest-builder.ts` + `digest-template.ts` |
| `email_weekly_summary` | Haftalik cron | `weekly-builder.ts` + `weekly-template.ts` |
| `email_ranking_alert` | Siralama degisimi | `ranking-alert-template.ts` |
| `email_competitor_alert` | Rakip aktivitesi | `competitor-alert-template.ts` |
| `email_review_alert` | Yeni review | `review-alert-template.ts` |
| `email_win_celebration` | Milestone | `win-celebration-template.ts` |
| `email_re_engagement` | Inaktif kullanici | `re-engagement-template.ts` |
| `email_onboarding` | Onboarding serisi | (template registry'de tanimli) |

### 1.6 Template Sistemi

- **Template Registry** (`packages/shared/src/template-registry.ts`): Her email tipi icin degisken tanimlari
- **`{{variable}}` placeholder** sistemi ile `renderTemplate()` fonksiyonu
- **Sample data generator** (`buildEmailSampleData()`) preview icin
- **Design tokens** (`components/design-tokens.ts`): Tutarli styling
- **Layout components**: Header, footer, layout wrapper

### 1.7 Tracking & Analytics

| Ozellik | Durum | Detay |
|---------|-------|-------|
| Open tracking | AKTIF | 1x1 transparent PNG pixel |
| Click tracking | AKTIF | Link rewriting + redirect |
| Unsubscribe | AKTIF | RFC 8058, one-click, token-based |
| Bounce handling | KISMI | Programmatic (webhook yok) |
| Suppression list | AKTIF | Hard bounce + complaint, 90 gun, 5dk cache |

### 1.8 Admin Dashboard Ozellikleri

| Sayfa | URL | Ozellikler |
|-------|-----|------------|
| Email Logs | `/system-admin/emails` | Filtreleme, stats, resend, manual send |
| Queue Monitor | `/system-admin/queues` | 5 kuyrugun real-time durumu |
| Email Templates | `/system-admin/email-templates` | Duzenleme, preview, reset, degisken picker |
| DLQ Management | `/system-admin/dlq` | Basarisiz joblari gorme, replay, silme |

### 1.9 Veritabani Semalari

7 tablo email sistemi icin kullaniliyor (`packages/db/src/schema/email.ts`):

1. `email_type_configs` — Global email tipi ayarlari
2. `email_type_account_overrides` — Account bazli override'lar
3. `email_logs` — Tum email kayitlari (subject, body, status, tracking)
4. `email_campaigns` — Cold email kampanya takibi
5. `email_prospects` — Cold outreach kontakt listesi
6. `user_email_preferences` — Kullanici opt-in/out tercihleri
7. `email_unsubscribe_tokens` — Unsubscribe tokenlari

### 1.10 Test & Sandbox Altyapisi

| Ozellik | Durum | Detay |
|---------|-------|-------|
| Mailhog (local) | AKTIF | Docker compose'da, SMTP port 1025, Web UI port 8025 |
| Dry-run preview | AKTIF | `dryRunPreview()` + `bulkDryRun()` |
| Test email gonder | AKTIF | `POST /emails/send` + test-send endpoint |
| Email preview | AKTIF | Adminlerden template + sample data ile HTML preview |
| Global sandbox mode | YOK | Tum emailleri tek adrese yonlendirme yok |

### 1.11 Alert Batching & Quiet Hours

- **Batch window**: 5 dakika (ayni kategorideki alertler birlestirilir)
- **Merge threshold**: 3+ event ayni kategoride ise birlestir
- **Quiet hours**: 22:00 – 07:00 (kullanici timezone'una gore)
- **Timezone destegi**: Digest/weekly emailler icin kullanici timezone'u

### 1.12 Dead Letter Queue (DLQ)

- Instant worker: 3 basarisiz denemeden sonra DLQ'ya
- Bulk worker: 2 basarisiz denemeden sonra DLQ'ya
- DLQ kayitlari: `deadLetterJobs` tablosunda (error, stack trace, attempt count)
- Admin'den replay veya silme mumkun
- DLQ depth alerti: threshold asildiginda uyari

---

## 2. Eksiklikler ve Iyilestirme Alanlari

### 2.1 Kritik Eksiklikler

| # | Eksiklik | Etki | Oncelik |
|---|----------|------|---------|
| E1 | Provider webhook entegrasyonu yok | Bounce/complaint'ler anlik yakalanmiyor, SMTP hata mesajindan parse ediliyor | YUKSEK |
| E2 | Global sandbox mode yok | Production'da test yapmak riskli, yanlislikla gercek kullaniciya email gidebilir | YUKSEK |
| E3 | Email worker health metrikleri yetersiz | Processing rate, error rate, latency gorulmuyor | ORTA |
| E4 | Queue depth alert sistemi yok | Kuyruk birikirse admin haberdar olmuyor | YUKSEK |
| E5 | Detayli analytics yok | Trend analizi, template karsilastirma, cohort analizi yok | ORTA |
| E6 | Email retry stratejisi sinirli | DLQ'daki emailler icin bulk retry yok, sadece tek tek | ORTA |
| E7 | SMTP failover/fallback yok | SMTP provider coktugunde email gonderilemiyor | YUKSEK |
| E8 | Rate limiting sadece BullMQ | SMTP provider limitleri ile senkron degil | DUSUK |
| E9 | Cron trigger'lar icin monitoring yok | Digest/weekly cron'lari calismazsa haber alinmiyor | ORTA |
| E10 | A/B test altyapisi yok | Farkli template/subject line test edilemiyor | DUSUK |

### 2.2 Operasyonel Eksiklikler

| # | Eksiklik | Detay |
|---|----------|-------|
| O1 | Admin'de email queue depth grafigi yok | Sadece anlik sayi, trend yok |
| O2 | Email gonderi basari orani trendi yok | Son 24s/7g/30g trend grafigi yok |
| O3 | Bulk retry butonu yok | DLQ'dan toplu replay yok |
| O4 | Email content search yok | Gonderilen emaillerin iceriginde arama yok |
| O5 | Export/download ozelligi yok | Email log'larini CSV/JSON olarak indirme yok |
| O6 | Email schedule/delay ozelligi yok | Belirli bir zamanda email gondermek mumkun degil |

---

## 3. Ideal Email Sistemi Mimarisi

### 3.1 Hedef Mimari

```
┌────────────────────────────────────────────────────────────────────┐
│                        API Server (Fastify)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Auth Routes   │  │ Admin Routes │  │ Webhook Receiver         │ │
│  │ (signup,      │  │ (manual send,│  │ (bounce, complaint,      │ │
│  │  reset, 2FA)  │  │  preview,    │  │  delivery notifications) │ │
│  │              │  │  dry-run)    │  │                          │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
│         │                 │                        │               │
│  ┌──────▼─────────────────▼────────────────────────▼─────────────┐ │
│  │                 Email Enqueue Service                          │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐ │ │
│  │  │ Priority     │  │ Sandbox      │  │ Validation &          │ │ │
│  │  │ Router       │  │ Interceptor  │  │ Deduplication         │ │ │
│  │  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────┘ │ │
│  └─────────┼────────────────┼──────────────────────┼─────────────┘ │
└────────────┼────────────────┼──────────────────────┼───────────────┘
             │                │                      │
    ┌────────▼────────┐  ┌────▼──────────────────────▼───────┐
    │  email-instant   │  │        email-bulk                 │
    │  (BullMQ)        │  │        (BullMQ)                   │
    │  Priority: HIGH  │  │  ┌─────────┐  ┌───────────────┐  │
    │  No rate limit   │  │  │ Delayed  │  │ Rate Limited  │  │
    │  3 retries       │  │  │ Jobs     │  │ 50/min        │  │
    └────────┬────────┘  │  └─────────┘  └───────────────┘  │
             │           └──────────────────┬───────────────┘
    ┌────────▼────────┐           ┌─────────▼────────┐
    │  Instant Worker  │           │   Bulk Worker     │
    │  (Container)     │           │   (Container)     │
    └────────┬────────┘           └─────────┬────────┘
             │                              │
    ┌────────▼──────────────────────────────▼────────┐
    │              Email Pipeline                     │
    │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐│
    │  │Eligible│→│Template│→│Track   │→│  Send    ││
    │  │Check   │ │Render  │ │Inject  │ │(Primary) ││
    │  └────────┘ └────────┘ └────────┘ └────┬─────┘│
    │                                        │      │
    │                              ┌─────────▼────┐ │
    │                              │  Fallback    │ │
    │                              │  SMTP        │ │
    │                              └──────────────┘ │
    └───────────────────────────────────┬───────────┘
                                        │
    ┌───────────────────────────────────▼───────────┐
    │           Monitoring & Observability           │
    │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
    │  │ Health   │ │ Metrics  │ │ Alert Rules   │  │
    │  │ Endpoint │ │ Collector│ │ (queue depth, │  │
    │  │ /health  │ │ (rates,  │ │  error rate,  │  │
    │  │          │ │  latency)│ │  bounce rate) │  │
    │  └──────────┘ └──────────┘ └───────────────┘  │
    └───────────────────────────────────────────────┘
```

### 3.2 Temel Prensipler

1. **Instant vs Bulk ayirimi** — Auth emailleri hicbir zaman bulk isle birlikte bloklamamali
2. **Sandbox mode** — Tek bir env var ile tum emailleri test adresine yonlendirme
3. **SMTP failover** — Primary SMTP coktugunde secondary'ye otomatik gecis
4. **Queue monitoring** — Derinlik, hiz, hata orani anlik izlenebilmeli
5. **Webhook-driven bounce** — Provider'dan anlik bounce/complaint bildirimi
6. **Dry-run her zaman** — Her email tipi icin "bu kullaniciya ne gonderirdim?" testi
7. **Graceful degradation** — SMTP down ise queue'da biriktir, SMTP dondugunde otomatik gonder
8. **Audit trail** — Her emailin tum yasam dongusu kayit altinda

---

## 4. Yol Haritasi: Tasklar ve Alt Tasklar

### FAZA 1: Guvenilirlik & Failover (Oncelik: KRITIK)

---

#### TASK 1.1: SMTP Failover Sistemi — [PLA-670](https://linear.app/plan-b-side-projects/issue/PLA-670/phase-1-smtp-failover-system)

**Problem:** Tek SMTP provider kullaniliyor. Provider coktugunde tum email gonderimleri duruyor.

**Cozum:** Primary/secondary SMTP konfigurasyonu ve otomatik failover.

**Alt Tasklar:**

**1.1.1 — Multi-provider SMTP konfigurasyonu**
- `apps/scraper/src/email/mailer.ts` dosyasinda `createTransporter()` fonksiyonunu guncelle
- Yeni env var'lar: `SMTP_SECONDARY_HOST`, `SMTP_SECONDARY_PORT`, `SMTP_SECONDARY_USER`, `SMTP_SECONDARY_PASS`
- `SmtpProvider` interface tanimla: `{ host, port, user, pass, from, priority }`
- Provider listesini priority sirasina gore tut
- `.env.example` dosyasini guncelle

**1.1.2 — Failover logic**
- `sendMail()` fonksiyonunda primary basarisiz olursa secondary'yi dene
- Circuit breaker pattern: 5 ardisik hatadan sonra provider'i 5dk devre disi birak
- Basarili gonderimden sonra circuit'i reset et
- `SmtpCircuitBreaker` class'i olustur: `{ provider, failCount, lastFailAt, state: 'closed'|'open'|'half-open' }`

**1.1.3 — Provider health check**
- Her provider icin periyodik SMTP EHLO testi (5dk'da bir)
- `checkSmtpHealth(provider): Promise<{ connected: boolean, latencyMs: number }>`
- Health sonuclarini `email_provider_health` tablosuna logla
- Unhealthy provider'i otomatik devre disi birak

**1.1.4 — Failover testleri**
- Primary fail senaryosu: secondary'ye gecis testi
- Her iki provider fail senaryosu: queue'da bekleme testi
- Circuit breaker acilma/kapanma testleri
- Health check mock testleri

**Dosyalar:**
- `apps/scraper/src/email/mailer.ts` (guncelle)
- `apps/scraper/src/email/smtp-circuit-breaker.ts` (yeni)
- `apps/scraper/src/email/smtp-health-check.ts` (yeni)
- `apps/scraper/src/email/__tests__/smtp-failover.test.ts` (yeni)

---

#### TASK 1.2: Queue Resilience & Recovery — [PLA-671](https://linear.app/plan-b-side-projects/issue/PLA-671/phase-1-queue-resilience-and-recovery)

**Problem:** SMTP down oldugunda queue'daki emailler retry limitine ulasip DLQ'ya dusuyor. SMTP donunce bu emailler otomatik gonderilemiyor.

**Cozum:** Akilli retry stratejisi + DLQ'dan bulk recovery.

**Alt Tasklar:**

**1.2.1 — Akilli retry stratejisi**
- SMTP connection error vs. recipient error ayirimi yap
- SMTP connection error: retry sayisini artir (instant: 5, bulk: 3), backoff suresini uzat
- Recipient error (invalid email, mailbox full): hemen DLQ'ya gonder
- `classifyEmailError(error): 'transient' | 'permanent' | 'provider_down'` fonksiyonu

**1.2.2 — Provider-down modu**
- Tum SMTP provider'lar down oldugunda queue'yu "pause" moduna al
- Pause modunda yeni joblar queue'ya eklenir ama process edilmez
- Provider donunce queue'yu otomatik resume et
- Admin dashboard'da "Provider Down — Queue Paused" banner'i goster

**1.2.3 — DLQ bulk recovery**
- Admin endpoint: `POST /api/system-admin/dlq/bulk-replay` — tum veya filtrelenmis DLQ job'larini tekrar kuyruklama
- Filtreler: email tipi, tarih araligi, hata turu
- Rate-limited replay: saniyede max 10 job
- Admin dashboard'da "Replay All" butonu

**1.2.4 — DLQ analitics**
- DLQ'daki emaillerin hata dagilimi (pie chart)
- En cok hata veren email tipleri
- Zaman bazli DLQ trend grafigi
- Admin dashboard'da DLQ analytics sayfasi

**Dosyalar:**
- `apps/scraper/src/email/error-classifier.ts` (yeni)
- `apps/scraper/src/email-instant-worker.ts` (guncelle)
- `apps/scraper/src/email-bulk-worker.ts` (guncelle)
- `apps/api/src/routes/dlq.ts` (guncelle: bulk replay endpoint)
- `apps/dashboard/src/app/(dashboard)/system-admin/dlq/page.tsx` (guncelle)

---

#### TASK 1.3: Bounce/Complaint Webhook Entegrasyonu — [PLA-672](https://linear.app/plan-b-side-projects/issue/PLA-672/phase-1-bouncecomplaint-webhook-integration)

**Problem:** Bounce ve complaint bildirimleri anlik gelmiyor. SMTP hata mesajindan parse ediliyor, bu guvenilir degil.

**Cozum:** Email provider webhook endpoint'leri + anlik suppression list guncellemesi.

**Alt Tasklar:**

**1.3.1 — Webhook receiver endpoint**
- `POST /api/webhooks/email/bounce` — provider'dan bounce bildirimi
- `POST /api/webhooks/email/complaint` — provider'dan complaint bildirimi
- `POST /api/webhooks/email/delivery` — basarili teslimat onay
- Her endpoint icin provider-specific payload parser (SES SNS, SendGrid Event Webhook, generic SMTP DSN)
- Webhook signature dogrulama (provider'a ozel)

**1.3.2 — Bounce processor**
- Webhook'tan gelen bounce'u `recordBounce()` ile isle
- Hard bounce: hemen suppression list'e ekle
- Soft bounce: 3 ardisik soft bounce'tan sonra suppress et
- Complaint: hemen suppress + kullanici bilgilendir

**1.3.3 — Suppression list yonetimi**
- Admin endpoint: `GET /api/system-admin/suppression-list` — suppress edilmis emailleri listele
- Admin endpoint: `DELETE /api/system-admin/suppression-list/:email` — suppress'i kaldir
- Admin dashboard'da suppression list yonetim sayfasi
- Bulk import/export (CSV)

**1.3.4 — Bounce rate monitoring**
- Bounce rate threshold: %5 uzerinde uyari, %10 uzerinde bulk email durdur
- `email_health_metrics` tablosu: gunluk sent, bounced, complained sayilari
- Admin dashboard'da bounce rate trend grafigi
- Threshold asildiginda admin'e alert (email + in-app notification)

**Dosyalar:**
- `apps/api/src/routes/email-webhooks.ts` (yeni)
- `apps/scraper/src/email/bounce-processor.ts` (yeni)
- `apps/api/src/routes/admin-emails.ts` (guncelle: suppression list)
- `packages/db/src/schema/email.ts` (guncelle: `email_health_metrics` tablosu)
- `apps/dashboard/src/app/(dashboard)/system-admin/suppression/page.tsx` (yeni)

---

### FAZA 2: Monitoring & Observability (Oncelik: YUKSEK)

---

#### TASK 2.1: Email Worker Health Metrikleri — [PLA-673](https://linear.app/plan-b-side-projects/issue/PLA-673/phase-2-email-worker-health-metrics)

**Problem:** Email worker'larin processing rate, error rate, latency gibi metrikleri gorulmuyor.

**Cozum:** Worker-level metrik toplama ve expose etme.

**Alt Tasklar:**

**2.1.1 — Worker metrics collector**
- Her worker icin in-memory metrik toplama:
  - `processed_total` — toplam islenen email
  - `failed_total` — toplam basarisiz
  - `processing_duration_ms` — her email icin sure (histogram)
  - `queue_wait_time_ms` — queue'da bekleme suresi
  - `active_jobs` — su an islenen job sayisi
- 1dk'lik pencereler halinde rolling averages
- `WorkerMetrics` class'i: `increment()`, `recordDuration()`, `getSnapshot()`

**2.1.2 — Worker health endpoint**
- Her worker icin `/health` HTTP endpoint'i (Fastify mini server, zaten var)
- Response:
  ```json
  {
    "status": "healthy|degraded|unhealthy",
    "uptime": 123456,
    "metrics": {
      "processedLastMinute": 12,
      "failedLastMinute": 0,
      "avgProcessingMs": 234,
      "avgQueueWaitMs": 45,
      "activeJobs": 2
    },
    "smtp": {
      "provider": "primary",
      "connected": true,
      "lastSuccessAt": "2026-04-03T10:00:00Z"
    },
    "queue": {
      "waiting": 5,
      "active": 2,
      "delayed": 0,
      "failed": 1
    }
  }
  ```

**2.1.3 — System-admin health aggregation**
- `GET /api/system-admin/email-health` — tum email worker'larin metriklerini topla
- Worker'larin health endpoint'lerini cagir ve birlestir
- Overall email system status: `healthy | degraded | down`
- Degraded: herhangi bir worker unhealthy veya queue depth > threshold
- Down: tum worker'lar unhealthy

**2.1.4 — Admin dashboard email health sayfasi**
- Real-time email system health dashboard
- Worker status kartlari (her worker icin)
- Processing rate grafigi (son 1 saat, 5dk araliklar)
- Queue depth grafigi
- Error rate grafigi
- Son 10 hata listesi

**Dosyalar:**
- `apps/scraper/src/email/worker-metrics.ts` (yeni)
- `apps/scraper/src/email-instant-worker.ts` (guncelle)
- `apps/scraper/src/email-bulk-worker.ts` (guncelle)
- `apps/api/src/routes/system-admin.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/email-health/page.tsx` (yeni)

---

#### TASK 2.2: Queue Depth Alert Sistemi — [PLA-674](https://linear.app/plan-b-side-projects/issue/PLA-674/phase-2-queue-depth-alert-system)

**Problem:** Queue birikirse (SMTP down, worker crash, vb.) admin haberdar olmuyor.

**Cozum:** Threshold-based alert sistemi.

**Alt Tasklar:**

**2.2.1 — Alert rule tanmlari**
- Konfigurasyonlar `email_alert_rules` tablosunda:
  ```
  rule_name | metric | operator | threshold | cooldown_minutes | channels
  instant_queue_depth | instant.waiting | > | 50 | 30 | email,notification
  bulk_queue_depth | bulk.waiting | > | 200 | 60 | email,notification
  instant_error_rate | instant.error_rate_1h | > | 0.1 | 60 | email,notification
  bounce_rate | bounce_rate_24h | > | 0.05 | 360 | email,notification
  dlq_depth | dlq.unresolved | > | 10 | 120 | email,notification
  ```
- Default rule'lar migration ile seed et

**2.2.2 — Alert evaluator cron**
- Her 1 dk'da bir cron job: tum alert rule'larini evaluate et
- Metrik kaynaklari: BullMQ queue stats, email_logs aggregation, DLQ count
- Cooldown: ayni alert `cooldown_minutes` icinde tekrar tetiklenmez
- Alert history: `email_alerts_log` tablosuna kayit

**2.2.3 — Alert delivery**
- Kanallar: Admin email, in-app notification, webhook (Slack/Discord)
- Admin email: `sendAlertEmail()` — instant queue uzerinden (kendi kendini bloklamamali!)
- In-app notification: `notifications` queue'su uzerinden
- Webhook: `ALERT_WEBHOOK_URL` env var (mevcut altyapi)

**2.2.4 — Admin alert yonetimi**
- Alert rule listesi ve duzenleme
- Alert history (son 30 gun)
- Alert disable/enable toggle
- Alert test butonu ("Bu alert'i simdi tetikle")

**Dosyalar:**
- `packages/db/src/schema/email.ts` (guncelle: `email_alert_rules`, `email_alerts_log`)
- `apps/scraper/src/email/alert-evaluator.ts` (yeni)
- `apps/api/src/routes/admin-emails.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/email-alerts/page.tsx` (yeni)

---

#### TASK 2.3: Email Analytics Dashboard v2 — [PLA-675](https://linear.app/plan-b-side-projects/issue/PLA-675/phase-2-email-analytics-dashboard-v2)

**Problem:** Sadece basit open/click istatistikleri var. Trend analizi, template karsilastirma, user engagement yok.

**Cozum:** Detayli analytics dashboard.

**Alt Tasklar:**

**2.3.1 — Time-series email metrikleri**
- Gunluk aggregation: `email_daily_stats` tablosu
  - Kolonlar: date, email_type, sent, delivered, opened, clicked, bounced, complained, unsubscribed
- Cron job: her gun 00:05'te onceki gunun verilerini aggregate et
- 90 gunluk retention

**2.3.2 — Analytics API endpoint'leri**
- `GET /api/system-admin/email-analytics/overview` — son 30 gun ozet
- `GET /api/system-admin/email-analytics/trends?metric=open_rate&period=30d` — trend data
- `GET /api/system-admin/email-analytics/by-type` — email tipine gore karsilastirma
- `GET /api/system-admin/email-analytics/by-template` — template performans
- `GET /api/system-admin/email-analytics/engagement` — kullanici engagement (acma/tiklama dagilimi)

**2.3.3 — Analytics dashboard UI**
- Overview kartlari: Total Sent, Delivery Rate, Open Rate, Click Rate, Unsubscribe Rate
- Trend grafikleri: Son 30 gun (line chart)
- Email type karsilastirma tablosu
- En iyi/en kotu performans gosteren template'ler
- Engagement heat map (gun/saat bazinda)

**2.3.4 — Export & raporlama**
- CSV export butonu (filtrelenmis email log'lari)
- PDF rapor olusturma (haftalik email performans ozeti)
- Scheduled report: her Pazartesi admin'e haftalik email performans raporu

**Dosyalar:**
- `packages/db/src/schema/email.ts` (guncelle: `email_daily_stats`)
- `apps/scraper/src/email/stats-aggregator.ts` (yeni)
- `apps/api/src/routes/email-analytics.ts` (yeni)
- `apps/dashboard/src/app/(dashboard)/system-admin/email-analytics/page.tsx` (yeni)

---

### FAZA 3: Sandbox & Test Altyapisi (Oncelik: YUKSEK)

---

#### TASK 3.1: Global Sandbox Mode — [PLA-676](https://linear.app/plan-b-side-projects/issue/PLA-676/phase-3-global-sandbox-mode)

**Problem:** Production'da email testi yapmak riskli. Yanlislikla gercek kullaniciya email gidebilir.

**Cozum:** Tek env var ile tum emailleri sandbox'a yonlendirme.

**Alt Tasklar:**

**3.1.1 — Sandbox interceptor**
- Yeni env var: `EMAIL_SANDBOX_MODE=true|false`
- Yeni env var: `EMAIL_SANDBOX_RECIPIENTS=admin@appranks.io,test@appranks.io`
- Pipeline'in basina sandbox interceptor ekle
- Sandbox aktifken:
  - Tum emaillerin `to` adresi `SANDBOX_RECIPIENTS` ile degistirilir
  - Orijinal alici `subject` basina eklenir: `[SANDBOX: original@user.com] Original Subject`
  - Email body'sine kirmizi banner eklenir: "This email was redirected by sandbox mode"
  - `email_logs`'a `sandboxed: true` flagi eklenir

**3.1.2 — Sandbox konfigurasyonu**
- Admin dashboard'dan sandbox toggle (env var override)
- Sandbox whitelist: belirli emailleri sandbox'tan muaf tut
- Email type bazli sandbox: sadece bulk emailleri sandbox'a yonlendir, instant'lari gec

**3.1.3 — Sandbox testleri**
- Sandbox aktifken email yonlendirme testi
- Whitelist muafiyet testi
- Sandbox banner injection testi
- Sandbox log kaydi testi

**Dosyalar:**
- `apps/scraper/src/email/sandbox.ts` (yeni)
- `apps/scraper/src/email/pipeline.ts` (guncelle)
- `apps/api/src/routes/admin-emails.ts` (guncelle)
- `apps/scraper/src/email/__tests__/sandbox.test.ts` (yeni)

---

#### TASK 3.2: Gelismis Dry-Run & Email Simulation — [PLA-677](https://linear.app/plan-b-side-projects/issue/PLA-677/phase-3-advanced-dry-run-and-email-simulation)

**Problem:** Mevcut dry-run sadece digest/weekly icin calisiyor. Tum email tipleri icin "bu kullaniciya ne gonderirdim?" testi yapilmiyor.

**Cozum:** Tum email tipleri icin simulation engine.

**Alt Tasklar:**

**3.2.1 — Universal email simulator**
- `simulateEmail(userId, emailType, options?)` fonksiyonu
- Tum email tiplerini destekle (instant + bulk)
- Cikti:
  ```json
  {
    "wouldSend": true,
    "eligibility": { "passed": true, "checks": [...] },
    "recipient": { "email": "user@example.com", "name": "John" },
    "subject": "Your daily digest",
    "htmlPreview": "<html>...",
    "textPreview": "...",
    "headers": { "List-Unsubscribe": "...", "X-Mailer": "..." },
    "estimatedSize": "12.4 KB",
    "trackingPixels": 1,
    "trackedLinks": 5,
    "blockedReasons": []
  }
  ```
- Eger email gonderilmeyecekse `wouldSend: false` + `blockedReasons` ile neden gonderilmedigini acikla

**3.2.2 — Bulk simulation**
- `simulateBulkEmail(emailType, filters?)` — "Bu tipi gondersem kac kisiye gider?"
- Filtreler: account, platform, son giris tarihi, subscription tier
- Cikti: toplam eligible count, sample subject list, sample HTML (ilk 3 kullanici icin)
- Ineligible breakdown: kac kisi opt-out, kac kisi frekans limitinde, kac kisi suppressed

**3.2.3 — Simulation API endpoint'leri**
- `POST /api/system-admin/emails/simulate` — tek kullanici simulasyonu
- `POST /api/system-admin/emails/simulate-bulk` — bulk simulasyon
- Response'a `dryRun: true` flagi ekle

**3.2.4 — Simulation dashboard UI**
- "Simulate Email" modal: kullanici sec, email tipi sec, preview gor
- Eligibility check sonuclarini goster (neden gonderilir/gonderilmez)
- Side-by-side preview: HTML + text
- "Send for real" butonu (simulasyondan gercek gonderime gecis)

**Dosyalar:**
- `apps/scraper/src/email/simulator.ts` (yeni)
- `apps/api/src/routes/admin-emails.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/page.tsx` (guncelle)

---

#### TASK 3.3: Email Template Test Suite — [PLA-678](https://linear.app/plan-b-side-projects/issue/PLA-678/phase-3-email-template-test-suite)

**Problem:** Template degisiklikleri production'da beklenmedik gorunum sorunlarina yol acabiliyor.

**Cozum:** Otomatik template rendering testleri + visual regression.

**Alt Tasklar:**

**3.3.1 — Template rendering testleri**
- Her email tipi icin: sample data ile render et, HTML ciktisini dogrula
- Kontroller:
  - Tum `{{variable}}` placeholder'lari degistirilmis mi?
  - Required linkler (unsubscribe, CTA) mevcut mu?
  - HTML valid mi? (cheerio ile parse)
  - Mobile responsive meta tag var mi?
  - Bozuk img src yok mu?
- CI pipeline'da her PR'da calisir

**3.3.2 — Template snapshot testleri**
- Her email tipi icin HTML snapshot
- Snapshot degisikliklerinde reviewer'a gorsel diff goster
- `npm run test:email-snapshots` komutu

**Dosyalar:**
- `apps/scraper/src/email/__tests__/template-rendering.test.ts` (yeni)
- `apps/scraper/src/email/__tests__/__snapshots__/` (yeni)

---

### FAZA 4: Gelismis Ozellikler (Oncelik: ORTA)

---

#### TASK 4.1: Email Scheduling (Delayed Send) — [PLA-679](https://linear.app/plan-b-side-projects/issue/PLA-679/phase-4-email-scheduling-delayed-send)

**Problem:** Emailler anlik veya cron ile gonderiliyor. Belirli bir zamanda gondermek mumkun degil.

**Cozum:** BullMQ delayed jobs kullanarak zamanlama.

**Alt Tasklar:**

**4.1.1 — Scheduled email enqueue**
- `enqueueScheduledEmail(data, sendAt: Date)` fonksiyonu
- BullMQ `delay` parametresi ile delayed job olustur
- `sendAt` UTC olarak sakla, kullanici timezone'unu dikkate al
- Admin endpoint: `POST /api/system-admin/emails/schedule`

**4.1.2 — Scheduled email yonetimi**
- `GET /api/system-admin/emails/scheduled` — planlanmis emailleri listele
- `DELETE /api/system-admin/emails/scheduled/:jobId` — planlanan emaili iptal et
- `PATCH /api/system-admin/emails/scheduled/:jobId` — zamani guncelle
- Admin dashboard'da "Scheduled" tab'i

**4.1.3 — Optimal send time**
- Kullanicinin email acma saatlerini analiz et
- `getOptimalSendTime(userId): { hour: number, timezone: string }`
- Opsiyonel: "En iyi zamanda gonder" secenegi

**Dosyalar:**
- `apps/scraper/src/email/scheduler.ts` (yeni)
- `apps/api/src/routes/admin-emails.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/emails/page.tsx` (guncelle)

---

#### TASK 4.2: A/B Test Altyapisi — [PLA-680](https://linear.app/plan-b-side-projects/issue/PLA-680/phase-4-ab-test-infrastructure-for-emails)

**Problem:** Farkli subject line veya template varyasyonlarinin performansini karsilastirmak mumkun degil.

**Cozum:** Basit A/B test framework'u.

**Alt Tasklar:**

**4.2.1 — A/B test modeli**
- `email_ab_tests` tablosu: test_name, email_type, variants (JSON), split_percentage, status, winner
- Variant yapisi: `{ id: 'A', subject?: string, templateOverride?: string }`
- Split: %50/%50 default, konfigurasyonda degistirilebilir

**4.2.2 — Variant selection**
- `selectVariant(userId, testId): Variant` — deterministic (userId hash mod)
- email_logs'a `abTestId` ve `variantId` ekle
- Pipeline'da variant subject/template override uygula

**4.2.3 — A/B test analizi**
- Her variant icin: sent, opened, clicked, open_rate, click_rate
- Statistical significance hesaplama (chi-squared test)
- Otomatik winner secimi: yeterli sample size + significant difference
- Admin dashboard: A/B test listesi, aktif testler, sonuclar

**Dosyalar:**
- `packages/db/src/schema/email.ts` (guncelle)
- `apps/scraper/src/email/ab-test.ts` (yeni)
- `apps/api/src/routes/email-ab-tests.ts` (yeni)
- `apps/dashboard/src/app/(dashboard)/system-admin/email-ab-tests/page.tsx` (yeni)

---

#### TASK 4.3: Email Preference Center — [PLA-681](https://linear.app/plan-b-side-projects/issue/PLA-681/phase-4-email-preference-center)

**Problem:** Kullanicilar sadece unsubscribe edebiliyor. Hangi emailleri alacaklarini secemiyorlar.

**Cozum:** Self-service email preference sayfasi.

**Alt Tasklar:**

**4.3.1 — Preference center sayfasi**
- Dashboard'da `/settings/email-preferences` sayfasi
- Kategoriler halinde email tipi listesi:
  - Transactional (devre disi birakilamaz): password reset, 2FA, login alert
  - Alerts: ranking, competitor, review (ayri ayri toggle)
  - Digests: daily digest, weekly summary (ayri ayri toggle)
  - Lifecycle: welcome, re-engagement, win celebration (ayri ayri toggle)
- Frekans tercihi: "Her degisiklikte" vs "Gunluk ozet" vs "Haftalik ozet"

**4.3.2 — Preference API**
- `GET /api/user/email-preferences` — kullanicinin mevcut tercihleri
- `PATCH /api/user/email-preferences` — tercihleri guncelle
- Unsubscribe link'inden preference center'a yonlendir (unsubscribe yerine "Manage Preferences")

**4.3.3 — Preference enforcement**
- Eligibility check'e preference center entegrasyonu (zaten kismi var)
- Frekans tercihi enforcement: "gunluk ozet" secen kullaniciya alert basina email gitmesin, gun sonunda ozet gitsin

**Dosyalar:**
- `apps/dashboard/src/app/(dashboard)/settings/email-preferences/page.tsx` (yeni)
- `apps/api/src/routes/user-settings.ts` (guncelle)
- `apps/scraper/src/email/eligibility.ts` (guncelle)

---

#### TASK 4.4: Email Error Tracking & Diagnostics — [PLA-682](https://linear.app/plan-b-side-projects/issue/PLA-682/phase-4-email-error-tracking-and-diagnostics)

**Problem:** Email hatalari Sentry'de generic loglanıyor. Spesifik email hatalarini debug etmek zor.

**Cozum:** Detayli email error tracking.

**Alt Tasklar:**

**4.4.1 — Structured error logging**
- Her email hatasi icin structured log:
  ```json
  {
    "event": "email_send_failed",
    "emailType": "email_daily_digest",
    "recipient": "user@example.com",
    "userId": "uuid",
    "error": "SMTP connection timeout",
    "errorCode": "ECONNREFUSED",
    "smtpResponse": "421 4.7.0 Try again later",
    "attempt": 2,
    "maxAttempts": 3,
    "queueName": "email-bulk",
    "jobId": "123",
    "duration": 30000
  }
  ```
- Sentry'ye structured context ekle (tags + extra)

**4.4.2 — Error categorization**
- Error tipleri: `smtp_connection`, `smtp_auth`, `smtp_rejected`, `template_render`, `eligibility_blocked`, `rate_limited`, `suppressed`
- Her kategori icin ayri counter
- Admin dashboard'da error breakdown (pie chart)

**4.4.3 — Error alerting**
- Spesifik error tipi threshold'lari:
  - `smtp_connection` > 5/dk: SMTP provider problemi
  - `smtp_rejected` > 10/saat: muhtemelen blacklist
  - `template_render` > 0: template bug'i, anlik alert
- Alert'ler email_alert_rules sistemine entegre

**4.4.4 — Error debug sayfasi**
- Admin'de `/system-admin/email-errors` sayfasi
- Son 24 saat error listesi
- Error tipi bazinda filtreleme
- Her hatanin detay sayfasi (full context, stack trace, SMTP response)
- "Bu emaili tekrar gonder" butonu

**Dosyalar:**
- `apps/scraper/src/email/error-tracker.ts` (yeni)
- `apps/scraper/src/email/pipeline.ts` (guncelle)
- `apps/api/src/routes/admin-emails.ts` (guncelle)
- `apps/dashboard/src/app/(dashboard)/system-admin/email-errors/page.tsx` (yeni)

---

### FAZA 5: Operasyonel Iyilestirmeler (Oncelik: DUSUK)

---

#### TASK 5.1: Email Log Search & Export — [PLA-683](https://linear.app/plan-b-side-projects/issue/PLA-683/phase-5-email-log-search-and-export)

**Alt Tasklar:**

**5.1.1 — Full-text search** ✅
- `GET /api/system-admin/emails?search=keyword` — subject ILIKE araması eklendi
- admin-emails.ts'e `search` query param eklendi

**5.1.2 — Advanced filtreleme** (kısmi)
- Mevcut filtreler: type, status, recipient, from, to, search
- Henuz eklenmedi: campaign, sandbox, A/B test variant, multi-select

**5.1.3 — Export** ✅
- `GET /api/system-admin/emails/export?format=csv` — CSV export eklendi
- `GET /api/system-admin/emails/export?format=json` — JSON export eklendi
- Ayni filtreler destekleniyor (type, status, recipient, date range, search)
- Max 10000 satir, Content-Disposition header ile download
- CSV'de proper escaping (virgul, tirnak, newline)

---

#### TASK 5.2: Cron Monitor & Digest Scheduler — [PLA-684](https://linear.app/plan-b-side-projects/issue/PLA-684/phase-5-cron-monitor-and-digest-scheduler)

**Alt Tasklar:**

**5.2.1 — Cron execution logging**
- Her cron calismasini `cron_executions` tablosuna logla
- Kolonlar: cron_name, started_at, completed_at, status, emails_enqueued, error

**5.2.2 — Cron health monitoring**
- "Son basarili calisma" kontrolu: X saat icerisinde calismadiydsa alert
- Admin dashboard'da cron durumu sayfasi
- Her cron icin: son calisma, sonraki planlanan, ortalama sure, basari orani

**5.2.3 — Manual cron trigger**
- Admin'den "Digest cron'unu simdi calistir" butonu
- `POST /api/system-admin/crons/:name/trigger`
- Dry-run secenegi: cron'u calistir ama email gonderme

---

#### TASK 5.3: Rate Limit Synchronization — [PLA-685](https://linear.app/plan-b-side-projects/issue/PLA-685/phase-5-rate-limit-synchronization)

**Alt Tasklar:**

**5.3.1 — Provider rate limit tracking**
- SMTP provider'in rate limit header'larini oku (eger varsa)
- `X-RateLimit-Remaining`, `X-RateLimit-Reset` header'lari
- Provider rate limit'ine yaklasinca BullMQ rate'i otomatik dusur

**5.3.2 — Adaptive rate limiting**
- 429/throttle response alinca BullMQ rate'i %50 dusur
- 5dk boyunca throttle olmayinca rate'i kademeli artir
- Min/max rate konfigurasyonu: `EMAIL_BULK_MIN_RATE=10`, `EMAIL_BULK_MAX_RATE=100`

---

## 5. Onceliklendirme Ozeti

| Faz | Task | Linear | Oncelik | Tahmini Karmasiklik | Bagimlilik |
|-----|------|--------|---------|---------------------|------------|
| 1 | 1.1 SMTP Failover | [PLA-670](https://linear.app/plan-b-side-projects/issue/PLA-670) | KRITIK | Orta | - |
| 1 | 1.2 Queue Resilience | [PLA-671](https://linear.app/plan-b-side-projects/issue/PLA-671) | KRITIK | Orta | - |
| 1 | 1.3 Bounce Webhooks | [PLA-672](https://linear.app/plan-b-side-projects/issue/PLA-672) | YUKSEK | Yuksek | - |
| 2 | 2.1 Worker Health Metrikleri | [PLA-673](https://linear.app/plan-b-side-projects/issue/PLA-673) | YUKSEK | Orta | - |
| 2 | 2.2 Queue Depth Alerts | [PLA-674](https://linear.app/plan-b-side-projects/issue/PLA-674) | YUKSEK | Orta | 2.1 |
| 2 | 2.3 Analytics Dashboard v2 | [PLA-675](https://linear.app/plan-b-side-projects/issue/PLA-675) | ORTA | Yuksek | - |
| 3 | 3.1 Global Sandbox Mode | [PLA-676](https://linear.app/plan-b-side-projects/issue/PLA-676) | YUKSEK | Dusuk | - |
| 3 | 3.2 Email Simulation | [PLA-677](https://linear.app/plan-b-side-projects/issue/PLA-677) | YUKSEK | Orta | - |
| 3 | 3.3 Template Test Suite | [PLA-678](https://linear.app/plan-b-side-projects/issue/PLA-678) | ORTA | Dusuk | - |
| 4 | 4.1 Email Scheduling | [PLA-679](https://linear.app/plan-b-side-projects/issue/PLA-679) | ORTA | Dusuk | - |
| 4 | 4.2 A/B Test | [PLA-680](https://linear.app/plan-b-side-projects/issue/PLA-680) | DUSUK | Yuksek | 2.3 |
| 4 | 4.3 Preference Center | [PLA-681](https://linear.app/plan-b-side-projects/issue/PLA-681) | ORTA | Orta | - |
| 4 | 4.4 Error Tracking | [PLA-682](https://linear.app/plan-b-side-projects/issue/PLA-682) | ORTA | Orta | 2.1 |
| 5 | 5.1 Log Search & Export | [PLA-683](https://linear.app/plan-b-side-projects/issue/PLA-683) | DUSUK | Dusuk | - |
| 5 | 5.2 Cron Monitor | [PLA-684](https://linear.app/plan-b-side-projects/issue/PLA-684) | ORTA | Dusuk | - |
| 5 | 5.3 Rate Limit Sync | [PLA-685](https://linear.app/plan-b-side-projects/issue/PLA-685) | DUSUK | Orta | 1.1 |

### Onerilen Uygulama Sirasi

**Sprint 1 (Guvenilirlik):** 1.1 + 1.2 + 3.1
**Sprint 2 (Monitoring):** 2.1 + 2.2 + 4.4
**Sprint 3 (Test):** 3.2 + 3.3 + 1.3
**Sprint 4 (Analytics):** 2.3 + 5.2
**Sprint 5 (Ozellikler):** 4.1 + 4.3
**Sprint 6 (Gelismis):** 4.2 + 5.1 + 5.3

---

## 6. Veritabani Degisiklikleri Ozeti

Yeni tablolar/kolonlar gerekecek:

| Tablo | Tur | Faz |
|-------|-----|-----|
| `email_provider_health` | Yeni | 1.1 |
| `email_health_metrics` | Yeni | 1.3 |
| `email_alert_rules` | Yeni | 2.2 |
| `email_alerts_log` | Yeni | 2.2 |
| `email_daily_stats` | Yeni | 2.3 |
| `email_ab_tests` | Yeni | 4.2 |
| `cron_executions` | Yeni | 5.2 |
| `email_logs.sandboxed` | Kolon ekleme | 3.1 |
| `email_logs.abTestId` | Kolon ekleme | 4.2 |
| `email_logs.variantId` | Kolon ekleme | 4.2 |
| `email_logs.errorCategory` | Kolon ekleme | 4.4 |

---

## 7. Ortam Degiskenleri (Yeni)

```env
# SMTP Failover (Task 1.1)
SMTP_SECONDARY_HOST=
SMTP_SECONDARY_PORT=587
SMTP_SECONDARY_USER=
SMTP_SECONDARY_PASS=
SMTP_SECONDARY_FROM=

# Sandbox Mode (Task 3.1)
EMAIL_SANDBOX_MODE=false
EMAIL_SANDBOX_RECIPIENTS=admin@appranks.io

# Rate Limiting (Task 5.3)
EMAIL_BULK_MIN_RATE=10
EMAIL_BULK_MAX_RATE=100

# Alert Webhook (Task 2.2)
EMAIL_ALERT_WEBHOOK_URL=
```

---

## Admin Email Broadcast & Kampanya Yönetimi — Yeni Özellik Planı (2026-04-05)

> **Label:** `admin-email-broadcast`

### Mevcut Durum

Email sistemi transactional (şifre sıfırlama, davet vb.) ve bulk (digest, alert) emailler için tam altyapıya sahip. Ancak:
- Admin'den hedefli email kampanyası gönderilemiyor
- Platform/plan bazlı kullanıcı segmentasyonu yok
- Kampanya zamanlama ve timezone-aware delivery yok
- Kampanya performans takibi (open/click rate per campaign) yok

### Planlanan Özellikler

#### Phase 1: Hedefli Email Kampanyaları → [PLA-707](https://linear.app/plan-b-side-projects/issue/PLA-707)

```
Audience Types (Notification ile paralel):
┌────────────────────────────────────────────────────┐
│ all                → tüm aktif kullanıcılar         │
│ active_last_Nd     → son N gün aktif                │
│ platform:<id>      → platformu takip edenler        │
│ plan:<name>        → free/pro/business kullanıcılar │
│ user:<uuid>        → tek kullanıcı                  │
│ users:[id1,id2]    → belirli kullanıcı listesi      │
│ account:<uuid>     → hesaptaki tüm kullanıcılar     │
└────────────────────────────────────────────────────┘
```

**Otomatik filtreleme:**
- Suppression list (bounce/complaint) otomatik hariç tutma
- Eligibility check (user preferences, opt-out) uygulanması
- Audience preview: kaç kullanıcıya gidecek + hariç tutulanlar

**DB tablosu:** `email_campaigns_v2`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | PK |
| name | varchar | Kampanya adı |
| subject | varchar | Email subject line |
| html_body | text | Email HTML içeriği |
| audience | varchar | Hedef kitle tipi |
| audience_filter | jsonb | Ek filtreler |
| status | varchar | draft/scheduled/sending/sent/cancelled |
| scheduled_at | timestamp | Planlanan gönderim zamanı |
| use_local_time | boolean | Alıcının yerel saatini kullan |
| sent_at | timestamp | Gönderim başlangıcı |
| recipient_count | int | Toplam alıcı |
| delivered_count | int | Başarıyla teslim |
| open_count | int | Açılma |
| click_count | int | Tıklanma |
| bounce_count | int | Bounce |
| created_by | uuid | Oluşturan admin |

#### Phase 2: Timezone-Aware Kampanya Zamanlama → [PLA-708](https://linear.app/plan-b-side-projects/issue/PLA-708)

```
Email Kampanya Zamanlama:
┌──────────────────────────────────────────────────────┐
│ ○ Send now                                            │
│ ○ Schedule for: [2026-04-10] [09:00] [UTC+3]        │
│   ☑ Use recipient's local time                        │
│     → Timezone grupları oluştur                       │
│     → Her grup için BullMQ delay hesapla              │
│     → TR (UTC+3): delay = X ms                       │
│     → US-East (UTC-5): delay = Y ms                  │
│     → US-West (UTC-8): delay = Z ms                  │
└──────────────────────────────────────────────────────┘
```

**Kampanya çalıştırıcı cron:**
- Her 1dk'da scheduled kampanyaları kontrol et
- Gönderim zamanı gelen kampanyaları başlat
- Timezone-aware: kullanıcıları timezone'a göre grupla
- Rate-limited: `AdaptiveRateLimiter` (PLA-685) entegrasyonu

#### Phase 3: Kampanya Admin Dashboard → [PLA-709](https://linear.app/plan-b-side-projects/issue/PLA-709)

```
Dashboard: /system-admin/email-campaigns
┌──────────────────────────────────────────────────────┐
│ ● Create Campaign (Wizard)                            │
│                                                        │
│ Step 1: Content   → subject + body (template/custom)  │
│ Step 2: Audience  → hedef kitle + preview              │
│ Step 3: Schedule  → now / schedule / local-time        │
│ Step 4: Review    → preview + confirm                  │
│                                                        │
│ [Kampanya Listesi]                                    │
│ ┌──────────┬────────┬────────┬──────┬──────┬───────┐ │
│ │ Campaign │ Status │  Sent  │ Open │ Click│ Bounce│ │
│ ├──────────┼────────┼────────┼──────┼──────┼───────┤ │
│ │ Welcome  │ ✅sent │  1,200 │  45% │  12% │  0.5% │ │
│ │ Feature  │ ⏳schd │    —   │   —  │   —  │   —   │ │
│ │ Promo    │ 📝drft │    —   │   —  │   —  │   —   │ │
│ └──────────┴────────┴────────┴──────┴──────┴───────┘ │
│                                                        │
│ [Kampanya Detay: Welcome]                             │
│ ┌──────────────────────────────────────────┐          │
│ │ Delivery Funnel:                          │          │
│ │ Sent(1200) → Delivered(1180) → Opened(531)│         │
│ │                          → Clicked(142)    │         │
│ └──────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### Bağımlılıklar

| Task | Bağımlılık | Açıklama |
|------|-----------|----------|
| PLA-707 | — | Bağımsız, kampanya modeli + hedefleme |
| PLA-708 | PLA-707 | Kampanya modeline zamanlama ekler |
| PLA-709 | PLA-707, PLA-708 | Her iki özelliği UI'da birleştirir |

---

## Test Kapsam Analizi & Eksik Testler (2026-04-05)

> **Label:** `email-tests`

### Mevcut Test Durumu

| Kategori | Toplam | Testli | Testsiz | Kapsam |
|----------|--------|--------|---------|--------|
| Email implementasyon (scraper) | 38 | 20 | 18 | 52.6% |
| Email API route'ları | 11 | 3 | 8 | 27.3% |
| **Toplam** | **49** | **23** | **26** | **46.9%** |

### Eksik Test Taskları

| Task | Öncelik | Kapsam |
|------|---------|--------|
| [PLA-710](https://linear.app/plan-b-side-projects/issue/PLA-710) | 🔴 Urgent | Core processing: process-instant, process-bulk, eligibility |
| [PLA-711](https://linear.app/plan-b-side-projects/issue/PLA-711) | 🟠 High | Templates, builders, bounce handler, tracking, email-logger |
| [PLA-712](https://linear.app/plan-b-side-projects/issue/PLA-712) | 🟠 High | API routes: alerts, analytics, logs, scheduling, simulation, preferences, suppression |
| [PLA-716](https://linear.app/plan-b-side-projects/issue/PLA-716) | 🟡 Medium | Utilities: alert-batching, dry-run, timezone |

### Kritik testsiz dosyalar (P1)

```
❌ process-instant-email.ts  — 6 transactional email tipinin işlenmesi
❌ process-bulk-email.ts     — digest, alert, campaign email işleme
❌ eligibility.ts            — 5 aşamalı eligibility karar mekanizması
```

---

## Queue Job Inspector (2026-04-05)

> **Task:** [PLA-717](https://linear.app/plan-b-side-projects/issue/PLA-717)

Queue Monitor sayfasında email/notification queue job'larının detaylarını incelemek için eklenen özellik:

### API Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/system-admin/queue-jobs?queue=email-instant&state=waiting` | Job listesi (tüm 5 queue) |
| `GET /api/system-admin/queue-jobs/:queue/:jobId` | Tekil job detayı + stacktrace + logs |
| `POST /api/system-admin/queue-jobs/:queue/:jobId/retry` | Failed job'u retry et |
| `DELETE /api/system-admin/queue-jobs/:queue/:jobId` | Job'u sil |

### Dashboard UI

- Queue kartlarındaki sayılara tıklanabilir linkler eklendi
- `/system-admin/queues/[id]?state=waiting` — job listesi sayfası
- Sol panel: job listesi (filtrelenebilir: waiting/active/completed/failed/delayed)
- Sağ panel: tıklanan job'un detayı (data, error, stacktrace, timestamps)
- Email job'lar için: recipient, type, body
- Scraper job'lar için: platform, slug, triggeredBy
- Retry ve Remove butonları

### Notification ile Paralellik

Email ve notification broadcast sistemleri paralel mimari kullanır:

| Özellik | Notification | Email |
|---------|-------------|-------|
| Audience targeting | PLA-704 | PLA-707 |
| Timezone scheduling | PLA-705 | PLA-708 |
| Admin dashboard | PLA-706 | PLA-709 |
| Label | `admin-broadcast` | `admin-email-broadcast` |
| Delivery mechanism | In-app + push | SMTP + queue |
| Rate limiting | Per-type (PLA-698) | Adaptive (PLA-685) |
| Suppression | Quiet hours (PLA-689) | Suppression list (PLA-672) |
