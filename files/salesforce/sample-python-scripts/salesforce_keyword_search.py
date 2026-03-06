#!/usr/bin/env python3
"""
Salesforce AppExchange Keyword Search

Fetches keyword search results from appxSearchKeywordResults (with Playwright for
JS-rendered results), extracts ranking position, listingId, app name, description,
rating, and link. Outputs JSON and optionally CSV.
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlencode

import requests

from bs4 import BeautifulSoup

BASE_URL = "https://appexchange.salesforce.com"
API_LISTINGS_URL = "https://api.appexchange.salesforce.com/recommendations/v3/listings"
OUTPUT_DIR = "files"
REQUEST_TIMEOUT_MS = 30000
REQUEST_TIMEOUT_SEC = 30
MIN_DELAY_SEC = 1.5
MAX_DELAY_SEC = 3.5
SLEEP_BETWEEN_PAGES_MIN = 0.5
SLEEP_BETWEEN_PAGES_MAX = 1.5

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def build_search_url(keywords: str) -> str:
    return f"{BASE_URL}/appxSearchKeywordResults?keywords={keywords}"


def extract_listing_id(href: str) -> str:
    match = re.search(r"listingId=([a0N][A-Za-z0-9]{14,18})", href)
    return match.group(1) if match else ""


def parse_search_results(html: str, keywords: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []
    seen_ids: set = set()

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "listingId=" not in href:
            continue
        listing_id = extract_listing_id(href)
        if not listing_id or listing_id in seen_ids:
            continue
        seen_ids.add(listing_id)
        full_url = href if href.startswith("http") else urljoin(BASE_URL, href)
        name = _safe_text(a)
        if len(name) > 200:
            name = name[:200] + "..."
        results.append({
            "position": len(results) + 1,
            "listing_id": listing_id,
            "name": name or None,
            "url": full_url,
            "keywords": keywords,
        })

    if not results:
        # Fallback: find listingId in raw HTML and use same path as on page (appxListingDetail or appxContentListingDetail)
        path_pattern = re.compile(
            r"(appx(?:Listing|ContentListing)Detail)\?listingId=([a0N][A-Za-z0-9]{14,18})"
        )
        for m in path_pattern.finditer(html):
            path_part = f"{m.group(1)}?listingId={m.group(2)}"
            lid = m.group(2)
            if lid not in seen_ids:
                seen_ids.add(lid)
                results.append({
                    "position": len(results) + 1,
                    "listing_id": lid,
                    "name": None,
                    "url": f"{BASE_URL}/{path_part}",
                    "keywords": keywords,
                })
        if not results:
            listing_ids = re.findall(r"listingId=([a0N][A-Za-z0-9]{14,18})", html)
            for lid in dict.fromkeys(listing_ids):
                if lid not in seen_ids:
                    seen_ids.add(lid)
                    results.append({
                        "position": len(results) + 1,
                        "listing_id": lid,
                        "name": None,
                        "url": f"{BASE_URL}/appxListingDetail?listingId={lid}",
                        "keywords": keywords,
                    })

    return results


def _safe_text(el: Any, default: str = "") -> str:
    if el is None:
        return default
    return (el.get_text(strip=True) or "").replace("\n", " ").strip() or default


def _extract_tiles_js() -> str:
    """JavaScript to run in page: returns list of {listing_id, name, url} from data-event=tile elements."""
    return """
    (function() {
        var tiles = document.querySelectorAll('[data-event="tile"]');
        var base = 'https://appexchange.salesforce.com';
        var out = [];
        var seen = {};
        for (var i = 0; i < tiles.length; i++) {
            var t = tiles[i];
            var id = t.dataset.listingId || t.getAttribute('data-listing-id');
            if (!id || seen[id]) continue;
            seen[id] = true;
            var name = (t.dataset.listingName || t.getAttribute('data-listing-name') || '').trim() || null;
            var a = t.querySelector('a[href*="listingId="], a[href*="appxListingDetail"], a[href*="appxContentListingDetail"]');
            var url = base;
            if (a && a.href) {
                url = a.href;
            } else {
                var type = (t.dataset.listingType || t.getAttribute('data-listing-type') || '').toLowerCase();
                url = type.indexOf('content') >= 0
                    ? base + '/appxContentListingDetail?listingId=' + id
                    : base + '/appxListingDetail?listingId=' + id;
            }
            out.push({ listing_id: id, name: name, url: url });
        }
        return out;
    })();
    """


SALESFORCE_ID_PATTERN = re.compile(r"^[a0N][A-Za-z0-9]{14,18}$")
SHORT_DESCRIPTION_MAX = 300


def _pick_logo_url(logos: Any) -> Optional[str]:
    """Pick best logo URL from API logos array. Prefer Logo or Big Logo, else first."""
    if not logos or not isinstance(logos, list):
        return None
    for preferred in ("Logo", "Big Logo"):
        for entry in logos:
            if isinstance(entry, dict) and entry.get("logoType") == preferred and entry.get("mediaId"):
                return str(entry["mediaId"]).strip()
    if logos and isinstance(logos[0], dict) and logos[0].get("mediaId"):
        return str(logos[0]["mediaId"]).strip()
    return None


def _fetch_listings_page(keywords: str, page: int, page_size: int = 12) -> Optional[Dict[str, Any]]:
    """Fetch a single page of app listings from the API (direct HTTP). Returns JSON payload or None.
    page: 0-based (0 = first page). API expects 1-based, so we send page+1."""
    api_page = page + 1  # API is 1-based
    params = {
        "type": "apps",
        "page": api_page,
        "pageSize": page_size,
        "language": "en",
        "keyword": keywords,
    }
    if page == 0:
        params["sponsoredCount"] = 4
    url = f"{API_LISTINGS_URL}?{urlencode(params)}"
    try:
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SEC,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def _page_number_from_url(res_url: str) -> int:
    """Extract page number from API URL (e.g. page=1). Default 0."""
    m = re.search(r"page=(\d+)", res_url, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"page%3D(\d+)", res_url, re.IGNORECASE)
    return int(m.group(1)) if m else 0


def _item_from_api(item: Dict, get_id: Any, get_name: Any, listing_id_type: Any) -> Dict[str, Any]:
    """Build a single result dict from API item (no position/page)."""
    lid = get_id(item)
    if not lid:
        return {}
    desc = (item.get("description") or "").strip()
    if len(desc) > SHORT_DESCRIPTION_MAX:
        desc = desc[:SHORT_DESCRIPTION_MAX] + "..."
    return {
        "listing_id": lid,
        "listing_id_type": listing_id_type(lid),
        "name": get_name(item),
        "url": f"{BASE_URL}/appxListingDetail?listingId={lid}",
        "logo_url": _pick_logo_url(item.get("logos")),
        "average_rating": item.get("averageRating"),
        "review_count": item.get("reviewsAmount"),
        "short_description": desc or None,
        "categories": item.get("listingCategories") or [],
    }


def _parse_apps_response_paginated(
    api_captures: List[tuple[str, Any]],
    keywords: str,
    max_pages: Optional[int] = 1,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parse apps API responses into sponsored and organic arrays.
    - sponsored: only from featured (page 0); position 1-based; page=1. Same app can also appear in organic.
    - organic: from listings on each page; position 1-based within organic; page 1-based (1=first page).
    Returns {"sponsored": [...], "organic": [...]}.
    """
    keywords_lower = (keywords or "").strip().lower()
    by_page: Dict[int, tuple[str, Dict[str, Any]]] = {}
    for res_url, payload in api_captures:
        if not isinstance(payload, dict):
            continue
        res_url_lower = res_url.lower()
        if "type=apps" not in res_url_lower:
            continue
        if keywords_lower and keywords_lower not in res_url_lower:
            if payload.get("queryText", "").strip().lower() != keywords_lower:
                continue
        page_num = _page_number_from_url(res_url)
        if page_num not in by_page:
            by_page[page_num] = (res_url, payload)
    if not by_page:
        return {"sponsored": [], "organic": []}
    pages_sorted = sorted(by_page.keys())
    if max_pages is not None:
        # Keep first max_pages (works for both 0-based and 1-based API page numbers)
        pages_sorted = pages_sorted[:max_pages]

    def get_id(item: Dict) -> str:
        for k in ("oafId", "listingId", "listing_id", "id", "Id"):
            if k in item and item[k]:
                return str(item[k])
        return ""

    def get_name(item: Dict) -> Optional[str]:
        for k in ("name", "title", "listingName", "listing_name", "label"):
            if k in item and item[k]:
                v = str(item[k]).strip()
                if len(v) > 200:
                    v = v[:200] + "..."
                return v or None
        return None

    def listing_id_type(lid: str) -> str:
        return "salesforce" if SALESFORCE_ID_PATTERN.match(lid) else "uuid"

    sponsored: List[Dict[str, Any]] = []
    organic: List[Dict[str, Any]] = []

    first_page_num = pages_sorted[0] if pages_sorted else None
    for page_num in pages_sorted:
        _, payload = by_page[page_num]
        # Output 1-based page number for display
        page_one_based = page_num if (first_page_num is not None and first_page_num >= 1) else page_num + 1
        if page_num == first_page_num:
            featured = payload.get("featured") or []
            if isinstance(featured, list):
                for item in featured:
                    if not isinstance(item, dict):
                        continue
                    base = _item_from_api(item, get_id, get_name, listing_id_type)
                    if not base:
                        continue
                    base["position"] = len(sponsored) + 1
                    base["page"] = 1
                    base["is_sponsored"] = True
                    sponsored.append(base)
        listings = payload.get("listings") or []
        if isinstance(listings, list):
            for item in listings:
                if not isinstance(item, dict):
                    continue
                base = _item_from_api(item, get_id, get_name, listing_id_type)
                if not base:
                    continue
                base["position"] = len(organic) + 1
                base["page"] = page_one_based
                base["is_sponsored"] = bool(item.get("sponsored"))
                organic.append(base)

    return {"sponsored": sponsored, "organic": organic}


