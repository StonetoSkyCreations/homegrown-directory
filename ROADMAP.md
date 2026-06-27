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
- **Web-of-connection maps (redesign, June 2026):** one shared client module `assets/js/connections-map.js` (lazy Leaflet + leaflet-ant-path, CDN with SRI) drives both views.
  - In-listing **mini-map** (`_includes/connection-map.html`): focus listing as a type emoji, connections as small coloured dots, animated ant-path flow lines (reciprocated styled distinct from one-way), with an accessible Sourced from / Supplies to chip list as the always-present textual index and no-JS / no-coords fallback. Orphans render no map and lead with their story. Replaced the old 3-column SVG diagram (`connection-map.js`, removed).
  - `/network/` rebuilt as a **Leaflet flow map** (`network.html`, `data-mode="full"`): clustered type dots for every geocoded listing, ant-path lines for every declared link, region / practice / type filters, click-to-trace. Replaced the Cytoscape node-graph (`network.js`, removed).
- **Interactive map:** `/map/` split-view list+map (Leaflet, CARTO Voyager, markercluster). Homepage is map-led (`map: true`, lazy "Show map" toggle).
- **Relationship-first sourcing (Codex pass):** ~50 new listings (mostly `_stores`, nationwide) following well-connected producers, with reciprocal `sourced_from` / `supplies_to` and real `source_urls`.
- **Practice token standardised:** `local` / `locally-sourced` split resolved to canonical `local`; homepage and `/map/` filters fixed to match.

## Known issues (fix later)
- **47 provenance-note listings (workstream B, next):** the Codex sourcing pass left 47 listings whose copy reads as sourcing metadata ("listed by X as a stockist"), 39 with empty `practices: []`. Rewrite to the listing-quality standard in `README.md` (plain description of what the business is, drop provenance phrasing, add practice tags only where genuinely known, keep `source_urls` / relationships / coords). Find via `grep -rlE "listed by|as a stockist" _stores _farms _restaurants _markets _vendors _distributors`.
- **Store/vendor polish:** `store.html` / `vendor.html` use the connection block but not the full collapsible `<details>` treatment `listing.html` has. Bring to parity.
- **Duplicate-slug nodes:** a few cross-collection duplicate slugs (e.g. `live2give-organics` is a farm and a store) can show twice. Dedupe by slug if it bothers.
- **Coverage:** only a minority of listings declare any relationship; the rest are orphans. Reciprocity coverage is the main growth metric (`relationship_audit.rb`).
- **`normalise_*.rb` non-idempotent:** a plain re-run rewrites ~90 listing files by re-inferring tags. Run only deliberately.

## Next
1. **Workstream B (honest-listing cleanup)** — rewrite the 47 provenance-note listings to the listing-quality standard. Raises perceived quality without changing relationships.
2. **Visual review of the new maps** — `/network/` flow map (dense web + clustering on mobile) and the mini-map small-dots refinement; iterate on UX.
3. **Bring store/vendor layouts to full parity** with the listing redesign.
4. **Canterbury batch** — staged candidates + relationship enrichment in `~/.claude/plans/eager-plotting-wadler.md`.
5. **Wider coverage** by region (North Canterbury meat, Banks Peninsula, Mid/South Canterbury, then other provinces) once the relationship-first method is proven.
6. **Map phase 2:** draw `supplies_to` / `sourced_from` connection lines on `/map/` too (the network map already does).

## Workflow
- **Josh is the primary-agent (owner)**; Claude is the primary build agent; Codex / Gemini are occasional helpers.
- **One agent edits the repo at a time.** Running Codex.app on this repo while Claude works froze every file at the OS level until a Mac restart (see the `codex-claude-repo-lock-hazard` memory). Confirm Codex.app is fully quit (Cmd+Q, not just the window) before editing, and never `kill -9` Codex to grab a locked file.
- Commit and push verified work promptly so a lock can never strand uncommitted changes.

## Guardrails
- No em dashes or en dashes in user-visible text. Vanilla, low-dependency (CDN plugins are fine, no build step beyond Jekyll). Never fabricate listing data.
- Always pass the gate before commit: `ruby scripts/validate_content.rb` && `python3 scripts/check_layouts.py` && `bundle exec jekyll build` && `python3 scripts/seo_lint.py`. Then `relationship_audit.rb` to confirm reciprocity held or rose.
- `git pull --rebase` before pushing; never force-push (auto-deploys from `main`).
