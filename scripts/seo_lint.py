#!/usr/bin/env python3
"""
SEO lint: checks built HTML in _site for
1) duplicate <title> values
2) missing/empty meta descriptions (or multiple descriptions)
3) missing JSON-LD on listing pages
"""

import json
import sys
from html.parser import HTMLParser
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "seo_lint_config.json"
SITE_DIR = Path(__file__).resolve().parent.parent / "_site"


class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.titles = []
        self.current_title = []
        self.meta_descriptions = []
        self.ld_json_count = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "title":
            self.in_title = True
            self.current_title = []
        if tag.lower() == "meta":
            attrs_dict = {k.lower(): (v or "") for k, v in attrs}
            name = attrs_dict.get("name", "").lower()
            if name == "description":
                content = attrs_dict.get("content", "").strip()
                self.meta_descriptions.append(content)
        if tag.lower() == "script":
            attrs_dict = {k.lower(): (v or "") for k, v in attrs}
            if attrs_dict.get("type", "").lower() == "application/ld+json":
                self.ld_json_count += 1

    def handle_endtag(self, tag):
        if tag.lower() == "title" and self.in_title:
            title_text = "".join(self.current_title).strip()
            self.titles.append(title_text)
            self.in_title = False
            self.current_title = []

    def handle_data(self, data):
        if self.in_title:
            self.current_title.append(data)


def load_config():
    with CONFIG_PATH.open() as f:
        return json.load(f)


def url_path_from_file(file_path: Path) -> str:
    rel = file_path.relative_to(SITE_DIR).as_posix()
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return "/" + rel


def main():
    if not SITE_DIR.exists():
        print("ERROR: _site/ not found. Build the site first (bundle exec jekyll build).")
        return 1

    config = load_config()
    listing_prefixes = config.get("listing_prefixes", [])
    ignore_paths = set(config.get("ignore_paths", []))
    allow_dupe_paths = set(config.get("allow_duplicate_titles_for_paths", []))

    duplicate_map = {}
    desc_issues = []
    ld_json_issues = []

    for file_path in SITE_DIR.rglob("*.html"):
        url_path = url_path_from_file(file_path)
        if url_path in ignore_paths:
            continue

        parser = HeadParser()
        try:
            parser.feed(file_path.read_text(encoding="utf-8"))
        except Exception as exc:
            desc_issues.append(
                (url_path, f"parse_error: {exc.__class__.__name__}: {exc}")
            )
            continue

        title = parser.titles[0].strip() if parser.titles else ""
        if title:
            duplicate_map.setdefault(title, []).append(url_path)
        else:
            desc_issues.append((url_path, "missing_title"))

        if len(parser.meta_descriptions) == 0:
            desc_issues.append((url_path, "missing_description"))
        elif len(parser.meta_descriptions) > 1:
            desc_issues.append((url_path, "multiple_descriptions"))
        else:
            content = parser.meta_descriptions[0].strip()
            if not content:
                desc_issues.append((url_path, "empty_description"))

        for prefix in listing_prefixes:
            if url_path.startswith(prefix) and url_path != prefix:
                if parser.ld_json_count == 0:
                    ld_json_issues.append((url_path, "missing_json_ld"))
                break

    duplicate_issues = [
        (title, paths)
        for title, paths in duplicate_map.items()
        if len(paths) > 1
        and not all(p in allow_dupe_paths for p in paths)
    ]

    issues_found = any([duplicate_issues, desc_issues, ld_json_issues])

    print("\n== SEO Lint Report ==")
    print(f"Scanned HTML files: {len(list(SITE_DIR.rglob('*.html')))}")

    print("\nDuplicate titles:")
    if duplicate_issues:
        for title, paths in duplicate_issues:
            print(f'  "{title}":')
            for p in paths:
                print(f"    - {p}")
    else:
        print("  None")

    print("\nMeta description issues:")
    if desc_issues:
        for path, reason in desc_issues:
            print(f"  {path}: {reason}")
    else:
        print("  None")

    print("\nJSON-LD issues (listing pages):")
    if ld_json_issues:
        for path, reason in ld_json_issues:
            print(f"  {path}: {reason}")
    else:
        print("  None")

    if issues_found:
        print("\nLint FAILED.")
        return 1
    print("\nLint PASSED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
