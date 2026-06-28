# Harvest pipeline

Internal doc (excluded from the published site). How we grow the directory as a
relationship-mapping harvest, evidence-first and credit-light. The staged plan and
source triage live in `SOURCING_PLAN.md`; this doc is the operating loop + tooling.

## Principles
- Scripts do the bulk fetch/parse. The LLM only reviews ambiguous cases, never bulk-extracts.
- One source family per session. If a source is JS/blocked after <=2 attempts, classify it and move on.
- Every claim carries evidence: a `source_url` + `last_checked` for listings, and a ledger
  entry for relationships. Never fabricate listings, practices, certifications or links.
- Reciprocity is the trust signal; the graph must stay 0 one-way / 0 dangling.

## Data model
- **Listing provenance:** `source_urls`, `last_checked`, `certifications` (existing fields).
  Optional `discovery_status: discovered | scaffolded | verified` to track pipeline state.
- **Relationship evidence (side ledger):** `_data/relationship_evidence.yml`, keyed by edge
  `"<from-slug>|<field>|<to-slug>"` -> list of `{ source_url, snippet, date, confidence }`.
  `sourced_from` / `supplies_to` stay plain slug arrays, so the maps, `search.json`,
  `relationship_audit.rb`, `reciprocate.rb` and `hub_report.rb` are unaffected.
- **Raw cache:** `data/harvest/cache/` (under the excluded `data/` dir) holds fetched
  HTML/JSON/files so re-parsing is free.
- **Staging CSVs:** `data/imports/*.csv`, shared 23-col header (see `data/imports/README.md`).

## The loop
1. Pick one source (from `SOURCING_PLAN.md` triage). Fetch with a script; honor robots.txt;
   rate-limit ~1 req/s; cache raw under `data/harvest/cache/`.
2. Parse with a deterministic per-source script (`scripts/harvesters/<source>.rb`) into a
   staging CSV (shared header) + the hub/edge it implies.
3. `ruby scripts/match_report.rb data/imports/FILE.csv` -> matched / new / ambiguous.
   Review the ambiguous rows by hand; fix names or drop dupes.
4. Confirm organic status: certified-register rows auto-qualify; otherwise only set an
   `organic`/`spray-free`/etc. practice tag when the source shows evidence.
5. `ruby scripts/harvest_import.rb --csv data/imports/FILE.csv [--collection C] \
   [--hub SLUG --hub-field supplies_to|sourced_from --evidence-url URL \
   --evidence-snippet TEXT --confidence high|medium|low] [--geocode]`
   - Skips existing/ambiguous rows, scaffolds new listings via `add_listing.rb`, wires the hub
     edge, records evidence, sets `discovery_status: scaffolded`, then reciprocates + validates.
   - Add `--dry-run` first to preview with no writes.
6. Gate: `evidence_audit.rb` -> `relationship_audit.rb` -> `validate_content.rb` ->
   `check_layouts.py` -> `jekyll build` -> `seo_lint.py`.
7. Commit one source/hub per commit (`git pull --rebase`; never force-push).

## Tooling
Built: `scripts/harvest_lib.rb` (listing index + matcher), `scripts/match_report.rb`
(dupe detector), `scripts/harvest_import.rb` (bulk importer + evidence ledger),
`scripts/evidence_audit.rb` (edges vs ledger).
Reused: `scripts/add_listing.rb`, `scripts/reciprocate.rb`, `scripts/hub_report.rb`,
`scripts/relationship_audit.rb`, `scripts/validate_content.rb`.
To build per pilot: `scripts/harvesters/<source>.rb`. Later: `scripts/source_triage.rb`
+ `data/sources.yml` (source registry).

## Pilots (see SOURCING_PLAN.md)
1. AsureQuality register (nodes + certification) — structured file -> staging CSV.
2. Otago Farmers Market (market -> vendor edges) — static pages already fetched.
3. One eatery "our suppliers" page (producer -> eatery edges) — the on-goal relationship.
