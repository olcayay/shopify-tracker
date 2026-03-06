#!/usr/bin/env python3
"""
Salesforce AppExchange Category Listing

Fetches a category page (explore/business-needs?category=<slug> or full URL),
captures API responses like keyword search, and extracts sponsored + organic
app lists with full card fields (logo, rating, review count, description, categories).
Outputs JSON and optionally CSV.
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
from urllib.parse import urljoin, urlencode, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://appexchange.salesforce.com"
EXPLORE_CATEGORY_PATH = "/explore/business-needs"
API_LISTINGS_URL = "https://api.appexchange.salesforce.com/recommendations/v3/listings"
OUTPUT_DIR = "files"
REQUEST_TIMEOUT_MS = 30000
REQUEST_TIMEOUT_SEC = 30
SHORT_DESCRIPTION_MAX = 300
SLEEP_BETWEEN_PAGES_MIN = 0.5
SLEEP_BETWEEN_PAGES_MAX = 1.5

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SALESFORCE_ID_PATTERN = re.compile(r"^[a0N][A-Za-z0-9]{14,18}$")


def build_category_url(slug_or_path: str) -> tuple[str, str]:
    """
    Return (category_url, category_slug).
    Accepts full URL (extracts slug from ?category=) or slug (e.g. customerService).
    """
    s = slug_or_path.strip()
    if s.startswith("http://") or s.startswith("https://"):
        parsed = urlparse(s)
        qs = parse_qs(parsed.query)
        slug = (qs.get("category") or qs.get("businessNeed") or [""])[0]
        if not slug:
            slug = parsed.path.rstrip("/").split("/")[-1] or "unknown"
        url = s
        return url, slug
    if not s.startswith("/"):
        slug = s
        url = f"{BASE_URL}{EXPLORE_CATEGORY_PATH}?category={slug}"
        return url, slug
    slug = s.strip("/").split("/")[-1] or "unknown"
    url = urljoin(BASE_URL, s)
    return url, slug


def _pick_logo_url(logos: Any) -> Optional[str]:
    if not logos or not isinstance(logos, list):
        return None
    for preferred in ("Logo", "Big Logo"):
        for entry in logos:
            if isinstance(entry, dict) and entry.get("logoType") == preferred and entry.get("mediaId"):
                return str(entry["mediaId"]).strip()
    if logos and isinstance(logos[0], dict) and logos[0].get("mediaId"):
        return str(logos[0]["mediaId"]).strip()
    return None


def _page_number_from_url(res_url: str) -> int:
    m = re.search(r"page=(\d+)", res_url, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"page%3D(\d+)", res_url, re.IGNORECASE)
    return int(m.group(1)) if m else 0


def _fetch_category_page(category_slug: str, page: int, page_size: int = 12) -> Optional[Dict[str, Any]]:
    """Fetch a single page of app listings for a category (direct HTTP).
    page: 0-based (0 = first page). API expects 1-based, so we send page+1."""
    api_page = page + 1  # API is 1-based
    params = {
        "type": "apps",
        "page": api_page,
        "pageSize": page_size,
        "language": "en",
        "category": category_slug,
    }
    if page == 0:
        params["sponsoredCount"] = 4
    url = f"{API_LISTINGS_URL}?{urlencode(params)}"
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SEC)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def _item_from_api(item: Dict, get_id: Any, get_name: Any, listing_id_type: Any) -> Dict[str, Any]:
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


def _parse_category_apps_response(
    api_captures: List[tuple[str, Any]],
    category_slug: str,
    max_pages: Optional[int] = 1,
) -> Dict[str, List[Dict[str, Any]]]:
    """Parse apps API responses for category into sponsored and organic."""
    slug_lower = (category_slug or "").strip().lower()
    slug_encoded = category_slug.strip() if category_slug else ""

    def is_category_response(res_url: str, payload: Dict) -> bool:
        res_url_lower = res_url.lower()
        if "type=apps" not in res_url_lower:
            return False
        if slug_lower and slug_lower not in res_url_lower:
            if "category" not in res_url_lower and "businessneed" not in res_url_lower:
                return False
            if slug_encoded and slug_encoded not in res_url and (payload.get("category") or "").strip().lower() != slug_lower:
                return False
        return True

    by_page: Dict[int, tuple[str, Dict[str, Any]]] = {}
    for res_url, payload in api_captures:
        if not isinstance(payload, dict) or not is_category_response(res_url, payload):
            continue
        page_num = _page_number_from_url(res_url)
        if page_num not in by_page:
            by_page[page_num] = (res_url, payload)
    if not by_page:
        return {"sponsored": [], "organic": []}
    pages_sorted = sorted(by_page.keys())
    if max_pages is not None:
        pages_sorted = pages_sorted[:max_pages]
    first_page_num = min(pages_sorted) if pages_sorted else 0

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

    for page_num in pages_sorted:
        _, payload = by_page[page_num]
        page_one_based = page_num  # URL already stores 1-based page
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


def fetch_category_results_api_only(
    category_slug: str,
    max_pages: int = 1,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], str, List[tuple[str, Any]]]:
    """Fetch category listings via direct API only (no browser). Returns (sponsored, organic, '', api_captures)."""
    api_captures: List[tuple[str, Any]] = []
    for page_num in range(max_pages):
        print(f"  Fetching page {page_num + 1}/{max_pages} (API)...", file=sys.stderr)
        payload = _fetch_category_page(category_slug, page_num)
        if payload:
            url = f"{API_LISTINGS_URL}?type=apps&page={page_num + 1}&pageSize=12&language=en&category={category_slug}"
            api_captures.append((url, payload))
        else:
            print(f"  Failed to fetch page {page_num + 1}.", file=sys.stderr)
        if page_num < max_pages - 1:
            delay = random.uniform(SLEEP_BETWEEN_PAGES_MIN, SLEEP_BETWEEN_PAGES_MAX)
            time.sleep(delay)
    if api_captures:
        pages_used = sorted(set(_page_number_from_url(u) for u, _ in api_captures))
        print(f"Using pages: {pages_used}", file=sys.stderr)
    raw = _parse_category_apps_response(api_captures, category_slug, max_pages=max_pages)
    return raw["sponsored"], raw["organic"], "", api_captures


def parse_category_page(html: str, category_url: str) -> List[Dict[str, Any]]:
    """Fallback: extract listing links from HTML (BeautifulSoup)."""
    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []
    seen_ids: set = set()
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "listingId=" not in href:
            continue
        m = re.search(r"listingId=([a0N][A-Za-z0-9]{14,18})", href)
        if not m:
            m = re.search(r"listingId=([a-f0-9\-]{36})", href)
        if not m or m.group(1) in seen_ids:
            continue
        seen_ids.add(m.group(1))
        lid = m.group(1)
        full_url = href if href.startswith("http") else urljoin(BASE_URL, href)
        name = (a.get_text(strip=True) or "").replace("\n", " ").strip()
        if len(name) > 300:
            name = name[:300] + "..."
        results.append({
            "listing_id": lid,
            "name": name or None,
            "url": full_url,
            "category_url": category_url,
        })
    if not results:
        for lid in re.findall(r"listingId=([a0N][A-Za-z0-9]{14,18})", html):
            if lid not in seen_ids:
                seen_ids.add(lid)
                results.append({
                    "listing_id": lid,
                    "name": None,
                    "url": f"{BASE_URL}/appxListingDetail?listingId={lid}",
                    "category_url": category_url,
                })
    return results


def fetch_category_results_playwright(
    category_url: str,
    category_slug: str,
    max_pages: Optional[int] = 1,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], str, List[tuple[str, Any]]]:
    """Fetch category page, capture API responses, return (sponsored, organic, html, api_captures)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("playwright not installed. Run: pip install playwright && playwright install chromium")

    api_captures: List[tuple[str, Any]] = []

    def handle_response(response):
        res_url = response.url
        if "appexchange.salesforce.com" in res_url and ("/api/" in res_url or "api.appexchange" in res_url):
            if response.status == 200:
                try:
                    api_captures.append((res_url, response.json()))
                except Exception:
                    pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()
        page.on("response", handle_response)
        try:
            page.goto(category_url, wait_until="domcontentloaded", timeout=REQUEST_TIMEOUT_MS)
            page.wait_for_timeout(4000)
            scroll_rounds = 6 + (max(0, (max_pages or 1) - 1) * 6)
            for _ in range(scroll_rounds):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(500)
            for _ in range(8):
                try:
                    show_more = page.locator("button:has-text('Show more'), a:has-text('Show more'), [aria-label*='Show more']").first
                    if show_more.count() > 0:
                        show_more.click()
                        page.wait_for_timeout(1500)
                except Exception:
                    break
            page.wait_for_timeout(2000)
            html = page.content()
        finally:
            browser.close()

    slug_lower = (category_slug or "").strip().lower()
    have_pages: set = set()
    for res_url, payload in api_captures:
        if not isinstance(payload, dict):
            continue
        res_url_lower = res_url.lower()
        if "type=apps" not in res_url_lower:
            continue
        if slug_lower and slug_lower not in res_url_lower:
            if "category" not in res_url_lower and "businessneed" not in res_url_lower:
                continue
        have_pages.add(_page_number_from_url(res_url))

    if have_pages:
        print(f"Pages from browser: {sorted(have_pages)}", file=sys.stderr)

    want_pages = max_pages if max_pages is not None else (max(have_pages) + 1 if have_pages else 1)
    for page_num in range(want_pages):
        page_one_based = page_num + 1
        if page_one_based in have_pages:
            continue
        print(f"Fetching page {page_one_based} (API)...", file=sys.stderr)
        payload = _fetch_category_page(category_slug, page_num)
        if payload:
            api_captures.append((f"{API_LISTINGS_URL}?type=apps&page={page_one_based}&pageSize=12&language=en&category={category_slug}", payload))
            print(f"Fetched page {page_one_based}.", file=sys.stderr)
            time.sleep(0.3)
        else:
            print(f"Failed to fetch page {page_one_based}.", file=sys.stderr)

    app_pages = set()
    for res_url, payload in api_captures:
        if not isinstance(payload, dict):
            continue
        res_url_lower = res_url.lower()
        if "type=apps" not in res_url_lower:
            continue
        if slug_lower and slug_lower not in res_url_lower:
            if "category" not in res_url_lower and "businessneed" not in res_url_lower:
                continue
        app_pages.add(_page_number_from_url(res_url))
    if app_pages:
        print(f"Using pages: {sorted(app_pages)}", file=sys.stderr)

    raw = _parse_category_apps_response(api_captures, category_slug, max_pages=max_pages)
    if not raw["sponsored"] and not raw["organic"]:
        legacy = parse_category_page(html, category_url)
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
                "category": category_slug,
                "category_url": category_url,
            })
        raw = {"sponsored": [], "organic": organic}

    def add_meta(lst: List[Dict[str, Any]]) -> None:
        for r in lst:
            r["url"] = r.get("url") or f"{BASE_URL}/appxListingDetail?listingId={r.get('listing_id')}"
            if r.get("url") and not r["url"].startswith("http"):
                r["url"] = urljoin(BASE_URL, r["url"])
            r["category"] = category_slug
            r["category_url"] = category_url

    add_meta(raw["sponsored"])
    add_meta(raw["organic"])
    return raw["sponsored"], raw["organic"], html, api_captures


