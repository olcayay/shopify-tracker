# Platform Data Matrix & Architecture Guide

> Reference document for app properties across all 11 marketplace platforms.
> Covers common vs platform-specific fields, DB/API/UI best practices, and anti-patterns.
>
> **Related Linear Tasks:** PLA-119 through PLA-126

---

## Table of Contents

1. [Universal Properties (9+ Platforms)](#1-universal-properties-9-platforms)
2. [Semi-Common Properties (4–8 Platforms)](#2-semi-common-properties-48-platforms)
3. [Platform-Specific Properties](#3-platform-specific-properties)
4. [Badge System](#4-badge-system)
5. [Snapshot Column Mapping](#5-snapshot-column-mapping)
6. [Anti-Patterns](#6-anti-patterns)
7. [Best Practices](#7-best-practices)
8. [Decision Guide: Common Column vs platformData](#8-decision-guide-common-column-vs-platformdata)

---

## 1. Universal Properties (9+ Platforms)

These properties are stored in the **`apps`** table and returned by every platform's parser via `NormalizedAppDetails`.

| Property | Shopify | Salesforce | Canva | Wix | WordPress | Google WS | Atlassian | Zoom | Zoho | Zendesk | HubSpot | WooCommerce | DB Column |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **name** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `apps.name` |
| **slug** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `apps.slug` |
| **iconUrl** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `apps.icon_url` |
| **developer** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `app_snapshots.developer` (JSONB) |
| **badges** | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | `apps.badges` (JSONB) |
| **averageRating** | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ✓ | — | ✓ | `apps.average_rating` |
| **ratingCount** | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ✓ | — | ✓ | `apps.rating_count` |
| **pricingHint** | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | `apps.pricing_hint` |

**Legend:** ✓ = always available, ~ = sometimes available, — = not available

---

## 2. Semi-Common Properties (4–8 Platforms)

These fields are available on multiple platforms. Some have dedicated columns in `apps` or `app_snapshots`, others live inside `platformData`.

| Property | Shopify | SF | Canva | Wix | WP | GWS | Atl | Zoom | Zoho | ZD | HS | WC | DB Location |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **pricingPlans** (structured) | ✓ | ✓ | — | ✓ | — | — | ✓ | — | — | — | ✓ | — | `app_snapshots.pricing_plans` |
| **categories** | ✓ | ✓ | ~ | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `app_snapshots.categories` |
| **languages** | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | `app_snapshots.languages` |
| **launchedDate** | ✓ | ✓ | — | — | ✓ | — | — | — | ✓ | ✓ | ✓ | — | `apps.launched_date` |
| **activeInstalls** | — | — | — | — | ✓ | ✓ | ✓ | — | — | — | ✓ | — | `apps.active_installs` |
| **currentVersion** | — | — | — | — | ✓ | — | ✓ | — | ✓ | ✓ | — | — | `apps.current_version` |
| **lastUpdatedAt** | — | — | — | — | ✓ | ✓ | ✓ | — | — | — | — | — | `apps.last_updated_at` |
| **screenshots** | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | `platformData` |
| **support** | ✓ | ~ | — | — | — | ✓ | ✓ | — | — | — | — | `app_snapshots.support` |
| **features/highlights** | ✓ | ✓ | — | ✓ | — | — | ✓ | — | — | — | — | `app_snapshots.features` |
| **seoTitle** | ✓ | ~ | — | ~ | — | — | — | — | — | — | — | `app_snapshots.seo_title` |
| **seoMetaDescription** | ✓ | ~ | — | ~ | — | — | — | — | — | — | — | `app_snapshots.seo_meta_description` |
| **externalId** | — | — | — | — | — | — | ✓ | — | — | ✓ | — | `apps.external_id` |

---

## 3. Platform-Specific Properties

Every field below lives in `app_snapshots.platform_data` (JSONB). Parser source files are listed for each platform.

### 3.1 Shopify

**Parser:** `apps/scraper/src/platforms/shopify/index.ts:138-152`

| Field | Type | Description |
|---|---|---|
| `appIntroduction` | string | Short introduction paragraph |
| `appDetails` | string | Full description text |
| `seoTitle` | string | Page title tag |
| `seoMetaDescription` | string | Meta description |
| `features` | object[] | Feature taxonomy (title, url, handle) |
| `integrations` | object[] | Third-party integrations |
| `categories` | object[] | Category with subcategories and features |
| `pricingPlans` | object[] | Pricing tiers (name, price, period, trial, features) |
| `support` | object | Support contacts (email, portal_url, phone) |
| `demoStoreUrl` | string | Demo store URL |
| `languages` | string[] | Supported languages |
| `launchedDate` | string | ISO date when app launched |
| `similarApps` | object[] | Similar apps list |

**Note:** Shopify puts common fields (appIntroduction, appDetails, etc.) into platformData, then `app-details-scraper.ts` re-extracts them into snapshot columns. This is a known anti-pattern (see Section 6).

---

### 3.2 Salesforce (AppExchange)

**Parser:** `apps/scraper/src/platforms/salesforce/parsers/app-parser.ts:45-64`

| Field | Type | Description |
|---|---|---|
| `description` | string | Short listing description |
| `fullDescription` | string | Complete description |
| `highlights` | object[] | Highlight bullets from extensions |
| `publishedDate` | string \| null | Publication date |
| `languages` | string[] | Supported languages |
| `listingCategories` | string[] | Category names array |
| `productsSupported` | string[] | Salesforce products supported |
| `productsRequired` | string[] | Salesforce products required |
| `pricingModelType` | string | Pricing model type |
| `pricingPlans` | object[] | Plans with plan_name, price, currency_code, units, frequency, trial_days |
| `publisher` | object \| null | Publisher details (name, email, website, description, employees, yearFounded, location, country) |
| `technology` | string | Technology stack |
| `editions` | string[] | Supported Salesforce editions |
| `supportedIndustries` | string[] | Target industries |
| `targetUserPersona` | string[] | Target personas |
| `solution` | object | Solution manifest (LWC, tabs, objects, etc.) |
| `businessNeeds` | string | Business needs description |
| `plugins` | object \| null | Plugin data (videos, resources, carousel, logos) |

---

### 3.3 Canva

**Parser:** `apps/scraper/src/platforms/canva/parsers/app-parser.ts`

Canva has two data paths with different field sets:
- **Bulk path** (`normalizeCanvaApp`) — from `/apps` page embedded JSON, basic fields only
- **Detail path** (`normalizeCanvaDetailApp`) — from individual app pages or appListing API, richer data

| Field | Type | Source | Description |
|---|---|---|---|
| `canvaAppId` | string | both | Canva's internal app ID (e.g., `AAF_8lkU9VE`) |
| `canvaAppType` | string | bulk | App type (`SDK_APP` or `EXTENSION`) |
| `description` | string | both | Short description |
| `tagline` | string | both | Tagline / H1 text |
| `fullDescription` | string | both | Full description text |
| `topics` | string[] | bulk | Topic tags (e.g., `marketplace_topic.ai_audio`) |
| `urlSlug` | string | bulk | URL slug for the app |
| `screenshots` | string[] | detail | Screenshot URLs |
| `promoCardUrl` | string | detail | Promotional card image URL |
| `developerEmail` | string | detail | Developer contact email |
| `developerPhone` | string | detail | Developer phone |
| `developerAddress` | object \| null | detail | Address (street, city, country, state, zip) |
| `termsUrl` | string | detail | Terms of service URL |
| `privacyUrl` | string | detail | Privacy policy URL |
| `permissions` | object[] | detail | Permissions array ({scope, type: MANDATORY\|OPTIONAL}) |
| `languages` | string[] | detail | Supported languages (locale codes) |

**Note:** `developerWebsite` is NOT stored in platformData — it's mapped to the normalized `developer.website` field instead.

---

### 3.4 Wix

**Parser:** `apps/scraper/src/platforms/wix/parsers/app-parser.ts:126-152`

| Field | Type | Description |
|---|---|---|
| `tagline` | string | Short description / tagline |
| `description` | string | Long description |
| `benefits` | string[] | Benefits / features list |
| `demoUrl` | string | Demo URL |
| `categories` | object[] | Categories with slug, title, parentSlug, parentTitle, url |
| `collections` | object[] | Collection memberships ({slug, name}) |
| `screenshots` | string[] | Screenshot URLs |
| `pricingPlans` | object[] | Plans with name, isFree, monthlyPrice, yearlyPrice, oneTimePrice, type, benefits |
| `currency` | string | Currency code for pricing |
| `isFreeApp` | boolean | Whether app is free |
| `trialDays` | number | Trial period in days |
| `languages` | string[] | Supported languages |
| `isAvailableWorldwide` | boolean | Worldwide availability |
| `ratingHistogram` | object | Rating breakdown ({rating5, rating4, rating3, rating2, rating1}) |
| `promotionalImage` | string | Promotional image URL |
| `developerEmail` | string | Contact email |
| `developerPrivacyUrl` | string | Privacy policy URL |

---

### 3.5 WordPress

**Parser:** `apps/scraper/src/platforms/wordpress/parsers/api-parser.ts:56-79`

| Field | Type | Description |
|---|---|---|
| `shortDescription` | string | Short description (stripped HTML) |
| `description` | string | Full description (raw HTML) |
| `version` | string | Plugin version → `apps.current_version` |
| `testedUpTo` | string | Tested up to WP version |
| `requiresWP` | string | Minimum WP version |
| `requiresPHP` | string | Minimum PHP version |
| `activeInstalls` | number | Active installations → `apps.active_installs` |
| `downloaded` | number | Total download count |
| `lastUpdated` | string | Last update date → `apps.last_updated_at` |
| `added` | string | When plugin was added to repository |
| `contributors` | object | Contributor info |
| `tags` | object | Tag strings |
| `supportThreads` | number | Support thread count |
| `supportThreadsResolved` | number | Resolved thread count |
| `homepage` | string | Plugin homepage URL |
| `donateLink` | string | Donation link URL |
| `faq` | string | FAQ section HTML |
| `changelog` | string | Changelog section |
| `screenshots` | object | Screenshot data |
| `banners` | object | Banner images |
| `businessModel` | string | Business model badge (community, commercial) |
| `ratings` | object | Rating breakdown by star count |

---

### 3.6 Google Workspace

**Parser:** `apps/scraper/src/platforms/google-workspace/parsers/app-parser.ts:76-91`

| Field | Type | Description |
|---|---|---|
| `googleWorkspaceAppId` | string | Numeric app ID |
| `shortDescription` | string | Short description → `app_snapshots.app_introduction` |
| `detailedDescription` | string | Detailed description → `app_snapshots.app_details` |
| `category` | string | Category slug |
| `pricingModel` | string | Pricing model (free, freemium, paid, free_trial, unknown) |
| `screenshots` | string[] | Screenshot URLs |
| `worksWithApps` | object[] | Integrations (Google apps it works with) |
| `termsOfServiceUrl` | string | Terms of service URL |
| `privacyPolicyUrl` | string | Privacy policy URL |
| `supportUrl` | string | Support URL |
| `casaCertified` | boolean | Cloud Application Security Assessment certification |
| `installCount` | number | Installation count → `apps.active_installs` |
| `developerWebsite` | string | Developer website URL |
| `listingUpdated` | string | Listing update date → `apps.last_updated_at` |

---

### 3.7 Atlassian

**Parser:** `apps/scraper/src/platforms/atlassian/parsers/api-parser.ts:161-200+`

| Field | Type | Description |
|---|---|---|
| `appId` | number | Addon ID → `apps.external_id` |
| `tagLine` | string | Short tagline |
| `summary` | string | Summary → `app_snapshots.app_introduction` |
| `description` | string | Description text |
| `fullDescription` | string | Full description → `app_snapshots.app_details` |
| `hostingVisibility` | string | Hosting visibility setting |
| `totalInstalls` | number | Total installations → `apps.active_installs` |
| `downloads` | number | Total downloads |
| `categories` | object[] | Categories ({slug, name}) |
| `cloudFortified` | boolean | Cloud Fortified certification |
| `topVendor` | boolean | Top Vendor status |
| `vendorName` | string | Vendor/developer name |
| `lastModified` | string | Last modification date → `apps.last_updated_at` |
| `vendorLinks` | object | Vendor-provided links (privacy, status page, etc.) |
| `vendorId` | string | Numeric vendor ID |
| `bugBountyParticipant` | boolean | Bug bounty program participation |
| `tagCategories` | string[] | Category tags |
| `tagKeywords` | string[] | Keyword tags |
| `listingCategories` | string[] | Category display names |
| `version` | string | Current version → `apps.current_version` |
| `paymentModel` | string | Payment model (free, atlassian, vendor) |
| `releaseDate` | string | Version release date |
| `licenseType` | string | License type |
| `compatibilities` | object[] | Compatibility info ({application, cloud, server, dataCenter}) |
| `highlights` | object[] | Feature highlights ({title, body}) → `app_snapshots.features` |
| `documentationUrl` | string | Documentation URL |
| `eulaUrl` | string | EULA URL |
| `supportEmail` | string | Support email → `app_snapshots.support` |
| `supportUrl` | string | Support URL → `app_snapshots.support` |
| `supportPhone` | string | Support phone → `app_snapshots.support` |
| `contactEmail` | string | Contact email |
| `vendorAddress` | object | Vendor address |
| `vendorHomePage` | string | Vendor homepage |
| `slaUrl` | string | SLA URL |
| `trustCenterUrl` | string | Trust center URL |
| `pricingPlans` | object[] | Pricing tiers ({name, price, period, units}) |

---

### 3.8 Zoom

**Parser:** `apps/scraper/src/platforms/zoom/parsers/app-parser.ts:29-37`

| Field | Type | Description |
|---|---|---|
| `description` | string | App description |
| `companyName` | string | Company/developer name |
| `worksWith` | string[] | Apps it integrates with |
| `usage` | object | Usage information |
| `fedRampAuthorized` | boolean | FedRAMP authorization flag |
| `essentialApp` | boolean | Essential app flag |
| `ratingStatistics` | object | Rating stats ({averageRating, totalRatings}) |

---

### 3.9 Zoho

**Parser:** `apps/scraper/src/platforms/zoho/parsers/app-parser.ts:141-166`

| Field | Type | Description |
|---|---|---|
| `extensionId` | string | Extension UUID/ID |
| `namespace` | string | Namespace identifier |
| `tagline` | string | Short tagline / description |
| `about` | string | About / description text |
| `pricing` | string | Pricing model string |
| `publishedDate` | string | Publication date → `apps.launched_date` |
| `version` | string | Current version |
| `deploymentType` | string | Deployment type |
| `cEdition` | string | CEdition flag |
| `categories` | object[] | Category slugs |
| `partnerDetails` | object[] | Partner info ({companyName, supportEmail, partner_uuid, websiteUrl}) |
| `versionhistory` | object | Version history data |
| `ratingBreakdown` | object | Rating breakdown ({onestar, twostar, threestar, fourstar, fivestar}) |

---

### 3.10 Zendesk

**Parser:** `apps/scraper/src/platforms/zendesk/parsers/app-parser.ts:77-87, 108-118, 157-164`

| Field | Type | Description |
|---|---|---|
| `shortDescription` | string | Short description |
| `longDescription` | string | Long description |
| `installationInstructions` | string | Installation instructions |
| `pricing` | string | Pricing information string |
| `datePublished` | string | Publication date → `apps.launched_date` |
| `version` | string | App version |
| `categories` | object[] | Categories ({slug, name}) |
| `products` | object[] | Zendesk products (support, chat, sell, etc.) |
| `source` | string | Data source identifier (`json-ld`, `next-data`, `dom-fallback`) |

---

### 3.11 HubSpot

**Parser:** `apps/scraper/src/platforms/hubspot/parsers/app-parser.ts:96-111`

| Field | Type | Description |
|---|---|---|
| `shortDescription` | string | Tagline |
| `longDescription` | string | Overview (HTML stripped) |
| `pricing` | string | Pricing hint string |
| `pricingPlans` | object[] | Plans with name, model[], monthlyPrice (dollars), features[] |
| `categories` | object[] | Category slugs with display names |
| `installCount` | number | Installation count → `apps.active_installs` |
| `launchedDate` | string | ISO date from firstPublishedAt → `apps.launched_date` |
| `offeringId` | number | Offering ID (needed for Ecosystem review API) |
| `productType` | string | Product type |
| `connectionType` | string | Connection type |
| `certified` | boolean | HubSpot certification flag |
| `builtByHubSpot` | boolean | Built by HubSpot flag |
| `source` | string | Always `chirp-api` or `chirp-api-empty` |

**Note:** HubSpot pricing is stored in **centicents** in the raw API. Parsers convert: `pricingMonthlyCenticents / 10000 = dollars/month`.

### 3.12 WooCommerce

**Parser:** `apps/scraper/src/platforms/woocommerce/parsers/app-parser.ts`
**Source:** WooCommerce REST API (`/wp-json/wccom-extensions/1.0/search`)

| Field | Type | Description |
|---|---|---|
| `shortDescription` | string | Product excerpt from search API |
| `pricing` | string | Formatted price string (e.g., "Free", "$79/year") |
| `rawPrice` | number | Raw price value (0 = free) |
| `currency` | string | Currency code (e.g., "USD") |
| `billingPeriod` | string | Billing period (e.g., "year", "month") |
| `regularPrice` | number | Regular price before sale |
| `isOnSale` | boolean | Whether the extension is on sale |
| `freemiumType` | string | Freemium type (e.g., "unset", "freemium") |
| `vendorName` | string | Vendor display name → `developer.name` |
| `vendorUrl` | string | Vendor profile URL → `developer.url` |
| `type` | string | Extension type (e.g., "extension") |
| `hash` | string | Unique hash identifier |
| `isInstallable` | boolean | Whether extension is directly installable |
| `categories` | object[] | Category slugs with labels |
| `source` | string | Always `woocommerce-api` |

**Note:** All fields come from the search API (bulk path). There is no dedicated single-product API endpoint. Individual reviews are not available via API — only aggregate `rating` and `reviews_count` from the search response.

---

## 4. Badge System

Badge keys are stored in `apps.badges` (JSONB string array). The UI renders them via `BADGE_CONFIG` in `apps/dashboard/src/components/app-badges.tsx`.

| Platform | Badge Key | Display Label | Icon | Source |
|---|---|---|---|---|
| **Shopify** | `built_for_shopify` | Built for Shopify | 💎 | `is_built_for_shopify` API field |
| **Salesforce** | `isa_certified` | ISA Certified | ✓ | Listing metadata |
| **Salesforce** | `security_reviewed` | Security Reviewed | 🔒 | Listing metadata |
| **Canva** | `premium` | Premium | 👑 | App listing |
| **Canva** | `canva_extension` | Extension | 🧩 | `appType === "EXTENSION"` |
| **Google WS** | `editors_choice` | Editor's Choice | ⭐ | Listing metadata |
| **Google WS** | `casa_certified` | CASA Certified | 🔒 | `casaCertified` boolean |
| **WordPress** | `community` | Open Source | 🌐 | `businessModel` field |
| **WordPress** | `commercial` | Commercial | 💼 | `businessModel` field |
| **Atlassian** | `cloud_fortified` | Cloud Fortified | 🛡️ | Addon approval status |
| **Atlassian** | `top_vendor` | Top Vendor | ⭐ | Addon approval status |
| **Zoom** | `fedramp_authorized` | FedRAMP | 🏛️ | `fedRampAuthorized` boolean |
| **Zoom** | `essential_app` | Essential App | ⭐ | `essentialApp` boolean |
| **HubSpot** | `Certified` | Certified | — | `certifiedAt` present |
| **HubSpot** | `Built by HubSpot` | Built by HubSpot | — | `builtByHubSpot` boolean |
| **Wix** | — | *(no badges defined)* | — | `appBadges` array (unused) |
| **Zoho** | — | *(no badges defined)* | — | — |
| **Zendesk** | — | *(no badges defined)* | — | — |
| **WooCommerce** | `developed_by_woo` | Developed by Woo | — | `vendor_name === "Woo"` |
| **WooCommerce** | `on_sale` | On Sale | — | `is_on_sale` boolean |
| **WooCommerce** | `freemium` | Freemium | — | `freemium_type === "freemium"` |

**Legacy:** `apps.is_built_for_shopify` boolean column still exists alongside badges. See Anti-Patterns section.

---

## 5. Snapshot Column Mapping

How `app-details-scraper.ts` maps platformData fields → common `app_snapshots` columns:

| Snapshot Column | Shopify | Salesforce | Canva | Wix | WordPress | Google WS | Atlassian | Zoom | Zoho | Zendesk | HubSpot |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `app_introduction` | pd.appIntroduction | pd.description | pd.description | pd.tagline | *(empty)* | pd.shortDescription | pd.summary | pd.description | pd.tagline | pd.shortDescription | pd.shortDescription |
| `app_details` | pd.appDetails | pd.fullDescription | pd.fullDescription | pd.description | stripHtml(pd.description) | pd.detailedDescription | pd.fullDescription | *(empty)* | pd.about | pd.longDescription | pd.longDescription |
| `seo_title` | pd.seoTitle | name | *(empty)* | name | *(empty)* | *(empty)* | name | name | name | name | name |
| `seo_meta_description` | pd.seoMetaDescription | pd.tagline\|pd.description | *(empty)* | pd.tagline\|pd.description | *(empty)* | *(empty)* | pd.tagline\|pd.description | *(empty)* | *(empty)* | *(empty)* | *(empty)* |
| `features` | pd.features | pd.highlights | *(empty)* | pd.benefits | *(empty)* | *(empty)* | pd.highlights (title+body) | *(empty)* | *(empty)* | *(empty)* | *(empty)* |
| `languages` | pd.languages | pd.languages | pd.languages | pd.languages | *(empty)* | *(empty)* | *(empty)* | *(empty)* | *(empty)* | *(empty)* | *(empty)* |
| `integrations` | pd.integrations | productsSupported + productsRequired | *(empty)* | *(empty)* | *(empty)* | pd.worksWithApps | *(empty)* | pd.worksWith | *(empty)* | *(empty)* | *(empty)* |
| `categories` | pd.categories | pd.listingCategories | *(empty)* | pd.categories (title) | pd.tags (values) | pd.category | pd.listingCategories/categories | *(empty)* | pd.categories (slug) | pd.categories (name) | pd.categories (displayName) |
| `pricing_plans` | pd.pricingPlans | pd.pricingPlans (normalized) | *(empty)* | pd.pricingPlans | *(empty)* | *(empty)* | pd.pricingPlans (period, yearly_price) | *(empty)* | *(empty)* | *(empty)* | pd.pricingPlans (monthlyPrice, model[]) |
| `support` | pd.support | publisher.email + developer.website | pd.developerEmail/Phone | pd.developerEmail | *(empty)* | pd.supportUrl | pd.supportEmail/Url/Phone | *(empty)* | *(empty)* | *(empty)* | *(empty)* |
| `demo_store_url` | pd.demoStoreUrl | *(null)* | *(null)* | pd.demoUrl | *(null)* | *(null)* | *(null)* | *(null)* | *(null)* | *(null)* | *(null)* |

**Source:** `apps/scraper/src/scrapers/app-details-scraper.ts:311-480`
**Last verified:** 2026-03-29

---

## 6. Anti-Patterns

### 6.1 `isBuiltForShopify` in common `apps` table

- **Location:** `packages/db/src/schema/apps.ts:32`
- **Problem:** Platform-specific boolean in the universal table. Every non-Shopify app carries a useless `false` column.
- **Fix:** Migrate to `badges[]` array (already has `built_for_shopify` key in `BADGE_CONFIG`). See **PLA-122**.

### 6.2 `demoStoreUrl` as common snapshot column

- **Location:** `packages/db/src/schema/apps.ts:73`
- **Problem:** Originally only Shopify populated this. Now Wix also maps `pd.demoUrl` to it (PLA-278).
- **Status:** Two platforms use it (Shopify, Wix). Anti-pattern is mitigated but column is still sparse for 9 platforms.

### 6.3 `integrations` as common snapshot column

- **Location:** `packages/db/src/schema/apps.ts:75`
- **Problem:** Originally only Shopify + Salesforce. Now Google WS (worksWithApps) and Zoom (worksWith) also map to it (PLA-276).
- **Status:** 4 platforms use it. Remaining 7 leave it empty. Column is becoming more useful but each platform's concept differs.

### 6.4 Untyped `platformData` JSONB

- **Location:** `packages/db/src/schema/apps.ts:85-88` — typed as `Record<string, unknown>`
- **Dashboard:** `details/page.tsx:28` — cast to `Record<string, any>` with no validation
- **Problem:** No compile-time safety, no runtime validation. Field renames/removals break silently.
- **Fix:** Per-platform TypeScript interfaces (**PLA-120**), Zod schemas (**PLA-125**).

### 6.5 Growing platform conditionals in UI

- **Location:** `apps/dashboard/src/app/(dashboard)/[platform]/apps/[slug]/details/page.tsx:29-58`
- **Problem:** 7 boolean platform checks with inline extraction logic. Won't scale to 15+ platforms.
- **Fix:** Component registry pattern (**PLA-124**).

### 6.6 Shopify double-hop for common fields

- **Location:** Shopify parser puts common fields (appIntroduction, appDetails, features, etc.) into `platformData`, then `app-details-scraper.ts:317-387` re-extracts them into snapshot columns.
- **Problem:** Fragile mapping; every new field requires updates in two places.
- **Fix:** Shopify parser should return common fields directly via `NormalizedAppDetails`, not smuggle them through `platformData`.

---

## 7. Best Practices

### 7.1 DB Layer

| Rule | Rationale |
|---|---|
| **Common columns** for fields used by **4+ platforms** with **consistent structure** | Avoids sparse tables while keeping frequent fields queryable |
| **`platformData` JSONB** for everything else | Flexible schema, no migrations needed for new fields |
| **Never add platform-specific booleans/columns** to `apps` or `app_snapshots` | Prevents `isBuiltForShopify` anti-pattern |
| **Use `badges[]` for platform certification/trust signals** | Single mechanism for all platforms |
| **`apps` table** = listing-level data (filterable, sortable) | name, rating, pricing_hint, badges, active_installs |
| **`app_snapshots`** = detail-level data (per-scrape, change-tracked) | descriptions, features, pricing plans, platformData |

### 7.2 API Layer

| Rule | Rationale |
|---|---|
| **Type-narrow `platformData` by platform** before returning | Consumers get typed data, not `Record<string, any>` |
| **Use common columns for cross-platform queries** (lists, search, comparisons) | They're indexed and consistent |
| **Validate `platformData` at API boundary** (log warnings, don't reject) | Catches scraper regressions without breaking dashboard |
| **Don't flatten platformData into top-level response** | Keeps the common/specific boundary clear |

### 7.3 UI Layer

| Rule | Rationale |
|---|---|
| **Component registry pattern** for platform-specific sections | Each platform = one file; details page iterates the registry |
| **Shared sections** for universal data (description, features, pricing, categories) | DRY, consistent layout across platforms |
| **Never add `if (platform === "X")` to shared components** | Use badge config, capability flags, or registry instead |
| **Type platformData in component props** | `platformData: ShopifyPlatformData` not `Record<string, any>` |

### 7.4 Scraper Layer

| Rule | Rationale |
|---|---|
| **Parser returns typed `platformData`** using `satisfies` keyword | Compile-time verification of field structure |
| **Common fields go directly into `NormalizedAppDetails`** top level | No double-hop through platformData |
| **Platform-unique fields go into `platformData`** | Clear separation; the scraper decides what's common vs specific |
| **Normalize pricing to canonical `PricingPlan` format** in the parser, not the scraper | Parser knows the source format best |

---

## 8. Decision Guide: Common Column vs platformData

When adding a new field, answer these questions:

```
1. How many platforms provide this field?
   ├── 4+ platforms with same structure → Common column candidate
   ├── 2-3 platforms → platformData (might promote later)
   └── 1 platform → platformData (definitely)

2. Is it used for listing/filtering/sorting?
   ├── Yes (e.g., rating, pricing, install count) → apps table column
   └── No (e.g., description, screenshots) → app_snapshots column or platformData

3. Is the structure consistent across platforms?
   ├── Yes (e.g., averageRating is always a number) → Common column
   └── No (e.g., "pricing" means different things) → platformData

4. Will it be change-tracked?
   ├── Yes → app_snapshots column (appFieldChanges compares snapshots)
   └── No → platformData is fine
```

**Examples:**
- `activeInstalls` (number, 4 platforms, used for sorting) → `apps.active_installs` ✓
- `screenshots` (array, 4 platforms, different structures, not filtered) → `platformData` ✓
- `cloudFortified` (boolean, Atlassian only) → `platformData` ✓
- `requiresPHP` (string, WordPress only) → `platformData` ✓

---

## Appendix: Related Linear Tasks

All tasks are labeled **`platform-data-matrix`** in Linear.

### Original Tasks (PLA-119 ~ PLA-126)

| Task | Description | Status | Notes |
|---|---|---|---|
| **PLA-119** | Create this reference document | In Review | ✅ Complete |
| **PLA-120** | Per-platform TypeScript interfaces for platformData | In Review | ✅ Complete — 11 interfaces in `packages/shared/src/types/platform-data/` |
| **PLA-121** | Type scraper parsers' platformData output | In Review | ✅ Complete — parsers use `satisfies` keyword |
| **PLA-122** | Migrate `isBuiltForShopify` to badges array | In Review | ⚠️ Column still in schema — needs DB migration |
| **PLA-123** | Move `demoStoreUrl` & `integrations` to platformData | In Review | ⚠️ Columns still in schema — needs DB migration |
| **PLA-124** | Platform-specific UI section components (registry pattern) | In Review | ✅ Complete — 11/11 platforms (PLA-204 added remaining 7) |
| **PLA-125** | Zod validation for platformData at API boundary | In Review | ✅ Complete — `validatePlatformData()` integrated in scraper + API (PLA-206) |
| **PLA-126** | Update ADDING_NEW_PLATFORM.md | In Review | ✅ Complete |

### New Tasks (PLA-203 ~ PLA-208)

| Task | Description | Status | Notes |
|---|---|---|---|
| **PLA-203** | Fix badge persistence gap in app-details-scraper | In Review | ✅ Complete — badges saved to `apps.badges` via detail scraper |
| **PLA-204** | Add platform section components for remaining 7 platforms | In Review | ✅ Complete — all 11 platforms in registry |
| **PLA-205** | Refactor v1 detail page to use platform sections registry | In Review | ✅ Complete — 757→364 lines, zero inline platform checks |
| **PLA-206** | Integrate `validatePlatformData()` into scraper and API pipeline | In Review | ✅ Complete — non-blocking warnings in both |
| **PLA-207** | Fix Canva platformData field discrepancies in this document | In Review | ✅ Complete — Section 3.3 matches actual parser code |
| **PLA-208** | Type `PlatformSectionProps` with per-platform generics | In Review | ✅ Complete — generic props with `PlatformData<P>` |
