---
paths:
  - "_farms/**"
  - "_markets/**"
  - "_stores/**"
  - "_restaurants/**"
  - "_distributors/**"
  - "_vendors/**"
  - "_templates/**"
  - "_data/taxonomies.yml"
---

# Listing data rules

- Create listings with `ruby scripts/add_listing.rb` (handles slug de-dup,
  canonical tags, validation), not by copying files, unless following the
  harvest pipeline in `HARVEST.md`.
- Slugs are permanent once live (they are URLs and relationship references).
  Renaming a slug requires updating every referencing `sourced_from` /
  `supplies_to`, the evidence ledger keys, and adding a `redirect_from`.
- Tags must come from the canonical vocabularies in `_data/taxonomies.yml`
  (`subtype_tokens`, `practice_tokens`). Never invent tokens.
- Practice claims (`organic`, `spray-free`, `regenerative`, `biodynamic`,
  `pasture-raised`, `local`, ...) only where evidence supports them. Certifications
  only when the register or the business's own site confirms them.
- Descriptions follow the listing-quality standard (README): plain visitor copy
  saying what the business is and where. No sourcing metadata in copy, no em or
  en dashes, no marketing superlatives.
- Evidence lives in `source_urls` (real URLs you actually opened) with
  `last_checked` dated. Never write placeholder pseudo-sources.
- Leave unknown fields blank or omitted; never guess addresses, coordinates,
  hours, or contact details. Geocoding goes through the `tools/` workflow or
  `add_listing.rb --geocode`.
- Brand umbrella parents use `type: brand` and are excluded from search/map;
  branch listings carry the location data.
- After any listing edit run the full gate (see CLAUDE.md). Bulk edits need a
  dry-run diff and a spot check first.
