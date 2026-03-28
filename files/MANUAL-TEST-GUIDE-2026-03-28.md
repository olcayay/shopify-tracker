# Manuel Test Rehberi — 28 Mart 2026 Gece Değişiklikleri

> Bu doküman, 28 Mart 2026 saat 03:00'ten sonra Done'a çekilen **21 Linear task'ın** tamamını kapsar.
> Linear issue'ları okumana gerek yok — her task burada özetlenmiş ve test adımları yazılmış.

---

## İçindekiler

| # | Task | Konu | Sayfa |
|---|------|------|-------|
| 1 | PLA-109 | Available Platforms görünürlük | [Link](#1-pla-109) |
| 2 | PLA-118 | System admin sidebar her sayfada görünür | [Link](#2-pla-118) |
| 3 | PLA-117 | Platform request dialog autocomplete | [Link](#3-pla-117) |
| 4 | PLA-116 | Sidebar context-aware navigasyon | [Link](#4-pla-116) |
| 5 | PLA-110 | API: Cross-platform endpointler | [Link](#5-pla-110) |
| 6 | PLA-111 | Shared cross-platform componentler | [Link](#6-pla-111) |
| 7 | PLA-112–115 | Cross-platform listing sayfaları | [Link](#7-pla-112-115) |
| 8 | PLA-127 | Overview → cross-platform sayfa linkleri | [Link](#8-pla-127) |
| 9 | PLA-128 | Tek item varsa direkt detail sayfasına git | [Link](#9-pla-128) |
| 10 | PLA-119 | PLATFORM-DATA-MATRIX.md referans dokümanı | [Link](#10-pla-119) |
| 11 | PLA-120 | Per-platform TypeScript interfaceleri | [Link](#11-pla-120) |
| 12 | PLA-121 | Scraper parser'lar typed platformData | [Link](#12-pla-121) |
| 13 | PLA-122 | isBuiltForShopify → badges migration | [Link](#13-pla-122) |
| 14 | PLA-123 | demoStoreUrl/integrations → platformData | [Link](#14-pla-123) |
| 15 | PLA-124 | Platform-specific UI section componentleri | [Link](#15-pla-124) |
| 16 | PLA-125 | Zod validation for platformData | [Link](#16-pla-125) |
| 17 | PLA-126 | ADDING_NEW_PLATFORM.md güncellendi | [Link](#17-pla-126) |
| 18 | PLA-94 | Multi-platform UX overhaul (ana task) | [Link](#18-pla-94) |

---

## 1. PLA-109
### Available Platforms Görünürlük İyileştirmesi

**Ne değişti:** Overview sayfasındaki "Available Platforms" bölümü çok soluk görünüyordu. Opacity ve renk değerleri artırıldı.

**Değişen dosya:** `apps/dashboard/src/app/(dashboard)/overview/page.tsx`

**Detay:**
- Container: kesikli kenarlık → düz kenarlık, `bg-muted/20` → `bg-muted/30`
- Başlık: `text-sm text-muted-foreground` → `text-base text-foreground/70`
- Açıklama: `text-xs` → `text-sm`
- Satır arka planı: `bg-background/60` → `bg-background/80`
- Renk noktaları: `opacity-80` kaldırıldı
- Badge'ler: `bg-muted/60 text-muted-foreground/70` → `bg-muted text-muted-foreground`
- Grid gap: `gap-2` → `gap-3`

**Commit:** `7ab1073`

#### Test adımları:
1. [ ] Dashboard'a giriş yap → `/overview` sayfasına git
2. [ ] Sayfayı aşağı kaydır, "Available Platforms" bölümünü bul
3. [ ] **Kontrol:** Bölüm başlığı rahatça okunabiliyor mu?
4. [ ] **Kontrol:** Platform kartları (Wix, Canva, WordPress vb.) net görünüyor mu?
5. [ ] **Kontrol:** Platform renk noktaları (yeşil, mavi, turuncu) canlı ve görünür mü?
6. [ ] **Kontrol:** Badge'ler (ör. "11 categories", "Reviews") okunabilir mi?
7. [ ] **Kontrol:** Aktif platformlara göre daha az belirgin ama hala okunabilir olmalı (secondary hierarchy)

---

## 2. PLA-118
### System Admin Sidebar Her Sayfada Görünür

**Ne değişti:** System admin linkleri sadece `/system-admin/*` ve platform sayfalarında görünüyordu. Artık `/overview`, `/settings` gibi global sayfalarda da görünüyor.

**Değişen dosyalar:**
- `apps/dashboard/src/components/icon-sidebar.tsx`
- `apps/dashboard/src/components/dashboard-shell.tsx`
- `apps/dashboard/src/components/sidebar.tsx`

**Detay:**
- `icon-sidebar.tsx`: Non-platform sayfalarında admin nav itemlerini göster (eskiden `null` dönüyordu)
- `dashboard-shell.tsx`: Mobilde hamburger menü admin kullanıcılar için her sayfada gösterilir
- `sidebar.tsx`: `SystemAdminSection` component'i eklendi — admin sayfasında otomatik açılır, diğer sayfalarda toggle ile açılır/kapanır

**Commit:** `c8f71e3`

#### Test adımları:
1. [ ] **System admin** hesabıyla giriş yap
2. [ ] `/overview` sayfasına git
3. [ ] **Kontrol:** Sol sidebar'da (icon sidebar) admin ikonları görünüyor mu? (Users, Scraper, Matrix, Health)
4. [ ] İkon sidebar'daki admin ikonlarından birine tıkla → doğru admin sayfasına gitmeli
5. [ ] `/settings` sayfasına git
6. [ ] **Kontrol:** Sidebar'da admin linkleri hala görünüyor mu?
7. [ ] `/shopify/apps` gibi bir platform sayfasına git → admin linkleri hala görünmeli
8. [ ] **Mobil test:** Ekranı daralt (veya mobil emulator)
9. [ ] `/overview`'da hamburger menüsü → admin linkleri listede olmalı
10. [ ] **Normal kullanıcı ile test:** Admin olmayan kullanıcı ile giriş yap → admin linkleri **görünmemeli**

---

## 3. PLA-117
### Platform Request Dialog Autocomplete

**Ne değişti:** "Request a Platform" dialog'undaki serbest metin input'u, ~96 marketplace'lik autocomplete listesiyle değiştirildi.

**Değişen dosyalar:**
- `apps/dashboard/src/lib/marketplace-list.ts` (yeni — 96 marketplace listesi)
- `apps/dashboard/src/components/platform-request-dialog.tsx`

**Detay:**
- Kullanıcı yazdıkça filtrelenen marketplace önerileri
- Zaten enable edilmiş platformlar listeden çıkarılıyor
- Desteklenen platformlarda "Supported" badge'i
- Listede olmayan isimler "Use custom" ile kullanılabilir

**Commit:** `a2a968a`

#### Test adımları:
1. [ ] `/overview` sayfasına git
2. [ ] "Request a Platform" butonunu bul ve tıkla (Available Platforms bölümünde)
3. [ ] Dialog açılınca arama kutusuna "Big" yaz
4. [ ] **Kontrol:** "BigCommerce Apps & Integrations" önerisini görmeli
5. [ ] "Shopify" yaz → **Kontrol:** Shopify zaten enabled ise listede **görünmemeli**
6. [ ] "Atlassian" yaz → "Supported" badge'i ile görünmeli (desteklenen platform)
7. [ ] "MyCustomPlatform" yaz → "Use 'MyCustomPlatform'" seçeneği çıkmalı
8. [ ] Bir öneri seçip form'u gönder → başarılı mesaj görmeli
9. [ ] Dialog'u Escape ile kapat → temiz kapanmalı

---

## 4. PLA-116
### Sidebar Context-Aware Navigasyon

**Ne değişti:** Sidebar artık bulunduğun sayfaya göre farklı navigasyon gösteriyor: global sayfalarda global nav, platform sayfalarında platform nav.

**Değişen dosyalar:**
- `apps/dashboard/src/lib/nav-utils.ts`
- `apps/dashboard/src/components/icon-sidebar.tsx`
- `apps/dashboard/src/components/sidebar.tsx`
- `apps/dashboard/src/components/dashboard-shell.tsx`

**Detay:**
- `nav-utils.ts`: `globalNavItems` (Overview, All Apps, All Keywords, All Competitors, Developers) ve `isOnGlobalPage()` helper eklendi
- Global page'lerde (örn. `/overview`, `/apps`, `/keywords`): Sidebar global nav itemleri düz liste olarak gösterir
- Platform page'lerde (örn. `/shopify/apps`): Eski davranış, platform accordion

**Commit:** `5ed48e7`

#### Test adımları:
1. [ ] `/overview` sayfasına git
2. [ ] **Kontrol:** Sidebar'da "Overview, All Apps, All Keywords, All Competitors, Developers" linkleri düz liste olarak görünmeli
3. [ ] **Kontrol:** Platform accordion (Shopify > Apps, Keywords...) **görünmemeli**
4. [ ] `/apps` sayfasına git → aynı global nav görünmeli
5. [ ] `/keywords` sayfasına git → aynı global nav görünmeli
6. [ ] Şimdi `/shopify/apps` sayfasına git
7. [ ] **Kontrol:** Sidebar'da platform accordion görünmeli (Shopify > Apps, Keywords, Categories...)
8. [ ] **Kontrol:** Global nav itemleri **görünmemeli** (veya ikincil olmalı)
9. [ ] `/salesforce/keywords` → Salesforce accordion'u aktif olmalı
10. [ ] **Kontrol:** Active sayfa doğru highlight edilmeli

---

## 5. PLA-110
### API: Cross-Platform Endpointler

**Ne değişti:** Platform-bağımsız 3 yeni API endpoint eklendi.

**Değişen dosyalar:**
- `apps/api/src/routes/cross-platform.ts` (yeni)
- `apps/api/src/routes/developers.ts` (platforms array eklendi)
- `apps/api/src/index.ts` (route registration)

**Yeni endpointler:**
- `GET /api/cross-platform/apps` — tüm tracked + competitor app'ler
- `GET /api/cross-platform/keywords` — tüm tracked keyword'ler
- `GET /api/cross-platform/competitors` — tüm competitor app'ler

Tümü pagination, search, platform filter, sort destekliyor.

**Commit:** `9f2f152`

#### Test adımları:
1. [ ] API'ye authenticated GET isteği at: `GET /api/cross-platform/apps`
2. [ ] **Kontrol:** Response'da tüm platformlardan app'ler dönmeli
3. [ ] `?platform=shopify,canva` filtresi ekle → sadece o platformlar dönmeli
4. [ ] `?search=form` ekle → isim filtrelemesi çalışmalı
5. [ ] `?page=1&limit=10` → pagination çalışmalı
6. [ ] `GET /api/cross-platform/keywords` → tüm keyword'ler dönmeli
7. [ ] `GET /api/cross-platform/competitors` → competitor'lar "tracked for" bilgisiyle dönmeli
8. [ ] `GET /api/developers` → response'da `platforms: string[]` array olmalı (eskiden yoktu)
9. [ ] Auth olmadan istek at → 401 dönmeli

---

## 6. PLA-111
### Shared Cross-Platform Componentler

**Ne değişti:** Cross-platform sayfalar için ortak UI componentleri oluşturuldu.

**Değişen dosyalar:**
- `apps/dashboard/src/components/platform-filter-chips.tsx` (yeni)
- `apps/dashboard/src/components/platform-badge-cell.tsx` (yeni)
- `apps/dashboard/src/lib/auth-context.tsx` (PLATFORM_EXEMPT_PREFIXES güncellendi)

**Detay:**
- `platform-filter-chips.tsx`: Tıklanabilir platform chip'leri, platform renkleriyle, toggle on/off
- `platform-badge-cell.tsx`: Tablo hücrelerinde platform adı ve renkli nokta badge'i
- Auth context: `/api/cross-platform/` ve `/api/developers` endpointlerine otomatik `?platform=` eklenmesini engeller

**Commit:** `b211958`

#### Test adımları:
1. [ ] `/apps` (cross-platform) sayfasına git
2. [ ] **Kontrol:** Sayfanın üstünde platform filter chip'leri görünmeli (Shopify, Salesforce, Canva...)
3. [ ] Her chip'in platform renginde olduğunu doğrula (Shopify yeşil, Salesforce mavi vb.)
4. [ ] Bir chip'e tıkla → o platformun app'leri filtrelenmeli
5. [ ] Birden fazla chip seç → çoklu filtreleme çalışmalı
6. [ ] **Kontrol:** Tablo satırlarında platform badge'leri doğru renkte görünmeli
7. [ ] Eğer tek platform enable ise → chip'ler otomatik gizlenmeli

---

## 7. PLA-112–115
### Cross-Platform Listing Sayfaları

**Ne değişti:** 4 yeni cross-platform sayfa oluşturuldu: Developers, Apps, Keywords, Competitors.

**Yeni dosyalar:**
- `apps/dashboard/src/app/(dashboard)/developers/page.tsx`
- `apps/dashboard/src/app/(dashboard)/apps/page.tsx`
- `apps/dashboard/src/app/(dashboard)/keywords/page.tsx`
- `apps/dashboard/src/app/(dashboard)/competitors/page.tsx`

**Commit:** `131c6cc`

#### Test adımları — `/developers`:
1. [ ] `/developers` sayfasına git
2. [ ] **Kontrol:** Tüm developer'lar listelenmiş mi? (platform badge'leriyle)
3. [ ] Arama kutusuna bir developer ismi yaz → filtreleme çalışmalı
4. [ ] Bir developer'a tıkla → `/developers/{slug}` detay sayfasına gitmeli
5. [ ] Pagination varsa sonraki sayfaya geç → çalışmalı

#### Test adımları — `/apps`:
6. [ ] `/apps` sayfasına git
7. [ ] **Kontrol:** Tüm platformlardan tracked + competitor app'ler listelenmeli
8. [ ] **Kontrol:** Her satırda platform badge (renkli), app ikonu, isim, rating, review sayısı görünmeli
9. [ ] Platform filter chip'leri ile filtrele → sadece seçili platformun app'leri
10. [ ] Status filtresi varsa (All / Tracked / Competitors) → doğru filtreleme
11. [ ] App ismine tıkla → `/{platform}/apps/{slug}` detay sayfasına gitmeli
12. [ ] Sıralama (sort) çalışmalı (Rating, Reviews vb.)

#### Test adımları — `/keywords`:
13. [ ] `/keywords` sayfasına git
14. [ ] **Kontrol:** Tüm platformlardan keyword'ler listelenmeli
15. [ ] **Kontrol:** Her satırda platform badge, keyword, tracked app sayısı, total results görünmeli
16. [ ] Keyword'e tıkla → `/{platform}/keywords/{slug}` sayfasına gitmeli
17. [ ] Platform filtresi çalışmalı

#### Test adımları — `/competitors`:
18. [ ] `/competitors` sayfasına git
19. [ ] **Kontrol:** Tüm platformlardan competitor app'ler listelenmeli
20. [ ] **Kontrol:** Her competitor'ın hangi tracked app için olduğu görünmeli ("Tracked For" kolonu)
21. [ ] Competitor ismine tıkla → `/{platform}/apps/{slug}` sayfasına gitmeli

---

## 8. PLA-127
### Overview → Cross-Platform Sayfa Linkleri

**Ne değişti:** Overview sayfasındaki stat pill'leri (ör. "5 Apps", "3 Keywords") artık cross-platform sayfalara link veriyor.

**Değişen dosya:** `apps/dashboard/src/app/(dashboard)/overview/page.tsx`

**Commit:** `3cdc49d`

#### Test adımları:
1. [ ] `/overview` sayfasına git
2. [ ] Üstteki özet kartlardaki "My Apps" değerine tıkla
3. [ ] **Kontrol:** `/apps` cross-platform sayfasına gitmeli
4. [ ] Geri gel, "Tracked Keywords" değerine tıkla → `/keywords`'e gitmeli
5. [ ] "Competitor Apps" değerine tıkla → `/competitors`'e gitmeli

---

## 9. PLA-128
### Tek Item Varsa Direkt Detail Sayfasına Git

**Ne değişti:** Overview'daki platform kartlarında bir varlık türünde (Apps, Keywords, Competitors) sadece 1 item varsa, tıklama direkt detail sayfasına götürüyor.

**Değişen dosya:** `apps/dashboard/src/app/(dashboard)/overview/page.tsx`

**Commit:** `3cdc49d`

#### Test adımları:
1. [ ] Sadece **1 tracked app'i** olan bir platform bul (veya oluştur)
2. [ ] `/overview` sayfasında o platformun kartına git
3. [ ] "1 Apps" değerine tıkla
4. [ ] **Kontrol:** `/shopify/apps/{slug}` gibi doğrudan detail sayfasına gitmeli (liste sayfası değil)
5. [ ] Aynı test "1 Keywords" ve "1 Competitors" için de geçerli
6. [ ] **2+ item olan** bir platform kartında "5 Apps" tıkla → liste sayfasına (`/{platform}/apps`) gitmeli
7. [ ] "0 Apps" durumunda → yine liste sayfasına gitmeli (boş liste)

---

## 10. PLA-119
### PLATFORM-DATA-MATRIX.md Referans Dokümanı

**Ne değişti:** `files/PLATFORM-DATA-MATRIX.md` oluşturuldu — 524 satırlık, 8 bölümlük referans dokümanı.

**Commit:** `8254a1a`

**Bölümler:**
1. Universal Properties Matrix (11 platform × property tablosu)
2. Semi-Common Properties
3. Platform-Specific platformData (her platform için alan listesi)
4. Badge System Catalog
5. Snapshot Column Mapping
6. Anti-Patterns (dosya:satır referanslarıyla)
7. Best Practices (DB/API/UI/Scraper)
8. Decision Guide (Common column vs platformData)

#### Test adımları:
1. [ ] `files/PLATFORM-DATA-MATRIX.md` dosyasını aç
2. [ ] **Kontrol:** 11 platformun hepsi Section 1'deki tabloda var mı?
3. [ ] **Kontrol:** Section 3'te her platform için platformData alanları listelenmiş mi?
4. [ ] **Kontrol:** Section 6'daki anti-pattern dosya referansları hala geçerli mi? (dosya:satır)
5. [ ] Bu doküman sadece referans — çalışan kod değil, görsel doğrulama yeterli

---

## 11. PLA-120
### Per-Platform TypeScript Interfaceleri

**Ne değişti:** `packages/shared/src/types/platform-data/` altında 11 platform için TypeScript interface'leri oluşturuldu.

**Yeni dosyalar:**
- `packages/shared/src/types/platform-data/shopify.ts`
- `packages/shared/src/types/platform-data/salesforce.ts`
- `packages/shared/src/types/platform-data/canva.ts`
- ... (toplam 11 dosya + `index.ts`)

**Commit:** `550b2d6`

#### Test adımları:
1. [ ] `npm run build` çalıştır → hatasız derlenmeli
2. [ ] `npm test --filter=shared` çalıştır → `platform-data.test.ts` ve `platform-data-schemas.test.ts` geçmeli
3. [ ] **Kontrol:** `packages/shared/src/types/platform-data/index.ts` dosyasında `PlatformDataMap` type'ında 11 platform olmalı
4. [ ] `getPlatformData("shopify", data)` → `ShopifyPlatformData` türünde dönmeli (type-level)

---

## 12. PLA-121
### Scraper Parser'lar Typed platformData

**Ne değişti:** `NormalizedAppDetails` interface'ine JSDoc eklendi, parser'lar artık typed platformData çıktısı verebilir.

**Değişen dosya:** `apps/scraper/src/platforms/platform-module.ts`

**Commit:** `1ee2927`

#### Test adımları:
1. [ ] `npm run build --filter=scraper` → hatasız derlenmeli
2. [ ] `npm test --filter=scraper` → tüm testler geçmeli
3. [ ] `platform-module.ts` dosyasında `platformData` alanında JSDoc açıklaması olmalı

---

## 13. PLA-122
### isBuiltForShopify → badges Migration (Planlandı)

**Ne değişti:** Bu bir **planlanan DB migration'dır**, henüz çalıştırılmadı. SQL ve yaklaşım belgelendi.

**Plan:**
```sql
UPDATE apps SET badges = badges || '"built_for_shopify"'
WHERE is_built_for_shopify = true AND NOT badges @> '"built_for_shopify"';
-- Sonra: ALTER TABLE apps DROP COLUMN is_built_for_shopify;
```

#### Test adımları:
1. [ ] **Şu an test edilecek bir şey yok** — deploy sırasında migration çalıştırılacak
2. [ ] Migration sonrası kontrol: `SELECT count(*) FROM apps WHERE badges @> '"built_for_shopify"'` → eskiden `is_built_for_shopify=true` olan sayıyla aynı olmalı
3. [ ] Dashboard'da "Built for Shopify" badge'i hala doğru görünmeli

---

## 14. PLA-123
### demoStoreUrl/integrations → platformData Migration (Planlandı)

**Ne değişti:** Bu da **planlanan DB migration'dır**. Shopify'a özel `demoStoreUrl` ve `integrations` kolonları `platformData` JSONB'ye taşınacak.

#### Test adımları:
1. [ ] **Şu an test edilecek bir şey yok** — deploy sırasında migration çalıştırılacak
2. [ ] Migration sonrası: `SELECT platform_data->'demoStoreUrl' FROM app_snapshots WHERE ...` → eski değerler taşınmış olmalı

---

## 15. PLA-124
### Platform-Specific UI Section Componentleri

**Ne değişti:** App detail sayfasındaki platform-spesifik koşullu render mantığı, bir registry pattern'ine taşındı.

**Yeni dosyalar:**
- `apps/dashboard/src/components/platform-sections/index.ts` — registry
- `apps/dashboard/src/components/platform-sections/atlassian-sections.tsx`
- `apps/dashboard/src/components/platform-sections/salesforce-sections.tsx`
- `apps/dashboard/src/components/platform-sections/google-workspace-sections.tsx`
- `apps/dashboard/src/components/platform-sections/wordpress-sections.tsx`

**Commit:** `ff80006`

#### Test adımları:
1. [ ] Bir **Atlassian** app'inin detail sayfasını aç (örn. `/atlassian/apps/{slug}`)
2. [ ] **Kontrol:** "App Info" bölümü görünmeli (hosting, install count vb.)
3. [ ] **Kontrol:** "Trust Signals" bölümü görünmeli (Cloud Fortified, Top Vendor badge'leri varsa)
4. [ ] Bir **Salesforce** app'i aç → "Industries", "Business Needs", "Products Required" badge grid'i görünmeli
5. [ ] Bir **WordPress** app'i aç → HTML description doğru render edilmeli
6. [ ] Bir **Google Workspace** app'i aç → Links bölümü görünmeli
7. [ ] Bir **Shopify** app'i aç → platformData section'ları varsa render edilmeli, yoksa hata vermemeli
8. [ ] `npm test` → ilgili testler geçmeli

---

## 16. PLA-125
### Zod Validation for platformData

**Ne değişti:** Her 11 platform için Zod şemaları oluşturuldu. `validatePlatformData()` fonksiyonu API boundary'de non-blocking validation yapıyor.

**Değişen dosyalar:**
- `packages/shared/src/types/platform-data/schemas.ts` (yeni)
- Her platform dosyasına Zod şema eklendi

**Commit:** `4adbd9e`

**Detay:**
- Tüm şemalar `.passthrough()` kullanıyor — ekstra alanlar kabul ediliyor
- Validation başarısız olursa hata fırlatmıyor, `{ success: false, error }` dönüyor

#### Test adımları:
1. [ ] `npm test --filter=shared` çalıştır
2. [ ] **Kontrol:** `platform-data-schemas.test.ts` dosyasındaki 8 test geçmeli
3. [ ] **Kontrol:** Geçerli shopify platformData → `{ success: true }`
4. [ ] **Kontrol:** Yanlış tip (string yerine number) → `{ success: false, error: "..." }`
5. [ ] **Kontrol:** Ekstra alanlar → hala `success: true` (passthrough)

---

## 17. PLA-126
### ADDING_NEW_PLATFORM.md Güncellendi

**Ne değişti:** Platform ekleme rehberi, typed platformData workflow'u ile güncellendi.

**Değişen dosya:** `files/ADDING_NEW_PLATFORM.md`

**Eklenen bölümler:**
- Phase 1b: Typed platformData (TypeScript interface, Zod schema, PlatformDataMap, re-export)
- Phase 5: Platform-specific UI sections registration

**Commit:** `d1b9ed7`

#### Test adımları:
1. [ ] `files/ADDING_NEW_PLATFORM.md` dosyasını aç
2. [ ] **Kontrol:** Quick Checklist'te şu yeni itemlar var mı?
   - `packages/shared/src/types/platform-data/{platform}.ts` oluştur
   - Zod schema ekle
   - `PlatformDataMap`'e register et
   - `platform-sections/{platform}-sections.tsx` oluştur
3. [ ] **Kontrol:** Phase 1b ve Phase 5 bölümleri açıklamalı yazılmış mı?

---

## 18. PLA-94
### Multi-Platform UX Overhaul (Ana Task)

Bu, yukarıdaki tüm task'ları kapsayan şemsiye task'tır. Aşağıdaki büyük UX değişikliklerini içerir:

**Yapılan ana değişiklikler:**
- **TopBar + IconSidebar** hibrit navigasyon
- **Persona-adaptive overview hub** (yeni/tek platform/çok platform kullanıcıları için farklı)
- **Platform discovery sheet** (sidebar'da tracked vs available ayrımı)
- **Cross-platform sayfalar** (`/apps`, `/keywords`, `/competitors`, `/developers`)
- **Context-aware sidebar** (global vs platform sayfalarda farklı nav)
- **Platform request dialog** autocomplete
- **Typed platformData** (TypeScript + Zod)
- **Platform section registry** (UI componentleri)

#### Kapsamlı smoke test:
1. [ ] Dashboard'a giriş yap
2. [ ] `/overview` sayfası düzgün yükleniyor mu?
3. [ ] TopBar'da platform dropdown çalışıyor mu?
4. [ ] Sidebar (sol) global nav gösteriyor mu?
5. [ ] Bir platform seç → platform sayfasına git → sidebar platform nav'a geçmeli
6. [ ] Cross-platform sayfalar çalışıyor mu? (`/apps`, `/keywords`, `/competitors`, `/developers`)
7. [ ] Platform filter chip'leri çalışıyor mu?
8. [ ] App detail sayfaları platform-specific section'ları gösteriyor mu?
9. [ ] "Request a Platform" autocomplete çalışıyor mu?
10. [ ] Mobilde (dar ekran) hamburger menü çalışıyor mu?
11. [ ] System admin → admin linkleri her sayfada görünüyor mu?
12. [ ] Tüm linkler doğru sayfalara yönlendiriyor mu?

---

## Hızlı Komut Referansı

```bash
# Tüm testleri çalıştır
npm test

# Belirli paket testleri
npm test --filter=shared
npm test --filter=api
npm test --filter=scraper
npm test --filter=dashboard

# Build doğrulama
npm run build

# API'yi test et (curl)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/cross-platform/apps
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/cross-platform/keywords
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/cross-platform/competitors
```

---

## Özet Tablo

| Task | Tür | Risk | Deploy Gerekli? |
|------|-----|------|-----------------|
| PLA-109 | UI/CSS | Düşük | Hayır (frontend) |
| PLA-118 | UI/Logic | Orta | Hayır |
| PLA-117 | UI/Component | Düşük | Hayır |
| PLA-116 | UI/Navigation | Orta | Hayır |
| PLA-110 | API | Yüksek | Evet (API + DB) |
| PLA-111 | UI/Component | Düşük | Hayır |
| PLA-112–115 | UI/Pages | Orta | Hayır |
| PLA-127 | UI/Links | Düşük | Hayır |
| PLA-128 | UI/Logic | Düşük | Hayır |
| PLA-119 | Docs | Yok | Hayır |
| PLA-120 | Types | Düşük | Hayır |
| PLA-121 | Types | Düşük | Hayır |
| PLA-122 | DB Migration | **Yüksek** | Evet (migration) |
| PLA-123 | DB Migration | **Yüksek** | Evet (migration) |
| PLA-124 | UI/Component | Orta | Hayır |
| PLA-125 | Validation | Düşük | Hayır |
| PLA-126 | Docs | Yok | Hayır |
| PLA-94 | Epic | — | — |
