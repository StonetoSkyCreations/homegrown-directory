---
paths:
  - "_farms/**"
  - "_markets/**"
  - "_stores/**"
  - "_restaurants/**"
  - "_distributors/**"
  - "_vendors/**"
  - "country/**"
  - "_data/geography.yml"
  - "_layouts/**"
  - "_includes/**"
  - "assets/js/**"
  - "search.json"
  - "index.html"
  - "map.md"
  - "network.html"
---

# Country-directory rules

Homegrown Directory is two country directories in one codebase: New Zealand /
Aotearoa (`new-zealand`) and Australia (`australia`). They share components but
never blend data contexts.

- `_data/geography.yml` is the single source of truth for valid countries and
  their regions. Adding a region means adding it there AND creating the matching
  `country/<country>/<region>.md` page.
- Every listing must carry explicit `country` (exactly `New Zealand` or
  `Australia`) and `country_slug` in its own front matter. Do not rely on the
  `_config.yml` collection defaults.
- `region` must be valid for the listing's `country_slug`
  (`validate_content.rb` enforces this).
- The active country lives in localStorage (`hg-country`, default `new-zealand`)
  and is managed by `assets/js/main.js` (`getActiveCountry`). Any new search,
  filter, map, or browse feature must scope by it, and any new server-rendered
  listing collection must filter by `page.country_slug` when the page is
  country-scoped.
- Map framing per country comes from `countryDefaults` in `main.js`. Do not
  hardcode NZ bounds.
- `/network/` and `assets/js/connections-map.js` currently have NO country
  scoping — that is audit task HG-AUDIT-007, not a pattern to copy.
- SEO: country-scoped pages state their country in title/meta. Never create a
  country-neutral page that duplicates country-specific intent (see
  `SEO_DOCTRINE.md` §3.2).
- Never move a listing between countries to "fix" a validation error — a
  country/region conflict means the data needs checking against sources.
