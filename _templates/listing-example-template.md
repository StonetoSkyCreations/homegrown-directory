Homegrown Listing Template (canonical). Copy into the correct collection (`_farms`, `_markets`, `_stores`, `_restaurants`, `_distributors`, `_vendors`), replace values, drop fields that do not apply, and keep `slug` stable once live.

---
# Allowed layouts (must exist in `_layouts/`): eatery (restaurants/eateries), store (grocers/shops), farm (growers/producers), vendor (food trucks/brands), listing (markets/distributors/general). Pick the matching layout.
layout: listing # Required.
title: Example Listing Name # Required; display name.
slug: example-listing-slug # Required; lowercase-with-dashes; do not change after publish.
collection: markets # Optional; only if the collection expects it (folder usually sets this).
type: market # Optional; high-level type token (market, eatery, store, farm, vendor, distributor).
subtype: farmers-market # Optional; finer type (community-farm, fine-dining, bakery, etc.).
name: Example Listing Name # Optional; only if this collection uses a separate name field.
seo_title: Example Listing Name | City, Region example # Optional; use the | separator; keep concise.
seo_description: One to two sentence SEO blurb in plain text. # Optional.
country_slug: new-zealand # Required; use an existing slug.
country: New Zealand # Required; human-friendly country name.
region: Canterbury # Required; region/state/province.
city: Exampletown # Required.
suburb: Riverside Market # Optional; local area or centre.
address: 123 Example Road, Exampletown 0000, New Zealand # Required; full street address.
postcode: '0000' # Optional; quote to preserve leading zeros.
description: Short 1-2 sentence public summary. # Required.
long_description: | # Optional; plain text only (no Markdown links).
  A fuller narrative about the listing, sourcing, and practices. Keep objective and sourced.
practices:
- organic
- local-sourcing
- spray-free # Optional; array of practices.
products:
- seasonal produce
- pantry goods # Optional; array of products.
services:
- weekly market
- online orders # Optional; array of services/sales channels.
website: https://example.example.nz # Optional; include scheme.
email: hello@example.example.nz # Optional; use '' if unknown.
phone: +64 21 000 000 # Optional; main phone.
hours: Saturday 9am-1pm # Optional; concise hours text.
market_days:
- Saturday 09:00-13:00 # Optional; for markets or recurring stalls.
source_urls:
- https://example.example.nz/about # Required when making claims; cite sources.
last_checked: '2025-12-31' # Optional; ISO date of verification.

# Relationships (canonical: slugs first, plain text second)
sourced_from:
- example-farm-supplier # Internal slug of a supplier listing (clickable).
sourced_from_text:
- Example Growers Co-op # Plain text source when no listing slug exists.
supplies_to:
- example-restaurant-buyer # Internal slug of a buyer listing (clickable).
supplies_to_text:
- local cafes and weekly veg boxes # Generic mention when no listing slug exists.
relationships_declared: true # Required; true if ANY of the four arrays above contain items, else false.

# Only if used in this repo (keep if relevant; otherwise remove)
secondary_phone: '' # Optional; only when a second number exists.
social_links:
- https://www.facebook.com/example # Optional; prefer list form; include socials here.
social: '' # Optional legacy string; leave '' unless migrating older data.
awards: [] # Optional.
certifications: [] # Optional; BioGro, Demeter, etc.
brand_slug: example-brand # Optional; umbrella brand link.
supply_role: Market # Optional; label such as Producer, Restaurant, Distributor.
category: eatery # Optional; only if this collection uses it.
sourcing_tags:
- local
- seasonal # Optional; legacy sourcing flags.
products_or_cuisine:
- Farmers market stalls # Optional; used by some vendor/eatery listings.
practices_tags: [] # Optional; normalised tags; leave [] if unused.
products_tags: [] # Optional; normalised product tags.
services_tags: [] # Optional; normalised service tags.
specialty_tags: [] # Optional; extra tags (e.g., open-fire-cooking).
lat: -43.530000 # Optional; decimal latitude.
lon: 172.630000 # Optional; decimal longitude (pair with lat).
geo_precision: exact # Optional; exact/approximate; keep if geocoded.
geo_source: nominatim # Optional; geocoder used.
geo_last_verified: '2025-12-31' # Optional; date coordinates were confirmed.
geo_label: '123' # Optional; street number label from geocoder.
geo_query: 123 Example Road, Exampletown, Region, Country # Optional; original geocode query.
rating_average: 5 # Optional; numeric average.
rating_count: 3 # Optional; count.
featured_article: '' # Optional; URL of a featured blog post/profile (leave '' if none).
hours_list: [] # Optional; only if structured hours are available.
---

Agent checklist:
- Confirm layout exists in `_layouts/` and matches the collection.
- Keep `slug` unique/stable; filename should match slug.
- Populate address, city, region, country; add suburb if relevant.
- Use arrays (`- item`) for practices/products/services/relationships; use '' for unknown strings.
- If any relationship arrays have data, set `relationships_declared: true`; prefer slugs over text.
- Provide `description` (and `seo_title`/`seo_description` when available) for SEO fallbacks.
- Cite `source_urls` for claims and update `last_checked`.
- If adding geo, include both `lat` and `lon` (plus precision/source when known).
- Run `bundle exec jekyll build`.
- Run `python3 scripts/seo_lint.py`.
