## Executive summary
- Status: **PASS** (no Critical blockers). Top findings focus on contact links with empty `mailto:`, a few missing listing cross-links, and JSON-LD gaps on store/vendor layouts.
- Build completed successfully; homepage and representative listings render; search.json present.
- Sitemap present (521 URLs), canonical domain OK, no duplicates detected.
- Broken internal links: 3 (missing listing targets from store pages).
- 206 pages output an empty `mailto:` link where email is blank.
- Store/vendor pages do not emit JSON-LD (others do).
- No missing assets detected; favicons/OG references resolve locally.
- Robots.txt references sitemap correctly and does not block the site.
- Near Me/search/filter pages build without errors (smoke-checked via build + sample pages).
- Recommendation: Go to launch with noted High/Medium items tracked below.

## Launch blockers (Critical)
- None.

## High / Medium / Low issues
### High
- **Empty mailto links**: e.g., `_site/vendors/mapu-test-kitchen/index.html` (and 205 similar) render `href="mailto:"` because email is blank in front matter and the layout still outputs the link. User click opens a blank mail compose. (Source: vendor/store layouts contact block.)
- **Broken internal links (missing targets)**:
  - `/stores/untamed-earth-farm-shop/index.html` → `/farms/untamed-earth` (target missing)
  - `/stores/untamed-earth-farm-shop/index.html` → `/stores/beckenham-butchery` (target missing)
  - `/stores/beckenham-butchery/index.html` → `/stores/untamed-earth-farm-shop` (target missing)
  These are cross-links to non-existent slugs.

### Medium
- **JSON-LD missing on stores/vendors**: Representative pages `_site/stores/bin-inn-glenfield/index.html` and `_site/vendors/mapu-test-kitchen/index.html` emit no JSON-LD, while farms/markets/restaurants/distributors do. Schema coverage inconsistent across collections.

### Low
- None additionally flagged.

## Fixes applied
- None (read-only audit; no code/content changes in this pass).

## Broken links summary
- Counts: internal broken links: 3; broken anchors: 0; missing assets: 0; malformed externals: 0; empty mailto: 206 (see High issues).
- Top broken links table:
  - `/stores/untamed-earth-farm-shop/index.html` → `/farms/untamed-earth` (target not in _site)
  - `/stores/untamed-earth-farm-shop/index.html` → `/stores/beckenham-butchery` (target not in _site)
  - `/stores/beckenham-butchery/index.html` → `/stores/untamed-earth-farm-shop` (target not in _site)

## Sitemap sanity
- `sitemap.xml` present in `_site`, 521 URLs, no duplicates, all on `https://homegrowndirectory.com`.
- Robots.txt references the sitemap and does not block the site.
- Key collections represented (multiple URLs per collection observed).

## JSON-LD validation (samples)
- Farms: `_site/farms/ashley-river-organics/index.html` → `@type: Farm`, parses OK, includes geo.
- Markets: `_site/markets/titirangi-village-market/index.html` → `@type: FarmersMarket`, parses OK, includes geo.
- Restaurants: `_site/restaurants/akito-eatery/index.html` → `@type: Restaurant`, parses OK, includes geo.
- Distributors: `_site/distributors/first-light-farms/index.html` → `@type: WholesaleStore`, parses OK, includes geo.
- Stores: `_site/stores/bin-inn-glenfield/index.html` → **no JSON-LD block emitted** (gap).
- Vendors: `_site/vendors/mapu-test-kitchen/index.html` → **no JSON-LD block emitted** (gap).

## Manual checks
- Jekyll build: `bundle exec jekyll build` succeeded (no errors).
- Homepage renders; `search.json` present in `_site`.
- Representative listing pages for each collection render without 404/blank output.

## Final recommendation
- **GO** (no Critical blockers). Track High/Medium items for a follow-up patch: guard empty email links, fix/redirect missing cross-link targets, and add JSON-LD to store/vendor layouts for schema parity.
