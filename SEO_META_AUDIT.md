# SEO & Meta Audit

## Executive summary
Status: **PASS WITH NOTES**. Meta output is present, consistent, and uses clear dynamic titles/descriptions with canonical/OG/Twitter tags. Notes: OG type defaults to `website` for listings (not harmful but suboptimal semantically), and descriptions truncate aggressively to ~155 chars. No blocking issues found.

## Strengths
- Single meta include (`_includes/seo-meta.html`) drives titles, descriptions, canonicals, OG, and Twitter tags consistently.
- Canonicals use `absolute_url` and https with the production domain.
- Titles/descriptions incorporate collection type, location, and first practice tag for strong disambiguation.
- Default OG/Twitter image fallback (`/og-image.png`) present site-wide.
- Homepage, listings, and collection pages all emit meta descriptions and canonicals.
- No duplicate `<title>` or missing description observed in sampled pages.

## Issues by severity
- Critical: 0
- High: 0
- Medium: 1  
  - OG type is `website` for non-blog pages, including individual listings. While valid, it’s a weaker semantic signal than using a more specific type (e.g., `place`/`local business`).  
- Low: 2  
  - Meta descriptions truncate to ~155 chars; for longer summaries this may clip mid-phrase.  
  - Twitter card is always `summary` (not `summary_large_image`), which is fine but could be richer if images are consistently landscape. Left unchanged for safety.

## Evidence (sample pages, rendered head)
- Homepage (`/`): Title “Homegrown Directory — Find Food Grown With Care”; description present; canonical `https://homegrowndirectory.com/`; OG/Twitter populated with og-image.png.
- Farm (`/farms/ashley-river-organics/`): Title “Ashley River Organics | Farm in Loburn, Canterbury, New Zealand | certified-organic | Homegrown Directory”; description present; canonical matches URL; OG/Twitter present; OG type `website`.
- Market (`/markets/titirangi-village-market/`): Title includes location; description present; canonical correct; OG/Twitter present; OG type `website`.
- Store (`/stores/bin-inn-glenfield/`): Title includes location and practice tag; description present; canonical correct; OG/Twitter present; OG type `website`.
- Vendor (`/vendors/mapu-test-kitchen/`): Title includes location and practice tag; description present; canonical correct; OG/Twitter present; OG type `website`.
- Distributor (`/distributors/first-light-farms/`): Title includes location; description present; canonical correct; OG/Twitter present; OG type `website`.

## What was changed
- No code or content changes made; audit only.

## What was intentionally not changed
- OG type left as `website` for listings to avoid semantic drift; safe but suboptimal.
- Twitter card left as `summary` to avoid layout/asset implications.
- Description truncation logic left at ~155 chars to avoid copy edits.

## SEO regression checklist
- Ensure new pages include `seo-meta.html` (or equivalent) so title/description/canonical/OG/Twitter render.
- Keep `site.url`/`site.baseurl` correct for canonical/OG absolute URLs.
- Provide `seo_title`/`seo_description` only when necessary; otherwise rely on the existing dynamic defaults (title + type + location + practice).
- Verify OG/Twitter image fallback remains valid (`/og-image.png`) and available.
- Avoid adding multiple `<title>` or conflicting meta tags in custom layouts.
- If adding richer OG types later, gate by clear, explicit signals (collection/subtype) to prevent semantic drift.
