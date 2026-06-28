# NZ sourcing plan: the connection harvest

Internal planning doc (excluded from the published site). How we grow Homegrown
toward "every NZ organic grower, every stockist, and every cafe, store and
restaurant that stocks it" without random data entry, by following the web of
connection. New Zealand only for now (ignore Australia).

## The core idea: mine hubs, do not type listings one by one
A **hub** is a business that publishes a list of its partners:
- a **producer's** "Where to buy / Stockists / Find us" page, or
- a **stockist's or distributor's** "Our producers / Meet our suppliers" page.

One hub page yields **many listings and many relationships in a single pass**.
That is the highest-leverage way to grow both coverage and reciprocity (the
trust signal). This is exactly how the Chantal Organics, Mahoe, Milmore Downs and
Wairiri Buffalo stockists were added. We industrialise that move.

Two directions, both valuable:
- **Forward (producer to outlets):** a producer's stockist page gives the shops
  and cafes that sell it.
- **Reverse (stockist or distributor to producers):** a grocer's, market's or
  distributor's supplier list gives the producers behind it.

## The harvest loop (repeatable, one hub at a time)
1. Pick the hub and its partner-list URL.
2. Pull the partner list (WebFetch on the URL, or Josh pastes the page): name,
   website, address, city, region.
3. Match each entry against the current DB by slug / name / website.
   - **Existing** listing, just wire the reciprocal relationship.
   - **New**, scaffold a listing.
4. Scaffold new listings with `scripts/add_listing.rb` (canonical tags, slug
   de-dup, `--geocode`) and write **honest copy at creation** per the
   listing-quality standard in `README.md` (never provenance phrasing). Set
   `sourced_from` / `supplies_to` on both ends so the link reciprocates.
5. Geocode anything missing coordinates (the `tools/` Nominatim toolchain).
6. Run the gate + `scripts/relationship_audit.rb`. Reciprocity should hold or rise.
7. Commit and push this one hub. Stop. The reciprocity count is the score.

## Let the database pick the next hub (the "scour" part)
The DB tells us where the leverage is. A small report (Stage 0) ranks it:
- **Supply-side hubs:** producers / distributors with the most outlets already
  linked and a website (likely a stockists page) = the richest forward mines.
- **Reverse hubs:** stockists / distributors that source from many producers.
- **One-way links** = instant reciprocity wins (partner already in the DB, just
  add the back-link).
- **Orphans** = listings with no connection yet; most pick one up as hubs are mined.

### Current state (baseline 2026-06-27)
- NZ listings **547**: farms 127, stores 204, restaurants 82, vendors 68,
  markets 62, distributors **4**.
- **199** have a relationship; **348** are orphans.
- Only **4 distributors**, the biggest single opportunity (distributors are the
  largest hubs; one supplies dozens to hundreds of stores).

**Update 2026-06-28 (completeness pass, Stage 4 pulled forward):** graph is now
fully reciprocal. `relationship_audit.rb` reports **0 one-way claims, 0 unresolved
targets, 240 reciprocated pairs** (all listings incl. AU). The 5 duplicate slugs
and 9 dangling references are resolved (see Stage 4 + the progress log). Next
session should re-baseline the NZ-only counts before mining the first hub.

### Concrete top hubs right now
Forward (producers / distributors, by outlets already linked):
Milmore Downs (48), Streamside Organics (48), Chantal Organics (44), Mahoe
Farmhouse Cheese (40), Farmers Mill (13), Untamed Earth (12), AwaRua Organics
(11), Trickett's Grove (10), Moana Organics (7), Waipuna Pastures (7).

Reverse (stockists, by producers they source from):
Harbour Co-op (15), Little Farms (10), Piko Wholefoods (8), Down to Earth
Organics (7), Lyttelton Farmers Market (4), Beckenham Butchery (4), Kingi (4).

