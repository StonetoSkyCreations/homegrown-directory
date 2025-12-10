# Homegrown Directory

Static, GitHub Pages–ready Jekyll site that maps integrity-first food systems (organic, regenerative, biodynamic, spray-free, pasture-raised). First focus is Aotearoa New Zealand, with a structure ready to expand globally.

## What’s inside
- Collections: `farms`, `markets`, `stores`, `restaurants`, `distributors` (hubs). Permalinks use `/collection/:country_slug/:slug/`.
- Shared front matter: `country`, `country_slug`, `region`, `city`, `lat`, `lon`, `practices`, `products`, `services`, `supplies_to` (slugs you supply), `sources` (slugs you buy from), `hours`, `website`, `email`, `phone`, `description`.
- Templates you can copy: `_farms/_template.md`, `_markets/_template.md`, `_stores/_template.md`, `_restaurants/_template.md`, `_distributors/_template.md`.
- Search + filters: client-side search over `search.json` (name, location, tags, description) with type/practice/product/service filters.
- SEO: `jekyll-seo-tag`, JSON-LD per listing, sitemap/robots.

## Add a listing
1) Copy the template file from the relevant collection folder and rename it using a slug (e.g. `_farms/river-bend-farm.md`).  
2) Fill front matter fields. Keep `country_slug` URL-friendly (e.g. `new-zealand`). Use other listing slugs inside `sources` or `supplies_to` to create relationship links.  
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
