# Homegrown Directory

Static, GitHub Pages–ready Jekyll site that maps integrity-first food systems (organic, regenerative, biodynamic, spray-free, pasture-raised). First focus is Aotearoa New Zealand, with a structure ready to expand globally.

## What’s inside
- Collections: `farms`, `markets`, `stores`, `restaurants`, `distributors` (hubs), `vendors`. Permalinks use `/<collection>/:slug/` (e.g. `/farms/river-bend-farm/`).
- Shared front matter: `country`, `country_slug`, `region`, `city`, `lat`, `lon`, `practices`, `products`, `services`, `supplies_to` (slugs you supply), `sourced_from` (slugs you buy from), `hours`, `website`, `email`, `phone`, `description`.
- Templates you can copy: `_farms/_template.md`, `_markets/_template.md`, `_stores/_template.md`, `_restaurants/_template.md`, `_distributors/_template.md`.
- Search + filters: client-side search over `search.json` (name, location, tags, description) with type/practice/product/service filters.
- SEO: `jekyll-seo-tag`, JSON-LD per listing, sitemap/robots.

## Add a listing

**Fastest:** the generator scaffolds a validated listing for you, with canonical tags, slug de-duplication, and optional geocoding:
```bash
ruby scripts/add_listing.rb --collection farms --name "River Bend Farm" \
  --region Canterbury --city Oxford --website riverbend.co.nz \
  --practice-tags organic,regenerative --subtype market-garden --geocode
```
Add `--dry-run` to preview, `--csv data/imports/FILE.csv --row N` to seed from a staging row, or `--help` for all flags. It writes the file then runs `validate_content.rb`.

**Manually:**
1) Copy the template file from the relevant collection folder and rename it using a slug (e.g. `_farms/river-bend-farm.md`).  
2) Fill front matter fields. Keep `country_slug` URL-friendly (e.g. `new-zealand`). Use other listing slugs inside `sourced_from` or `supplies_to` to create relationship links.  
3) Write a short body paragraph describing practices and how people can buy or visit.  
4) Commit and push; GitHub Pages will build automatically.

## Local preview
```bash
bundle exec jekyll serve
```

## URLs to know
- Home/search: `/`
- Country index: `/country/new-zealand/`
- Collections: `/farms/`, `/markets/`, `/stores/`, `/restaurants/`, `/distributors/`