## Staged plan
One hub is roughly one work session and one commit. Stop after any hub; nothing
is left half-done. Tackle stages in order, but each sub-batch is independent.

### Stage 0, tooling (one short session)
- **DONE 2026-06-28: `scripts/hub_report.rb`** (report-only): reads the listing
  collections (NZ only) and ranks forward hubs (producers/distributors by outlets
  linked, with a website to mine), reverse hubs (stockists by producers sourced),
  unmined producers with a website, and orphans by region. `--top N` / `--all`.
  This is now the source of truth for the "concrete top hubs" below (which are
  stale; run the report). One-way reciprocation is handled by `reciprocate.rb`
  (currently 0 one-way).
- **DONE 2026-06-28: harvest backbone** (see `HARVEST.md`): `harvest_lib.rb`
  (listing index + matcher), `match_report.rb` (dupe detector), `harvest_import.rb`
  (bulk wrapper over `add_listing.rb` + evidence ledger + reciprocate),
  `evidence_audit.rb`, and the `_data/relationship_evidence.yml` ledger. Per-source
  parsers live in `scripts/harvesters/`.

### Stage 1, mine the top producer hubs (forward) — biggest leverage
One per sub-batch: Streamside Organics, then Untamed Earth, Farmers Mill, Trickett's
Grove, AwaRua Organics, Moana Organics, Waipuna Pastures. Then revisit Chantal /
Mahoe / Milmore / Wairiri to capture any stockists we missed the first time.

### Stage 2, mine the big stockists and distributors (reverse)
- **Distributors first** (mega-hubs, only 4 in DB): add and mine Ceres Organics,
  Chantal Wholesale, Trade Aid, Bin Inn, GoodFor, Wise Cicada. Their
  where-to-buy and producer pages explode coverage.
- **Big organic grocers:** Commonsense Organics, Huckleberry, Farro Fresh,
  Harbour Co-op, Little Farms, Down to Earth, harvest their "meet our producers"
  pages.
- **Big farmers' markets:** harvest vendor lists (adds markets, vendors and
  producers at once).

### Stage 3, regional gap sweeps
Use the orphan-by-region output to find thin regions and do one region per
session. Canterbury candidates are already staged in
`~/.claude/plans/eager-plotting-wadler.md`. Then North Canterbury meat, Banks
Peninsula, then province by province.

### Stage 4, reciprocity and hygiene pass — DONE 2026-06-28 (pulled forward)
`relationship_audit.rb --strict`: reciprocate one-way links, resolve dangling
slug references (the legacy exceptions), and dedupe cross-collection duplicate
slugs (e.g. AwaRua Organics appears as both a farm and a vendor). Re-baseline.

Done this pass:
- **Deduped 5 duplicate slugs.** Merged the lower-quality cafe/store dups
  (earth-store-whitianga, toad-hall-motueka, all-things-organic-tairua) into one
  store listing each; consolidated the 3 AwaRua Organics listings (stub farm +
  rich vendor + awarua-organics-southland) into the single vendor node and
  repointed inbound refs; split Live2Give's shared slug into
  `live2give-organics` (farm) + `live2give-organics-grocer` (grocer) with a
  reciprocal self-supply link. Pruned `KNOWN_DUPLICATE_SLUGS`.
- **Stripped 9 dangling references** (none resolved to real businesses):
  the phantom `supply-circle-hub` x4 (the real grower<->outlet links already
  exist directly), Amisfield's self/descriptive refs, and 2 AU refs. Pruned
  `KNOWN_UNRESOLVED_RELATIONSHIPS`.
- **Built `scripts/reciprocate.rb`** (report / `--apply`, reuses the audit's
  parsing) and reciprocated all 47 one-way claims. Reusable every harvest session
  (loop step 6). Result: 0 one-way, 0 dangling.

