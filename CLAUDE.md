# CLAUDE.md — Homegrown Directory operating rules

Always-loaded rules for coding agents working in this repo. Internal file, excluded
from the published site. Path-scoped detail lives in `.claude/rules/`.

## Project purpose

Homegrown Directory (homegrowndirectory.com, StonetoSky brand, owner Josh,
josh@stonetosky.nz) is a static Jekyll directory mapping food grown with care:
who grows it, who stocks it, who cooks with it, and the evidence behind those
claims. The core value is the **relationship web** (`sourced_from` / `supplies_to`
slug links between listings), not the list of places. Reciprocated links are the
trust signal ("Verified by N partners").

## Two-country directory model

The site is **one codebase containing two distinct country directories**:

1. **New Zealand / Aotearoa** (`country_slug: new-zealand`) — 573 listings, the
   mature directory and the active growth focus.
2. **Australia** (`country_slug: australia`) — 81 listings, an early-stage
   directory with country pages, switcher support, and one relationship cluster.

Rules that follow from this:

- Do not describe the project as NZ-only, and do not collapse the two countries
  into one blended dataset. Shared layouts/scripts/validation are fine; listing
  data, search, maps, network views, URLs, SEO metadata, and navigation must
  preserve country context.
- Every listing declares `country` and `country_slug` explicitly in its own front
  matter (do not rely on `_config.yml` defaults).
- Relationship edges stay country-scoped. A cross-border edge requires explicit
  verified evidence in `_data/relationship_evidence.yml` (none exist today).
- Any listing, validation, SEO, or UI change must ask: does this behave correctly
  for BOTH countries? (The country switcher is in the header; state persists in
  localStorage; `assets/js/main.js` scopes search/map/regions by active country.)
- The NZ **harvest workstream** (`SOURCING_PLAN.md`) is deliberately NZ-only for
  now. That scopes the harvest, not the site.

## Authoritative docs (in precedence order for their domain)

- `CLAUDE.md` (this file) — agent operating rules. `.claude/rules/` — path-scoped detail.
- `AUDIT_MASTER_PLAN.md` — the current audit truth + staged repair plan
  (supersedes everything in `archive/`).
- `README.md` — architecture, add-a-listing, listing-quality standard.
- `ROADMAP.md` — status, known issues, next steps.
- `SEO_DOCTRINE.md` — canonical SEO rules, enforced by `scripts/seo_lint.py`.
- `SOURCING_PLAN.md` (+ `HARVEST.md`) — the harvest workstream; resume block at top.
- `archive/` — historical snapshots only; never treat as current.

## Core data model

- Collections: `_farms` `_markets` `_stores` `_restaurants` `_distributors`
  `_vendors` (654 listings). Permalink `/<collection>/:slug/`.
- Front matter is the schema. Required: `title`, `slug`, `country`,
  `country_slug`, `region` (validated against `_data/geography.yml`).
  Canonical tag vocab: `_data/taxonomies.yml`. Annotated field reference:
  `_templates/listing-example-template.md` + per-collection `_template.md`.
- Relationships: `sourced_from` / `supplies_to` are plain slug arrays.
  Edge evidence lives in `_data/relationship_evidence.yml`.
- `search.json` (Liquid template at root) generates the client index used by
  search, `/map/`, `/network/`, and the in-listing mini-maps.
- Add listings with `ruby scripts/add_listing.rb` (slug de-dup, canonical tags,
  optional `--geocode`), not by hand-copying files.

## Relationship graph rules

- Never invent a relationship. Every new edge needs a source URL recorded in the
  evidence ledger (`harvest_import.rb` does this for you).
- Reciprocate only when the source supports both directions; `scripts/reciprocate.rb`
  exists for deliberate passes, not casual auto-runs.
- The graph invariant is **0 one-way / 0 dangling** (`scripts/relationship_audit.rb`
  must confirm reciprocity held or rose before every commit).
- Orphans are allowed (a listing without links leads with its story).

## Provenance rules

- Never fabricate listings, certifications, practices, products, or links.
- Practice tags (`organic`, `spray-free`, `regenerative`, ...) only where the
  source genuinely establishes them. Leave unknown fields blank.
- Evidence goes in `source_urls` / the ledger, never into listing copy
  ("listed by X as a stockist" phrasing is banned; see README quality standard).
- `last_checked` on anything you verify or edit.

## Jekyll / static-site workflow

- Ruby 3.2.0 via rbenv: `eval "$(rbenv init - zsh)"` first, or `bundle`/`jekyll`
  fall back to system Ruby 2.6. Gems in project-local `vendor/bundle`.
- `bundle exec jekyll serve` → http://localhost:4000. Deploys automatically from
  `main` via GitHub Actions to GitHub Pages (custom domain CNAME).
- Vanilla JS/CSS only (`assets/js/main.js`, `assets/js/connections-map.js`,
  `assets/css/main.css`). No frameworks, no build step beyond Jekyll, no new
  dependencies without Josh's sign-off. CDN plugins need SRI hashes.
- Internal docs and working dirs are excluded from the published site in
  `_config.yml` — keep new internal files in that list.

## Validation commands (the gate — run all before any commit)

```bash
eval "$(rbenv init - zsh)"
ruby scripts/validate_content.rb     # front-matter gate, all listings
python3 scripts/check_layouts.py     # layout references resolve
bundle exec jekyll build             # builds _site/
python3 scripts/seo_lint.py          # SEO lint (reads _site/, run after build)
ruby scripts/relationship_audit.rb   # reciprocity held or rose
```

CI (`.github/workflows/seo-lint.yml`) runs the same gate on every push.

## Before editing

1. Confirm Codex.app is fully quit (Cmd+Q). **One agent edits this repo at a
   time** — concurrent editing once froze every file until a Mac restart. Never
   `kill -9` Codex to grab a locked file.
2. `git pull --rebase` before pushing; never force-push (`main` auto-deploys).
3. Check the resume block at the top of `SOURCING_PLAN.md` if doing harvest work,
   and `AUDIT_MASTER_PLAN.md` stage notes if doing repair work.
4. Bulk file edits: dry-run/diff first, spot-check a sample, keep the change in
   its own commit.

## Do not do

- Do not invent listings, relationships, or food-integrity claims.
- Do not collapse or blur the NZ and AU directories.
- Do not scrape or bulk-import without the harvest pipeline + human curation.
- Do not run `scripts/normalise_*.rb` casually (non-idempotent; rewrites ~90 files).
- Do not use em dashes or en dashes in any user-visible text.
- Do not add frameworks, npm tooling, or paid services.
- Do not change permalinks or canonical logic without updating `SEO_DOCTRINE.md`.
- Do not treat `archive/` or old counts in docs as current — measure, or read
  `AUDIT_MASTER_PLAN.md` §3.
- Do not redesign the site or turn it into a marketplace/social/booking product.

## Final response format (for future agents)

End every working session's final message with:

1. What changed (files + one-line why).
2. Gate results (each command, pass/fail — never hide a failure).
3. Relationship audit delta (pairs before → after; must not silently drop).
4. Country impact: what this means for NZ and for AU (or "no country-specific
   behaviour touched").
5. Anything deferred or needing Josh's judgement.
