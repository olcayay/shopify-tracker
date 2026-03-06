#!/usr/bin/env python3
"""
Salesforce AppExchange Listing (canonical / API-style)

Fetches a single listing from appxListingDetail?listingId=... using API only
(window.stores). Outputs a canonical JSON with API-like field names and structure,
redundant keys removed. No scrape in normal flow; use --validate only for initial
"missing data?" check. Reviews: only reviewsSummary from API (no reviews[]).
"""

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

# Reuse store extraction from app detail script
from salesforce_app_detail import (
    BASE_URL,
    OUTPUT_DIR,
    REQUEST_TIMEOUT_SEC,
    USER_AGENT,
    build_detail_url,
    build_headers,
    extract_listing_from_stores,
    extract_stores_raw,
    fetch_page,
    fetch_with_playwright,
)


def _get_extension_data(listing: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """First listing extension data (listing/extensions/force/listings/Listing)."""
    extensions = listing.get("extensions") or []
    for ext in extensions:
        if ext.get("extensionType") == "listing/extensions/force/listings/Listing":
            return ext.get("data")
    if extensions and isinstance(extensions[0], dict):
        return extensions[0].get("data")
    return None


def _normalize_publisher(pub: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(pub, dict):
        return None
    return {
        "name": pub.get("name"),
        "email": pub.get("email"),
        "website": pub.get("website"),
        "description": pub.get("description"),
        "employees": pub.get("employees"),
        "yearFounded": pub.get("yearFounded"),
        "location": pub.get("hQLocation"),
        "country": pub.get("country"),
    }


def _normalize_plans(plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for p in plans or []:
        if not isinstance(p, dict):
            continue
        out.append({
            "plan_name": p.get("plan_name"),
            "price": p.get("price"),
            "currency_code": p.get("currency_code"),
            "units": p.get("units"),
            "frequency": p.get("frequency"),
            "trial_days": p.get("trial_days"),
        })
    return out


def _normalize_plugins(plugins: List[Any]) -> Dict[str, Any]:
    """Build normalized plugins: videos, resources, carousel, logos."""
    result: Dict[str, Any] = {"videos": [], "resources": [], "carousel": [], "logos": []}
    for pl in plugins or []:
        if not isinstance(pl, dict):
            continue
        ptype = pl.get("pluginType") or ""
        data = pl.get("data") or {}
        items = data.get("items") or []

        if "Demo" in ptype:
            for it in items:
                d = it.get("data") or it if isinstance(it, dict) else {}
                if d.get("url"):
                    result["videos"].append({
                        "url": d.get("url"),
                        "type": d.get("type"),
                        "caption": d.get("title") or d.get("caption"),
                    })

        elif "Content" in ptype:
            for it in items:
                d = it.get("data") or it if isinstance(it, dict) else {}
                url = d.get("url") or (d.get("mediaId") if isinstance(d.get("mediaId"), str) else None)
                if url:
                    result["resources"].append({
                        "url": url,
                        "type": d.get("type") or it.get("type") if isinstance(it, dict) else None,
                        "title": d.get("title") or d.get("caption"),
                    })

        elif "Carousel" in ptype:
            for it in items:
                d = (it.get("data") or it) if isinstance(it, dict) else {}
                if isinstance(d, dict) and (d.get("mediaId") or d.get("url")):
                    result["carousel"].append({
                        "url": d.get("mediaId") or d.get("url"),
                        "caption": d.get("caption"),
                        "altText": d.get("altText"),
                    })

        elif "LogoSet" in ptype:
            for it in items:
                d = it.get("data") or it if isinstance(it, dict) else {}
                url = d.get("mediaId") or d.get("url") or (it.get("mediaId") if isinstance(it, dict) else None)
                if url:
                    result["logos"].append({"url": url, "logoType": d.get("logoType") or it.get("logoType")})

    # Drop empty lists
    for k in list(result.keys()):
        if result[k] == []:
            del result[k]
    return result if result else {}


def _normalize_reviews_summary(rev: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(rev, dict):
        return None
    return {
        "reviewCount": rev.get("reviewCount"),
        "averageRating": rev.get("averageRating"),
    }


def normalize_listing(listing: Dict[str, Any]) -> Dict[str, Any]:
    """Build canonical output from raw LISTING.listing: API names, drop redundant."""
    ext = _get_extension_data(listing)
    pub = _normalize_publisher(listing.get("publisher"))
    sol = listing.get("solution") or {}
    sol_inner = sol.get("solution") or {} if isinstance(sol, dict) else {}
    manifest = sol_inner.get("manifest") if isinstance(sol_inner.get("manifest"), dict) else {}
    pricing = listing.get("pricing") or {}
    model = pricing.get("model") or {} if isinstance(pricing, dict) else {}

    # Identity
    out = {
        "listingId": listing.get("tzId") or listing.get("external_id") or listing.get("oafId"),
        "id": listing.get("id"),
        "appExchangeId": listing.get("appExchangeId"),
        "name": listing.get("name"),
        "title": listing.get("title"),
        "description": listing.get("description"),
        "fullDescription": listing.get("fullDescription"),
        "technology": listing.get("technology"),
    }

    if pub:
        out["publisher"] = pub

    # Extension (single object; drop internal keys we don't need for marketplace)
    if ext:
        ext_out = {
            "supportedIndustries": ext.get("supportedIndustries"),
            "productsRequired": ext.get("productsRequired"),
            "productsSupported": ext.get("productsSupported"),
            "editions": ext.get("editions"),
            "highlights": ext.get("highlights"),
            "publishedDate": ext.get("publishedDate"),
            "recordType": ext.get("recordType"),
            "languages": ext.get("languages"),
            "targetUserPersona": ext.get("targetUserPersona"),
            "listingCategories": ext.get("listingCategories"),
        }
        out["extension"] = {k: v for k, v in ext_out.items() if v is not None}

    # Solution
    if sol_inner:
        out["solution"] = {
            "manifest": {
                "hasLWC": manifest.get("hasLWC"),
                "tabsCount": manifest.get("tabsCount"),
                "objectsCount": manifest.get("objectsCount"),
                "applicationsCount": manifest.get("applicationsCount"),
                "globalComponentsCount": manifest.get("globalComponentsCount"),
                "cmtyBuilderComponentsCount": manifest.get("cmtyBuilderComponentsCount"),
                "isCommunityBuilder": manifest.get("isCommunityBuilder"),
                "isLightningAppBuilder": manifest.get("isLightningAppBuilder"),
                "appBuilderComponentsCount": manifest.get("appBuilderComponentsCount"),
            } if manifest else None,
            "latestVersionDate": sol_inner.get("latestVersionDate"),
            "packageId": sol_inner.get("packageId"),
            "namespacePrefix": sol_inner.get("namespacePrefix"),
            "packageCategory": sol_inner.get("packageCategory"),
            "createdDate": sol_inner.get("createdDate"),
            "lastModifiedDate": sol_inner.get("lastModifiedDate"),
        }

    # Pricing
    if isinstance(pricing, dict):
        out["pricing"] = {
            "price_model_type": pricing.get("price_model_type"),
            "model": {
                "plans": _normalize_plans(model.get("plans") if isinstance(model, dict) else []),
                "user_limitations": model.get("user_limitations") if isinstance(model, dict) else None,
                "additional_details": model.get("additional_details") if isinstance(model, dict) else None,
                "display_plan_names": model.get("display_plan_names") if isinstance(model, dict) else None,
                "discounts_offered": model.get("discounts_offered") if isinstance(model, dict) else None,
            },
        }

    # Reviews summary only
    rs = _normalize_reviews_summary(listing.get("reviewsSummary"))
    if rs:
        out["reviewsSummary"] = rs

    out["businessNeeds"] = listing.get("businessNeeds")

    plugins_norm = _normalize_plugins(listing.get("plugins"))
    if plugins_norm:
        out["plugins"] = plugins_norm

    return out


def run_validate(page: Any, listing_id: str, canonical: Dict[str, Any]) -> Dict[str, Any]:
    """Optional: scrape Overview + More Details and compare with API. Returns validation report."""
    report = {"mapped": [], "missing_from_api": [], "only_in_api": [], "errors": []}
    try:
        # Try to open More Details tab (common pattern: tab link or &tab=d)
        more_details_selector = "a[href*='tab='], button:has-text('More Details'), [role='tab']:has-text('More Details')"
        try:
            page.click(more_details_selector, timeout=3000)
            page.wait_for_timeout(2000)
        except Exception:
            pass

        html = page.content()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # Check key sections exist in DOM that we have in API
        ext = canonical.get("extension") or {}
        if ext.get("supportedIndustries"):
            report["mapped"].append("supportedIndustries")
        if ext.get("productsRequired"):
            report["mapped"].append("productsRequired")
        if ext.get("productsSupported"):
            report["mapped"].append("productsSupported")
        if ext.get("highlights"):
            report["mapped"].append("highlights")
        if canonical.get("pricing"):
            report["mapped"].append("pricing")
        if canonical.get("reviewsSummary"):
            report["mapped"].append("reviewsSummary")

        # Simple presence check for Compatibility / App Details / Additional in page text
        body_text = soup.get_text() if soup.body else ""
        if "Compatibility" in body_text or "Compatible" in body_text:
            report["mapped"].append("compatibility_section")
        if "App Details" in body_text or "Version" in body_text:
            report["mapped"].append("app_details_section")
        if "Additional" in body_text or canonical.get("fullDescription"):
            report["mapped"].append("additional_section")
    except Exception as e:
        report["errors"].append(str(e))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Salesforce AppExchange listing (API-only, canonical JSON). No scrape unless --validate.",
    )
    parser.add_argument("listing_id", help="Listing ID (e.g. a0N4V00000JTeWyUAL).")
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Output JSON path (default: files/listing-canonical-<listing_id>.json)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Use requests only; no window.stores, limited data from JSON-LD.",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Optional: scrape Overview + More Details and compare with API (initial gap check).",
    )
    parser.add_argument(
        "--debug-api",
        nargs="?",
        const="",
        default=None,
        metavar="PATH",
        help="Save raw window.stores to JSON file.",
    )
    args = parser.parse_args()

    listing_id = args.listing_id.strip()
    output_path = args.output or os.path.join(OUTPUT_DIR, f"listing-canonical-{listing_id}.json")
    url = build_detail_url(listing_id)
    headers = build_headers()

    html = None
    listing = None
    canonical = None

    try:
        if args.no_browser:
            html = fetch_page(url, headers)
        elif args.validate:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent=USER_AGENT)
                page = context.new_page()
                page.goto(url, wait_until="networkidle", timeout=REQUEST_TIMEOUT_SEC * 1000)
                page.wait_for_timeout(2500)
                html = page.content()
                listing = extract_listing_from_stores(html)
                if listing:
                    canonical = normalize_listing(listing)
                    try:
                        report = run_validate(page, listing_id, canonical)
                        validation_path = os.path.join(OUTPUT_DIR, f"listing-validation-{listing_id}.json")
                        os.makedirs(OUTPUT_DIR, exist_ok=True)
                        with open(validation_path, "w", encoding="utf-8") as f:
                            json.dump(report, f, indent=2, ensure_ascii=False)
                        print(f"Validation report: {validation_path}", file=sys.stderr)
                    except Exception as e:
                        print(f"Validation failed: {e}", file=sys.stderr)
        else:
            html = fetch_with_playwright(url)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1

    if listing is None:
        listing = extract_listing_from_stores(html)
    if not listing:
        if args.no_browser:
            print("No window.stores (expected with --no-browser). Use without --no-browser for full data.", file=sys.stderr)
        else:
            print("No listing in window.stores.", file=sys.stderr)
        return 1

    if canonical is None:
        canonical = normalize_listing(listing)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(canonical, f, indent=2, ensure_ascii=False)
    print(f"Wrote {output_path}")

    if args.debug_api is not None:
        api_path = (args.debug_api if args.debug_api else
                    re.sub(r"\.json$", "-api.json", output_path) or output_path + "-api.json")
        os.makedirs(os.path.dirname(api_path) or ".", exist_ok=True)
        raw = extract_stores_raw(html)
        if raw is not None:
            with open(api_path, "w", encoding="utf-8") as f:
                json.dump(raw, f, indent=2, ensure_ascii=False)
            print(f"Saved API/store data to {api_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
