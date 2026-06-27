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
- Build `scripts/hub_report.rb` (report-only): reads `search.json` and prints
  (a) top unmined / partially-mined hubs that have a website, (b) one-way links
  to reciprocate, (c) orphan counts by region.
- Build a thin harvest helper: turn a reviewed CSV (the shared `data/imports`
  header) into matched relationships plus scaffolded listings, so the
  Chantal/Mahoe/Milmore/Wairiri move becomes one command.

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

### Stage 4, reciprocity and hygiene pass
`relationship_audit.rb --strict`: reciprocate one-way links, resolve dangling
slug references (the legacy exceptions), and dedupe cross-collection duplicate
slugs (e.g. AwaRua Organics appears as both a farm and a vendor). Re-baseline.

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
| 0 | (tooling) | | | | |
