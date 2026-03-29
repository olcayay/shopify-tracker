# SEO & AEO (Answer Engine Optimization) Strateji Dokümanı — AppRanks.io

> **Tarih:** 29 Mart 2026
> **Amaç:** Email dışındaki en büyük trafik kanalları olan organik arama (SEO) ve yapay zeka destekli arama motorları (AEO) üzerinden trafik çekmek. Bunun için mevcut veri altyapısını genişletmek, public sayfalar oluşturmak ve yapısal veri zenginliği sağlamak.
> **Linear Label:** `seo-aeo` — Tüm ilgili task'lar bu label altında gruplandırılmıştır.

---

## İçindekiler

1. [Mevcut Durum Analizi](#1-mevcut-durum-analizi)
2. [Stratejik Vizyon: Freemium Content Modeli](#2-stratejik-vizyon-freemium-content-modeli)
3. [Faz 0: Teknik SEO Temelleri](#3-faz-0-teknik-seo-temelleri)
4. [Faz 1: Public App Profile Sayfaları](#4-faz-1-public-app-profile-sayfaları)
5. [Faz 2: Kategori & Developer Sayfaları](#5-faz-2-kategori--developer-sayfaları)
6. [Faz 3: Karşılaştırma, Best-Of & AI Content](#6-faz-3-karşılaştırma-best-of--ai-content)
7. [Faz 4: Veri Zenginleştirme](#7-faz-4-veri-zenginleştirme)
8. [Faz 5: Trend & Keyword Insight Sayfaları](#8-faz-5-trend--keyword-insight-sayfaları)
9. [Faz 6: Otomasyon, Monitoring & Ölçekleme](#9-faz-6-otomasyon-monitoring--ölçekleme)
10. [AEO (Answer Engine Optimization) Stratejisi](#10-aeo-answer-engine-optimization-stratejisi)
11. [URL Mimarisi & Internal Linking](#11-url-mimarisi--internal-linking)
12. [Keyword Fırsatları & Trafik Tahminleri](#12-keyword-fırsatları--trafik-tahminleri)
13. [Başarı Metrikleri (KPI)](#13-başarı-metrikleri-kpi)
14. [Riskler & Dikkat Edilecekler](#14-riskler--dikkat-edilecekler)
15. [Task Özet Tablosu](#15-task-özet-tablosu)

---

## 1. Mevcut Durum Analizi

### 1.1 SEO Altyapısı — Neredeyse Sıfır

AppRanks.io şu an SEO açısından neredeyse görünmez durumda. Temel SEO bileşenlerinin hiçbiri mevcut değil:

| Bileşen | Durum | Ne Zaman Çözülecek |
|---------|-------|-------------------|
| `robots.txt` | Yok | Faz 0 — **PLA-309** |
| `sitemap.xml` | Yok | Faz 0 — **PLA-310** |
| `llms.txt` (AEO) | Yok | Faz 0 — **PLA-311** |
| JSON-LD Structured Data | Yok | Faz 0 — **PLA-313** |
| Open Graph / Twitter Cards | Yok | Faz 0 — **PLA-314** |
| Canonical URLs | Yok | PLA-314 kapsamında |
| Dynamic Meta Tags | Yok (sadece landing page'de statik) | Faz 1 — **PLA-317** |
| Breadcrumbs | Yok | Faz 6 — **PLA-346** |
| hreflang | Yok (tek dil, gerek yok şimdilik) | — |

### 1.2 Public Sayfalar — Çok Kısıtlı

Şu an sadece şunlar public (arama motorlarının erişebildiği):
- `/` — Landing page
- `/login`, `/register` — Auth sayfaları
- `/privacy`, `/terms` — Yasal sayfalar

**Tüm değerli içerik auth duvarının arkasında.** 50,000+ app profili, 2,000+ kategori, 10,000+ developer profili — hiçbiri arama motorları tarafından indexlenemiyor.

### 1.3 Mevcut Veri Zenginliği — Güçlü Ama Kullanılmıyor

AppRanks zaten çok zengin bir veri setine sahip:

| Veri Türü | Detay |
|-----------|-------|
| **App Metadata** | 11 platformdan ad, açıklama, icon, developer, pricing, features, categories, languages, integrations |
| **Reviews** | Tam review içeriği, rating, reviewer bilgisi, developer yanıtı, zaman serisi |
| **Keyword Rankings** | Arama pozisyonları, auto-suggestions, ad sightings |
| **Category Rankings** | Kategori içi sıralama, hiyerarşi, feature taxonomy |
| **Computed Scores** | Visibility score, power score, similarity score, review velocity, momentum |
| **Tarihsel Data** | Snapshot'lar, field change tracking, ranking history |
| **Developer Data** | Ad, website, app portföyü (bazı platformlarda kuruluş yılı, lokasyon vb.) |

**Sonuç:** Veri var ama ne Google'a, ne Perplexity'ye, ne ChatGPT Search'e sunuluyor. Bu doküman, bu veriyi organik trafik motoruna dönüştürme planıdır.

---

## 2. Stratejik Vizyon: Freemium Content Modeli

Tüm public sayfalarda **freemium** yaklaşım uygulanacak:

### Public Katman (Herkes + Arama Motorları)
Temel bilgiler, özet metrikler, AI-generated açıklamalar. Arama motorlarının indexlemesi ve kullanıcıların ilk izlenimi için yeterli derinlikte.

### Premium Katman (Login Gerekli)
Detaylı analiz, tarihsel veriler, rakip karşılaştırma, keyword ranking'ler, visibility score'lar, alert'ler. "Daha fazlası için kayıt ol" CTA'ları ile dönüşüm sağlanacak.

### Dönüşüm Noktaları (CTA)
Her public sayfada stratejik CTA'lar:
- "Track this app" — App profilinde
- "See full keyword rankings" — Keyword teaser
- "Compare with competitors" — Comparison teaser
- "Get weekly alerts" — Engagement hook
- "Sign up for free" — Genel CTA

---

## 3. Faz 0: Teknik SEO Temelleri

> **Süre:** 1-2 hafta | **Öncelik:** Urgent
> **Bağımlılık:** Yok — hemen başlanabilir, diğer fazlardan bağımsız

Bu faz, arama motorlarının siteyi keşfetmesi, anlaması ve indexlemesi için gereken **temel altyapıyı** kurar. Public sayfalar olmadan bile bu bileşenler hazır olmalı.

---

### 3.1 Robots.txt — PLA-309

**Ne:** Arama motorlarına hangi sayfaları tarayıp hangilerini görmezden geleceklerini söyleyen dosya.

**Neden kritik:**
- Robots.txt olmadan arama motorları tüm URL'leri taramaya çalışır — `/settings`, `/system-admin`, `/api/*` dahil
- Crawl budget israfı olur (Google bir siteye sınırlı sayıda istek atar)
- Hassas endpoint'ler (admin paneli, API) gereksiz yere indexlenebilir

**Uygulanacak yapı:**
```
User-agent: *
Allow: /apps/
Allow: /categories/
Allow: /developers/
Allow: /compare/
Allow: /best/
Allow: /trends/
Allow: /insights/
Disallow: /settings
Disallow: /system-admin
Disallow: /api/

Sitemap: https://appranks.io/sitemap.xml
```

**Teknik detay:** Next.js `app/robots.ts` convention'ı ile dinamik olarak üretilecek. Hardcoded değil — ileride yeni public path'ler eklendiğinde otomatik güncellenecek.

---

### 3.2 Dinamik XML Sitemap — PLA-310

**Ne:** Arama motorlarına tüm indexlenebilir sayfaların listesini veren XML dosyası.

**Neden kritik:**
- 50,000+ sayfa için Google'ın her birini organik olarak keşfetmesini beklemek aylar alır
- Sitemap ile tüm sayfalar 1-2 hafta içinde indexlenebilir
- `lastModified` ile Google'a hangi sayfaların güncel olduğu söylenir
- `priority` ile en önemli sayfalar vurgulanır

**Sitemap index yapısı:**
```
/sitemap.xml (index — tüm sub-sitemap'lere pointer)
├── /sitemap-apps-shopify.xml      (~15,000 URL)
├── /sitemap-apps-wordpress.xml    (~10,000 URL)
├── /sitemap-apps-wix.xml          (~5,000 URL)
├── /sitemap-apps-salesforce.xml   (~3,000 URL)
├── /sitemap-apps-{platform}.xml   (her platform için ayrı)
├── /sitemap-categories.xml        (~2,000 URL)
├── /sitemap-developers.xml        (~10,000 URL)
├── /sitemap-comparisons.xml       (~10,000 URL — en popüler çiftler)
├── /sitemap-best-of.xml           (~500 URL)
├── /sitemap-trends.xml            (~50 URL)
└── /sitemap-keywords.xml          (~5,000 URL)
```

**Her URL'de:**
- `loc` — Tam URL
- `lastmod` — Son scrape/snapshot tarihi (veritabanından)
- `changefreq` — App profili: `weekly`, Trend: `daily`, Best-of: `monthly`
- `priority` — App profili: `0.8`, Kategori: `0.7`, Comparison: `0.6`

**Teknik detay:** Next.js `app/sitemap.ts` + `generateSitemaps()` ile dinamik üretim. Her sub-sitemap veritabanını sorgulayarak güncel slug listesini çeker. Google'ın 50,000 URL/sitemap limiti aşılmamalı.

**Bağımlılık:** Sub-sitemap'ler ilgili public sayfalar oluşturuldukça aktifleşir. Başlangıçta sadece app sitemap'i ile başlanabilir.

---

### 3.3 llms.txt — PLA-311

**Ne:** AI botlarının (ChatGPT, Perplexity, Claude) siteyi anlamasını kolaylaştıran, `robots.txt`'nin AI versiyonu.

**Neden kritik:**
- AEO'nun temel taşı — AI arama motorları bu dosyayı okuyarak siteyi kategorize eder
- Sitenin ne hakkında olduğunu, hangi sayfa tiplerinin bulunduğunu ve URL pattern'lerini açıklar
- Erken benimseme avantajı — henüz çok az site llms.txt kullanıyor

**İçerik:**
```markdown
# AppRanks.io
> App marketplace intelligence platform tracking apps across 11 platforms

## About
AppRanks tracks app rankings, reviews, pricing, and performance across
Shopify, WordPress, Salesforce, Canva, Wix, Google Workspace, Atlassian,
Zoom, Zoho, Zendesk, and HubSpot marketplaces. Data is updated every 12 hours.

## Key Page Types
- /apps/{platform}/{slug} - Detailed app profiles with ratings, reviews, pricing
- /categories/{platform}/{slug} - Category rankings and top apps
- /compare/{platform}/{app1}-vs-{app2} - Side-by-side app comparisons
- /best/{platform}/{category} - Curated best app lists by category
- /developers/{platform}/{slug} - Developer/publisher profiles
- /trends/{platform} - Market trends, statistics, and insights
- /insights/{platform}/keywords/{slug} - Search keyword analysis

## Data Coverage
- 50,000+ app profiles across 11 platforms
- 2,000+ categories with rankings
- 10,000+ developer profiles
- Daily review tracking and sentiment analysis
- Historical pricing and ranking data
```

**Ek olarak `/llms-full.txt`:** Daha detaylı versiyon — veri şeması, metrik açıklamaları, API endpoint'leri.

---

### 3.4 JSON-LD Structured Data Component Kütüphanesi — PLA-313

**Ne:** Sayfaların HTML'ine gömülen, arama motorlarına yapısal bilgi sunan Schema.org markup'ları.

**Neden kritik:**
- Google Rich Results (yıldız rating, fiyat, review sayısı arama sonuçlarında görünür)
- AI Overviews'da source olarak seçilme şansı %3x artar
- Featured Snippet eligibility
- Knowledge Panel verisi

**Oluşturulacak 6 React component:**

#### 1. `<AppJsonLd>` — SoftwareApplication Schema
Her app profil sayfasında kullanılacak:
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Klaviyo: Email Marketing & SMS",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "highPrice": "150",
    "priceCurrency": "USD",
    "offerCount": 4
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "reviewCount": "2847",
    "bestRating": "5",
    "worstRating": "1"
  },
  "author": {
    "@type": "Organization",
    "name": "Klaviyo",
    "url": "https://www.klaviyo.com"
  },
  "datePublished": "2014-06-23",
  "description": "Email marketing and SMS automation platform...",
  "screenshot": ["https://..."],
  "softwareVersion": "4.2.1"
}
```

**Google'da görünüm:** Arama sonuçlarında ★★★★★ 4.6 (2,847 reviews) · Free - $150/mo

#### 2. `<CategoryJsonLd>` — ItemList Schema
Kategori sayfalarında top app'leri listelemek için:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Best Email Marketing Apps for Shopify",
  "numberOfItems": 10,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "SoftwareApplication",
        "name": "Klaviyo",
        "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "2847" }
      }
    }
  ]
}
```

#### 3. `<ComparisonJsonLd>` — Article Schema
Karşılaştırma sayfalarında:
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Klaviyo vs Mailchimp: Detailed Comparison for Shopify (2026)",
  "dateModified": "2026-03-29",
  "articleSection": "App Comparison",
  "about": [
    { "@type": "SoftwareApplication", "name": "Klaviyo" },
    { "@type": "SoftwareApplication", "name": "Mailchimp" }
  ],
  "publisher": {
    "@type": "Organization",
    "name": "AppRanks",
    "url": "https://appranks.io"
  }
}
```

#### 4. `<FaqJsonLd>` — FAQPage Schema
FAQ bulunan tüm sayfalarda:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the best email marketing app for Shopify?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Based on our analysis of 2,847 reviews, Klaviyo is the highest-rated email marketing app for Shopify with a 4.6★ rating..."
      }
    }
  ]
}
```

**Google'da görünüm:** Arama sonuçlarında soru-cevap dropdown'ları (Featured Snippet)

#### 5. `<BreadcrumbJsonLd>` — BreadcrumbList Schema
Tüm sayfalarda navigasyon hiyerarşisi:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://appranks.io" },
    { "@type": "ListItem", "position": 2, "name": "Shopify", "item": "https://appranks.io/apps/shopify" },
    { "@type": "ListItem", "position": 3, "name": "Email Marketing", "item": "https://appranks.io/categories/shopify/email-marketing" },
    { "@type": "ListItem", "position": 4, "name": "Klaviyo" }
  ]
}
```

#### 6. `<OrganizationJsonLd>` — Site-wide Organization Schema
Ana layout'ta bir kez:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "AppRanks",
  "url": "https://appranks.io",
  "logo": "https://appranks.io/logo.png",
  "description": "App marketplace intelligence platform"
}
```

**Doğrulama:** Tüm component'ler [Google Rich Results Test](https://search.google.com/test/rich-results) ile valide edilecek.

---

### 3.5 Open Graph & Twitter Card Meta Tag'leri — PLA-314

**Ne:** URL paylaşıldığında sosyal medyada (Twitter/X, LinkedIn, Slack, Discord, WhatsApp) gösterilen önizleme bilgileri.

**Neden kritik:**
- Paylaşılan link'lerin tıklanma oranı 2-3x artar (görsel + başlık + açıklama)
- Backlink kazanımını artırır (insanlar güzel görünen link'leri daha çok paylaşır)
- Google da OG tag'leri referans alır

**Her sayfa tipi için:**

| Sayfa | og:title | og:description | og:image |
|-------|----------|----------------|----------|
| App profili | `{App Name} for {Platform}` | `{rating}★ from {reviewCount} reviews. {pricingHint}` | App icon + rating badge |
| Kategori | `Best {Category} Apps for {Platform}` | `Top {count} apps, avg {rating}★` | Kategori ikonu + top 3 app icon |
| Comparison | `{App1} vs {App2}` | `Compare ratings, pricing & features` | İki app icon yan yana |
| Best-of | `10 Best {Category} Apps ({Year})` | `Curated list with ratings & pricing` | Listicle görseli |

**Canonical URL:** Her sayfada `<link rel="canonical">` ile tekil URL belirtilecek — duplicate content riski sıfırlanır.

**OG image generation:** Faz 6'da dinamik OG image üretimi ile desteklenecek (bkz. **PLA-347**).

---

## 4. Faz 1: Public App Profile Sayfaları

> **Süre:** 2-3 hafta | **Öncelik:** Urgent
> **Bağımlılık:** Faz 0 (teknik altyapı)
> **SEO Etkisi:** En yüksek — 50,000+ indexlenebilir sayfa

Bu faz, tüm stratejinin temel taşıdır. Her app için bir public profil sayfası oluşturulacak. Bu sayfalar `[app name] review`, `[app name] pricing`, `[app name] alternatives` gibi yüksek hacimli keyword'ler için landing page görevi görecek.

---

### 4.1 Public App Profile Sayfaları — PLA-317

**URL Pattern:** `/apps/{platform}/{slug}`
**Örnek:** `/apps/shopify/klaviyo-email-marketing-sms`

#### Sayfa Yapısı (Yukarıdan Aşağıya)

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Shopify > Email Marketing > Klaviyo  │  ← BreadcrumbJsonLd
├─────────────────────────────────────────────────────────┤
│ [Icon] Klaviyo: Email Marketing & SMS                   │
│ by Klaviyo • ★★★★½ 4.6 (2,847 reviews) • Free plan    │
│ [Track This App - CTA]                                  │
├─────────────────────────────────────────────────────────┤
│ ## TL;DR                                                │  ← AI-generated özet
│ Klaviyo is an email marketing and SMS platform for      │
│ e-commerce. It's the highest-rated email app on Shopify │
│ with 4.6★ from 2,847 reviews. Free up to 250 contacts. │
├─────────────────────────────────────────────────────────┤
│ ## Key Facts                                            │  ← Yapısal veri tablosu
│ | Rating    | ★★★★½ 4.6 (2,847 reviews)              │
│ | Pricing   | Free – $150/mo                           │
│ | Category  | Email Marketing, SMS Marketing           │
│ | Developer | Klaviyo (klaviyo.com)                     │
│ | Launched  | June 23, 2014                            │
│ | Updated   | March 28, 2026                           │
├─────────────────────────────────────────────────────────┤
│ ## About This App                                       │  ← appIntroduction + appDetails
│ {App'in kendi açıklaması, ilk 500 karakter}            │
│ [Read full description ▼]                               │
├─────────────────────────────────────────────────────────┤
│ ## Screenshots                                          │  ← PLA-320 (normalize edilmiş)
│ [Screenshot gallery - lazy loaded]                      │
├─────────────────────────────────────────────────────────┤
│ ## Pricing Plans                                        │
│ | Free        | Email     | SMS        | Enterprise   │
│ | $0/mo       | $20/mo    | $15/mo     | Custom       │
│ | 250 contacts| 5,000     | 1,000 SMS  | Unlimited    │
├─────────────────────────────────────────────────────────┤
│ ## What Users Say (Pros & Cons)                         │  ← PLA-329 (sentiment analysis)
│ 👍 Easy to set up (mentioned in 34% of reviews)        │
│ 👍 Great email templates (28%)                          │
│ 👎 Expensive at scale (18%)                             │
│ 👎 Learning curve for flows (12%)                       │
│ [See all reviews — Sign up free]                        │
├─────────────────────────────────────────────────────────┤
│ ## Features                                             │
│ Email campaigns, SMS, Automation flows, Segmentation,   │
│ A/B testing, Reporting, Integrations (Shopify, ...)     │
├─────────────────────────────────────────────────────────┤
│ ## Categories                                           │
│ Email Marketing • SMS Marketing • Marketing Automation  │
│ (her biri kategori sayfasına link)                      │
├─────────────────────────────────────────────────────────┤
│ ## Alternatives to Klaviyo                              │  ← appSimilarityScores
│ | App          | Rating | Reviews | Price     |        │
│ | Mailchimp    | 3.8★   | 1,205   | Free-$350 |        │
│ | Omnisend     | 4.8★   | 6,892   | Free-$59  |        │
│ | Drip         | 4.5★   | 312     | $39/mo    |        │
│ [Compare Klaviyo vs Mailchimp →]                        │
│ [Compare Klaviyo vs Omnisend →]                         │
├─────────────────────────────────────────────────────────┤
│ ## FAQ                                                  │  ← PLA-333 (AI-generated FAQ)
│ ▸ What does Klaviyo do?                                 │
│ ▸ Is Klaviyo free?                                      │
│ ▸ What are the best alternatives to Klaviyo?            │
├─────────────────────────────────────────────────────────┤
│ ## About the Developer                                  │
│ Klaviyo • 12 apps on Shopify • Avg rating: 4.4★        │
│ [View all apps by Klaviyo →]                            │
├─────────────────────────────────────────────────────────┤
│ 🔒 Want deeper insights?                               │
│ Track keywords, monitor competitors, get alerts.        │
│ [Sign Up Free — No credit card required]                │
├─────────────────────────────────────────────────────────┤
│ Data last updated: March 29, 2026 • Sources: Shopify    │
└─────────────────────────────────────────────────────────┘
```

#### Meta Tag'ler
```html
<title>Klaviyo: Email Marketing & SMS for Shopify - Reviews, Pricing & Alternatives | AppRanks</title>
<meta name="description" content="Klaviyo has 4.6★ rating from 2,847 reviews on Shopify. Free plan available. Compare alternatives, see pricing plans, and read user reviews." />
<link rel="canonical" href="https://appranks.io/apps/shopify/klaviyo-email-marketing-sms" />
```

#### Structured Data
- `SoftwareApplication` JSON-LD (PLA-313)
- `BreadcrumbList` JSON-LD (PLA-313)
- `FAQPage` JSON-LD (PLA-333 sonrası)

#### Tahmini Sayfa Sayısı
~50,000+ (tüm platformlardaki tüm app'ler)

---

### 4.2 Public API Endpoint'leri — PLA-318

Public sayfalar, auth gerektirmeyen API endpoint'lerine ihtiyaç duyar. Mevcut tüm API endpoint'leri JWT auth gerektiriyor.

**Yeni endpoint'ler (`/public/` prefix, auth yok):**

| Endpoint | Döndürdüğü Veri | Cache TTL |
|----------|-----------------|-----------|
| `GET /public/apps/:platform/:slug` | Ad, icon, intro, rating, reviewCount, pricing, categories, features, developer, launchDate, screenshots | 1 saat |
| `GET /public/apps/:platform/:slug/reviews-summary` | Rating dağılımı, trend (up/down/stable), toplam sayı | 1 saat |
| `GET /public/apps/:platform/:slug/similar` | Top 5 benzer app (ad, slug, icon, rating, reviewCount, pricing) | 6 saat |
| `GET /public/categories/:platform/:slug` | Kategori bilgisi + top 10 app | 1 saat |
| `GET /public/categories/:platform` | Platform'un kategori ağacı | 6 saat |
| `GET /public/developers/:platform/:slug` | Developer bilgisi + app listesi | 6 saat |
| `GET /public/platforms/:platform/stats` | Platform istatistikleri | 6 saat |

**Güvenlik:**
- Rate limiting: IP başına 60 req/min
- Redis cache ile veritabanı yükü minimalize
- HTTP cache header'ları (Cloudflare CDN'de cache)
- Hassas veri yok — keyword ranking, visibility score, ad sighting döndürülmez

**Neden ayrı endpoint'ler?**
- Mevcut auth middleware'i bypass etmek yerine temiz bir ayrım
- Public endpoint'ler sadece freemium veri döndürür
- Rate limiting ve cache stratejisi farklı

---

### 4.3 Screenshot Data Normalizasyonu — PLA-320

**Problem:** Screenshot URL'leri her platformda farklı formatta `platformData` JSONB'de saklanıyor. Normalize edilmemiş haliyle public sayfalarda kullanılamıyor.

**Mevcut durum (platform bazlı):**
| Platform | Screenshot Kaynağı | Format |
|----------|-------------------|--------|
| WordPress | `platformData.screenshots` | `[{src, caption}]` |
| Wix | `platformData.screenshots` | `[url]` |
| Canva | `platformData.screenshots` | `[url]` |
| Google Workspace | `platformData.screenshots` | `[url]` |
| Salesforce | `platformData.plugins.carousel` | `[{url, title}]` |
| Atlassian | Çeşitli media field'lar | Karışık |
| Shopify | Description içinde embed | Parse gerekli |
| Diğerleri | Değişken | — |

**Çözüm:**
1. `appSnapshots` tablosuna normalize `screenshots` field'ı ekle (string array)
2. Her platform için screenshot extractor yaz (scraper'da)
3. Mevcut veriyi backfill et (migration)
4. Public sayfalarda lazy-loaded image gallery component'i

**Image SEO bonus:**
- `<img alt="{App Name} screenshot - {Platform}">` — Image search trafiği
- Next.js `<Image>` component ile WebP, lazy loading, responsive sizing
- Open Graph image olarak ilk screenshot kullanılabilir

---

## 5. Faz 2: Kategori & Developer Sayfaları

> **Süre:** 1-2 hafta | **Öncelik:** High
> **Bağımlılık:** Faz 1 (public API + JSON-LD components)
> **SEO Etkisi:** Yüksek — "best [category] apps" keyword'leri

---

### 5.1 Public Kategori Sayfaları — PLA-321

**URL Pattern:** `/categories/{platform}/{slug}`
**Örnek:** `/categories/shopify/email-marketing`

#### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Shopify > Categories > Email Mktg    │
├─────────────────────────────────────────────────────────┤
│ # Email Marketing Apps for Shopify                      │
│ 847 apps • Average rating: 4.2★ • Updated daily        │
├─────────────────────────────────────────────────────────┤
│ ## Overview                                             │  ← AI-generated (PLA-328)
│ The Shopify email marketing category includes 847 apps  │
│ ranging from free solutions to enterprise platforms...  │
├─────────────────────────────────────────────────────────┤
│ ## Top 10 Email Marketing Apps                          │
│ | # | App       | Rating | Reviews | Pricing    |      │
│ | 1 | Klaviyo   | 4.6★   | 2,847   | Free-$150  |      │
│ | 2 | Omnisend  | 4.8★   | 6,892   | Free-$59   |      │
│ | 3 | Mailchimp | 3.8★   | 1,205   | Free-$350  |      │
│ | ...                                              |     │
│ (her satır app profil sayfasına link)                   │
├─────────────────────────────────────────────────────────┤
│ ## Subcategories                                        │
│ SMS Marketing (234) • Marketing Automation (456) •      │
│ Newsletter (123) • Popup & Forms (345)                  │
├─────────────────────────────────────────────────────────┤
│ ## Category Statistics                                  │
│ Free apps: 312 (37%) | Paid: 535 (63%)                 │
│ Average price: $29/mo | Rating distribution: [chart]    │
├─────────────────────────────────────────────────────────┤
│ ## FAQ                                                  │
│ ▸ What is the best email marketing app for Shopify?     │
│ ▸ Are there free email marketing apps?                  │
│ ▸ How much do email marketing apps cost?                │
├─────────────────────────────────────────────────────────┤
│ [See full category analysis — Sign up free]             │
└─────────────────────────────────────────────────────────┘
```

#### Meta Tag'ler
```html
<title>Best Email Marketing Apps for Shopify (2026) - Top 10 Ranked | AppRanks</title>
<meta name="description" content="Compare 847 email marketing apps for Shopify. #1 Klaviyo (4.6★, 2,847 reviews). From free to $150/mo. Updated March 2026." />
```

#### Structured Data
- `ItemList` JSON-LD (top 10 app)
- `BreadcrumbList` JSON-LD
- `FAQPage` JSON-LD (PLA-333 sonrası)

**Tahmini sayfa sayısı:** ~2,000+ (tüm platformlar × tüm kategoriler)

**Hedef keyword'ler:**
- `best email marketing apps for shopify`
- `top shopify email apps`
- `shopify email marketing tools 2026`

---

### 5.2 Public Developer Profil Sayfaları — PLA-323

**URL Pattern:** `/developers/{platform}/{slug}`
**Örnek:** `/developers/shopify/klaviyo`

#### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Shopify > Developers > Klaviyo       │
├─────────────────────────────────────────────────────────┤
│ # Klaviyo — Shopify App Developer                       │
│ 12 apps on Shopify • Average rating: 4.4★              │
│ 🌐 klaviyo.com                                          │
├─────────────────────────────────────────────────────────┤
│ ## Apps by Klaviyo                                       │
│ | App                    | Rating | Reviews | Category  │
│ | Klaviyo Email & SMS    | 4.6★   | 2,847   | Email     │
│ | Klaviyo Reviews        | 4.2★   | 312     | Reviews   │
│ | ...                                                   │
├─────────────────────────────────────────────────────────┤
│ ## Developer Stats                                      │  ← PLA-335 (enriched)
│ Total reviews: 3,459 • Founded: 2012 • Boston, MA      │
│ Also on: WordPress, Salesforce [cross-platform badge]   │
├─────────────────────────────────────────────────────────┤
│ [Track Klaviyo's apps — Sign up free]                   │
└─────────────────────────────────────────────────────────┘
```

**Meta Tag'ler:**
```html
<title>Klaviyo Apps for Shopify - 12 Apps, 4.4★ Average Rating | AppRanks</title>
<meta name="description" content="Klaviyo has 12 apps on Shopify with 3,459 total reviews. See all apps, ratings, and detailed analysis." />
```

**Structured Data:** `Organization` + `ItemList` JSON-LD

**Tahmini sayfa sayısı:** ~10,000+

**Hedef keyword'ler:** `klaviyo shopify apps`, `[developer name] apps`

---

## 6. Faz 3: Karşılaştırma, Best-Of & AI Content

> **Süre:** 2-3 hafta | **Öncelik:** High
> **Bağımlılık:** Faz 1-2 (app + kategori sayfaları) + PLA-328 (AI pipeline)
> **SEO Etkisi:** Çok Yüksek — "[app] vs [app]" ve "best [category] apps" en değerli keyword'ler

Bu faz, en yüksek ticari niyetli (commercial intent) keyword'leri hedefler. Bir kullanıcı "Klaviyo vs Mailchimp" ararken satın alma kararının eşiğindedir.

---

### 6.1 App Karşılaştırma Sayfaları — PLA-325

**URL Pattern:** `/compare/{platform}/{app1-slug}-vs-{app2-slug}`
**Örnek:** `/compare/shopify/klaviyo-email-marketing-sms-vs-mailchimp-email-marketing`

#### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│ # Klaviyo vs Mailchimp: Which is Better for Shopify?    │
│ Updated March 2026 • Based on 4,052 total reviews       │
├─────────────────────────────────────────────────────────┤
│ ## Quick Comparison                                     │
│ ┌──────────────┬───────────────┬───────────────┐        │
│ │              │   Klaviyo     │   Mailchimp   │        │
│ ├──────────────┼───────────────┼───────────────┤        │
│ │ Rating       │ ★★★★½ 4.6   │ ★★★★ 3.8     │        │
│ │ Reviews      │ 2,847        │ 1,205         │        │
│ │ Free Plan    │ ✅ 250 contct│ ✅ 500 contct │        │
│ │ Starting     │ $20/mo       │ $13/mo        │        │
│ │ Launched     │ 2014         │ 2019          │        │
│ │ Categories   │ Email, SMS   │ Email, Ads    │        │
│ └──────────────┴───────────────┴───────────────┘        │
├─────────────────────────────────────────────────────────┤
│ ## Summary (AI-generated)                               │  ← PLA-328
│ Klaviyo leads in rating and review sentiment, with      │
│ users praising its automation capabilities. Mailchimp   │
│ offers a lower starting price and more generous free... │
├─────────────────────────────────────────────────────────┤
│ ## Feature Comparison                                   │
│ | Feature          | Klaviyo | Mailchimp |              │
│ | Email campaigns  | ✅      | ✅        |              │
│ | SMS              | ✅      | ❌        |              │
│ | A/B testing      | ✅      | ✅        |              │
│ | Segmentation     | ✅      | ✅        |              │
│ | Automation flows | ✅      | ✅ (basic) |             │
├─────────────────────────────────────────────────────────┤
│ ## Pricing Comparison                                   │
│ [Detaylı plan × plan tablosu]                           │
├─────────────────────────────────────────────────────────┤
│ ## What Users Say                                       │  ← PLA-329 (sentiment)
│ Klaviyo Pros: Easy automation, great templates          │
│ Klaviyo Cons: Expensive at scale                        │
│ Mailchimp Pros: Generous free plan, simple UI           │
│ Mailchimp Cons: Limited automation, reliability issues  │
├─────────────────────────────────────────────────────────┤
│ ## Shared Categories                                    │
│ Both apps are in: Email Marketing, Marketing Automation │
├─────────────────────────────────────────────────────────┤
│ ## Other Alternatives                                   │
│ Omnisend (4.8★) • Drip (4.5★) • ActiveCampaign (4.3★) │
│ [Compare Klaviyo vs Omnisend →]                         │
├─────────────────────────────────────────────────────────┤
│ ## FAQ                                                  │
│ ▸ Is Klaviyo better than Mailchimp?                     │
│ ▸ Which is cheaper, Klaviyo or Mailchimp?               │
│ ▸ Can I switch from Mailchimp to Klaviyo?               │
├─────────────────────────────────────────────────────────┤
│ Similarity score: 78% • Based on categories, features,  │
│ keywords, and description analysis                       │
└─────────────────────────────────────────────────────────┘
```

#### Sayfa Üretim Stratejisi
Tüm olası çiftleri üretmek yerine akıllı filtreleme:
1. **Yüksek benzerlik skoru** (> 0.5) olan çiftler — `appSimilarityScores` tablosundan
2. **Aynı kategoride top 20** app'lerin kombinasyonları
3. **Herhangi geçerli slug çifti** için on-demand generation (ISR)

`generateStaticParams` ile top 10,000 çift pre-render, geri kalanı ISR ile lazy generation.

**Meta Tag'ler:**
```html
<title>Klaviyo vs Mailchimp for Shopify: Comparison (2026) | AppRanks</title>
<meta name="description" content="Klaviyo (4.6★, 2,847 reviews) vs Mailchimp (3.8★, 1,205 reviews). Compare features, pricing, pros & cons for Shopify." />
```

**Tahmini sayfa sayısı:** ~10,000-50,000

---

### 6.2 Best-Of Listicle Sayfaları — PLA-327

**URL Pattern:** `/best/{platform}/{category-slug}`
**Örnek:** `/best/shopify/email-marketing`

Bu sayfalar, "best shopify email marketing apps 2026" gibi **en yüksek hacimli ve en rekabetçi** keyword'leri hedefler.

#### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│ # 10 Best Email Marketing Apps for Shopify (2026)       │
│ Last updated: March 29, 2026 • Based on 15,000+ reviews│
├─────────────────────────────────────────────────────────┤
│ ## Overview                                             │  ← AI-generated (PLA-328)
│ We analyzed 847 email marketing apps on Shopify's app   │
│ store, comparing ratings, reviews, pricing, and         │
│ features. Here are the top 10 picks for 2026...         │
├─────────────────────────────────────────────────────────┤
│ ## Quick Comparison                                     │
│ | # | App       | Rating | Reviews | Price   | Best For│
│ | 1 | Klaviyo   | 4.6★   | 2,847   | Free+   | Overall │
│ | 2 | Omnisend  | 4.8★   | 6,892   | Free+   | Value   │
│ | 3 | Privy     | 4.6★   | 24,789  | Free+   | Popups  │
│ | ...                                                   │
├─────────────────────────────────────────────────────────┤
│ ## 1. Klaviyo: Email Marketing & SMS                    │  ← AI mini-review (PLA-328)
│ ★★★★½ 4.6 • 2,847 reviews • Free – $150/mo            │
│ Klaviyo is our top pick for Shopify email marketing.    │
│ With deep e-commerce integration and powerful           │
│ automation flows, it's ideal for growing stores...      │
│ ✅ Pros: Advanced automation, SMS included              │
│ ❌ Cons: Expensive for large lists                      │
│ [View full profile →] [Compare with alternatives →]     │
│                                                         │
│ ## 2. Omnisend: Email Marketing & SMS                   │
│ ★★★★★ 4.8 • 6,892 reviews • Free – $59/mo             │
│ Omnisend offers the best value in email marketing...    │
│ [...]                                                   │
├─────────────────────────────────────────────────────────┤
│ ## Pricing Comparison                                   │
│ [Detaylı fiyat tablosu — Free, Starter, Pro, Enterprise]│
├─────────────────────────────────────────────────────────┤
│ ## How We Ranked                                        │
│ Apps are ranked by AppRanks Power Score™, which         │
│ considers: rating (30%), review volume (25%), review    │
│ momentum (20%), category ranking (15%), features (10%)  │
├─────────────────────────────────────────────────────────┤
│ ## FAQ                                                  │  ← PLA-333
│ ▸ What is the best email marketing app for Shopify?     │
│ ▸ Is there a free email marketing app for Shopify?      │
│ ▸ How much do Shopify email marketing apps cost?        │
│ ▸ Klaviyo vs Omnisend: which is better?                 │
├─────────────────────────────────────────────────────────┤
│ [Track these apps & get weekly updates — Sign up free]  │
└─────────────────────────────────────────────────────────┘
```

**Sıralama kriteri:** Power Score (mevcut `appPowerScores` tablosu)

**Meta Tag'ler:**
```html
<title>10 Best Email Marketing Apps for Shopify (2026) | AppRanks</title>
<meta name="description" content="Compare the best email marketing apps for Shopify. #1 Klaviyo (4.6★), #2 Omnisend (4.8★). Pricing from free. Updated March 2026." />
```

**Structured Data:** `ItemList` JSON-LD + `FAQPage` JSON-LD

**Tahmini sayfa sayısı:** ~500-1,000 (ana kategoriler × platformlar)

---

### 6.3 AI Content Generation Pipeline — PLA-328

**Ne:** Karşılaştırma metinleri, best-of özet yazıları, app mini-review'ları ve kategori açıklamalarını otomatik olarak üreten batch pipeline.

**Neden ayrı bir task:**
- PLA-325 ve PLA-327 sayfaları AI-generated içerik olmadan "thin content" olur
- Google thin content'i cezalandırır — sadece tablo/veri yetmez, doğal dil gerekli
- Manuel yazım 50,000+ sayfa için imkansız

**Content tipleri:**

| Tip | Örnek | Üretim Sıklığı | Kaynak Veri |
|-----|-------|----------------|------------|
| App summary | "Klaviyo is an email marketing platform..." | Ayda 1 | appIntroduction + features + categories |
| Category overview | "The Shopify email marketing category..." | Ayda 1 | Category stats + top apps |
| Mini-review | "Omnisend offers the best value..." | Ayda 1 | Rating + reviews + pricing + features |
| Comparison text | "Klaviyo leads in automation while..." | Ayda 1 | Both apps' data + similarity score |
| FAQ answers | "Based on 2,847 reviews, Klaviyo is..." | Ayda 1 | Veriye dayalı cevaplar |

**Kalite kontrol:**
- Her üretilen metin gerçek veriye dayalı olmalı (rating, review sayısı, fiyat)
- Hallücinasyon kontrolü — prompt'ta sadece verilen datayla sınırlı kalma talimatı
- Veri snapshot tarihi içerikle birlikte saklanır
- Değişmeyen veri için gereksiz re-generation yapılmaz

**Storage:** Yeni `seo_content` tablosu (entity_type, entity_id, platform, content_type, content, metadata, generated_at)

---

## 7. Faz 4: Veri Zenginleştirme

> **Süre:** 2-3 hafta | **Öncelik:** High-Medium
> **Bağımlılık:** Faz 1 (public sayfalar var olmalı ki zenginleştirilmiş veri gösterilebilsin)
> **Paralel çalışabilir:** Faz 3 ile aynı anda yürütülebilir

Bu faz, mevcut veri setini genişleterek public sayfaların içerik kalitesini artırır. Her yeni veri katmanı, hem SEO hem AEO için farklılaştırıcı değer yaratır.

---

### 7.1 Review Sentiment Analizi (AI-Powered) — PLA-329

**Bu fazın en yüksek etkili task'ı.** Hiçbir rakip platform, AI-powered review sentiment analizi sunmuyor.

**Ne üretilecek (her app için):**

| Alan | Açıklama | Örnek |
|------|----------|-------|
| `sentiment_score` | 0-100 arası genel memnuniyet | 82/100 |
| `sentiment_trend` | Son 90 gün trend | "improving" |
| `pros` | Top 5 pozitif tema + frekans | [{theme: "Easy setup", count: 34, quote: "..."}] |
| `cons` | Top 5 negatif tema + frekans | [{theme: "Expensive", count: 18, quote: "..."}] |
| `use_cases` | Kullanıcıların gerçek kullanım senaryoları | ["Email campaigns", "SMS automation"] |
| `key_quotes` | 3-5 temsili review alıntısı | [{quote: "...", rating: 5, sentiment: "positive"}] |

**Kullanım yerleri:**
- **App profil sayfası:** "What Users Say" bölümü — en farklılaştırıcı içerik
- **Karşılaştırma sayfası:** Her iki app'in pros/cons'ları yan yana
- **Best-of sayfası:** Mini-review'larda pros/cons referansı
- **AEO:** "Is [app] good?" sorusuna doğrudan cevap

**SEO hedef keyword'ler:** `[app] pros and cons`, `[app] problems`, `is [app] good`, `[app] reviews summary`

**Teknik:** Batch Claude API processing — her app için son 100 review analiz edilir. Yeni `app_review_sentiment` tablosunda saklanır. Ayda 1 veya review sayısı >10% değiştiğinde yeniden üretilir.

---

### 7.2 Changelog & Version History — PLA-331

**Ne:** App'lerin güncelleme geçmişi, versiyon notları, release tarihleri.

**Mevcut durum:** Sadece `currentVersion` field'ı var. Geçmiş versiyonlar, changelog metinleri yok.

**Platform bazlı fırsatlar:**

| Platform | Changelog Kaynağı | Erişim Yöntemi |
|----------|-------------------|----------------|
| WordPress | Plugin API `changelog` field | API — zaten mevcut, çekilmiyor |
| Shopify | Description veya ayrı section | HTML parse |
| Atlassian | Marketplace API version history | API |
| Diğerleri | `currentVersion` snapshot diff | Mevcut veri — hesaplanabilir |

**Üretilecek metrikler:**
- `update_frequency_days` — Ortalama güncelleme sıklığı (gün)
- `last_updated_days_ago` — Son güncelleme kaç gün önce
- `total_versions` — Toplam versiyon sayısı

**Kullanım yerleri:**
- App profilinde "Last updated X days ago" (freshness sinyali)
- "Recently updated [category] apps" liste sayfaları
- AEO: "When was [app] last updated?" sorusu

**Storage:** Yeni `app_changelogs` tablosu (app_id, version, release_date, changelog_text, change_type)

---

### 7.3 FAQ Extraction & AI FAQ Generation — PLA-333

**Ne:** Platform kaynaklı FAQ'ların çıkarılması + her app/kategori için AI-generated FAQ'lar.

**Neden çok önemli:**
- `FAQPage` JSON-LD schema → Google Featured Snippets'ta görünme
- AEO motorları soru-cevap formatını doğrudan kullanır
- "How to...", "What is...", "Is [app] good?" sorularını yakalar

**İki aşamalı yaklaşım:**

#### Aşama 1: Platform FAQ Extraction
- **WordPress:** `faq` field API'da mevcut ama çekilmiyor — extract et
- **Diğer platformlar:** Description içindeki FAQ bölümlerini regex/AI ile parse et

#### Aşama 2: AI FAQ Generation (her app ve kategori için)

**Per-app FAQ'lar (3-5 soru):**
```
Q: What does Klaviyo do?
A: Klaviyo is an email marketing and SMS platform for Shopify stores. It offers automated email campaigns, SMS messaging, customer segmentation, and analytics. [data-driven, specific]

Q: How much does Klaviyo cost?
A: Klaviyo offers a free plan for up to 250 contacts. Paid plans start at $20/month for Email and $15/month for SMS. Enterprise pricing is custom. [actual pricing data]

Q: Is Klaviyo good? What do users say?
A: Klaviyo has a 4.6★ rating from 2,847 reviews on Shopify. Users praise its easy setup (34% of reviews) and great templates (28%), but some find it expensive at scale (18%). [sentiment data from PLA-329]

Q: What are the best alternatives to Klaviyo?
A: Top alternatives include Omnisend (4.8★, 6,892 reviews), Mailchimp (3.8★, 1,205 reviews), and Drip (4.5★, 312 reviews). [similarity data]
```

**Per-category FAQ'lar (3-5 soru):**
```
Q: What is the best email marketing app for Shopify?
A: Based on our Power Score analysis, the top email marketing apps for Shopify are: 1) Klaviyo (4.6★), 2) Omnisend (4.8★), 3) Privy (4.6★). [power score data]

Q: Are there free email marketing apps for Shopify?
A: Yes, 312 out of 847 email marketing apps (37%) offer free plans. Top free options: Shopify Email (4.1★), Klaviyo Free (4.6★, up to 250 contacts), Omnisend Free (4.8★, up to 250 contacts). [actual data]
```

**Storage:** `seo_content` tablosunda `content_type = 'faq'`, JSONB format: `[{question, answer}]`

---

### 7.4 Developer Profil Zenginleştirme — PLA-335

**Ne:** Developer profillerine ek metadata eklenmesi.

**Mevcut durum:** Sadece `name` ve `website`.

**Zaten platformData'da var ama normalize edilmemiş:**

| Platform | Mevcut Ek Veri |
|----------|---------------|
| Salesforce | `employees`, `yearFounded`, `location`, `country` |
| Atlassian | Vendor address, phone, SLA URL, trust center |
| Canva | Developer email, phone, address |
| Google Workspace | Developer website, support URLs |

**Eklenecek computed metrikler:**
- `total_apps` — Developer'ın toplam app sayısı
- `total_reviews` — Tüm app'leri üzerinden toplam review
- `average_rating` — Tüm app'lerin ortalama rating'i
- `platforms_present` — Hangi platformlarda app'i var (cross-platform badge)

**Kullanım:** Developer profil sayfasında (PLA-323) daha zengin içerik, trust sinyalleri.

---

## 8. Faz 5: Trend & Keyword Insight Sayfaları

> **Süre:** 1-2 hafta | **Öncelik:** Medium
> **Bağımlılık:** Faz 1-2 (app + kategori sayfaları)
> **SEO Etkisi:** Orta — düşük rekabet ama düşük volume

---

### 8.1 Platform Trend & İstatistik Sayfaları — PLA-337

**URL Pattern:** `/trends/{platform}`
**Örnek:** `/trends/shopify`

**İçerik bölümleri:**

1. **Platform Overview**
   - Toplam app sayısı, ortalama rating, toplam kategori, toplam developer
   - Free vs paid dağılımı (pie chart)
   - Rating dağılım histogramı

2. **Trending Now**
   - 🔥 En hızlı büyüyen app'ler (review velocity bazlı)
   - 🆕 Son 30 günde launch edilen app'ler
   - ⭐ En yüksek rating'li app'ler (min 50 review)
   - 📈 En hızlı büyüyen kategoriler

3. **Category Breakdown**
   - Top 10 kategori (app sayısı, ortalama rating)
   - Kategori büyüme trendi

4. **Pricing Insights**
   - Ortalama aylık fiyat by kategori
   - Free plan oranı by kategori
   - Pricing trend (yıllar içinde ortalama fiyat değişimi)

**Meta Tag'ler:**
```html
<title>Shopify App Store Statistics & Trends (2026) | AppRanks</title>
<meta name="description" content="Shopify App Store has 15,000+ apps with 4.2★ average rating. See trends, top categories, fastest growing apps, and market insights. Updated daily." />
```

**Hedef keyword'ler:** `shopify app store statistics`, `shopify marketplace trends 2026`, `how many shopify apps are there`

**Tahmini sayfa sayısı:** ~11 (her platform için bir tane) + alt sayfalar

---

### 8.2 Keyword Insight Sayfaları — PLA-340

**URL Pattern:** `/insights/{platform}/keywords/{slug}`
**Örnek:** `/insights/shopify/keywords/email-marketing`

**İçerik:**
- Keyword/search term
- Toplam sonuç sayısı (platformda)
- Top 10 sıralanan app (ad, icon, rating, pricing)
- Auto-suggestion'lar (ilişkili arama terimleri)
- İlgili keyword'ler (keyword tags'ten)
- CTA: "Track this keyword"

**Meta Tag'ler:**
```html
<title>Best Shopify Apps for "email marketing" (2026) — Top 10 Results | AppRanks</title>
<meta name="description" content="1,234 apps found for 'email marketing' on Shopify. #1 Klaviyo (4.6★). Compare top results and find the best email marketing app." />
```

**Hedef keyword'ler:** `shopify apps for email marketing`, `best email marketing shopify app`

**Tahmini sayfa sayısı:** ~5,000+ (tracked keyword'ler)

---

## 9. Faz 6: Otomasyon, Monitoring & Ölçekleme

> **Süre:** Ongoing | **Öncelik:** Medium-Low
> **Bağımlılık:** Faz 1-5 tamamlanmış olmalı

---

### 9.1 Content Freshness Otomasyonu — PLA-341

**Ne:** Public sayfaların otomatik olarak güncel tutulması.

**Neden kritik:**
- Google stale content'i sıralamadan düşürür
- AI motorları `dateModified` ve "last updated" timestamp'ına bakar
- Kullanıcı güveni: "Data last updated: 3 months ago" → güvensizlik

**ISR (Incremental Static Regeneration) stratejisi:**

| Sayfa Tipi | Revalidation Süresi | Neden |
|-----------|-------------------|-------|
| App profili | 24 saat | Rating/review günlük değişir |
| Kategori | 12 saat | App sıralaması sık değişir |
| Best-of | 7 gün | Top 10 nadiren değişir |
| Comparison | 7 gün | Karşılaştırma verileri yavaş değişir |
| Trends | 6 saat | İstatistikler sık güncellenmeli |
| Keyword insight | 24 saat | Sıralama günlük değişir |

**On-demand revalidation:**
- Scrape tamamlandıktan sonra worker, değişen app/kategori sayfalarını revalidate eder
- API: `POST /api/revalidate?path=/apps/shopify/klaviyo&secret=...`

**Dynamic year in titles:**
- "Best Email Marketing Apps (2026)" → Yıl otomatik güncellenir
- Title'da güncel yıl → CTR artışı (kullanıcılar güncel içerik tercih eder)

---

### 9.2 Google Search Console Entegrasyonu — PLA-344

**Ne:** SEO performansının izlenmesi ve sorunların tespit edilmesi.

**Kurulum adımları:**
1. AppRanks.io domain'ini GSC'de verify et
2. Sitemap.xml'i submit et
3. GSC API entegrasyonu (daily data pull)

**Admin dashboard SEO paneli (`/system-admin/seo`):**
- Indexlenen sayfa sayısı vs submitted
- Top search query'ler (hangi keyword'lerden trafik geliyor)
- Crawl error'lar (404, 5xx)
- Core Web Vitals (LCP, FID, CLS)
- Sitemap health

**Alert'ler:**
- Indexed sayfa sayısı >10% düşerse
- Crawl error rate >5% olursa
- Core Web Vitals threshold aşılırsa

---

### 9.3 Internal Linking Stratejisi — PLA-346

**Ne:** Public sayfalar arası sistematik, SEO-optimized bağlantı ağı.

**Neden kritik:**
- Internal link'ler Google'a sayfa ilişkilerini gösterir
- Link equity (PageRank) önemli sayfalara dağıtılır
- Kullanıcılar sitede daha uzun kalır (bounce rate düşer)
- Orphan page'ler (hiçbir yerden bağlantı almayan) indexlenmez

**Linking matrisi:**

| Kaynak Sayfa | Hedef Sayfalar |
|-------------|---------------|
| **App profili** | Kategorileri, developer'ı, top 5 benzer app, top 3 comparison, best-of sayfası |
| **Kategori** | Top 10 app profili, alt kategoriler, parent kategori, best-of, comparison'lar |
| **Comparison** | Her iki app profili, ortak kategoriler, diğer comparison'lar |
| **Best-of** | 10 app profili, kategori, comparison'lar, developer'lar |
| **Developer** | Tüm app profilleri, app'lerin kategorileri |
| **Trend** | Trending app profilleri, büyüyen kategoriler |
| **Keyword insight** | Top 10 app profili, ilgili keyword'ler |

**Teknik:**
- `<RelatedLinks>` reusable component
- `<Breadcrumbs>` component + JSON-LD
- Anchor text'ler descriptive ve keyword-rich ("`Compare Klaviyo vs Mailchimp`" not "`click here`")
- Her sayfa en az 2 farklı kaynaktan link almalı (orphan page olmamalı)

---

### 9.4 Dinamik OG Image Generation — PLA-347

**Ne:** URL paylaşıldığında sosyal medyada gösterilen dinamik önizleme görseli.

**Teknik:** Next.js `ImageResponse` API (Vercel OG / `@vercel/og`)

**3 image tipi:**

1. **App profili (1200×630):**
   - App icon (büyük), app adı, developer
   - Yıldız rating görseli, review sayısı
   - Platform badge, AppRanks branding

2. **Comparison (1200×630):**
   - İki app icon yan yana, "VS" badge
   - Her ikisinin rating'i
   - AppRanks branding

3. **Kategori/Best-of (1200×630):**
   - Kategori adı, top 3 app icon'u
   - App sayısı badge, platform badge
   - AppRanks branding

**Route:** `/api/og?type=app&platform=shopify&slug=klaviyo`
**Cache:** 24 saat CDN cache

---

## 10. AEO (Answer Engine Optimization) Stratejisi

AEO, SEO'nun tamamlayıcısı. AI arama motorları (ChatGPT Search, Perplexity, Google AI Overviews, Bing Copilot) kullanıcı sorularına doğrudan yanıt üretir. Bu yanıtlarda **kaynak** olarak seçilmek için:

### 10.1 AEO İçin Kritik Faktörler

| Faktör | Nasıl Sağlanacak | İlgili Task |
|--------|-----------------|------------|
| **Yapısal veri** | JSON-LD schema tüm sayfalarda | **PLA-313** |
| **Soru-cevap formatı** | FAQ section + FAQPage schema | **PLA-333** |
| **Otoritatif, fact-based** | Tüm içerik gerçek veriye dayalı | **PLA-328**, **PLA-329** |
| **Taze veri** | ISR + "last updated" timestamp | **PLA-341** |
| **AI bot erişimi** | llms.txt + robots.txt | **PLA-311**, **PLA-309** |
| **Semantic HTML** | Doğru heading hiyerarşisi, `<table>`, `<dl>` | Tüm page task'ları |

### 10.2 AI-Friendly Content Patterns

Her public sayfada şu pattern uygulanacak:

1. **TL;DR / Summary bloğu** — Sayfanın en üstünde 2-3 cümlelik özet. AI botları genellikle ilk paragrafı alıntılar.
2. **Key Facts tablosu** — Yapısal bilgi (rating, price, category, launch date). AI botları tablo formatını iyi parse eder.
3. **FAQ section** — 3-5 soru ve data-driven cevap. "Is [app] good?" gibi yaygın sorulara doğrudan cevap.
4. **"Last updated" timestamp** — Tazelik sinyali. AI motorları güncel kaynakları tercih eder.
5. **Karşılaştırma tabloları** — Feature × App grid. AI motorları karşılaştırma sorularında tablo verisi kullanır.

### 10.3 Hedef AEO Soruları

| Soru Tipi | Örnek | Cevap Kaynağı |
|-----------|-------|--------------|
| "What is the best X for Y?" | "What is the best email app for Shopify?" | Best-of sayfası (PLA-327) |
| "X vs Y" | "Klaviyo vs Mailchimp" | Comparison sayfası (PLA-325) |
| "Is X good?" | "Is Klaviyo good?" | App profili + sentiment (PLA-317, PLA-329) |
| "How much does X cost?" | "How much does Klaviyo cost?" | App profili pricing bölümü (PLA-317) |
| "What are alternatives to X?" | "Klaviyo alternatives" | App profili alternatives bölümü + comparison |
| "How many apps on X?" | "How many apps on Shopify?" | Trends sayfası (PLA-337) |

---

## 11. URL Mimarisi & Internal Linking

### 11.1 URL Yapısı

```
Statik Sayfalar:
/                                          → Landing page (mevcut)
/privacy                                   → Privacy policy (mevcut)
/terms                                     → Terms of service (mevcut)

Public SEO Sayfaları:
/apps/{platform}/{slug}                    → App profili (PLA-317)
/categories/{platform}/{slug}              → Kategori sayfası (PLA-321)
/developers/{platform}/{slug}              → Developer profili (PLA-323)
/compare/{platform}/{slug1}-vs-{slug2}     → Karşılaştırma (PLA-325)
/best/{platform}/{category-slug}           → Best-of listesi (PLA-327)
/trends/{platform}                         → Platform trendleri (PLA-337)
/insights/{platform}/keywords/{slug}       → Keyword insight (PLA-340)

Authenticated Sayfalar (mevcut, değişmez):
/{platform}/apps/{slug}                    → Dashboard app detay
/{platform}/categories/{slug}              → Dashboard kategori
/{platform}/keywords/{slug}                → Dashboard keyword
/settings                                  → Kullanıcı ayarları
```

**Neden ayrı URL pattern?**
- Public sayfalar: `/apps/shopify/klaviyo` (SEO-friendly, platform prefix'li)
- Dashboard sayfalar: `/shopify/apps/klaviyo` (mevcut, auth gerektiren)
- Karışıklık yok, canonical URL'ler net

### 11.2 Sayfa Sayısı Tahmini

| Sayfa Tipi | Tahmini Sayfa Sayısı | İlgili Task |
|-----------|---------------------|------------|
| App profilleri | ~50,000 | PLA-317 |
| Kategoriler | ~2,000 | PLA-321 |
| Developer profilleri | ~10,000 | PLA-323 |
| Karşılaştırmalar | ~10,000-50,000 | PLA-325 |
| Best-of listeleri | ~500-1,000 | PLA-327 |
| Trend sayfaları | ~50 | PLA-337 |
| Keyword insight'lar | ~5,000 | PLA-340 |
| **TOPLAM** | **~77,000-118,000** | |

---

## 12. Keyword Fırsatları & Trafik Tahminleri

### 12.1 Keyword Pattern'leri ve Hedef Sayfalar

| Keyword Pattern | Tahmini Aylık Volume | Rekabet | Hedef Sayfa | İlgili Task |
|----------------|---------------------|---------|------------|------------|
| `[app name] review` | 100-10,000/app | Orta | App profili | PLA-317 |
| `[app name] pricing` | 50-5,000/app | Düşük | App profili | PLA-317 |
| `[app name] alternatives` | 50-5,000/app | Orta | Comparison + App profili | PLA-325, PLA-317 |
| `[app name] vs [app name]` | 100-2,000/çift | Düşük | Comparison | PLA-325 |
| `[app name] pros and cons` | 50-1,000/app | Düşük | App profili | PLA-317, PLA-329 |
| `is [app name] good` | 50-500/app | Düşük | App profili | PLA-317, PLA-329 |
| `best [category] apps for [platform]` | 500-10,000 | Yüksek | Best-of | PLA-327 |
| `top [category] [platform] apps` | 200-5,000 | Orta | Kategori | PLA-321 |
| `[category] apps [platform]` | 200-5,000 | Orta | Kategori | PLA-321 |
| `[developer] apps` | 50-500/developer | Düşük | Developer | PLA-323 |
| `[platform] app store statistics` | 200-1,000 | Düşük | Trends | PLA-337 |
| `shopify apps for [keyword]` | 200-5,000 | Orta | Keyword insight | PLA-340 |
| `[app name] changelog` | 20-200/app | Çok Düşük | App profili | PLA-331 |

### 12.2 Trafik Tahminleri

**3 ay sonra (Faz 0-2 tamamlandığında):**

| Kaynak | Tahmini Aylık Trafik |
|--------|---------------------|
| App profil sayfaları | 5,000-15,000 |
| Kategori sayfaları | 2,000-5,000 |
| Developer sayfaları | 500-2,000 |
| **TOPLAM** | **7,500-22,000** |

**6 ay sonra (Faz 0-5 tamamlandığında):**

| Kaynak | Tahmini Aylık Trafik |
|--------|---------------------|
| App profil sayfaları | 20,000-50,000 |
| Karşılaştırma sayfaları | 10,000-30,000 |
| Kategori sayfaları | 5,000-15,000 |
| Best-of sayfaları | 5,000-20,000 |
| Keyword insight sayfaları | 3,000-8,000 |
| Trend/Stats sayfaları | 2,000-5,000 |
| Developer sayfaları | 2,000-5,000 |
| **TOPLAM** | **47,000-133,000** |

### 12.3 Dönüşüm Tahminleri

| Metrik | 3 Ay | 6 Ay |
|--------|------|------|
| Organik trafik | 15,000/ay | 90,000/ay |
| Signup sayfası görüntüleme (CTR ~10%) | 1,500/ay | 9,000/ay |
| Signup dönüşüm (~3%) | 45/ay | 270/ay |
| Premium dönüşüm (~5% of signups) | 2/ay | 14/ay |

---

## 13. Başarı Metrikleri (KPI)

| Metrik | Hedef (3 ay) | Hedef (6 ay) | Hedef (12 ay) |
|--------|-------------|-------------|--------------|
| Indexed pages (GSC) | 10,000+ | 50,000+ | 80,000+ |
| Organic traffic/month | 10,000 | 50,000 | 150,000 |
| Keywords in top 10 | 500 | 3,000 | 10,000 |
| Keywords in top 3 | 50 | 500 | 2,000 |
| Featured snippets | 20 | 100 | 300 |
| AI citations (Perplexity/ChatGPT) | 10 | 50 | 200 |
| Avg organic CTR | 3% | 5% | 6% |
| Signup conversion from SEO | 2% | 3% | 4% |
| Backlinks (unique domains) | 50 | 200 | 500 |
| Core Web Vitals pass rate | 90% | 95% | 98% |
| Avg bounce rate (public pages) | <60% | <50% | <45% |

---

## 14. Riskler & Dikkat Edilecekler

### 14.1 Thin Content Riski
**Risk:** Public sayfalar yeterince içerik sunmazsa Google "thin content" olarak değerlendirir ve indexlemez.
**Mitigasyon:** AI-generated doğal dil içerik (PLA-328), FAQ'lar (PLA-333), review sentiment (PLA-329). Sadece tablo/veri değil, açıklayıcı metin de olmalı.

### 14.2 Duplicate Content
**Risk:** Aynı app farklı platformlarda varsa (ör: Klaviyo hem Shopify hem WordPress'te) benzer içerik oluşur.
**Mitigasyon:** Canonical URL'ler (PLA-314). Platform-specific veri farklılıkları (rating, review sayısı farklı) zaten unique kılar.

### 14.3 Crawl Budget
**Risk:** 80,000+ sayfa için Google'ın crawl budget'ı yetmeyebilir.
**Mitigasyon:** Sitemap priority ayarları (PLA-310). Önemli sayfalar (app profilleri, best-of) yüksek priority. Crawl rate monitoring (PLA-344).

### 14.4 AI Content Quality
**Risk:** AI-generated metinler generic, tekrarlayan veya hatalı olabilir.
**Mitigasyon:** Prompt'larda gerçek veriye referans zorunluluğu (PLA-328). Hallücinasyon kontrolü. Her üretilen metin veri snapshot'ı ile eşleştirilir.

### 14.5 Data Freshness
**Risk:** Eski veri gösteren sayfalar hem SEO'ya hem kullanıcı güvenine zarar verir.
**Mitigasyon:** ISR stratejisi (PLA-341). "Last updated" timestamp tüm sayfalarda. Scrape sonrası on-demand revalidation.

### 14.6 Freemium Balance
**Risk:** Çok fazla veri public yapılırsa premium ürünün değeri düşer.
**Mitigasyon:** Keyword ranking, visibility score, tarihsel trend, rakip karşılaştırma, alert'ler yalnızca premium. Public'te sadece snapshot (anlık) veri.

### 14.7 Google Algorithmic Penalty
**Risk:** Büyük ölçekli AI-generated content Google tarafından cezalandırılabilir.
**Mitigasyon:** İçerik "helpful content" kriterlerini karşılamalı — user-first, data-driven, unique insights. Generic "filler" text yerine spesifik, veriye dayalı analiz. Her sayfa unique veri kombinasyonu içerir.

---

## 15. Task Özet Tablosu

### Faz 0: Teknik SEO Temelleri
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-309** | robots.txt oluştur | Urgent | — |
| **PLA-310** | Dinamik XML sitemap + index | Urgent | — |
| **PLA-311** | llms.txt (AI bot discoverability) | High | — |
| **PLA-313** | JSON-LD structured data component kütüphanesi | Urgent | — |
| **PLA-314** | Open Graph & Twitter Card meta tag'leri | High | — |

### Faz 1: Public App Profile Sayfaları
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-317** | Public app profil sayfaları (`/apps/{platform}/{slug}`) | Urgent | PLA-313, PLA-318 |
| **PLA-318** | Public API endpoint'leri (auth gerektirmeyen) | Urgent | — |
| **PLA-320** | Screenshot data normalizasyonu (tüm platformlar) | High | — |

### Faz 2: Kategori & Developer Sayfaları
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-321** | Public kategori sayfaları | High | PLA-318 |
| **PLA-323** | Public developer profil sayfaları | High | PLA-318 |

### Faz 3: Karşılaştırma, Best-Of & AI Content
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-325** | App comparison sayfaları (`/compare/`) | High | PLA-317, PLA-328 |
| **PLA-327** | Best-of listicle sayfaları (`/best/`) | High | PLA-317, PLA-328 |
| **PLA-328** | AI content generation pipeline (Claude API) | High | PLA-318 |

### Faz 4: Veri Zenginleştirme
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-329** | Review sentiment analizi (AI-powered pros/cons) | High | — |
| **PLA-331** | Changelog/version history scraping | Medium | — |
| **PLA-333** | FAQ extraction + AI FAQ üretimi | Medium | PLA-328 |
| **PLA-335** | Developer profil zenginleştirme | Medium | — |

### Faz 5: Trend & Keyword Insight Sayfaları
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-337** | Public trend/istatistik sayfaları | Medium | PLA-318 |
| **PLA-340** | Public keyword insight sayfaları | Medium | PLA-318 |

### Faz 6: Otomasyon, Monitoring & Ölçekleme
| Task | Başlık | Priority | Bağımlılık |
|------|--------|----------|-----------|
| **PLA-341** | Content freshness otomasyonu (ISR) | Medium | Faz 1-5 |
| **PLA-344** | Google Search Console entegrasyonu | Medium | Faz 1 |
| **PLA-346** | Internal linking stratejisi | Medium | Faz 1-3 |
| **PLA-347** | Dinamik OG image generation | Low | PLA-314 |

---

## Sonuç

AppRanks.io **veri açısından zengin ama SEO açısından tamamen görünmez** bir platform. 11 platformdan toplanan 50,000+ app profili, 2,000+ kategori, binlerce keyword ve review verisi — hiçbiri arama motorlarına sunulmuyor.

Bu strateji, mevcut veriyi **77,000-118,000 public sayfa**ya dönüştürerek organik bir trafik motoru oluşturmayı hedefliyor. 19 task, 7 faz halinde yapılandırılmış ve her faz bir öncekinin üzerine inşa ediliyor.

**En yüksek ROI aksiyonları (ilk yapılması gerekenler):**
1. **Faz 0 (PLA-309, PLA-310, PLA-313)** — Teknik temel olmadan hiçbir şey indexlenmez
2. **Faz 1 (PLA-317, PLA-318)** — 50,000+ app profili = en büyük trafik fırsatı
3. **PLA-329 (Review Sentiment)** — En farklılaştırıcı içerik, kimse yapmıyor
4. **PLA-325 (Comparison)** — "[app] vs [app]" keyword'leri yüksek dönüşüm

Email mevcut kullanıcıları geri getirirken, SEO/AEO yeni kullanıcıları organik olarak çekecek — birlikte çift motorlu bir büyüme stratejisi.
