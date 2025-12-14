# Data Hygiene Report

## Summary
- Files scanned: 496
- Files changed: 496
- Issue counts by severity: Critical 0 · High 194 · Medium 897 · Low 3,285

## Auto-fixes applied
- Normalised relationship fields: ensured `sources` and `supplies_to` exist as arrays, split comma/newline strings, trimmed, de-duplicated (case-insensitive), and set `relationships_declared` true/false based on contents.
- Normalised tag arrays used by templates/search (`practices`, `practices_tags`, `products`, `products_tags`, `services`, `services_tags`, `certifications`, `specialty_tags`, `source_urls`): converted strings to arrays, trimmed, de-duped, defaulted missing to `[]`.
- Coerced boolean-like strings to real booleans for `published`, `featured`, `relationships_declared` (when present).
- Coerced numeric-like `lat`/`lon` strings to numbers; set to null when clearly invalid (out of range or 0/0).
- Added `title` from `name` when `title` was missing.
- Kept front matter YAML valid (no duplicate keys introduced) and left page bodies untouched.

## Not fixed (needs human decision)
- None detected in this pass; all targeted mechanical fixes were applied. If any business data is incorrect or missing (addresses, coords, links), it requires human review and was not invented here.

## Top recurring issues
1) Missing `services_tags` (filled with `[]`)  
2) Missing `specialty_tags` (filled with `[]`)  
3) Missing/incorrect `relationships_declared` (set based on sources/supplies_to)  
4) Missing `products_tags` (filled with `[]`)  
5) Missing `supplies_to` (filled with `[]`)  
6) Missing `certifications` (filled with `[]`)  
7) Missing `sources` (filled with `[]`)  
8) Missing `practices_tags` (filled with `[]`)  
9) Missing `practices` (filled with `[]`)  
10) Missing `services` (filled with `[]`)

## Regression checklist
- Always include `title` (and `slug`) in front matter; if only `name` is supplied, copy it to `title`.
- Ensure relationship arrays are present: `sources: []`, `supplies_to: []`, and update `relationships_declared` accordingly.
- Keep tag arrays as arrays (never single strings): `practices`, `products`, `services`, `certifications`, `specialty_tags`, `source_urls`.
- Keep coordinates numeric and within range; if unknown, leave `lat`/`lon` blank (null), never use placeholders like `0/0`.
- Preserve `layout`/permalinks and do not invent business data (addresses, websites, coords) during edits.
- After bulk edits, run a quick build to confirm front matter parses and search/index generation succeeds.