def write_json(
    category_url: str,
    category_slug: str,
    sponsored: List[Dict[str, Any]],
    organic: List[Dict[str, Any]],
    output_path: str,
) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {"category_url": category_url, "category": category_slug, "sponsored": sponsored, "organic": organic},
            f, indent=2, ensure_ascii=False,
        )


def write_csv(
    category_url: str,
    category_slug: str,
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
        "categories", "is_sponsored", "category", "category_url",
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
        description="Fetch Salesforce AppExchange category page app list (sponsored + organic, full card fields).",
    )
    parser.add_argument(
        "category",
        help="Category slug (e.g. customerService) or full category URL.",
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=1,
        metavar="N",
        help="Number of result pages to fetch (default: 1).",
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Output JSON path (default: files/category-<slug>.json)",
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
        help="Save fetched HTML to file (for debugging; only when Playwright is used).",
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
        help="Only use direct API; do not open browser if API returns empty.",
    )
    args = parser.parse_args()

    category_url, category_slug = build_category_url(args.category)
    safe_slug = re.sub(r"[^\w\-]", "-", category_slug.strip())[:60]
    default_output = os.path.join(OUTPUT_DIR, f"category-{safe_slug}.json")
    output_path = args.output or default_output

    # API first
    sponsored, organic, html, api_captures = fetch_category_results_api_only(
        category_slug, max_pages=args.pages,
    )
    if sponsored or organic:
        for r in sponsored + organic:
            r["url"] = r.get("url") or f"{BASE_URL}/appxListingDetail?listingId={r.get('listing_id')}"
            if r.get("url") and not r["url"].startswith("http"):
                r["url"] = urljoin(BASE_URL, r["url"])
            r["category"] = category_slug
            r["category_url"] = category_url
    else:
        if args.no_browser:
            print("Direct API returned no results.", file=sys.stderr)
            return 1
        print("API returned no results, trying Playwright...", file=sys.stderr)
        try:
            sponsored, organic, html, api_captures = fetch_category_results_playwright(
                category_url, category_slug, max_pages=args.pages,
            )
        except Exception as e:
            print(f"Playwright failed: {e}", file=sys.stderr)
            return 1
        if not sponsored and not organic:
            print("Direct API returned no results.", file=sys.stderr)
            return 1

    if args.save_html and html:
        os.makedirs(os.path.dirname(args.save_html) or ".", exist_ok=True)
        with open(args.save_html, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Saved HTML to {args.save_html}", file=sys.stderr)

    if api_captures:
        api_path = args.debug_api or re.sub(r"\.json$", "-api.json", output_path) or os.path.join(OUTPUT_DIR, f"category-{safe_slug}-api.json")
        os.makedirs(os.path.dirname(api_path) or ".", exist_ok=True)
        with open(api_path, "w", encoding="utf-8") as f:
            json.dump([{"url": u, "payload": p} for u, p in api_captures], f, indent=2, ensure_ascii=False)
        print(f"Saved API responses to {api_path}", file=sys.stderr)

    total = len(sponsored) + len(organic)
    print(f"Found {len(sponsored)} sponsored, {len(organic)} organic ({total} total) for category: {category_slug}", file=sys.stderr)

    write_json(category_url, category_slug, sponsored, organic, output_path)
    print(f"Wrote {output_path}")

    if args.csv:
        write_csv(category_url, category_slug, sponsored, organic, args.csv)
        print(f"Wrote {args.csv}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
