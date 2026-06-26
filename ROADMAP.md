# Homegrown Directory roadmap

Internal planning doc (excluded from the published site via `_config.yml`).

## Vision
The comprehensive map of NZ organic food: every grower/producer, every stockist of that
produce, and every cafe/store/restaurant that stocks it. Two-way discovery (a traveller
finds outlets in a town; an outlet finds producers) with the producer to stockist to
eatery **web of connection** made visible and used as a trust signal (reciprocated
relationships = verified).

## Done
- **Add pipeline:** `scripts/add_listing.rb` (name+website or `--csv` row, canonical tags, slug de-dup, `--geocode`, runs validate). Canonical vocab centralised in `_data/taxonomies.yml`.
- **Interconnectedness:** `scripts/relationship_audit.rb` (reciprocity / one-way / orphan report; `--strict`, `--json`; report-only CI step) + "Verified by N partners" badge (`_includes/verified-badge.html`).
- **Network graph:** `/network/` interactive whole-web graph (Cytoscape via CDN, reuses `search.json`).
- **Interactive map:** `/map/` split-view list+map (Leaflet, CARTO Voyager, markercluster).
- **Listing redesign (connection-forward):** `_includes/connection-map.html` 3-column hero (suppliers -> this -> outlets) + `assets/js/connection-map.js` SVG lines; collapsible `<details>` for products/practices, hours, reviews. Applied to listing/store/vendor layouts. Orphans lead with their story.

## Known issues (fix later)
- **Connection-map bugs (priority):** connector lines dangle to empty positions until the "+N more" overflow is expanded; after expanding, some node text overlaps other text. Likely in `assets/js/connection-map.js` line drawing (skip nodes in collapsed `<details>`, redraw on toggle) + node spacing/z-index in `.connection-map__overflow` CSS.
- **Store/vendor polish:** `store.html` / `vendor.html` got the connection hero but not the full collapsible `<details>` treatment that `listing.html` has. Bring them to parity.
- **Duplicate-slug nodes:** 5 cross-collection duplicate slugs (e.g. `live2give-organics` is a farm and a store) show twice in the map. Dedupe by slug in `connection-map.html` if it bothers.
- **Coverage:** only ~23% of listings declare any relationship; 443 orphans. Reciprocity coverage is the main growth metric (`relationship_audit.rb`).
- **`normalise_*.rb` non-idempotent:** a plain re-run rewrites ~90 listing files by re-inferring tags. Make them idempotent or run only deliberately.

## Next
1. **Workstream B (relationship-first sourcing)** — in progress via Codex. Take well-connected producers (Streamside, Untamed Earth, Piko, Harbour Co-op) and add the grocers/cafes/restaurants that already stock them but are missing, wiring reciprocal `sourced_from`/`supplies_to`. Raises coverage + verified counts.
2. **Fix the connection-map bugs** above.
3. **Bring store/vendor layouts to full parity** with the listing redesign.
4. **Canterbury batch** — staged candidates + relationship enrichment in `~/.claude/plans/eager-plotting-wadler.md`.
5. **Wider coverage** by region (North Canterbury meat, Banks Peninsula, Mid/South Canterbury, then other provinces) once the relationship-first method is proven.
6. **Map phase 2:** draw `supplies_to`/`sourced_from` connection lines on `/map/`.

## Guardrails
- One agent edits the repo at a time (Codex + Claude both work here). Coordinate to avoid drift.
- No em dashes or en dashes in user-visible text. Vanilla, low-dependency.
- Always pass the gate before commit: `ruby scripts/validate_content.rb` && `python3 scripts/check_layouts.py` && `bundle exec jekyll build` && `python3 scripts/seo_lint.py`. Then `relationship_audit.rb` to confirm reciprocity rose.
- `git pull --rebase` before pushing; never force-push (auto-deploys from `main`).
