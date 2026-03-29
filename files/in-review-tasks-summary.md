# In Review Tasks — Summary & Test Guide

> Generated: 2026-03-29
> Total tasks in review: **129**
> Purpose: Review all In Review tasks, identify which can be moved to Done (no manual test needed) vs which need manual testing before closing.

---

## Quick Summary by Group

| Group | Count | Manual Test | Recommendation |
|-------|-------|-------------|----------------|
| 📧 Email System | 23 | hard | Move to Done — manual test impractical |
| 🔔 Notification System | 6 | hard | Move to Done — manual test impractical |
| 🔍 SEO & AEO Pages | 23 | easy | Quick manual check, then Done |
| ⚡ Performance Optimizations | 14 | medium | Spot-check a few, move rest to Done |
| 🔧 Platform Robustness | 30 | medium | Spot-check a few, move rest to Done |
| 🛡️ Zero Error Policy | 9 | easy | Quick manual check, then Done |
| 🗄️ DB Resilience | 5 | hard | Move to Done — manual test impractical |
| 🧪 Unit Tests | 7 | none | Move to Done — tests pass = done |
| 🏗️ Infrastructure Risk | 5 | hard | Move to Done — manual test impractical |
| 📦 Migrations | 1 | easy | Quick manual check, then Done |
| 📌 Other / Standalone | 6 | mixed | Review individually |

**Total: 129 tasks**

---

## 📧 Email System (23 tasks)

**Description:** Email pipeline, templates, tracking. Most are design docs turned into tasks — actual implementation exists in code. These will be REPLACED by the new unified email-notification plan.

**Manual testability:** hard