def _legacy_to_organic(legacy: List[Dict[str, Any]], keywords: str) -> List[Dict[str, Any]]:
    """Convert flat legacy result list to organic list (position 1-based, page=1)."""
    out: List[Dict[str, Any]] = []
    for i, row in enumerate(legacy):
        lid = row.get("listing_id") or row.get("listingId")
        if not lid:
            continue
        one = dict(row)
        one["position"] = i + 1
        one["page"] = 1
        one.setdefault("is_sponsored", False)
        out.append(one)
    return out


def _parse_search_api_response(api_payload: List[Any], keywords: str) -> List[Dict[str, Any]]:
    """Legacy: extract from raw payload list (no URL). Used when api_captures not available."""
    out: List[Dict[str, Any]] = []
    seen: set = set()

    def get_id(item: Dict) -> str:
        for k in ("oafId", "listingId", "listing_id", "id", "Id"):
            if k in item and item[k]:
                return str(item[k])
        return ""

    def get_name(item: Dict) -> Optional[str]:
        for k in ("name", "title", "listingName", "listing_name", "label"):
            if k in item and item[k]:
                v = str(item[k]).strip()
                if len(v) > 200:
                    v = v[:200] + "..."
                return v or None
        return None

    def extract_list(obj: Any) -> List[Any]:
        if isinstance(obj, list):
            return obj
        if isinstance(obj, dict):
            for key in ("listings", "results", "data", "items", "records", "hits"):
                if key in obj and isinstance(obj[key], list):
                    return obj[key]
        return []

    for payload in api_payload:
        if not isinstance(payload, dict):
            continue
        for item in extract_list(payload):
            if not isinstance(item, dict):
                continue
            lid = get_id(item)
            if not lid or lid in seen:
                continue
            seen.add(lid)
            desc = (item.get("description") or "").strip()
            if len(desc) > SHORT_DESCRIPTION_MAX:
                desc = desc[:SHORT_DESCRIPTION_MAX] + "..."
            out.append({
                "listing_id": lid,
                "listing_id_type": "salesforce" if SALESFORCE_ID_PATTERN.match(lid) else "uuid",
                "name": get_name(item),
                "url": f"{BASE_URL}/appxListingDetail?listingId={lid}",
                "logo_url": _pick_logo_url(item.get("logos")),
                "average_rating": item.get("averageRating"),
                "review_count": item.get("reviewsAmount"),
                "short_description": desc or None,
                "categories": item.get("listingCategories") or [],
                "is_sponsored": bool(item.get("sponsored")),
            })
    return out


