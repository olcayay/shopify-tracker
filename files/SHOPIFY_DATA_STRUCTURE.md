# Shopify App Store – Data Structure Reference

This document describes the data structures used when scraping and working with the Shopify App Store: **category tree**, **app details**, and **reviews**. Use it as the single source of truth when building or extending scripts (scrapers, report generators, analyses) that consume or produce this data.

**Scripts and outputs:**

| Script | Output | Description |
|--------|--------|-------------|
| `shopify-category-tree-scraper.py` | Category tree JSON | Crawls categories; nested tree (this section). |
| `shopify-category-tree-report.py` | Category tree CSV | Flattens the JSON to one row per category. |
| `shopify-app-details-scraper.py` | App details JSON | Single app page: name, pricing, developer, categories, pricing tiers. |
| `shopify-app-review-scrapper.py` | Reviews CSV | Paginated reviews for one app. |

---

## Category tree: URL and page model

- **Base:** `https://apps.shopify.com`
- **Categories:** `https://apps.shopify.com/categories/<slug>`
  - Example: `https://apps.shopify.com/categories/finding-products`
- **Full app list for a category:** `https://apps.shopify.com/categories/<slug>/all`
  - Example: `https://apps.shopify.com/categories/finding-products-sourcing-options-dropshipping/all`

**Two page types:**

1. **Main category page** (`/categories/<slug>`): May show subcategories and sometimes a curated app grid. On some categories there are no app cards on this page; instead there is a “View all apps” link.
2. **Full list page** (`/categories/<slug>/all`): Paginated list of all apps in the category. The scraper uses this page when the main page has no app cards or has a “View all apps” link, so that metrics and app list come from the same place.

**Seed categories (roots):** The category tree is crawled from these six slugs:

- `finding-products`
- `selling-products`
- `orders-and-shipping`
- `store-design`
- `marketing-and-conversion`
- `store-management`

**Max depth:** 5 levels (0 = root, 1–4 = subcategories).

---

## Category tree (JSON)

The scraper outputs a **nested JSON tree**: the root is an **array of category nodes**. Each node can have a `children` array of the same shape.

### Node shape

| Field | Type | Description |
|-------|------|-------------|
| `slug` | string | URL-safe identifier (lowercase, hyphens). Unique within the tree. |
| `url` | string | Canonical category page URL (e.g. `https://apps.shopify.com/categories/finding-products`). |
| `data_source_url` | string | URL of the page **actually scraped** for metrics and app list (no query params). Equals `url` when the main page was used; equals `.../categories/<slug>/all` when the full-list page was used. |
| `title` | string | Display title (e.g. "Dropshipping apps"). |
| `breadcrumb` | string | Full breadcrumb text as shown on the page. |
| `description` | string | Category description. |
| `app_count` | number \| null | Total number of apps in the category (from Shopify “X apps” text). `null` for level-0 (root) nodes. |
| `first_page_metrics` | object \| null | Metrics derived from the first 24 app cards (see below). `null` for level-0. |
| `first_page_apps` | array | List of app objects in **page order** (up to 24). Empty for level-0. |
| `parent_slug` | string \| null | Slug of the parent category. `null` for roots. |
| `category_level` | number | 0 = root, 1–4 = subcategory depth. |
| `children` | array | Child category nodes (same structure). Only present in the tree representation. |

**Level-0 (root) nodes:** `app_count`, `first_page_metrics`, and `first_page_apps` are always `null` / `[]` because root pages are category hubs, not app lists.

---

## first_page_metrics

“First page” means the **first 24 app cards** (4×6 grid) on the category page or the `/all` page, depending on `data_source_url`. All metrics are computed from that set only; there is no pagination.

| Field | Type | Definition |
|-------|------|------------|
| `sponsored_count` | number | Count of apps in the first 24 that are marked as sponsored/paid. |
| `built_for_shopify_count` | number | Count of apps in the first 24 with the “Built for Shopify” badge. |
| `count_100_plus_reviews` | number | Count of apps in the first 24 with ≥100 reviews. |
| `count_1000_plus_reviews` | number | Count of apps in the first 24 with ≥1000 reviews. |
| `total_reviews` | number | Sum of review counts across the first 24 apps. |
| `top_4_avg_rating` | number | Average of the `average_rating` values of the top 4 apps by review count. |
| `top_4_avg_rating_count` | number | Average of the `rating_count` values of the top 4 apps by review count. |
| `top_1_pct_reviews` | number | Percentage of first-page total reviews held by the single top app (by review count). |
| `top_4_pct_reviews` | number | Percentage of first-page total reviews held by the top 4 apps (by review count). |
| `top_8_pct_reviews` | number | Percentage of first-page total reviews held by the top 8 apps (by review count). |

