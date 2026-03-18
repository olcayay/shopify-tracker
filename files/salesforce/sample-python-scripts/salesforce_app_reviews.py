#!/usr/bin/env python3
"""
Salesforce AppExchange App Reviews

Opens the Reviews tab (appxListingDetail?listingId=...&tab=r), clicks "Show More"
until all reviews are loaded, then extracts each review: name, rating, date, title,
review message, replied (yes/no), like count. Uses Playwright only. Outputs CSV
with optional aggregate row from JSON-LD.
"""

import argparse
import csv
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

BASE_URL = "https://appexchange.salesforce.com"
OUTPUT_DIR = "files"
REVIEWS_TAB_SUFFIX = "&tab=r"
REQUEST_TIMEOUT_MS = 45000
SHOW_MORE_WAIT_MS = 1500
MAX_SHOW_MORE_CLICKS = 80
EXTRACT_EVERY_N_CLICKS = 5  # Extract reviews every N clicks to avoid huge DOM / target crash

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def build_reviews_url(listing_id: str) -> str:
    return f"{BASE_URL}/appxListingDetail?listingId={listing_id}{REVIEWS_TAB_SUFFIX}"


def extract_json_ld_rating(html: str) -> tuple:
    for m in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    ):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
            items = data if isinstance(data, list) else data
            for item in (items if isinstance(items, list) else [items]):
                if isinstance(item, dict) and item.get("@type") == "SoftwareApplication":
                    rating = item.get("aggregateRating")
                    if isinstance(rating, dict):
                        rv = rating.get("ratingValue")
                        rc = rating.get("reviewCount")
                        return (rv, int(rc) if rc is not None else None)
        except (json.JSONDecodeError, TypeError):
            continue
    return (None, None)


def _extract_review_texts_from_page(page: Any) -> List[str]:
    """Extract review block texts via locators (avoids page.content() to reduce memory)."""
    reviews = []
    try:
        rating_els = page.locator("text=/\\d\\s*out of\\s*5|\\d\\s*\\/\\s*5\\s*star/i").all()
        for el in rating_els:
            try:
                container = el.locator(
                    "xpath=ancestor::*[string-length(normalize-space(.)) > 80][position() <= 5]"
                ).first
                text = container.inner_text(timeout=1000)
                if text and 60 <= len(text) <= 8000:
                    reviews.append(text.strip())
            except Exception:
                continue
    except Exception:
        pass
    return reviews