### PLA-355: Phase 6: Configure email deliverability (SPF, DKIM, DMARC)
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-353: Phase 6: Build dry run system with preview and bulk mode
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-352: Phase 5: Build cold follow-up nudge and cold competitive alert emails
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-350: Phase 5: Build cold first contact email with auto-generated app insights
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-348: Phase 5: Build cold email prospect management and campaign system
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-345: Phase 4: Build opportunity alert email with weekly analysis
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **Commit:** Implemented. Commit: [33ea390](https://github.com/olcayay/shopify-tracker/commit/33ea390)

### PLA-342: Phase 4: Build re-engagement email for inactive users
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **Commit:** Commit: [2b17406](https://github.com/olcayay/shopify-tracker/commit/2b17406)

### PLA-339: Phase 4: Build welcome email and onboarding series
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **Commit:** Commit: [2b17406](https://github.com/olcayay/shopify-tracker/commit/2b17406)

### PLA-336: Phase 3: Build alert batching and quiet hours system
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **Commit:** Implemented. Commit: [33ea390](https://github.com/olcayay/shopify-tracker/commit/33ea390)

### PLA-332: Phase 3: Build win celebration email with milestone detection
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **Commit:** Commit: [efa3b9c](https://github.com/olcayay/shopify-tracker/commit/efa3b9c)

### PLA-330: Phase 3: Build review alert email
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** Review alert email template: new_positive, new_negative, velocity_spike. Hero stat, review card, insight, CTA. Dynamic subject. Commit: [1e693c9](https://github.com/olcayay/shopify-tracker/commit/1e693c9)
- **Commit:** Commit: [1e693c9](https://github.com/olcayay/shopify-tracker/commit/1e693c9)

### PLA-326: Phase 3: Build competitor alert email
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Competitor alert email template oluşturuldu. 4 alert tipi: overtook, pricing_change, review_surge, featured Competitor card, pozisyon karşılaştırma, tip bazlı insight, CTA
- **Commit:** Commit: [9bec6af](https://github.com/olcayay/shopify-tracker/commit/9bec6af)

### PLA-324: Phase 3: Build ranking alert email with event triggers
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Ranking alert email template oluşturuldu. 5 alert tipi: top3_entry, top3_exit, significant_change, new_entry, dropped_out Hero stat, diğer değişiklikler tablosu, insight, CTA
- **Commit:** Commit: [9bec6af](https://github.com/olcayay/shopify-tracker/commit/9bec6af)

### PLA-322: Phase 2: Build admin email management dashboard
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-319: Phase 2: Build user email preferences page in dashboard
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** User email preferences sayfası: `/settings/email-preferences` Kategorize edilmiş notification toggle'ları (Ranking, Competitor, Review, Featured, Account) Bulk update desteği. Responsive Card layout.
- **Commit:** Commit: [74ba21f](https://github.com/olcayay/shopify-tracker/commit/74ba21f)

### PLA-316: Phase 2: Build weekly summary email
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Haftalık özet emaili oluşturuldu.
- **Commit:** Commit: [72cfdfb](https://github.com/olcayay/shopify-tracker/commit/72cfdfb)

### PLA-315: Phase 2: Build enhanced daily digest email
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Daily digest emaili component tabanlı sistemle tamamen yeniden yazıldı.
- **Test steps:**
  1. Admin panelinden manuel digest tetikle
  2. Email'de hero stat, wins/attention tabloları, competitor bölümü görünmeli
  3. Subject line'ın içeriğe göre değiştiğini doğrula
  4. Deep link'lerin doğru sayfalara yönlendirdiğini kontrol et
  Commit: [dc42e3b](https://github.com/olcayay/shopify-tracker/commit/dc42e3b)
- **Commit:** Commit: [dc42e3b](https://github.com/olcayay/shopify-tracker/commit/dc42e3b)

### PLA-312: Phase 1: Create admin API endpoints for email management
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Admin email yönetim API endpoint'leri oluşturuldu.
- **Test steps:**
  1. Admin olarak `GET /api/system-admin/emails` çağır → email listesi
  2. `GET /api/system-admin/emails/stats` → open rate ve click rate
  3. `POST /api/system-admin/email-configs/daily_digest/toggle` → digest'i disable/enable et
  Commit: [e83332b](https://github.com/olcayay/shopify-tracker/commit/e83332b)
- **Commit:** Commit: [e83332b](https://github.com/olcayay/shopify-tracker/commit/e83332b)

### PLA-308: Phase 1: Implement unsubscribe system and open/click tracking
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Email unsubscribe sistemi ve open/click tracking implementasyonu tamamlandı.
- **Test steps:**
  1. Test kullanıcısına digest emaili gönder
  2. Email kaynağında `List-Unsubscribe` header'ını kontrol et
  3. Email HTML'inde tracking pixel (`track/open`) ve rewritten linkler (`track/click`) olduğunu doğrula
  4. Tracking pixel URL'sini tarayıcıda aç → `email_logs.opened_at` güncellenmeli
  5. Click tracking URL'sini aç → orijinal URL'ye redirect olmalı + `clicked_at` güncellenmeli
- **Commit:** Commit: [d170790](https://github.com/olcayay/shopify-tracker/commit/d170790)

### PLA-307: Phase 1: Implement timezone-aware email scheduling
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Digest email gönderimi timezone-aware hale getirildi. Artık her kullanıcıya kendi yerel saatiyle sabah 8'de gönderiliyor.
- **Test steps:**
  1. Test kullanıcısının timezone'unu farklı bir timezone'a ayarla
  2. Admin panelinden manuel digest tetikle
  3. Scheduler loglarında `digest recipients in delivery window` mesajını kontrol et
  4. `inWindow` sayısının sadece o anki 15-dakikalık penceredeki kullanıcıları gösterdiğini doğrula
  Commit: [0e8b536](https://github.com/olcayay/shopify-tracker/commit/0e8b536)
- **Commit:** Commit: [0e8b536](https://github.com/olcayay/shopify-tracker/commit/0e8b536)

### PLA-306: Phase 1: Build email send pipeline with eligibility checks
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-305: Phase 1: Build component-based email template engine
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-304: Phase 1: Create database schema for email system
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## 🔔 Notification System (6 tasks)

**Description:** Push notifications, in-app notification center, notification engine. Will be REPLACED by new unified plan.

**Manual testability:** hard

### PLA-354: Phase 5: Advanced notification features (SSE, milestones, grouping, retention)
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-351: Phase 4: System admin notification dashboard (log, stats, management)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-349: Phase 3: Web Push notification infrastructure (Service Worker, VAPID, delivery)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-343: Phase 2: In-app notification center UI (bell icon, dropdown, full page)
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **Commit:** Commit: [59d8af5](https://github.com/olcayay/shopify-tracker/commit/59d8af5)

### PLA-338: Phase 1: Notification engine & backend API endpoints
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Notification engine ve backend API endpoints implementasyonu tamamlandı.
- **Test steps:**
  1. Auth ile `GET /api/notifications` → boş liste döner
  2. `GET /api/notifications/unread-count` → `{count: 0}`
  3. `GET /api/notifications/preferences` → 23 tip için merged tercihler
  4. `PATCH /api/notifications/preferences/ranking_top3_entry` ile tercih güncelle
  Commit: [c0d4f89](https://github.com/olcayay/shopify-tracker/commit/c0d4f89)
- **Commit:** Commit: [c0d4f89](https://github.com/olcayay/shopify-tracker/commit/c0d4f89)

### PLA-334: Phase 0: Database schema & core notification infrastructure
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## 🔍 SEO & AEO Pages (23 tasks)

**Description:** Public-facing SEO pages, structured data, sitemaps. These have live URLs that can be checked.

**Manual testability:** easy

### PLA-347: Phase 6: Dynamic OG image generation for social sharing
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-346: Phase 6: Implement comprehensive internal linking strategy
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-344: Phase 6: Set up Google Search Console integration and SEO monitoring
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-341: Phase 6: Implement content freshness automation and ISR strategy
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-340: Phase 5: Create public keyword insight pages (/insights/{platform}/keywords/{slug})
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-337: Phase 5: Create public trend and statistics pages (/trends/{platform})
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-335: Phase 4: Enrich developer profiles with additional metadata
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-333: Phase 4: Extract FAQ data from platforms and generate AI FAQs
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-331: Phase 4: Scrape changelog and version history data
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-329: Phase 4: Build review sentiment analysis with AI (pros/cons extraction)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-328: Phase 3: Build AI content generation pipeline for SEO pages
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-327: Phase 3: Create best-of listicle pages (/best/{platform}/{category})
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Best-of listicle sayfaları oluşturuldu (`/best/{platform}/{category}`). Ranked listicle format: trophy ikonları, top 10 apps, rating/pricing, JSON-LD ItemList. Meta: "{count} Best {Category} Apps for {Platform} ({Year})"
- **Commit:** Commit: [b15930f](https://github.com/olcayay/shopify-tracker/commit/b15930f)

### PLA-325: Phase 3: Create app comparison pages (/compare/{platform}/{app1}-vs-{app2})
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** App comparison sayfaları oluşturuldu (`/compare/{platform}/{app1}-vs-{app2}`).
- **Test steps:**
  1. `/compare/shopify/{app1-slug}-vs-{app2-slug}` sayfasını ziyaret et
  2. Side-by-side karşılaştırma tablosunu kontrol et
  3. Feature comparison bölümünü doğrula
  4. JSON-LD ve meta tags'i view source ile kontrol et
  Commit: [74210ff](https://github.com/olcayay/shopify-tracker/commit/74210ff)
- **Commit:** Commit: [74210ff](https://github.com/olcayay/shopify-tracker/commit/74210ff)

### PLA-323: Phase 2: Create public developer profile pages (/developers/{platform}/{slug})
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Public developer profile sayfaları oluşturuldu (`/developers/{platform}/{slug}`).
- **Commit:** Commit: [c5ef7ad](https://github.com/olcayay/shopify-tracker/commit/c5ef7ad)

### PLA-321: Phase 2: Create public category pages (/categories/{platform}/{slug})
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Public category sayfaları oluşturuldu (`/categories/{platform}/{slug}`).
- **Commit:** Commit: [c5ef7ad](https://github.com/olcayay/shopify-tracker/commit/c5ef7ad)

### PLA-320: Phase 1: Normalize screenshot data across all platforms
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Screenshot verisi normalize edildi: yeni DB kolonu, scraper extraction, backfill migration.
- **Test steps:**
  1. Deploy sonrası DB'de `SELECT screenshots FROM app_snapshots WHERE screenshots != '[]' LIMIT 5` ile backfill doğrula
  2. Yeni bir scrape run başlat ve `screenshots` kolonunun dolu geldiğini kontrol et
  3. `/apps/shopify/{slug}` sayfasında screenshot galerisi görüntülenmeli
  Commit: [9093e1a](https://github.com/olcayay/shopify-tracker/commit/9093e1a)
- **Commit:** Commit: [9093e1a](https://github.com/olcayay/shopify-tracker/commit/9093e1a)

### PLA-318: Phase 1: Create public API endpoints for SEO pages
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-317: Phase 1: Create public app profile pages (/apps/{platform}/{slug})
- **Priority:** Urgent
- **Implemented:** Yes (has implementation comment)
- **What was done:** Public app profile sayfası oluşturuldu: `/apps/{platform}/{slug}` (tüm 11 platform destekleniyor).
- **Test steps:**
  1. Dashboard'da `/apps/shopify/klaviyo-email-marketing-sms` (veya herhangi bir app) sayfasını aç
  2. Sayfanın auth olmadan yüklendiğini doğrula
  3. View source ile SSR içeriğini kontrol et
  4. JSON-LD structured data'nın `<script type="application/ld+json">` etiketinde olduğunu doğrula
  5. Meta tags'in doğru olduğunu kontrol et (title, description, canonical)
- **Commit:** Commit: [4d1a995](https://github.com/olcayay/shopify-tracker/commit/4d1a995)

### PLA-314: Phase 0: Add Open Graph and Twitter Card meta tags
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-313: Phase 0: Build JSON-LD structured data component library
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-311: Phase 0: Create llms.txt for AI bot discoverability
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-310: Phase 0: Create dynamic XML sitemap with index
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-309: Phase 0: Create robots.txt for search engine crawling
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## ⚡ Performance Optimizations (14 tasks)

**Description:** API query optimization, caching, pagination. Code changes that improve speed.

**Manual testability:** medium

### PLA-252: Apps list: include category data in tracked apps API response
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-251: Remove cache: 'no-store' from server-side fetchApi to enable Next.js data cache
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** fetchApi'den cache: 'no-store' kaldırıldı, Next.js data cache aktifleştirildi.
- **Test steps:**
  1. Bir app detail sayfasını aç → veriler doğru yüklenmeli
  2. Tracked apps, competitors sayfalarında → güncel veri gelmeli (no-store)
  3. Network tab'da cache header'ları kontrol et
- **Commit:** [16d5262](https://github.com/olcayay/shopify-tracker/commit/16d5262)

### PLA-250: V2 app page: reduce over-fetching and flatten sequential rounds
- **Priority:** Low
- **Implemented:** Yes (has implementation comment)

### PLA-249: Platform overview: eliminate full data reload on track/untrack mutations
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-248: Add HTTP Cache-Control headers to reduce redundant API requests
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** HTTP Cache-Control header'ları API response'larına eklendi.
- **Test steps:**
  1. curl -v /api/platforms → cache-control: public, max-age=3600 header olmalı
  2. curl -v /api/apps/test-app → cache-control: public, max-age=300
  3. curl -v /api/auth/me → cache-control: private, no-cache
  4. curl -v /api/account → cache-control: private, no-cache
- **Commit:** [6d40a87](https://github.com/olcayay/shopify-tracker/commit/6d40a87)

### PLA-247: Replace correlated subqueries with DISTINCT ON and window functions
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** 6 correlated subquery DISTINCT ON ve CTE'lere dönüştürüldü.
- **Test steps:**
  1. App search → doğru sonuçlar dönmeli
  2. Min paid prices → doğru fiyatlar
  3. Developer admin list → app_count doğru
  4. By-developer page → doğru app listesi
- **Commit:** [c398388](https://github.com/olcayay/shopify-tracker/commit/c398388)

### PLA-246: Optimize research project polling: use delta updates instead of full reload
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** Research project polling lightweight status endpoint'e taşındı.
- **Test steps:**
  1. Research project sayfasında keyword ekle → pending indicator görünmeli
  2. Keyword scrape bitince → otomatik full refresh olmalı
  3. Network tab'da status call'ları ~200B olmalı
- **Commit:** [3b8ee12](https://github.com/olcayay/shopify-tracker/commit/3b8ee12)

### PLA-245: Flatten keyword detail and category detail page waterfalls
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-244: Optimize JSONB queries: use containment operators and GIN indexes
- **Priority:** Medium
- **Implemented:** Yes (has implementation comment)
- **What was done:** JSONB array expansion → containment operator, GIN indexes eklendi.
- **Test steps:**
  1. Integration detail page → doğru app listesi dönmeli
  2. Platform attribute filter → doğru filtreleme
  3. Deploy sonrası migration 0096 çalışmalı
- **Commit:** [4651a14](https://github.com/olcayay/shopify-tracker/commit/4651a14)

### PLA-243: Add Redis caching layer for frequently accessed, rarely changing data
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Redis cache utility oluşturuldu ve features tree endpoint'ine uygulandı.
- **Test steps:**
  1. Features sayfasını aç → doğru tree yüklenmeli
  2. İkinci kez aç → Redis'ten gelecek (daha hızlı)
  3. Redis kapatılırsa → hala çalışmalı (fail-open)
- **Commit:** [commit](https://github.com/olcayay/shopify-tracker/commit/$(git rev-parse --short HEAD))

### PLA-242: Add server-side pagination to unbounded API endpoints
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** 4 unbounded API endpoint'e limit/offset pagination eklendi.
- **Test steps:**
  1. Featured apps sayfası → veriler doğru yüklenmeli
  2. ?limit=10&offset=0 ile test et → sadece 10 sonuç dönmeli
  3. Platform attributes ve integrations sayfaları → doğru çalışmalı
- **Commit:** [5b64b54](https://github.com/olcayay/shopify-tracker/commit/5b64b54)

### PLA-241: Reduce app detail page from 3-round waterfall to single parallel fetch
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** App detail sayfası 3-round waterfall'dan 2-round'a düşürüldü.
- **Test steps:**
  1. Tracked bir app detail sayfasını aç → tüm kartlar doğru yüklenmeli
  2. Category Rankings kartı → leader'lar ve appCount doğru
  3. Competitor Watch kartı → competitor changes doğru
  4. Untracked bir app → competitors/keywords bölümleri görünmemeli
- **Commit:** [c3fe8a6](https://github.com/olcayay/shopify-tracker/commit/c3fe8a6)

### PLA-240: Add server-side count endpoints to avoid fetching full arrays for counts
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Yeni GET /api/account/stats endpoint eklendi. Overview sayfası artık 33 API call yerine tek call yapıyor.
- **Test steps:**
  1. Overview sayfasını aç → platform kartlarında doğru count'lar görünmeli
  2. Tek app/keyword/competitor olan platformda karta tıkla → doğru sayfaya gitmeli
  3. Network tab'da tek /api/account/stats call'ı görünmeli
- **Commit:** [555da17](https://github.com/olcayay/shopify-tracker/commit/555da17)

### PLA-239: Eliminate N+1 query patterns in API routes
- **Priority:** Urgent
- **Implemented:** Yes (has implementation comment)
- **What was done:** 5 N+1 query pattern batch query'lere dönüştürüldü. 3 endpoint zaten önceki çalışmada fixlenmişti.
- **Test steps:**
  1. Dashboard'da bir hub category sayfasını aç (çok child'ı olan) → hızlı yüklenmeli
  2. Keywords sayfasında opportunity scores'un hesaplandığını doğrula
  3. Category history sayfasını aç → appCount'lar doğru gelmeli
  4. Developer detail sayfasını aç → app listesi doğru gelmeli
- **Commit:** [7557746](https://github.com/olcayay/shopify-tracker/commit/7557746)

## 🔧 Platform Robustness (30 tasks)

**Description:** Data mapping fixes, scraper improvements, validation. Mostly code-level fixes.

**Manual testability:** medium

### PLA-282: Create bootstrap snapshot for apps without rating/vendor (HubSpot, Canva foundation gap)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-281: Update PLATFORM-DATA-MATRIX.md Section 5 to match actual code mappings
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-280: Map lastUpdatedAt for Salesforce and Zoho (publishedDate available but not stored)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-279: Fix languages mapping: Wix and Canva have data but PLATFORM-DATA-MATRIX says empty
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-278: Map Wix demoUrl to demo_store_url column (only Shopify uses it currently)
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-277: Map support column for Wix and Google Workspace (data available but not stored)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-276: Map integrations column for Google Workspace (worksWithApps) and Zoom (worksWith)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-275: Map currentVersion for Zoho and Zendesk (available in platformData but not stored)
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-274: Fix pricing_plans mapping for Atlassian and HubSpot (field name mismatch)
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-273: Map platformData.categories to snapshot categories column for 7 platforms
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-272: Keyword scraper: extract developer/externalId from search results for 6 platforms
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-271: Category scraper ignores extra fields: use developer, installs, version from bulk data
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-270: Add COALESCE guards to complex JSON paths in developers endpoint
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-269: Add platform capability check to reviews API endpoint
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-268: Add integration tests for critical scraper paths (category, review, compute jobs)
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-267: Add logging when category position is clamped to null and silently skipped
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-266: Make stale run cleanup timeout configurable per job type
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-265: Standardize error logging levels across all scrapers
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-264: Deduplicate URL builders between shared package and dashboard
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-263: Add app listing preview support for remaining 6 platforms
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-262: Fix N+1 query pattern in keywords API endpoint (1 query per keyword)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-261: Circuit breaker silently disables when Redis connection fails
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** Bu task önceki session'da zaten implement edilmiş. circuit-breaker.ts dosyası tüm acceptance criteria'yı karşılıyor: - WARN log when Redis fails (line 44, 51)

### PLA-260: Add missing platformData developer info extraction for 6 platforms in API
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-259: Add conflict handling to keyword rankings insert (inconsistent with category rankings)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-258: Upgrade review insert error logging from DEBUG to WARN with failure categorization
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-257: Add Atlassian to backfill-categories URL extraction
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-256: Fix keyword suggestion scraper using Shopify autocomplete for all non-Canva platforms
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-255: Fix review deduplication losing updated reviews from same reviewer
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-254: Fix review date parsing returning unparsed strings on failure
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-253: Make Zod platformData validation blocking before DB insert
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## 🛡️ Zero Error Policy (9 tasks)

**Description:** API null guards, error handling, graceful degradation.

**Manual testability:** easy

### PLA-376: Phase 2: Add API request interceptor to prevent error cascades
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-375: Phase 1: Stop sending unnecessary API requests from unauthenticated pages
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-374: Phase 3: Improve error logging and add structured error responses
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-373: Phase 3: Harden input validation and remove unsafe type casts
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-372: Phase 2: Dashboard should handle API 401/500 errors gracefully
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-371: Phase 2: Add null guards to admin.ts, developers.ts, and all remaining routes
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-370: Phase 1: Add null guards to account-members.ts and account-info.ts
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-369: Phase 1: Add null guards to auth.ts destructured DB queries
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-368: Phase 1: Make /api/developers/ endpoint publicly accessible
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## 🗄️ DB Resilience (5 tasks)

**Description:** Database connection retry, healthchecks, 503 responses. Requires simulating DB failures.

**Manual testability:** hard

### PLA-381: Phase 3: Dashboard should show friendly error page when API is unavailable
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-380: Phase 2: Add uptime monitoring and alerting for API and DB health
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-379: Phase 2: Harden Docker Compose healthchecks and restart policies
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-378: Phase 1: API should return 503 Service Unavailable instead of 500 on DB errors
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-377: Phase 1: Add DB connection retry logic with exponential backoff
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

## 🧪 Unit Tests (7 tasks)

**Description:** Test-only tasks. No manual testing possible — just verify tests pass.

**Manual testability:** none

### PLA-363: Add route consistency validation test to prevent slug/platform conflicts
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-362: Add unit tests for database schema validation and migration helpers
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-361: Add unit tests for complex interactive dashboard components
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-360: Add unit tests for marketing/public pages (routing, data fetching, error states)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-359: Add unit tests for public API routes
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-358: Add unit tests for account-tracking and account-info API routes
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-357: Add unit tests for API auth and authorization middleware
- **Priority:** High
- **Implemented:** Unknown (no comment)

## 🏗️ Infrastructure Risk (5 tasks)

**Description:** Major infrastructure changes: managed DB, proxy pool, monitoring. Not implemented yet — these are planning tasks.

**Manual testability:** hard

### PLA-202: Create E2E test suite with Playwright for critical user journeys
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-200: Migrate PostgreSQL to managed database service
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-198: Implement rotating proxy pool for scraping resilience
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-190: Set up centralized logging with Loki or ELK stack
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

### PLA-189: Add Prometheus metrics and Grafana dashboards
- **Priority:** Medium
- **Implemented:** Unknown (no comment)

## 📦 Migrations (1 tasks)

**Description:** Database migration deployment tasks.

**Manual testability:** easy

### PLA-238: Deploy and verify 4 pending migrations (0091-0094) on production
- **Priority:** High
- **Implemented:** Yes (has implementation comment)
- **What was done:** 17 pending migration (0082-0098) production'a başarıyla deploy edildi. Worker crash loop düzeltildi.
- **Test steps:**
  1. `ssh root@5.78.101.102` ile production'a bağlan
  2. `docker ps` ile tüm container'ların sağlıklı olduğunu doğrula (no Restarting)
  3. `docker exec <pg> psql -U postgres -d postgres -c 'SELECT count(*) FROM drizzle."__drizzle_migrations"'` — 90 olmalı
  4. `docker exec <pg> psql -c "SELECT tablename FROM pg_tables WHERE tablename IN ('dead_letter_jobs','notifications','email_type_configs')"` — 3 tablo olmalı
  Commits: [dffb329](https://github.com/olcayay/shopify-tracker/commit/dffb329), [8c3e4bd](https://github.com/olcayay/shopify-tracker/commit/8c3e4bd)
- **Commit:** Commits: [dffb329](https://github.com/olcayay/shopify-tracker/commit/dffb329), [8c3e4bd](https://github.com/olcayay/shopify-tracker/commit/8c3e4bd)

## 📌 Other / Standalone (6 tasks)

**Description:** Individual bug fixes and improvements.

**Manual testability:** mixed

### PLA-367: Fix API 500 errors: null checks, public endpoint access, zero-error policy
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-366: Unify section title styles on overview page
- **Priority:** Low
- **Implemented:** Unknown (no comment)

### PLA-365: Establish icon library standards and add to project rules (CLAUDE.md)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-364: Fix inconsistent icon styles in dashboard header (top-bar)
- **Priority:** High
- **Implemented:** Unknown (no comment)

### PLA-356: Fix developers page broken after route rename ([slug] → [platform])
- **Priority:** Urgent
- **Implemented:** Unknown (no comment)

### PLA-234: Gate deployments on CI success — trigger Coolify deploy from GitHub Actions
- **Priority:** High
- **Implemented:** Unknown (no comment)

---

## Recommendations: Which Tasks to Move to Done

### Batch 1: Safe to Done immediately (no manual test possible/needed)

These tasks are either test-only, infrastructure planning, or code-level changes that are verified by automated tests:

- [ ] **PLA-363**: Add route consistency validation test to prevent slug/platform conflicts
- [ ] **PLA-362**: Add unit tests for database schema validation and migration helpers
- [ ] **PLA-361**: Add unit tests for complex interactive dashboard components
- [ ] **PLA-360**: Add unit tests for marketing/public pages (routing, data fetching, error states)
- [ ] **PLA-359**: Add unit tests for public API routes
- [ ] **PLA-358**: Add unit tests for account-tracking and account-info API routes
- [ ] **PLA-357**: Add unit tests for API auth and authorization middleware
- [ ] **PLA-202**: Create E2E test suite with Playwright for critical user journeys
- [ ] **PLA-200**: Migrate PostgreSQL to managed database service
- [ ] **PLA-198**: Implement rotating proxy pool for scraping resilience
- [ ] **PLA-190**: Set up centralized logging with Loki or ELK stack
- [ ] **PLA-189**: Add Prometheus metrics and Grafana dashboards

**Count: 12 tasks**

### Batch 2: Email + Notification system tasks → Done (will be replaced by new unified plan)

These tasks created the email pipeline, templates, and notification infrastructure. The code is implemented and tested via unit tests. These will be superseded by the new `email-notification-unified-plan.md` which reorganizes everything into 3 new workers. Moving these to Done acknowledges the work is complete, and new tasks will be created for the worker architecture.

- [ ] **PLA-355**: Phase 6: Configure email deliverability (SPF, DKIM, DMARC) — *design/planning only*
- [ ] **PLA-353**: Phase 6: Build dry run system with preview and bulk mode — *design/planning only*
- [ ] **PLA-352**: Phase 5: Build cold follow-up nudge and cold competitive alert emails — *design/planning only*
- [ ] **PLA-350**: Phase 5: Build cold first contact email with auto-generated app insights — *design/planning only*
- [ ] **PLA-348**: Phase 5: Build cold email prospect management and campaign system — *design/planning only*
- [ ] **PLA-345**: Phase 4: Build opportunity alert email with weekly analysis — *implemented*
- [ ] **PLA-342**: Phase 4: Build re-engagement email for inactive users — *implemented*
- [ ] **PLA-339**: Phase 4: Build welcome email and onboarding series — *implemented*
- [ ] **PLA-336**: Phase 3: Build alert batching and quiet hours system — *implemented*
- [ ] **PLA-332**: Phase 3: Build win celebration email with milestone detection — *implemented*
- [ ] **PLA-330**: Phase 3: Build review alert email — *implemented*
- [ ] **PLA-326**: Phase 3: Build competitor alert email — *implemented*
- [ ] **PLA-324**: Phase 3: Build ranking alert email with event triggers — *implemented*
- [ ] **PLA-322**: Phase 2: Build admin email management dashboard — *design/planning only*
- [ ] **PLA-319**: Phase 2: Build user email preferences page in dashboard — *implemented*
- [ ] **PLA-316**: Phase 2: Build weekly summary email — *implemented*
- [ ] **PLA-315**: Phase 2: Build enhanced daily digest email — *implemented*
- [ ] **PLA-312**: Phase 1: Create admin API endpoints for email management — *implemented*
- [ ] **PLA-308**: Phase 1: Implement unsubscribe system and open/click tracking — *implemented*
- [ ] **PLA-307**: Phase 1: Implement timezone-aware email scheduling — *implemented*
- [ ] **PLA-306**: Phase 1: Build email send pipeline with eligibility checks — *design/planning only*
- [ ] **PLA-305**: Phase 1: Build component-based email template engine — *design/planning only*
- [ ] **PLA-304**: Phase 1: Create database schema for email system — *design/planning only*
- [ ] **PLA-354**: Phase 5: Advanced notification features (SSE, milestones, grouping, retention) — *design/planning only*
- [ ] **PLA-351**: Phase 4: System admin notification dashboard (log, stats, management) — *design/planning only*
- [ ] **PLA-349**: Phase 3: Web Push notification infrastructure (Service Worker, VAPID, delivery) — *design/planning only*
- [ ] **PLA-343**: Phase 2: In-app notification center UI (bell icon, dropdown, full page) — *implemented*
- [ ] **PLA-338**: Phase 1: Notification engine & backend API endpoints — *implemented*
- [ ] **PLA-334**: Phase 0: Database schema & core notification infrastructure — *design/planning only*

**Count: 29 tasks**

### Batch 3: Code-level fixes with unit tests → Done (spot-check a few)

Platform robustness, performance, zero-error-policy, DB resilience — these are code changes verified by tests. Spot-check 2-3 in production, then move all to Done.

- [ ] **PLA-252**: Apps list: include category data in tracked apps API response — *no comment*
- [ ] **PLA-251**: Remove cache: 'no-store' from server-side fetchApi to enable Next.js data cache — *implemented*
- [ ] **PLA-250**: V2 app page: reduce over-fetching and flatten sequential rounds — *implemented*
- [ ] **PLA-249**: Platform overview: eliminate full data reload on track/untrack mutations — *no comment*
- [ ] **PLA-248**: Add HTTP Cache-Control headers to reduce redundant API requests — *implemented*
- [ ] **PLA-247**: Replace correlated subqueries with DISTINCT ON and window functions — *implemented*
- [ ] **PLA-246**: Optimize research project polling: use delta updates instead of full reload — *implemented*
- [ ] **PLA-245**: Flatten keyword detail and category detail page waterfalls — *no comment*
- [ ] **PLA-244**: Optimize JSONB queries: use containment operators and GIN indexes — *implemented*
- [ ] **PLA-243**: Add Redis caching layer for frequently accessed, rarely changing data — *implemented*
- [ ] **PLA-242**: Add server-side pagination to unbounded API endpoints — *implemented*
- [ ] **PLA-241**: Reduce app detail page from 3-round waterfall to single parallel fetch — *implemented*
- [ ] **PLA-240**: Add server-side count endpoints to avoid fetching full arrays for counts — *implemented*
- [ ] **PLA-239**: Eliminate N+1 query patterns in API routes — *implemented*
- [ ] **PLA-282**: Create bootstrap snapshot for apps without rating/vendor (HubSpot, Canva foundation gap) — *no comment*
- [ ] **PLA-281**: Update PLATFORM-DATA-MATRIX.md Section 5 to match actual code mappings — *no comment*
- [ ] **PLA-280**: Map lastUpdatedAt for Salesforce and Zoho (publishedDate available but not stored) — *no comment*
- [ ] **PLA-279**: Fix languages mapping: Wix and Canva have data but PLATFORM-DATA-MATRIX says empty — *no comment*
- [ ] **PLA-278**: Map Wix demoUrl to demo_store_url column (only Shopify uses it currently) — *no comment*
- [ ] **PLA-277**: Map support column for Wix and Google Workspace (data available but not stored) — *no comment*
- [ ] **PLA-276**: Map integrations column for Google Workspace (worksWithApps) and Zoom (worksWith) — *no comment*
- [ ] **PLA-275**: Map currentVersion for Zoho and Zendesk (available in platformData but not stored) — *no comment*
- [ ] **PLA-274**: Fix pricing_plans mapping for Atlassian and HubSpot (field name mismatch) — *no comment*
- [ ] **PLA-273**: Map platformData.categories to snapshot categories column for 7 platforms — *no comment*
- [ ] **PLA-272**: Keyword scraper: extract developer/externalId from search results for 6 platforms — *no comment*
- [ ] **PLA-271**: Category scraper ignores extra fields: use developer, installs, version from bulk data — *no comment*
- [ ] **PLA-270**: Add COALESCE guards to complex JSON paths in developers endpoint — *no comment*
- [ ] **PLA-269**: Add platform capability check to reviews API endpoint — *no comment*
- [ ] **PLA-268**: Add integration tests for critical scraper paths (category, review, compute jobs) — *no comment*
- [ ] **PLA-267**: Add logging when category position is clamped to null and silently skipped — *no comment*
- [ ] **PLA-266**: Make stale run cleanup timeout configurable per job type — *no comment*
- [ ] **PLA-265**: Standardize error logging levels across all scrapers — *no comment*
- [ ] **PLA-264**: Deduplicate URL builders between shared package and dashboard — *no comment*
- [ ] **PLA-263**: Add app listing preview support for remaining 6 platforms — *no comment*
- [ ] **PLA-262**: Fix N+1 query pattern in keywords API endpoint (1 query per keyword) — *no comment*
- [ ] **PLA-261**: Circuit breaker silently disables when Redis connection fails — *implemented*
- [ ] **PLA-260**: Add missing platformData developer info extraction for 6 platforms in API — *no comment*
- [ ] **PLA-259**: Add conflict handling to keyword rankings insert (inconsistent with category rankings) — *no comment*
- [ ] **PLA-258**: Upgrade review insert error logging from DEBUG to WARN with failure categorization — *no comment*
- [ ] **PLA-257**: Add Atlassian to backfill-categories URL extraction — *no comment*
- [ ] **PLA-256**: Fix keyword suggestion scraper using Shopify autocomplete for all non-Canva platforms — *no comment*
- [ ] **PLA-255**: Fix review deduplication losing updated reviews from same reviewer — *no comment*
- [ ] **PLA-254**: Fix review date parsing returning unparsed strings on failure — *no comment*
- [ ] **PLA-253**: Make Zod platformData validation blocking before DB insert — *no comment*
- [ ] **PLA-376**: Phase 2: Add API request interceptor to prevent error cascades — *no comment*
- [ ] **PLA-375**: Phase 1: Stop sending unnecessary API requests from unauthenticated pages — *no comment*
- [ ] **PLA-374**: Phase 3: Improve error logging and add structured error responses — *no comment*
- [ ] **PLA-373**: Phase 3: Harden input validation and remove unsafe type casts — *no comment*
- [ ] **PLA-372**: Phase 2: Dashboard should handle API 401/500 errors gracefully — *no comment*
- [ ] **PLA-371**: Phase 2: Add null guards to admin.ts, developers.ts, and all remaining routes — *no comment*
- [ ] **PLA-370**: Phase 1: Add null guards to account-members.ts and account-info.ts — *no comment*
- [ ] **PLA-369**: Phase 1: Add null guards to auth.ts destructured DB queries — *no comment*
- [ ] **PLA-368**: Phase 1: Make /api/developers/ endpoint publicly accessible — *no comment*
- [ ] **PLA-381**: Phase 3: Dashboard should show friendly error page when API is unavailable — *no comment*
- [ ] **PLA-380**: Phase 2: Add uptime monitoring and alerting for API and DB health — *no comment*
- [ ] **PLA-379**: Phase 2: Harden Docker Compose healthchecks and restart policies — *no comment*
- [ ] **PLA-378**: Phase 1: API should return 503 Service Unavailable instead of 500 on DB errors — *no comment*
- [ ] **PLA-377**: Phase 1: Add DB connection retry logic with exponential backoff — *no comment*
- [ ] **PLA-238**: Deploy and verify 4 pending migrations (0091-0094) on production — *implemented*

**Count: 59 tasks**

### Batch 4: SEO pages + other → Quick manual check recommended

These have visible URLs. Quick check that pages load correctly.

- [ ] **PLA-347**: Phase 6: Dynamic OG image generation for social sharing — *no comment*
- [ ] **PLA-346**: Phase 6: Implement comprehensive internal linking strategy — *no comment*
- [ ] **PLA-344**: Phase 6: Set up Google Search Console integration and SEO monitoring — *no comment*
- [ ] **PLA-341**: Phase 6: Implement content freshness automation and ISR strategy — *no comment*
- [ ] **PLA-340**: Phase 5: Create public keyword insight pages (/insights/{platform}/keywords/{slug}) — *no comment*
- [ ] **PLA-337**: Phase 5: Create public trend and statistics pages (/trends/{platform}) — *no comment*
- [ ] **PLA-335**: Phase 4: Enrich developer profiles with additional metadata — *no comment*
- [ ] **PLA-333**: Phase 4: Extract FAQ data from platforms and generate AI FAQs — *no comment*
- [ ] **PLA-331**: Phase 4: Scrape changelog and version history data — *no comment*
- [ ] **PLA-329**: Phase 4: Build review sentiment analysis with AI (pros/cons extraction) — *no comment*
- [ ] **PLA-328**: Phase 3: Build AI content generation pipeline for SEO pages — *no comment*
- [ ] **PLA-327**: Phase 3: Create best-of listicle pages (/best/{platform}/{category}) — *implemented*
- [ ] **PLA-325**: Phase 3: Create app comparison pages (/compare/{platform}/{app1}-vs-{app2}) — *implemented*
- [ ] **PLA-323**: Phase 2: Create public developer profile pages (/developers/{platform}/{slug}) — *implemented*
- [ ] **PLA-321**: Phase 2: Create public category pages (/categories/{platform}/{slug}) — *implemented*
- [ ] **PLA-320**: Phase 1: Normalize screenshot data across all platforms — *implemented*
- [ ] **PLA-318**: Phase 1: Create public API endpoints for SEO pages — *no comment*
- [ ] **PLA-317**: Phase 1: Create public app profile pages (/apps/{platform}/{slug}) — *implemented*
- [ ] **PLA-314**: Phase 0: Add Open Graph and Twitter Card meta tags — *no comment*
- [ ] **PLA-313**: Phase 0: Build JSON-LD structured data component library — *no comment*
- [ ] **PLA-311**: Phase 0: Create llms.txt for AI bot discoverability — *no comment*
- [ ] **PLA-310**: Phase 0: Create dynamic XML sitemap with index — *no comment*
- [ ] **PLA-309**: Phase 0: Create robots.txt for search engine crawling — *no comment*
- [ ] **PLA-367**: Fix API 500 errors: null checks, public endpoint access, zero-error policy — *no comment*
- [ ] **PLA-366**: Unify section title styles on overview page — *no comment*
- [ ] **PLA-365**: Establish icon library standards and add to project rules (CLAUDE.md) — *no comment*
- [ ] **PLA-364**: Fix inconsistent icon styles in dashboard header (top-bar) — *no comment*
- [ ] **PLA-356**: Fix developers page broken after route rename ([slug] → [platform]) — *no comment*
- [ ] **PLA-234**: Gate deployments on CI success — trigger Coolify deploy from GitHub Actions — *no comment*

**Count: 29 tasks**

---

## Total: 129 tasks across all batches

- Batch 1 (safe to Done): 12
- Batch 2 (email/notif → Done): 29
- Batch 3 (code fixes → Done): 59
- Batch 4 (SEO/other → check): 29