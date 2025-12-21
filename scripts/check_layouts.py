#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
LAYOUTS_DIR = ROOT / "_layouts"
IGNORE_DIRS = {".git", "_site", "node_modules", ".bundle"}
TEXT_EXTENSIONS = {".md", ".markdown", ".html", ".txt"}


def is_ignored(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def parse_layout_from_front_matter(lines: list[str]) -> str | None:
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("layout:"):
            value = stripped.split(":", 1)[1].strip()
            value = value.split("#", 1)[0].strip()
            if value.startswith(("'", '"')) and value.endswith(("'", '"')):
                value = value[1:-1].strip()
            if value.lower() in {"", "null", "none", "nil", "false"}:
                return None
            return value
    return None


def main() -> int:
    missing: dict[str, list[str]] = {}

    for path in ROOT.rglob("*"):
        if not path.is_file() or is_ignored(path):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        lines = content.splitlines()
        if not lines or lines[0].strip() != "---":
            continue

        end_index = None
        for idx in range(1, len(lines)):
            if lines[idx].strip() == "---":
                end_index = idx
                break
        if end_index is None:
            continue

        layout = parse_layout_from_front_matter(lines[1:end_index])
        if not layout:
            continue

        layout_file = LAYOUTS_DIR / f"{layout}.html"
        if not layout_file.exists():
            missing.setdefault(layout, []).append(str(path.relative_to(ROOT)))

    if missing:
        print("Missing layouts detected:")
        for layout, files in sorted(missing.items()):
            print(f"- layout '{layout}' referenced by:")
            for file in sorted(files):
                print(f"  - {file}")
        return 1

    print("Layout check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
