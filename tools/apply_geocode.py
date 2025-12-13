#!/usr/bin/env python3
"""
Apply geocode results into listing front matter with backups and logging.

Usage:
  python3 tools/apply_geocode.py --results tools/geocode_results.csv [--overwrite]

Only applies rows with confidence_bucket in (high, medium). Creates backups and a log.
"""
import argparse
import csv
import shutil
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


VALID_COLLECTIONS = {"farms", "markets", "stores", "restaurants", "vendors", "distributors"}


def load_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def has_valid_coords(value: Any, lon: bool = False) -> bool:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return False
    if lon:
        return -180 <= num <= 180
    return -90 <= num <= 90


def is_valid_pair(lat: Any, lon: Any) -> bool:
    return has_valid_coords(lat, lon=False) and has_valid_coords(lon, lon=True)


def parse_path_from_listing(slug: str, collection: str, url: str) -> Optional[Path]:
    if collection in VALID_COLLECTIONS and slug:
        candidate = Path(f"_{collection}") / f"{slug}.md"
        if candidate.exists():
            return candidate
    if url:
        parts = url.strip("/").split("/")
        if len(parts) >= 2:
            collection_guess, slug_guess = parts[0], parts[1]
            if collection_guess in VALID_COLLECTIONS:
                candidate = Path(f"_{collection_guess}") / f"{slug_guess}.md"
                if candidate.exists():
                    return candidate
    return None


def load_front_matter(path: Path) -> Tuple[Dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    front_matter = parts[1]
    body = parts[2]
    data = yaml.safe_load(front_matter) or {}
    return data, body


def write_front_matter(path: Path, data: Dict[str, Any], body: str) -> None:
    yaml_dump = yaml.safe_dump(data, sort_keys=False, allow_unicode=True).strip()
    path.write_text(f"---\n{yaml_dump}\n---{body}", encoding="utf-8")


def ensure_backup(src: Path, backup_root: Path) -> None:
    dest = backup_root / src
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def today_nz() -> str:
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("Pacific/Auckland")
        now = datetime.now(tz)
    except Exception:
        # Fallback: UTC+12 approximation
        now = datetime.now(timezone(timedelta(hours=12)))
    return now.strftime("%Y-%m-%d")


def derive_geo_label(display_name: str, city: str, region: str) -> str:
    if display_name:
        return display_name.split(",")[0].strip()
    if city and region:
        return f"{city}, {region}"
    return city or region or ""


def apply_row(row: Dict[str, str], overwrite: bool, backup_root: Path, log_lines: List[str]) -> None:
    slug = row.get("slug") or ""
    collection = row.get("collection") or ""
    url = row.get("url") or ""
    bucket = (row.get("confidence_bucket") or "").lower()
    if bucket not in {"high", "medium"}:
        return

    path = parse_path_from_listing(slug, collection, url)
    if not path:
        log_lines.append(f"SKIP: no file for slug={slug} collection={collection} url={url}")
        return

    data, body = load_front_matter(path)
    lat_existing = data.get("lat")
    lon_existing = data.get("lon")
    if not overwrite and is_valid_pair(lat_existing, lon_existing):
        log_lines.append(f"SKIP valid coords: {path}")
        return

    try:
        lat_new = float(row["lat"])
        lon_new = float(row["lon"])
    except (TypeError, ValueError):
        log_lines.append(f"SKIP invalid new coords: {path}")
        return

    ensure_backup(path, backup_root)

    data["lat"] = lat_new
    data["lon"] = lon_new
    data["geo_precision"] = "exact" if bucket == "high" else "approx"
    data["geo_source"] = "nominatim"
    data["geo_last_verified"] = today_nz()

    if not data.get("geo_label"):
        data["geo_label"] = derive_geo_label(row.get("matched_display_name") or "", row.get("city") or "", row.get("region") or "")

    if not data.get("geo_query"):
        data["geo_query"] = row.get("query_used") or ""

    write_front_matter(path, data, body)
    log_lines.append(f"UPDATED {path} lat={lat_new} lon={lon_new} precision={data['geo_precision']}")


def main():
    parser = argparse.ArgumentParser(description="Apply geocoded coordinates to listings")
    parser.add_argument("--results", default="tools/geocode_results.csv", help="Path to geocode results CSV")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing valid coordinates")
    parser.add_argument("--log", default="tools/apply_geocode_log.txt", help="Path to log file")
    parser.add_argument("--backup-dir", default="tools/backup", help="Directory to store backups")
    args = parser.parse_args()

    results_path = Path(args.results)
    backup_root = Path(args.backup_dir)
    backup_root.mkdir(parents=True, exist_ok=True)

    rows = load_csv(results_path)
    log_lines: List[str] = []

    for row in rows:
        apply_row(row, args.overwrite, backup_root, log_lines)

    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"Applied updates logged to {log_path}")
    print(f"Backups stored under {backup_root}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