def _extract_links_js() -> str:
    """JavaScript fallback: extract from a[href*=\"listingId=\"] when tiles are not present."""
    return """
    (function() {
        var links = document.querySelectorAll('a[href*="listingId="]');
        var seen = {};
        var out = [];
        var base = 'https://appexchange.salesforce.com';
        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = a.getAttribute('href') || a.href || '';
            var m = href.match(/listingId=([a0N][A-Za-z0-9]{14,18})/);
            if (m && !seen[m[1]]) {
                seen[m[1]] = true;
                var name = (a.textContent || '').trim();
                if (name.length > 200) name = name.slice(0, 200) + '...';
                out.push({
                    listing_id: m[1],
                    name: name || null,
                    url: a.href ? a.href : (base + '/appxListingDetail?listingId=' + m[1])
                });
            }
        }
        return out;
    })();
    """


def fetch_search_results_api_only(
    keywords: str,
    max_pages: Optional[int] = 1,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], str, List[tuple[str, Any]]]:
    """Fetch keyword search results using only direct API (no Playwright). Returns (sponsored, organic, html, api_captures)."""
    api_captures: List[tuple[str, Any]] = []
    max_pages = max(1, max_pages or 1)
    for page_num in range(max_pages):
        print(f"Fetching page {page_num + 1}/{max_pages} (API)...", file=sys.stderr)
        payload = _fetch_listings_page(keywords, page_num)
        if payload:
            # Store URL with 1-based page so parser sees consistent page numbers
            api_page = page_num + 1
            url = f"{API_LISTINGS_URL}?type=apps&page={api_page}&pageSize=12&language=en&keyword={keywords}"
            api_captures.append((url, payload))
        if page_num < max_pages - 1:
            delay = random.uniform(SLEEP_BETWEEN_PAGES_MIN, SLEEP_BETWEEN_PAGES_MAX)
            time.sleep(delay)
    raw = _parse_apps_response_paginated(api_captures, keywords, max_pages=max_pages)
    if not raw["sponsored"] and not raw["organic"] and api_captures:
        legacy = _parse_search_api_response([p[1] for p in api_captures], keywords)
        raw = {"sponsored": [], "organic": _legacy_to_organic(legacy, keywords)}

    def add_keywords(lst: List[Dict[str, Any]]) -> None:
        for r in lst:
            r["url"] = r.get("url") or f"{BASE_URL}/appxListingDetail?listingId={r.get('listing_id')}"
            if r["url"] and not r["url"].startswith("http"):
                r["url"] = urljoin(BASE_URL, r["url"])
            r["keywords"] = keywords

    add_keywords(raw["sponsored"])
    add_keywords(raw["organic"])
    return raw["sponsored"], raw["organic"], "", api_captures