## Per-session checklist (keeps each login bounded)
- [ ] `git pull --rebase`; confirm sole agent (Codex.app fully quit).
- [ ] Pick ONE hub (from `hub_report` or the next in the current stage).
- [ ] Pull its partner list into a reviewed CSV in `data/imports/`.
- [ ] Match and dedupe; wire reciprocal relationships; scaffold new listings with
      honest copy.
- [ ] Geocode; run the gate + `relationship_audit.rb`.
- [ ] Commit and push this one hub. Stop.

## Quality bar (non-negotiable)
- Honest copy at creation (listing-quality standard in `README.md`): say what the
  business is and where; no provenance phrasing; practice tags only where
  genuinely known; never fabricate. No em or en dashes.
- Every new listing earns at least one real relationship (that is how it was found).
- Reciprocity is the metric; `relationship_audit.rb` must hold or rise each session.

## Progress log
| Stage | Hub | Date | Listings added | Relationships added | Commit |
|-------|-----|------|----------------|---------------------|--------|
| 0 | hub_report.rb (forward/reverse/unmined/orphan ranking, NZ) | 2026-06-28 | 0 | 0 | hub_report.rb |
| 4 | reciprocity + hygiene (pulled forward) | 2026-06-28 | 0 new (merged 5 dup slugs, stripped 9 dangling) | +44 reciprocated pairs (196 to 240); 47 one-way reciprocated | reciprocate.rb |
| 1 | AsureQuality register (Pilot 1, enrichment slice) | 2026-06-28 | 0 new (206 parsed, shortlist staged) | 7 listings certified AsureQuality Organic | asurequality.py + enrich_certifications.rb |
| 1 | Producer-forward web scan (detect-only, Pilot 4 step 1) | 2026-06-28 | 0 new (detect-only) | 0 (candidate hub pages only) | stockist_scan.py |
| 1 | Producer-forward extract + classify (Pilot 4 step 2) | 2026-06-28 | 0 new (review queue staged) | 0 (CoralTree: 10 auto edges + 19 NZ new staged for review) | stockist_extract.py + candidate_edges.rb |
| 1 | Producer-forward full scan (Pilot 4, all 52 sized) | 2026-06-28 | 0 new (opportunity sized, nothing applied) | 0 (26 trustworthy AUTO edges + ~22 KML-new identified; widget adapters = next leverage) | full-scan analysis |
| 1 | Apply 2 clean KML hubs: coraltree + three-oaks (Pilot 4) | 2026-06-29 | 11 new (8 coraltree, 3 three-oaks; dropped 11 of 22 candidates) | +28 reciprocal edges (17 AUTO + 11 new); pairs 240 -> 268 | 7ddeb19 + 82189cc |

## Pilots (full pipeline doc in `HARVEST.md`)
- **Pilot 1, AsureQuality register: enrichment slice DONE 2026-06-28.**
  `scripts/harvesters/asurequality.py` parses the register (raw cached + gitignored
  under `data/harvest/`) to `data/imports/asurequality.csv` (206 deduped NZ Active
  operators). The register has **no websites and uses legal names**, so it is a
  curation source, not a bulk import: `match_report` found 4 existing + 11 ambiguous
  + 191 new, and region is missing from ~80% of addresses. Enriched 7 confirmed
  existing listings with `AsureQuality Organic` + source + organic tag via
  `enrich_certifications.rb` (curated list in `data/imports/asurequality-confirmed.csv`).
  **Next:** (a) review the remaining ambiguous matches (`ruby scripts/match_report.rb
  data/imports/asurequality.csv`) and enrich the real ones; (b) curate consumer-facing
  new producers from the 191 (skip anonymous trusts/wholesale entities; resolve region
  via a geocode-with-region step before import).
- **Pilot 2, Otago Farmers Market** (market -> vendor edges): vendor pages already
  fetched this session; pagination `?start=N`, detail `/vendors/<slug>`. Filter to
  organic stallholders, scaffold, wire `supplies_to: otago-farmers-market-dunedin`.
