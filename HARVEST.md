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
Built: `scripts/hub_report.rb` (ranks NZ hubs), `scripts/harvest_lib.rb` (listing
index + matcher + YAML field helpers), `scripts/match_report.rb` (dupe detector),
`scripts/harvest_import.rb` (bulk importer + evidence ledger), `scripts/evidence_audit.rb`
(edges vs ledger), `scripts/enrich_certifications.rb` (adds a certification + source +
organic tag to a reviewed list of existing listings), `scripts/candidate_edges.rb`
(step 2 classifier: runs extracted candidate names through `Harvest.match` and writes
`data/harvest/stockist-review.csv` split into `auto` = existing-listing edge ready to
wire vs `review` = new-listing or fuzzy-name decision).
Harvesters: `scripts/harvesters/asurequality.py` (register XLSX -> staging CSV);
`scripts/harvesters/stockist_scan.py` (step 1, detect-only web scan: for the unmined
NZ produce producers with a website, politely fetches each homepage and reports likely
"where to buy / stockists / suppliers" page URLs to `data/harvest/stockist-candidates.csv`;
honours robots.txt with correct longest-match precedence, ~1 req/s, caches raw HTML;
produce-first, so drinks/eatery listings are filtered out unless `--include-all`);
`scripts/harvesters/stockist_extract.py` (step 2, extract: fetches the detected pages
and pulls candidate names + a snippet to `data/harvest/stockist-edges.csv`). Producer
where-to-buy pages expose their list in different ways, so the extractor is a small
dispatcher, not one universal scraper: Google My Maps embed -> the map's KML export
(one row per placemark, NZ-only via longitude, coords captured; the highest-yield
pattern, e.g. CoralTree ~29 NZ stockists); plain static HTML list -> `<li>`/`<td>`/
heading/anchor text with a boilerplate stoplist; JS store-locator (WP Store Locator,
Stockist.co, Shopify blog, Wix, bare Google Maps iframe) -> classified `widget:<type>`
and skipped (handled later with a per-widget adapter, not scraped as noise).
Reused: `scripts/add_listing.rb`, `scripts/reciprocate.rb`, `scripts/relationship_audit.rb`,
`scripts/validate_content.rb`.
Later: `scripts/source_triage.rb` + `data/sources.yml` (source registry); a
geocode-with-region step so register rows missing a region can be imported.

## Pilots (status; see SOURCING_PLAN.md for detail)
1. **AsureQuality register — enrichment slice DONE (2026-06-28).** Parsed to
   `data/imports/asurequality.csv` (206 deduped operators). It is a curation source
   (no websites, legal names, region often absent), so we enriched 7 confirmed
   existing listings with certification rather than bulk-importing. Next: review the
   ambiguous matches and curate consumer-facing new producers (resolve region first).
2. Otago Farmers Market (market -> vendor edges) — static vendor pages already fetched.
3. One eatery "our suppliers" page (producer -> eatery edges) — the on-goal relationship.
