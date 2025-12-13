#!/usr/bin/env python3
"""
Geocode listings via Nominatim using search.json as input.

Usage:
  python3 tools/geocode_nominatim.py --search-json ../search.json --output tools/geocode_results.csv

Notes:
- Respects Nominatim usage policy (1 rps, retries with backoff).
- No client-side geocoding; runs locally.
"""
import argparse
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests


def load_listings(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_country(listing: Dict[str, Any]) -> str:
    country_slug = (listing.get("country_slug") or "").lower()
    if country_slug == "new-zealand":
        return "New Zealand"
    return listing.get("country") or ""


def build_query(listing: Dict[str, Any]) -> Tuple[str, str]:
    """Return (query, query_used_description)."""
    country = normalize_country(listing)
    title = listing.get("title") or listing.get("name") or ""
    address = listing.get("address") or ""
    city = listing.get("city") or ""
    region = listing.get("region") or ""
    geo_query = listing.get("geo_query") or ""

    def join_parts(parts: List[str]) -> str:
        return ", ".join([p for p in parts if p])

    candidates = []
    if geo_query:
        candidates.append(("geo_query", geo_query))
    if address or city or region or country:
        candidates.append(("address_city_region_country", join_parts([address, city, region, country])))
    if title and (city or region or country) and not address:
        candidates.append(("title_city_region_country", join_parts([title, city, region, country])))
    if city or region or country:
        candidates.append(("city_region_country", join_parts([city, region, country])))
    if region or country:
        candidates.append(("region_country", join_parts([region, country])))

    for label, query in candidates:
        if query:
            return query, label
    return "", "none"


def rate_limited_request(session: requests.Session, url: str, params: Dict[str, Any], last_time: List[float]) -> requests.Response:
    # Enforce at least 1 second between requests
    now = time.time()
    elapsed = now - last_time[0]
    if elapsed < 1:
        time.sleep(1 - elapsed)
    last_time[0] = time.time()

    max_retries = 3
    backoff = 1
    for attempt in range(max_retries):
        resp = session.get(url, params=params, timeout=15)
        if resp.status_code in (429, 500, 502, 503, 504):
            if attempt == max_retries - 1:
                return resp
            time.sleep(backoff)
            backoff *= 2
            continue
        return resp
    return resp


def bucket_confidence(place_rank: int, result_type: str, result_class: str) -> Tuple[str, str]:
    # place_rank meaning: higher is more precise (30=house, 16=state/country)
    if place_rank >= 28:
        return "high", f"place_rank={place_rank}"
    if place_rank >= 26 and result_class in {"building", "amenity", "shop", "office", "tourism"}:
        return "high", f"class={result_class}"
    if place_rank >= 22:
        return "medium", f"place_rank={place_rank}"
    if place_rank >= 16:
        return "low", f"place_rank={place_rank}"
    return "low", f"broad place_rank={place_rank}"


def geocode_listing(session: requests.Session, listing: Dict[str, Any]) -> Dict[str, Any]:
    query, query_strategy = build_query(listing)
    if not query:
        return {
            "result": None,
            "query": query,
            "query_strategy": query_strategy,
            "bucket": "none",
            "notes": "no_query"
        }

    params = {
        "format": "jsonv2",
        "q": query,
        "addressdetails": 0,
        "limit": 1
    }
    if normalize_country(listing) == "New Zealand" or (listing.get("country_slug") or "").lower() == "new-zealand":
        params["countrycodes"] = "nz"
    url = "https://nominatim.openstreetmap.org/search"
    response = rate_limited_request(session, url, params, geocode_listing.last_request_time)
    if not response.ok:
        return {
            "result": None,
            "query": query,
            "query_strategy": query_strategy,
            "bucket": "none",
            "notes": f"http_{response.status_code}"
        }

    data = response.json()
    if not data:
        return {
            "result": None,
            "query": query,
            "query_strategy": query_strategy,
            "bucket": "none",
            "notes": "no_results"
        }

    best = data[0]
    place_rank = int(best.get("place_rank", 0))
    result_type = best.get("type") or ""
    result_class = best.get("class") or ""
    bucket, reason = bucket_confidence(place_rank, result_type, result_class)
    return {
        "result": best,
        "query": query,
        "query_strategy": query_strategy,
        "bucket": bucket,
        "notes": reason
    }


geocode_listing.last_request_time = [0.0]


def main():
    parser = argparse.ArgumentParser(description="Geocode listings via Nominatim")
    parser.add_argument("--search-json", default="../search.json", help="Path or URL to search.json")
    parser.add_argument("--output", default="tools/geocode_results.csv", help="Path for CSV output")
    parser.add_argument("--user-agent", default="Homegrown Directory geocoder (contact: info@homegrowndirectory.com)", help="User-Agent for Nominatim requests")
    args = parser.parse_args()

    search_path = args.search_json
    if search_path.startswith("http"):
        resp = requests.get(search_path, timeout=15)
        resp.raise_for_status()
        listings = resp.json()
    else:
        listings = load_listings(Path(search_path))

    session = requests.Session()
    session.headers.update({"User-Agent": args.user_agent})

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "slug",
        "url",
        "collection",
        "title",
        "country",
        "region",
        "city",
        "address",
        "query",
        "query_strategy",
        "matched_display_name",
        "matched_type",
        "matched_class",
        "lat",
        "lon",
        "importance",
        "place_rank",
        "osm_type",
        "osm_id",
        "confidence_bucket",
        "notes"
    ]

    summary_counts = {"high": 0, "medium": 0, "low": 0, "none": 0}
    failure_reasons: Dict[str, int] = {}

    with output_path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for listing in listings:
            result = geocode_listing(session, listing)
            bucket = result["bucket"]
            summary_counts[bucket] = summary_counts.get(bucket, 0) + 1
            if bucket == "none":
                failure_reasons[result["notes"]] = failure_reasons.get(result["notes"], 0) + 1

            best = result["result"] or {}
            matched_display_name = best.get("display_name") or ""
            writer.writerow({
                "slug": listing.get("slug") or "",
                "url": listing.get("url") or "",
                "collection": listing.get("collection") or "",
                "title": listing.get("title") or listing.get("name") or "",
                "country": normalize_country(listing) or "",
                "region": listing.get("region") or "",
                "city": listing.get("city") or "",
                "address": listing.get("address") or "",
                "query": result["query"],
                "query_strategy": result["query_strategy"],
                "matched_display_name": matched_display_name,
                "matched_type": best.get("type") or "",
                "matched_class": best.get("class") or "",
                "lat": best.get("lat") or "",
                "lon": best.get("lon") or "",
                "importance": best.get("importance") or "",
                "place_rank": best.get("place_rank") or "",
                "osm_type": best.get("osm_type") or "",
                "osm_id": best.get("osm_id") or "",
                "confidence_bucket": bucket,
                "notes": result["notes"]
            })

    total = len(listings)
    print(f"Total processed: {total}")
    for level in ("high", "medium", "low", "none"):
        print(f"{level.title()}: {summary_counts.get(level, 0)}")
    if failure_reasons:
        print("Top failure reasons:")
        for reason, count in sorted(failure_reasons.items(), key=lambda x: x[1], reverse=True)[:20]:
            print(f"- {reason}: {count}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