def fetch_search_results_playwright(
    keywords: str,
    max_pages: Optional[int] = 1,
) -> tuple[List[Dict[str, Any]], str, List[tuple[str, Any]]]:
    """Fetch search page and extract results from DOM (tiles) or API response. Returns (results, html, api_captures).
    max_pages: number of result pages to include (1 = first page only). More scrolls when > 1 to trigger further API requests."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("playwright not installed. Run: pip install playwright && playwright install chromium")

    url = build_search_url(keywords)
    api_captures: List[tuple[str, Any]] = []

    def handle_response(response):
        res_url = response.url
        if "appexchange.salesforce.com" in res_url and ("/api/" in res_url or "api.appexchange" in res_url):
            if response.status == 200:
                try:
                    body = response.json()
                    api_captures.append((res_url, body))
                except Exception:
                    pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()
        page.on("response", handle_response)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=REQUEST_TIMEOUT_MS)
            page.wait_for_timeout(8000)
            scroll_rounds = 10 + (max(0, (max_pages or 1) - 1) * 8)
            for _ in range(scroll_rounds):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(500)
            page.wait_for_timeout(2000)
            raw = page.evaluate(_extract_tiles_js())
            if not raw:
                raw = page.evaluate(_extract_links_js())
            html = page.content()
        finally:
            browser.close()

    # Collect which app pages we already have (type=apps, keyword match)
    keywords_lower = (keywords or "").strip().lower()
    have_pages: set = set()
    for res_url, payload in api_captures:
        if not isinstance(payload, dict):
            continue
        res_url_lower = res_url.lower()
        if "type=apps" not in res_url_lower:
            continue
        if keywords_lower and keywords_lower not in res_url_lower:
            if (payload.get("queryText") or "").strip().lower() != keywords_lower:
                continue
        have_pages.add(_page_number_from_url(res_url))

    if have_pages:
        print(f"Pages from browser: {sorted(have_pages)}", file=sys.stderr)

    # Fetch any missing pages via direct API so --pages N is respected
    want_pages = max_pages if max_pages is not None else (max(have_pages) + 1 if have_pages else 1)
    for page_num in range(want_pages):
        if page_num in have_pages:
            continue
        print(f"Fetching page {page_num + 1} (API)...", file=sys.stderr)
        payload = _fetch_listings_page(keywords, page_num)
        if payload:
            api_captures.append((f"{API_LISTINGS_URL}?type=apps&page={page_num}&pageSize=12&language=en&keyword={keywords}", payload))
            print(f"Fetched page {page_num + 1}.", file=sys.stderr)
            time.sleep(0.3)
        else:
            print(f"Failed to fetch page {page_num + 1}.", file=sys.stderr)

    app_pages = set()
    for res_url, payload in api_captures:
        if not isinstance(payload, dict) or "type=apps" not in res_url.lower():
            continue
        if keywords_lower and keywords_lower not in res_url.lower():
            if (payload.get("queryText") or "").strip().lower() != keywords_lower:
                continue
        app_pages.add(_page_number_from_url(res_url))
    if app_pages:
        print(f"Using pages: {sorted(p + 1 for p in app_pages)}", file=sys.stderr)

    raw = _parse_apps_response_paginated(api_captures, keywords, max_pages=max_pages)
    if not raw["sponsored"] and not raw["organic"]:
        legacy = _parse_search_api_response([p[1] for p in api_captures], keywords)
        raw = {"sponsored": [], "organic": _legacy_to_organic(legacy, keywords)}

    def add_keywords(lst: List[Dict[str, Any]]) -> None:
        for r in lst:
            r["url"] = r.get("url") or f"{BASE_URL}/appxListingDetail?listingId={r.get('listing_id')}"
            if r["url"] and not r["url"].startswith("http"):
                r["url"] = urljoin(BASE_URL, r["url"])
            r["keywords"] = keywords

    add_keywords(raw["sponsored"])
    add_keywords(raw["organic"])
    return raw["sponsored"], raw["organic"], html, api_captures


def fetch_search_page_playwright(keywords: str) -> str:
    """Fetch search page HTML (for fallback parsing)."""
    _, _, html, _ = fetch_search_results_playwright(keywords)
    return html


def write_json(
    keywords: str,
    sponsored: List[Dict[str, Any]],
    organic: List[Dict[str, Any]],
    output_path: str,
) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {"keywords": keywords, "sponsored": sponsored, "organic": organic},
            f, indent=2, ensure_ascii=False,
        )


def write_csv(
    keywords: str,
    sponsored: List[Dict[str, Any]],
    organic: List[Dict[str, Any]],
    output_path: str,
) -> None:
    if not sponsored and not organic:
        return
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    fieldnames = [
        "type", "position", "page", "listing_id", "listing_id_type", "name", "url",
        "logo_url", "average_rating", "review_count", "short_description",
        "categories", "is_sponsored", "keywords",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in sponsored:
            row = dict(r)
            row["type"] = "sponsored"
            row.setdefault("page", 1)
            if isinstance(row.get("categories"), list):
                row["categories"] = ",".join(str(x) for x in row["categories"])
            writer.writerow(row)
        for r in organic:
            row = dict(r)
            row["type"] = "organic"
            if isinstance(row.get("categories"), list):
                row["categories"] = ",".join(str(x) for x in row["categories"])
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Salesforce AppExchange keyword search results (ranking, listingId, app name, url).",
    )
    parser.add_argument(
        "keywords",
        help="Search keywords (e.g. form, integration).",
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=1,
        metavar="N",
        help="Number of result pages to fetch (default: 1). More scrolls when N > 1.",
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Output JSON path (default: files/keyword-<keywords>.json)",
    )
    parser.add_argument(
        "--csv",
        default=None,
        help="Also write CSV to this path.",
    )
    parser.add_argument(
        "--save-html",
        metavar="PATH",
        default=None,
        help="Save fetched HTML to file (for debugging).",
    )
    parser.add_argument(
        "--debug-api",
        metavar="PATH",
        default=None,
        help="Save captured API response(s) to JSON file (for debugging).",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Use only direct API (no Playwright). Faster, no scrape.",
    )
    args = parser.parse_args()

    safe_key = re.sub(r"[^\w\-]", "-", args.keywords.strip())[:50]
    default_output = os.path.join(OUTPUT_DIR, f"keyword-{safe_key}.json")
    output_path = args.output or default_output

    try:
        # Default: API first (no browser). Playwright only as fallback when API returns empty.
        sponsored, organic, html, api_captures = fetch_search_results_api_only(
            args.keywords, max_pages=args.pages,
        )
        if not args.no_browser and not sponsored and not organic:
            print("API returned no results, trying Playwright...", file=sys.stderr)
            sponsored, organic, html, api_captures = fetch_search_results_playwright(
                args.keywords, max_pages=args.pages,
            )
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1

    if args.save_html:
        os.makedirs(os.path.dirname(args.save_html) or ".", exist_ok=True)
        with open(args.save_html, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Saved HTML to {args.save_html}", file=sys.stderr)

    if not sponsored and not organic:
        legacy = parse_search_results(html, args.keywords)
        organic = []
        for i, row in enumerate(legacy):
            lid = row.get("listing_id")
            if not lid:
                continue
            organic.append({
                "position": i + 1,
                "page": 1,
                "listing_id": lid,
                "listing_id_type": "salesforce" if SALESFORCE_ID_PATTERN.match(lid) else "uuid",
                "name": row.get("name"),
                "url": row.get("url") or f"{BASE_URL}/appxListingDetail?listingId={lid}",
                "logo_url": None,
                "average_rating": None,
                "review_count": None,
                "short_description": None,
                "categories": [],
                "is_sponsored": False,
                "keywords": args.keywords,
            })

    if api_captures:
        out_path = args.debug_api or re.sub(r"\.json$", "-api.json", output_path) or (output_path + "-api.json")
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(
                [{"url": u, "payload": p} for u, p in api_captures],
                f, indent=2, ensure_ascii=False,
            )
        print(f"Saved API responses to {out_path}", file=sys.stderr)

    total = len(sponsored) + len(organic)
    print(f"Found {len(sponsored)} sponsored, {len(organic)} organic ({total} total) for keywords: {args.keywords}")

    write_json(args.keywords, sponsored, organic, output_path)
    print(f"Wrote {output_path}")

    if args.csv:
        write_csv(args.keywords, sponsored, organic, args.csv)
        print(f"Wrote {args.csv}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