- **Pilot 3, an eatery "our suppliers" page** (producer -> eatery edges): the on-goal
  relationship type.
- **Pilot 4, producer-forward web scan (steps 1-2 DONE 2026-06-28; apply pending).**
  `stockist_scan.py` (detect) + `stockist_extract.py` (extract) + `candidate_edges.rb`
  (classify) discover producer -> stockist edges from producers' own "where to buy"
  pages. Key findings this build: (a) of 106 unmined producers, 54 are drinks/eateries
  out of scope, leaving ~52 produce producers to scan; (b) modern producer where-to-buy
  pages are mostly JS store-locator widgets (WP Store Locator, Stockist.co, Shopify
  blog, Wix), so the data is not in static HTML, the highest-yield exception is a Google
  My Maps embed whose KML export lists every pin with coordinates; (c) Python's
  `robotparser` false-blocks Allow-overrides (e.g. Google's `Allow: /maps/d/`), fixed
  with a correct longest-match evaluator in `stockist_scan.py`.
  - **Full produce-first scan (all 52 producers, 2026-06-28).** Funnel: 8 unreachable
    (stale website fields, DNS/SSL); 30 reachable with no stockist page (many are
    legitimately direct-to-consumer: CSA boxes, eggs, meat); 14 with a candidate page.
    By extraction method (AUTO = edge to an existing listing, ready to wire; new =
    candidate outlet to review):
    - KML (clean): coraltree 10 auto / 19 new; three-oaks 8 / 3.
    - static (noisy): pasture-poultry 4 / 18; first-light 2 / 96; mycobio 2 / 99;
      premium-game 0 / 15; zealong 0 / 62.
    - widget (locked, 0 extracted): biofarm + olliff (WP Store Locator); durham +
      jersey-girl + te-horo + te-matuku (Wix); ceres (Shopify blog).
    - **Totals: 26 trustworthy AUTO edges** (18 from KML, 8 from static) **+ ~22
      trustworthy new outlets** (KML only). The 290 static "new" rows are ~95%
      boilerplate noise (nav, product names, recipe words) and must NOT be bulk
      imported; only the static AUTO matches are usable, with a glance.
  - **Strategic read:** most modern NZ producers expose stockists via JS widgets, so the
    highest-leverage next investment is per-widget adapters (WP Store Locator AJAX for 2;
    Stockist.co JSON / Wix for 4+), not more static scraping. Also queued: tighten the
    static adapter to a detected list region; fix the 8 stale producer website fields;
    curate clinics/pharmacies out of the CoralTree new set before any apply.
  - **Applied 2026-06-29 (coraltree + three-oaks).** Wired 17 of the KML AUTO edges
    and scaffolded 11 curated new outlets; reciprocated pairs 240 -> 268 (both
    producers moved from orphan to connected, coraltree now a top-10 hub). Each new
    outlet was verified for what it is and where before any copy was written.
    Curation dropped 11 of the 22 "new" candidates: 8 clinics/pharmacies/wellness
    centres + 3 that are producers, not stockists (Chaos Springs = compost/soil,
    Zealand Farms = eggs, Millstream Gardens = herbal skincare); also dropped 1 AUTO
    edge the source itself marks "COMING SOON" (three-oaks -> commonsense-wellington-city).
    Staging CSVs: `data/imports/{coraltree,three-oaks}-stockists.csv`.
  - **Still to apply (deferred, needs a glance):** the 8 static-hub AUTO edges
    (first-light 2, mycobio 2, pasture-poultry 4) were left for an individual review
    because 2 are junk matches (mycobio "Store" -> organic-store; first-light
    supplies_to wharerata-farm looks reversed, wharerata is one of its growers).
  - **Next leverage remains the widget adapters** (the highest-yield uninvested move):
    WP Store Locator AJAX for biofarm + olliff; Wix for durham / jersey-girl /
    te-horo / te-matuku; Shopify blog for the ceres distributor mega-hub.
