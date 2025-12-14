# SEO Lint

This lint checks the built `_site` output for basic SEO/meta correctness:

- Duplicate `<title>` values (same title on multiple pages)
- Missing or empty `<meta name="description">`
- Missing JSON-LD (`<script type="application/ld+json">`) on listing pages

## Running locally
```bash
bundle exec jekyll build
python3 scripts/seo_lint.py
```
The script exits non-zero if issues are found and prints a grouped report.

## Configuration
- `seo_lint_config.json`
  - `listing_prefixes`: URL prefixes treated as listings (must have JSON-LD)
  - `ignore_paths`: paths to skip (e.g., `/404.html`)
  - `allow_duplicate_titles_for_paths`: paths allowed to share a title

## CI
GitHub Actions workflow `.github/workflows/seo-lint.yml` builds the site and runs the lint on push and pull_request. The job fails if any issues are detected.

## Interpreting failures
- **Duplicate titles**: check which pages share the same title; adjust the source content or templates as needed.
- **Missing/empty descriptions**: ensure the page outputs a single non-empty meta description.
- **Missing JSON-LD** (listing pages): ensure listing layouts emit a JSON-LD block.
