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
- **Honest-listing cleanup (workstream B):** rewrote the 46 provenance-note listings ("listed by X as a stockist") to plain visitor copy per the listing-quality standard; added `organic` practice tags to self-identified organic stores. Relationships and source URLs untouched.
- **Map framing + popup fixes:** homepage / `/map/` now frame the active country (NZ here) instead of zooming to the whole planet on the Chatham Islands antimeridian outlier; clicking a pin shows a brief overview popup in place rather than scrolling to the list card.

## Known issues (fix later)
- **Store/vendor polish:** `store.html` / `vendor.html` use the connection block but not the full collapsible `<details>` treatment `listing.html` has. Bring to parity.
- **Duplicate-slug nodes:** a few cross-collection duplicate slugs (e.g. `live2give-organics` is a farm and a store) can show twice. Dedupe by slug if it bothers.
- **Coverage:** only a minority of listings declare any relationship; the rest are orphans. Reciprocity coverage is the main growth metric (`relationship_audit.rb`).
- **`normalise_*.rb` non-idempotent:** a plain re-run rewrites ~90 listing files by re-inferring tags. Run only deliberately.

## Next
1. **NZ sourcing: the connection harvest** — the main growth workstream. Mine "hubs" (a producer's stockist page, or a stockist/distributor's supplier page) to add many listings + reciprocal relationships per pass, NZ only for now. Full staged method, concrete top hubs, and a per-session checklist live in **`SOURCING_PLAN.md`**. Start with Stage 0 (build `hub_report.rb` + a harvest helper), then Stage 1 (top producer hubs: Streamside, Untamed Earth, Farmers Mill, ...). One hub ≈ one session ≈ one commit, so credits stay bounded.
2. **Visual review of the new maps** — `/network/` flow map (dense web + clustering on mobile) and the mini-map small-dots refinement; iterate on UX.
3. **Bring store/vendor layouts to full parity** with the listing redesign.
4. **Map phase 2:** draw `supplies_to` / `sourced_from` connection lines on `/map/` too (the network map already does).

## Workflow
- **Josh is the primary-agent (owner)**; Claude is the primary build agent; Codex / Gemini are occasional helpers.
- **One agent edits the repo at a time.** Running Codex.app on this repo while Claude works froze every file at the OS level until a Mac restart (see the `codex-claude-repo-lock-hazard` memory). Confirm Codex.app is fully quit (Cmd+Q, not just the window) before editing, and never `kill -9` Codex to grab a locked file.
- Commit and push verified work promptly so a lock can never strand uncommitted changes.

## Guardrails
- No em dashes or en dashes in user-visible text. Vanilla, low-dependency (CDN plugins are fine, no build step beyond Jekyll). Never fabricate listing data.
- Always pass the gate before commit: `ruby scripts/validate_content.rb` && `python3 scripts/check_layouts.py` && `bundle exec jekyll build` && `python3 scripts/seo_lint.py`. Then `relationship_audit.rb` to confirm reciprocity held or rose.
- `git pull --rebase` before pushing; never force-push (auto-deploys from `main`).