---

## first_page_apps

Array of **app objects** in the order they appear on the scraped page (up to 24 items).

**App object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | App name. |
| `short_description` | string | Short description or tagline. |
| `average_rating` | number | Average star rating. |
| `rating_count` | number | Number of reviews. |
| `app_url` | string | Full URL to the app’s page on the Shopify App Store. |
| `logo_url` | string | URL of the app logo/image as shown in the card. |

---

## Conventions

- **Slug format:** Lowercase, words separated by hyphens (e.g. `finding-products-sourcing-options-dropshipping`).
- **app_count:** Always the **full category** total from Shopify (“X apps”); not limited to the first page.
- **Data source:** All first-page metrics and `first_page_apps` are derived from **HTML scraping** of a single page (the one in `data_source_url`). No public API; no pagination beyond that first page.

---

## App details (JSON)

Produced by **`shopify-app-details-scraper.py`**. One JSON file per app (e.g. `files/app-details-<app_slug>.json`). Source: single app page `https://apps.shopify.com/<app_slug>`.

### Root fields

| Field | Type | Description |
|-------|------|-------------|
| `app_slug` | string | URL slug (e.g. `tidio-chat`). |
| `app_name` | string | Display name. |
| `title` | string | Short tagline. |
| `description` | string | Full description. |
| `pricing` | string | Summary (e.g. "Free plan available"). |
| `average_rating` | number \| null | App store rating (1–5). May be null if not shown. |
| `rating_count` | number \| null | Total review count. May be null. |
| `developer` | object | `name`, `url` (partner page), optional `website`. |
| `demo_store_url` | string \| null | Link to demo store. |
| `languages` | array of strings | Supported languages. |
| `works_with` | array of strings | Integrations (e.g. "Zendesk", "Klaviyo"). |
| `categories` | array | Category tree this app appears under (see below). |
| `pricing_tiers` | array | Plan tiers (see below). |

### categories (app taxonomy)

Each item is a **category** the app is listed under:

- **title:** Category name (e.g. "Chat").
- **url:** Category page URL.
- **subcategories:** Array of groups; each has **title** (e.g. "Real Time Messaging") and **features**:
  - **title:** Feature name (e.g. "Live chat", "AI chatbots").
  - **url:** URL to filtered app list (often with `feature_handles[]`).
  - **feature_handle:** Stable handle (e.g. `cf.chat.real_time_messaging.live_chat`).

Cross-reference with the category tree (same category slugs/URLs).

### pricing_tiers

Each tier is an object:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | e.g. "Free", "Paid". |
| `price` | string \| null | Monthly price (numeric string, e.g. "29"). |
| `period` | string \| null | e.g. "month". |
| `yearly_price` | string \| null | Price per year if shown. |
| `discount_text` | string \| null | e.g. "save 17%". |
| `trial_text` | string \| null | e.g. "14-day free trial". |
| `features` | array of strings | Bullet points for that plan. |

---

## Reviews (CSV)

Produced by **`shopify-app-review-scrapper.py`**. One CSV per app (e.g. `files/reviews-<app_slug>.csv`). Source: paginated review pages `https://apps.shopify.com/<app_slug>/reviews?page=N`. Fetched page by page with rate limiting until no more reviews are returned.

### Columns

| Column | Description |
|--------|-------------|
| **date** | Review date (as shown on the page, e.g. "December 29, 2025"). |
| **content** | Review text. |
| **reviewer_name** | Display name (often store/business name). |
| **reviewer_country** | Country if shown. |
| **duration_using_app** | e.g. "2 months using the app", "N/A". |
| **rating** | Star rating (1–5) as string. |
| **developer_reply_date** | Date of developer reply if present. |
| **developer_reply_text** | Developer reply text if present. |

Empty cells mean the field was not found on the page.

---

## Usage in scripts

- When building a new scraper, set **`data_source_url`** (category tree) to the exact page you scraped (without query params) so downstream tools know the source.
- For field names and types for **category tree**, **app details**, and **reviews**, use this document so all scripts stay aligned.
- The category tree CSV report is generated from the category JSON by flattening the tree; see `shopify-category-tree-report.py` and the [CSV interpretation guide](INTERPRETING_THE_CSV.md) for how to read and use the CSV.
