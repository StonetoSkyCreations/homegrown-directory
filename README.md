# Homegrown Directory

Static, GitHub Pages ready Jekyll site that maps integrity-first food systems (organic, regenerative, biodynamic, spray-free, pasture-raised). First focus is Aotearoa New Zealand, with a structure ready to expand globally. Live at homegrowndirectory.com.

The point of difference is the **web of connection**: who grows the food, who stocks it, and who serves it, drawn as supply links between listings. When both sides declare a link it is reciprocated, and reciprocity is the site's trust signal ("Verified by N partners").

## What's inside
- Collections: `farms`, `markets`, `stores`, `restaurants`, `distributors` (hubs), `vendors`. Permalinks use `/<collection>/:slug/` (e.g. `/farms/river-bend-farm/`).
- Shared front matter: `country`, `country_slug`, `region`, `city`, `lat`, `lon`, `practices`, `products`, `services`, `supplies_to` (slugs you supply), `sourced_from` (slugs you buy from), `hours`, `website`, `email`, `phone`, `description`, `long_description`. Canonical tag vocab lives in `_data/taxonomies.yml`.
- Templates you can copy: `_farms/_template.md`, `_markets/_template.md`, `_stores/_template.md`, `_restaurants/_template.md`, `_distributors/_template.md`.
- Search + filters: client-side search over `search.json` (name, location, tags, description) with type/practice/product/service filters.
- SEO: `jekyll-seo-tag`, JSON-LD per listing, sitemap/robots. The canonical rules live in `SEO_DOCTRINE.md` and are enforced by `scripts/seo_lint.py`.

## The web of connection (maps)
Both visualisations are driven by one client-side module, `assets/js/connections-map.js`, reading `search.json`. It lazy-loads Leaflet 1.9.4 + `leaflet-ant-path` from CDN (with SRI) only when a map scrolls into view, so listing pages stay light.

- **In-listing mini-map** (`_includes/connection-map.html`): a small map centred on the listing, with the focus shown as a type emoji and its connected listings as small coloured dots, joined by animated ant-path flow lines (reciprocated links styled distinctly from one-way). Each line flows in the direction the goods move: inward from places the listing sources from, outward to places it supplies (a two-way trade draws both). An accessible chip list (Sourced from / Supplies to, with counts and verified ticks) is always rendered as the textual index and the no-JS / no-coords fallback. Listings with no connections render no map and lead with their story.
- **`/network/` flow map** (`network.html`, `data-mode="full"`): the whole web on one Leaflet map. Clustered type-coloured dots for every geocoded listing, faint static lines for every declared supply link, and region / practice / type filters. Click a point to trace its connections as animated ant-path flow lines, each flowing in the goods direction (inward from sources, outward to recipients).

`scripts/relationship_audit.rb` reports reciprocity, one-way and orphan links (`--strict`, `--json`); it mirrors the client-side verified computation and runs report-only in CI.

## Add a listing

**Fastest:** the generator scaffolds a validated listing for you, with canonical tags, slug de-duplication, and optional geocoding:
```bash
ruby scripts/add_listing.rb --collection farms --name "River Bend Farm" \
  --region Canterbury --city Oxford --website riverbend.co.nz \
  --practice-tags organic,regenerative --subtype market-garden --geocode
```
Add `--dry-run` to preview, `--csv data/imports/FILE.csv --row N` to seed from a staging row, or `--help` for all flags. It writes the file then runs `validate_content.rb`.

**Manually:**
1. Copy the template file from the relevant collection folder and rename it using a slug (e.g. `_farms/river-bend-farm.md`).
2. Fill front matter fields. Keep `country_slug` URL-friendly (e.g. `new-zealand`). Use other listing slugs inside `sourced_from` or `supplies_to` to create relationship links, and add the matching link on the other listing so the connection reciprocates.
3. Write the description and body following the listing-quality standard below.
4. Commit and push; GitHub Pages builds automatically.

## Listing-quality standard
Every listing should read like a visitor's introduction to a real business, not an internal note.

- **Say what the business is and where**, in plain language. "A family market garden in Oxford, North Canterbury, growing certified-organic vegetables for local boxes and markets."
- **No provenance phrasing.** Never write "listed by X as a stockist" or "added because we found it on Y's website." That is sourcing metadata, not copy. Keep the evidence in `source_urls`, not in the description.
- **Only claim what is known.** Add `practices` / `practices_tags` (organic, spray-free, regenerative, etc.) only where it is genuinely established. Leave unknown fields blank rather than guessing. Never fabricate certifications, products, or relationships.
- **No em dashes or en dashes** in any visitor-visible text. Use a comma or reword.
- **Connection-forward.** If the listing has supply links, the copy can gesture at the relationships the map shows, but the map carries the detail.

## Local preview
```bash
bundle exec jekyll serve   # http://localhost:4000
```
Ruby 3.2.0 via rbenv; load it with `eval "$(rbenv init - zsh)"` so `bundle` / `jekyll` use 3.2.0, not system Ruby. Gems install to project-local `vendor/bundle`.

## Verification gate
Run before every commit:
```bash
ruby scripts/validate_content.rb     # front-matter checks across all listings
python3 scripts/check_layouts.py     # every layout reference resolves
bundle exec jekyll build             # build to _site/
python3 scripts/seo_lint.py          # SEO lint (reads _site/)
ruby scripts/relationship_audit.rb   # confirm reciprocity held or rose
```

## URLs to know
- Home / search: `/`
- Interactive map: `/map/`
- The connection network: `/network/`
- Country index: `/country/new-zealand/`
- Collections: `/farms/`, `/markets/`, `/stores/`, `/restaurants/`, `/distributors/`