def fetch_with_playwright(listing_id: str, max_clicks: int = MAX_SHOW_MORE_CLICKS) -> tuple:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError(
            "playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    url = build_reviews_url(listing_id)
    aggregate_rating = None
    aggregate_count = None
    seen_keys: set = set()
    all_reviews: List[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=REQUEST_TIMEOUT_MS)
            page.wait_for_timeout(3000)

            # Get aggregate from initial HTML (small DOM)
            try:
                html = page.content()
                aggregate_rating, aggregate_count = extract_json_ld_rating(html)
            except Exception:
                pass

            # Click "Show More" and extract incrementally to avoid target crash from huge DOM
            for click_num in range(max_clicks):
                try:
                    btn = page.get_by_text("Show More", exact=False).first
                    if not btn.is_visible(timeout=2000):
                        break
                    btn.click(timeout=3000)
                    page.wait_for_timeout(SHOW_MORE_WAIT_MS)
                except Exception:
                    break

                # Extract every N clicks so we keep progress if browser crashes later
                if (click_num + 1) % EXTRACT_EVERY_N_CLICKS == 0:
                    for text in _extract_review_texts_from_page(page):
                        key = text[:100].strip()
                        if key not in seen_keys:
                            seen_keys.add(key)
                            all_reviews.append(text)

            # Final extraction
            for text in _extract_review_texts_from_page(page):
                key = text[:100].strip()
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_reviews.append(text)

        except Exception as e:
            if "Target crashed" in str(e) or "crash" in str(e).lower():
                pass  # use all_reviews collected so far
            else:
                raise
        finally:
            try:
                browser.close()
            except Exception:
                pass

    return (aggregate_rating, aggregate_count, all_reviews)


def parse_review_text(full_text: str) -> Dict[str, Any]:
    """Parse a single review block text into name, rating, date, title, message, replied, like_count."""
    # Extract like count first and remove from text for message
    like_count = ""
    m = re.search(r"(\d+)\s*(?:Like|like)s?\b", full_text)
    if m:
        like_count = m.group(1)
    text_clean = re.sub(r"\d+\s*(?:Like|like)s?\b", "", full_text)

    lines = [ln.strip() for ln in text_clean.split("\n") if ln.strip()]
    name = ""
    rating = ""
    date = ""
    title = ""
    message = ""
    replied = "1" if re.search(r"developer\s+reply|reply\s+from|replied", text_clean, re.I) else "0"

    for i, line in enumerate(lines):
        if re.match(r"^[1-5](\.\d+)?\s*(out of|\/)\s*5", line, re.I) or re.match(r"^[1-5]\s*$", line):
            rating = line[:30].strip()
        elif re.match(r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{4}-\d{2}-\d{2}", line):
            date = line[:30].strip()
        elif re.search(r"(\d+)\s*(like|helpful)", line, re.I) and not like_count:
            m = re.search(r"(\d+)\s*(like|helpful)", line, re.I)
            if m:
                like_count = m.group(1)
        elif len(line) > 3 and len(line) < 120 and not name and not title and "out of" not in line:
            if not name:
                name = line
            elif not title:
                title = line
        elif len(line) > 50 and "out of" not in line and "Like" not in line:
            if not message:
                message = line
            else:
                message += " " + line

    if not name and lines:
        name = lines[0][:100] if len(lines[0]) < 100 else ""
    if not message and lines:
        long_lines = [l for l in lines if len(l) > 60 and "out of" not in l]
        message = " ".join(long_lines)[:5000] if long_lines else text_clean[:5000]

    return {
        "name": name[:200],
        "rating": rating,
        "date": date,
        "title": title[:300],
        "review_message": message[:5000],
        "replied": replied,
        "like_count": like_count,
    }


def write_csv(
    listing_id: str,
    average_rating: Optional[Any],
    review_count: Optional[int],
    reviews: List[Dict[str, Any]],
    output_path: str,
) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    fieldnames = [
        "listing_id",
        "name",
        "rating",
        "date",
        "title",
        "review_message",
        "replied",
        "like_count",
        "is_aggregate",
    ]
    rows = []
    rows.append(
        {
            "listing_id": listing_id,
            "name": "Aggregate",
            "rating": str(average_rating) if average_rating is not None else "",
            "date": "",
            "title": "",
            "review_message": f"review_count={review_count}" if review_count is not None else "",
            "replied": "",
            "like_count": "",
            "is_aggregate": "1",
        }
    )
    for r in reviews:
        rows.append(
            {
                "listing_id": listing_id,
                "name": r.get("name", ""),
                "rating": r.get("rating", ""),
                "date": r.get("date", ""),
                "title": r.get("title", ""),
                "review_message": r.get("review_message", ""),
                "replied": r.get("replied", "0"),
                "like_count": r.get("like_count", ""),
                "is_aggregate": "0",
            }
        )
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch all Salesforce AppExchange app reviews from the Reviews tab (Show More until end) and export to CSV.",
    )
    parser.add_argument(
        "listing_id",
        help="Listing ID (e.g. a0N4V00000JTeWyUAL).",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Output CSV path (default: files/reviews-<listing_id>.csv)",
    )
    parser.add_argument(
        "--max-clicks",
        type=int,
        default=MAX_SHOW_MORE_CLICKS,
        help=f"Max 'Show More' clicks (default: {MAX_SHOW_MORE_CLICKS})",
    )
    args = parser.parse_args()

    listing_id = args.listing_id.strip()
    output_path = args.output or os.path.join(OUTPUT_DIR, f"reviews-{listing_id}.csv")

    try:
        aggregate_rating, aggregate_count, raw_reviews = fetch_with_playwright(
            listing_id, max_clicks=args.max_clicks
        )
    except Exception as e:
        print(f"Failed: {e}", file=sys.stderr)
        return 1

    reviews = []
    for text in raw_reviews:
        if isinstance(text, str):
            reviews.append(parse_review_text(text))

    print(
        f"Aggregate: rating={aggregate_rating}, review_count={aggregate_count}; extracted reviews: {len(reviews)}"
    )
    write_csv(listing_id, aggregate_rating, aggregate_count, reviews, output_path)
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
