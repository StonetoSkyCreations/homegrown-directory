# Homegrown Directory — Audit Master Plan

This is the single authoritative audit of the Homegrown Directory repo. It supersedes
every earlier audit, report, and repair plan (see the documentation decision table in
section 4). Future agents should execute the staged plan in section 6 without
re-auditing, and should treat the measured baseline in section 3 as the ground truth
as of the audit date.

Internal doc, excluded from the published site via `_config.yml`.

---

## 1. Audit metadata

- **Date:** 2026-07-02
- **Branch:** `main`
- **Commit:** `bba42e1b473c3a1f83fb5fb81e35bd4db261e1fe`
- **Auditor:** Claude (Fable 5), one-shot repo audit + guardrail reset session
- **Commands run:** `git status`, `git log`, `ruby scripts/validate_content.rb`,
  `ruby scripts/relationship_audit.rb`, `ruby scripts/evidence_audit.rb`,
  `python3 scripts/check_layouts.py`, `bundle exec jekyll build`,
  `python3 scripts/seo_lint.py`, plus a session-local Ruby measurement script that
  parsed the front matter of all 654 listings (counts below all come from it or from
  the scripts above).
- **Inspected:** `_config.yml`, all six listing collections, `_data/*`, `_layouts/*`,
  `_includes/*` (header, seo-meta, connection-map, footer), `assets/js/main.js`,
  `assets/js/connections-map.js`, `assets/css/main.css`, `search.json`, `index.html`,
  `map.md`, `network.html`, `country/**`, top-level collection pages, `scripts/*`,
  `tools/*`, `data/imports/*`, `.github/workflows/*`, `_site/` build output
  (sitemap, listing titles/meta), and every non-listing `.md` file in the repo.
- **Docs found and used:** `README.md`, `ROADMAP.md`, `SEO_DOCTRINE.md`,
  `SOURCING_PLAN.md`, `HARVEST.md`, `archive/*` (8 files), `reports/*` (7 files),
  `tools/*.md`, `data/imports/README.md`, `_templates/listing-example-template.md`.
- **Docs superseded by this plan:** everything in `archive/` and the seven
  point-in-time reports formerly in `reports/` (now `archive/reports/`).

## 2. Executive summary

### Current state in plain English

The repo is in good working order. All five gate checks pass: front-matter validation
(654 listings), layout check, Jekyll build (25s), SEO lint, and the relationship audit
(334 reciprocated pairs, 0 one-way claims, 0 dangling references). CI runs the same
gate on every push.

The most important structural fact this audit establishes: **the site already ships
two country directories, and the documentation pretends it does not.** There are 81
Australian listings (12% of the directory), country pages for both countries under
`/country/`, an NZ/AU switcher in the header, country-scoped search, map framing,
region filters, and per-country browse pages. Yet the README says "First focus is
Aotearoa New Zealand", the homepage hero and site meta description say "across
Aotearoa", the SEO doctrine says "Country is omitted by default (NZ assumed)", and
the sourcing plan says "ignore Australia". This audit pass fixes the documentation
side (README, ROADMAP, SEO_DOCTRINE, SOURCING_PLAN clarified; `CLAUDE.md` and
`.claude/rules/` created); the user-facing side (homepage copy, network-view country
scoping, SEO metadata) is staged as repair work below.

The relationship web, the core value, is healthy on the NZ side (267 connected
listings, 334 reciprocated pairs, evidence ledger for all post-2026-06 edges) and
almost nonexistent on the AU side (3 connected listings forming one Byron Bay
triangle; the other 78 AU listings are orphans). There is zero cross-country leakage
in the graph and zero coordinates plotted in the wrong country.

The main data-quality debts are provenance (35% of listings have no `source_urls`;
72% of relationship pairs predate the evidence ledger), one legacy import scar
(87 files carry a stray sentence parsed as a YAML key), and inconsistent `country`
label values (`NZ` vs `New Zealand`, `AU` vs `Australia`).

### Top 10 highest-impact issues

1. Homepage, site meta, and hero copy describe an NZ-only site while an AU directory
   is live (product clarity + SEO).
2. `/network/` and the shared connections module have no country scoping; the network
   view blends both countries on one map.
3. Documentation contradicted the shipped two-country reality (fixed this pass).
4. 78 of 81 AU listings are orphans: the AU directory is a list, not yet a web.
5. 229 listings (35%) have no `source_urls`; 22 more carry the non-URL placeholder
   `User-supplied list`.
6. 240 of 334 relationship pairs have no entry in the evidence ledger (they predate
   it; most carry listing-level sources, so "likely, needs source review").
7. 87 listing files contain a stray full-sentence YAML key from a legacy import.
8. `country` label values are inconsistent (four variants across two countries) and
   not enforced by validation.
9. Country-neutral collection pages (`/farms/`, `/eateries/`, etc.) server-render
   both countries blended with NZ-only meta descriptions, while country-scoped
   equivalents exist at `/country/<country>/<section>/`.
10. `search.json` is one 796 KB payload for both countries, fetched by every page
    that needs the index, and grows with every listing.

### Top 10 fastest wins

1. Fix the homepage hero/meta and `_config.yml` site description to name both
   countries (also removes the em dash that violates the site's own copy rule).
2. Add a country filter (defaulting to the active country) to `/network/`.
3. Replace the 22 `source_urls: [User-supplied list]` placeholders with real URLs or
   an honest `sources_note`.
4. Strip the 87 stray sentence keys with a one-off script + spot check.
5. Normalise `country:` to exactly `New Zealand` / `Australia` and enforce the enum
   in `validate_content.rb`.
6. Geocode or explicitly mark the 3 listings genuinely missing coordinates.
7. Make `relationship_audit.rb --strict` blocking in CI now that the baseline is
   0 one-way / 0 dangling.
8. Add per-country counts to `relationship_audit.rb` output so AU web growth is
   visible.
9. Add country-index links to the footer (currently the switcher is the only path).
10. Add `last_checked` to the 265 listings missing it (script-assisted, from git
    history dates).

### Top 10 risks if ignored

1. An agent reads stale docs, treats AU listings as noise, and deletes or "fixes"
   them into the NZ directory.
2. Google indexes the blended country-neutral pages and the site loses country-intent
   searches in both markets.
3. The evidence-free majority of relationships decays silently; nobody can tell a
   verified link from a guessed one, undermining the trust signal.
4. `last_checked` dates from 2025-12 (255 listings) cross the 12-month line in
   December 2026 with no refresh policy in place.
5. The stray-YAML-key files break a future script that iterates front-matter keys.
6. `_config.yml` injects `country_slug: new-zealand` as a collection default, so a
   future AU listing missing the explicit field silently files under NZ (validation
   currently catches this only because it requires the field per-file).
7. search.json weight keeps growing linearly and mobile map/search performance
   degrades.
8. Near-duplicate listings (`bellbird-bakery` x4 variants, `ashley-river-organics`
   x2) split the graph value of those businesses.
9. `normalise_*.rb` scripts are non-idempotent; a casual run rewrites ~90 files.
10. AU users who find the switcher see a directory with no relationship web, which
    contradicts the site's stated point of difference.

## 3. Measured baseline (2026-07-02, commit bba42e1)

All counts measured this session; scripts and method in section 1.

| Metric | Value |
|---|---|
| Total listings | 654 |
| By collection | farms 130, stores 260, restaurants 111, markets 78, vendors 71, distributors 4 |
| Listings by country (effective `country_slug`) | New Zealand 573, Australia 81 |
| AU listings by collection | stores 32, restaurants 26, markets 16, farms 5, vendors 2, distributors 0 |
| `country` label variants | `New Zealand` 376, `NZ` 197, `AU` 43, `Australia` 38 |
| Connected listings (>=1 declared link) | 267 (40.8%) |
| Orphan listings | 387 (of which 78 of the 81 AU listings) |
| Reciprocated pairs | 334 (across 267 listings) |
| One-way claims | 0 |
| Dangling slug references | 0 |
| Directed edge entries (`sourced_from` + `supplies_to`) | 674 |
| Cross-country edges | 0 |
| AU-internal pairs | 3 (the-farm-byron-bay / the-bread-social-byron-bay / three-blue-ducks triangle) |
| Evidence ledger entries | 94; pairs without ledger evidence: 240 of 334 |
| Listings with no `source_urls` | 229 (35%): restaurants 77, stores 56, farms 46, vendors 35, markets 15 |
| `source_urls` containing the non-URL `User-supplied list` | 22 |
| Missing `last_checked` | 265; dated values: 2025-12 x255, 2026-06 x74, 2026-07 x12, 2026-03 x1; none older than 12 months |
| Missing `website` | 175 |
| Missing `description` / `region` | 0 / 0 |
| Duplicate slugs across collections | 0 (blocked by validate_content.rb) |
| Listings without numeric lat/lon | 9 = 6 brand-umbrella parents with `lat: ""` (excluded from search.json by design) + 3 real gaps: `_markets/northland-farmers-market`, `_markets/veg-out-st-kilda-farmers-market` (AU), `_vendors/tasman-bay-salt-co` |
| Coordinates outside declared country's bounding box | 0 |
| Files with stray sentence-as-YAML-key front matter | 87 |
| Text-only relationship fields (unrendered) | `sourced_from_text` 46, `supplies_to_text` 13 |
| Fields in wide use but absent from templates/docs | `type` 357, `social_links` 281, `market_days` 275, `name` 271, `notes` 221, `postcode` 214, `long_description` 204, `category` 187, `sourcing_tags` 182, `suburb` 176, `social` 165, `brand` 153, `collection` 113, `supply_role` 67, `awards` 30, `rating_*` 28 |
| Sitemap URLs | 719 (country pages: NZ 30, AU 10) |
| Pages missing SEO metadata | 0 (seo_lint passes: titles, descriptions, canonicals, JSON-LD all clean) |
| Build time | ~25 s |
| Asset weight | `search.json` 796 KB, `main.js` 68 KB, `main.css` 76 KB, `connections-map.js` 16 KB, `og-image.png` 120 KB, `logo.png` 92 KB |
| Broken internal/external links | **not checked this session** (no link checker in repo) |
| Secrets / unsafe endpoints | none found; CDN scripts carry SRI hashes; no form POST endpoints (submit flow is mailto-based) |

## 4. Documentation decision table

| Path | Purpose | Status | Action (this pass) | Superseded by / notes |
|---|---|---|---|---|
| `README.md` | Human-facing overview, add-a-listing, quality standard | Authoritative | **Edited** — two-country model stated; AU URLs added | — |
| `ROADMAP.md` | Living status, known issues, next steps | Authoritative | **Edited** — vision covers both countries; points to this plan | — |
| `SEO_DOCTRINE.md` | Canonical SEO rules (enforced by seo_lint) | Authoritative, one stale rule | **Edited** — §3.2 "NZ assumed" replaced with two-country rule | — |
| `SOURCING_PLAN.md` | Active NZ harvest workstream + resume block | Authoritative for harvest | **Edited** — "ignore Australia" clarified as harvest scope only | — |
| `HARVEST.md` | Harvest pipeline operating loop + tooling | Authoritative | Kept unchanged | — |
| `CLAUDE.md` (repo root) | Always-loaded agent operating rules | — | **Created** | — |
| `AUDIT_MASTER_PLAN.md` | This audit | — | **Created** | Supersedes all prior audits |
| `.claude/rules/*.md` (4 files) | Path-scoped agent rules | — | **Created** | — |
| `reports/*.md` (7 files) + CSVs | Point-in-time audits from the ~480-listing era (Dec 2025) | Stale, looked current | **Moved to `archive/reports/`** with historical headers | This plan |
| `archive/*.md` (8 files) | Pre-launch/SEO/data-hygiene snapshots | Historical | Kept; **headers added** where missing | This plan |
| `archive/README.md` | Explains the archive | Useful | **Edited** — lists current living docs | — |
| `tools/*.md` (4 summaries) | Geocoding-run working notes | Historical working artefacts | Kept in place (tools/ is a working dir; README there explains) | — |
| `tools/README.md` | Geocoding toolchain how-to | Useful | Kept unchanged | — |
| `data/imports/README.md` | Import staging conventions | Useful | Kept unchanged | — |
| `_templates/listing-example-template.md` | Canonical annotated listing template | Useful | Kept unchanged; Stage 9 promotes it to the full field reference | — |
| `_posts/*.md`, per-collection `_template.md` | Site content / scaffolds | Content | Out of scope | — |

No files were deleted.

## 5. Detailed findings

Severity: Critical / High / Medium / Low. "AI-safe" = safe for AI automation.

### 5.1 Product clarity

- **[High] The site presents as NZ-only while shipping an AU directory.**
  Evidence: `index.html` hero and `seo_description` say "across Aotearoa";
  `_config.yml` description says "Explore Aotearoa's directory…"; meanwhile 81 AU
  listings, `/country/australia/` pages, and the NZ/AU switcher are live.
  Why it matters: AU users and crawlers have no signal the AU directory exists;
  the switcher sits under a "Settings" label in the nav, discoverable but unexplained.
  Action: Stage 2 copy work (homepage, about, config description).
  AI-safe: Yes (copy change, Josh reviews wording). Human judgement: Yes (brand voice).
- **[Medium] The "why the web matters" story is told well on listing pages
  (verified badge, chip lists) but nothing on the homepage explains reciprocity as
  the trust signal.** Action: Stage 5. AI-safe: Partial. Human: Yes.
- **[Low] `_config.yml` site description contains an em dash**, violating the site's
  own no-dash copy rule; it flows into meta tags. Action: Stage 2 (bundle with copy
  fix). AI-safe: Yes. Human: No.

### 5.2 Country-directory structure

- **[Working well]** Explicit `country_slug` on all 654 listings; validation enforces
  known `country_slug` and region-belongs-to-country (`scripts/validate_content.rb`
  lines 103–117); search, map framing, region dropdowns, and directory browse pages
  are country-scoped in `assets/js/main.js` (`getActiveCountry`, `matchesCountry`,
  `countryDefaults` map views); the header switcher persists to localStorage, sets
  `aria-pressed`, and redirects between `/country/<slug>/` pages; server-rendered
  country pages filter collections by `page.country_slug`; sitemap carries 30 NZ +
  10 AU country pages; 0 cross-country coordinates; 0 cross-country edges.
- **[High] `/network/` is not country-scoped.** Evidence: zero country logic in
  `assets/js/connections-map.js`; `network.html` filters are region/practice/type
  only. Both countries render on one world map. The in-listing mini-map is inherently
  focus-scoped and currently cannot leak (0 cross-country edges), but has no guard.
  Action: Stage 2. AI-safe: Yes. Human: No.
- **[Medium] Country-neutral collection pages blend countries for crawlers.**
  `/farms/`, `/eateries/`, `/groceries/`, `/markets-directory/`, `/stores/`,
  `/restaurants/`, `/distributors/`, `/vendors/`, `/brands/` have no
  `page.country_slug`, so `directory_browse.html` server-renders all listings from
  both countries; client JS then filters by the active country. Metas are NZ-flavoured
  ("across Aotearoa"). Country-scoped equivalents already exist under
  `/country/<country>/<section>/`. Action: Stage 6 (decide: country-aware rendering,
  redirect, or canonical-to-country strategy). AI-safe: Partial. Human: Yes.
- **[Medium] `country` label values inconsistent** (four variants; table in §3).
  `country` feeds search haystacks, address lines, and JSON-LD. Action: Stage 1
  normalise + enforce enum in validation. AI-safe: Yes. Human: No.
- **[Low] `_config.yml` collection defaults inject `country_slug: new-zealand`.**
  Only harmless because validation independently requires the field per file.
  Action: Stage 1 — remove the defaults so a missing field fails loud instead of
  silently filing under NZ. AI-safe: Yes. Human: No.
- **[Low] AU listing titles carry state but not country** (e.g. "…in Byron Bay,
  New South Wales | Homegrown Directory"). Defensible; decide deliberately in
  Stage 6 whether disambiguation is needed. AI-safe: Partial. Human: Yes.

### 5.3 Architecture / repo health

- **[Working well]** Clean Jekyll 3.9.5 / github-pages 231 setup, schema-driven
  collections, one shared JS module per concern, CI gate mirrors the local gate,
  no dead framework code found (old Cytoscape/SVG modules confirmed removed).
- **[Medium] 87 listing files carry a stray full sentence parsed as a YAML key**
  (legacy import wrote a description line + `Source: …` outside any field; example:
  `_stores/homegrown-wholefoods-paraparaumu.md` line 30). Harmless to build; noise
  and a script hazard. Action: Stage 1 scripted strip, preserving the sentence into
  `long_description`/`notes` where it adds value. AI-safe: Yes (with dry-run diff).
  Human: spot-check.
- **[Low] Brand umbrella parents** (6 files, `type: brand`) use `lat: ""` — a
  stringly convention that any numeric consumer must special-case. Action: Stage 1
  switch to omitting the fields. AI-safe: Yes. Human: No.
- **[Low] `normalise_*.rb` non-idempotent** (known; rewrites ~90 files on re-run).
  Action: Stage 9. AI-safe: Partial. Human: Yes.

### 5.4 Documentation / project instructions

- **[High, fixed this pass] Docs contradicted the shipped product** (NZ-only claims;
  no repo-level agent instructions; stale reports in `reports/` looked current).
  Fixed: `CLAUDE.md` + `.claude/rules/` created, README/ROADMAP/SEO_DOCTRINE/
  SOURCING_PLAN edited, reports archived with headers, this plan created.
- **[Medium] No single field reference.** ~15 real fields (see §3 table) exist in
  data but not in templates or README. Action: Stage 9 — promote
  `_templates/listing-example-template.md` to the complete annotated field reference.
  AI-safe: Yes. Human: review.

### 5.5 Schema / listing data

Data-quality dimensions: **validity** — all 654 files parse and pass validation;
87 carry stray keys (see 5.3). **Uniqueness** — 0 duplicate slugs; known
near-duplicates: `bellbird-bakery` vs `-merivale`/`-riverside-market`/`-the-tannery`,
`ashley-river-organics` vs `-loburn`. **Completeness** — 0 missing description/region;
175 missing website; 3 missing coordinates; 265 missing `last_checked`; 229 missing
sources. **Consistency** — `country` labels (4 variants); duplicated overlapping
fields (`social` vs `social_links`, `type` vs `subtype` vs `category`,
`sourcing_tags` vs `practices`) tolerated by the search template's fallback chains.
**Timeliness** — no `last_checked` older than 12 months, but 255 dated 2025-12 cross
that line in Dec 2026. **Accuracy** — spot checks fine; no systematic verification
run this session.

- **[Medium] Near-duplicates split graph value.** Action: Stage 3 merge/relate.
  AI-safe: Partial (needs business-identity judgement). Human: Yes.
- **[Medium] `last_checked` refresh cliff in Dec 2026.** Action: Stage 4 policy +
  Stage 9 tooling. AI-safe: Partial. Human: Yes.
- **[Low] Overlapping legacy fields** — document, don't refactor. Stage 9.

### 5.6 Relationship graph

- **[Working well]** 334 reciprocated pairs, 0 one-way, 0 dangling — the June 2026
  completeness pass achieved and CI-reports the clean state. Hubs: jersey-girl-organics
  30, streamside-organics 26, milmore-downs 25, chantal-organics 23,
  mahoe-farmhouse-cheese 20, te-horo-harvest 20.
- **[High] AU graph is one triangle; 78/81 AU listings orphaned.** The AU directory
  currently lacks the site's core value. Classification: verified (the triangle) /
  absent (everything else). Action: future AU harvest workstream — Josh's call on
  priority; not repair work. AI-safe: No (needs sourced harvesting). Human: Yes.
- **[Medium] 240 of 334 pairs lack ledger evidence** (predate the ledger).
  Classification: **likely, needs source review** — most carry listing-level
  `source_urls`. Action: Stage 4 batch backfill by hub. AI-safe: Partial. Human: Yes.
- **[Medium] Text-only relationship fields are dead weight** (`sourced_from_text` 46,
  `supplies_to_text` 13 — intentionally unrendered per the archived relationship
  reports). They hold real leads. Action: Stage 3 — mine into slugs where the target
  now exists, else move to `notes`. AI-safe: Partial. Human: Yes.
- **[Low] `relationship_audit.rb` is report-only in CI** and has no per-country
  breakdown. Action: Stage 3 make `--strict` blocking; add country counts.
  AI-safe: Yes. Human: No.

### 5.7 Provenance / trust

- **[Medium] 229 listings without `source_urls`, 22 with the placeholder
  `User-supplied list`** (not a URL; example: `_stores/homegrown-wholefoods-paraparaumu.md`).
  Also `last_checked: ''` empty strings in the same import cohort.
  Action: Stage 4. AI-safe: Partial (finding URLs needs verification). Human: Yes.
- **[Working well]** The listing-quality standard (no provenance phrasing in copy),
  the evidence ledger for all new edges, distributor collection kept distinct from
  grower relationships, and practice tags only-when-known are all documented and
  recently enforced (workstream B cleanup done June 2026).
- **[Low] Public verification standard is implicit.** "Verified by N partners"
  badge exists; no public page explains what verification means. Action: Stage 4
  (small addition to about/listing-criteria pages). AI-safe: Yes. Human: review copy.
- Source-link liveness: **not checked this session** (no link checker in repo).

### 5.8 Search / filter / browse / map / network UX

- **[Working well]** Country switch (header, persists, redirects), country-scoped
  search + region + type + practice filters, split-view `/map/` with clustering and
  country framing (`countryDefaults` views), listing pages with chip-list fallbacks,
  mobile nav toggle.
- **[High] `/network/` country blending** (see 5.2).
- **[Medium] `store.html` / `vendor.html` lack the collapsible connection `<details>`
  parity `listing.html` has** (known ROADMAP issue). Stage 5. AI-safe: Yes. Human: No.
- **[Medium] `/map/` phase 2** (connection lines on the explorer map) deferred by
  design; keep deferred. Stage 5.
- **[Low] No-results recovery**: search has an initial-state template; verify empty
  states name the active country so users understand scoping. Stage 5.

### 5.9 SEO / indexability

- **[Working well]** seo_lint passes site-wide (single titles, descriptions,
  canonicals, valid JSON-LD); sitemap + robots fine; pretty permalinks; blog exists.
- **[High] Country-neutral metas on blended pages + NZ-only homepage meta** (5.1,
  5.2). Stage 2/6.
- **[Medium] `SEO_DOCTRINE.md` §3.2 said "Country omitted (NZ assumed)"** —
  amended this pass to the two-country rule; title-format implementation unchanged
  (Stage 6 decides AU disambiguation).
- **[Low] Internal linking between country sections is switcher-only**; footer has
  no country links. Stage 6. AI-safe: Yes. Human: No.
- Broken-link crawl: **not run** — add a checker in Stage 9 if wanted.

### 5.10 Accessibility

- **[Working well]** Skip link, `main` landmark, `aria-pressed` on switcher and
  theme toggle, `aria-expanded` on map/nav toggles, `aria-live` results region,
  chip-list text alternative for every map, `prefers-reduced-motion` media query
  in CSS.
- **[Medium] Ant-path animations are JS-driven and do not check
  `prefers-reduced-motion`** (`connections-map.js` has no reference; the CSS query
  can't reach canvas/SVG animations Leaflet plugins run). Stage 7. AI-safe: Yes.
  Human: No.
- **[Medium] Not measured this session:** colour contrast, tap-target sizes, full
  keyboard walk of the map explorer and network filters, focus-obscured checks.
  Stage 7 audit items. AI-safe: Partial. Human: Yes.

### 5.11 Performance

- **[Medium] `search.json` 796 KB** single payload for both countries; grows
  linearly. Obvious cut: per-country indexes (aligns with country scoping).
  Stage 8. AI-safe: Yes (template + JS change). Human: review.
- **[Low]** Leaflet already lazy-loads only on `map: true` pages; `main.js` 68 KB
  unminified sitewide is acceptable; images modest (og 120 KB, logo 92 KB — logo
  could be resized). Build 25 s. No third-party scripts beyond CDN Leaflet stack
  (SRI-pinned). Stage 8 minor items.

### 5.12 Security / static-site safety

- **[Low overall risk.]** No secrets in repo; no form endpoints (mailto flow);
  CDN scripts SRI-pinned; GitHub Pages deploy from `main` with CNAME; Gemfile
  pinned to `github-pages` 231. No dependency audit run this session (Stage 9
  optional `bundle audit`). External-link spam scan not run.

### 5.13 Maintainability / workflow

- **[Working well]** Validation gate is real and CI-enforced; `add_listing.rb`
  scaffolds valid listings; geography.yml is the country/region source of truth;
  the harvest pipeline is documented with a resume block.
- **[Medium] Field reference gap** (5.4) and **[Low] normalise script hazard**
  (5.3) are the maintainability debts. Stage 9.
- **This pass adds:** repo `CLAUDE.md` (operating rules), `.claude/rules/`
  (path-scoped guardrails), and this plan (single audit truth).

## 6. Staged repair plan

Rules for every stage: run the full gate before commit
(`ruby scripts/validate_content.rb && python3 scripts/check_layouts.py &&
bundle exec jekyll build && python3 scripts/seo_lint.py`, then
`ruby scripts/relationship_audit.rb` to confirm reciprocity held or rose).
Never fabricate data. Never collapse the two countries. One stage slice per commit.

### Stage 0 — Freeze baseline and project rules ✅ DONE (this pass, 2026-07-02)

Goal: preserve measured truth; remove conflicting instructions.
Done: this plan finalised; repo `CLAUDE.md` created; `.claude/rules/` created
(country-directories, listing-data, relationship-graph, validation-workflow);
`reports/` archived with historical headers; README/ROADMAP/SEO_DOCTRINE/
SOURCING_PLAN edited to the two-country truth; internal docs excluded from the
published build.
Acceptance: future agents load `CLAUDE.md`; old audits live only under `archive/`;
NZ and AU documented as distinct directory contexts; gate commands documented. ✅

### Stage 1 — Structural blockers

Goal: make every listing file structurally clean and country-labelled consistently.
Tasks: strip the 87 stray sentence keys (script with dry-run diff; keep the sentence
in `long_description` if the listing lacks one, else `notes`); normalise `country:`
to `New Zealand` / `Australia` exactly; add the enum check to `validate_content.rb`;
remove the `country_slug` defaults from `_config.yml`; change the 6 brand parents
from `lat: ""` to omitted coords (confirm search.json emits null and map skips them);
geocode or mark the 3 coordinate gaps.
Acceptance: gate passes; a front-matter key scan finds 0 multi-word keys; `country`
has exactly 2 values; validation fails on a bad `country`.
Likely files: 87+197+43 listing files (scripted), `scripts/validate_content.rb`,
`_config.yml`.
Risks: bulk edit noise — dry-run diff and spot-check 10 files per collection.
Do not touch: relationship fields, descriptions, tags, layouts.

### Stage 2 — Country-directory separation

Goal: both countries clearly visible and scoped everywhere users and crawlers look.
Tasks: homepage hero + meta + `_config.yml` description name both countries (and
drop the em dash); country filter on `/network/` defaulting to the active country
(guard in `connections-map.js`, UI in `network.html`); mini-map: assert focus-scoped
behaviour with a comment/test rather than new UI; make the switcher self-explanatory
(label "Country" already present — verify mobile); footer links to both country
indexes.
Acceptance: `/network/` opens scoped to the active country with a visible toggle;
homepage/meta mention Australia; gate passes; no NZ/AU listing disappears from its
own country's views.
Likely files: `index.html`, `_config.yml`, `network.html`,
`assets/js/connections-map.js`, `_includes/footer.html`, `about.html`.
Risks: breaking map framing — keep `countryDefaults` in `main.js` as the framing
source; copy voice — Josh reviews wording.
Do not touch: listing data, permalinks, `search.json` schema (that is Stage 8).

### Stage 3 — Relationship graph repair

Goal: protect the clean graph and convert latent relationship data.
Tasks: make `relationship_audit.rb --strict` blocking in CI; add per-country
counts to its output; merge/relate the near-duplicates (bellbird-bakery cluster,
ashley-river-organics pair) with redirects (`jekyll-redirect-from` is installed);
process `sourced_from_text`/`supplies_to_text`: convert to slug edges only where the
target listing exists AND the original source supports the claim, otherwise move to
`notes`; keep country-scoped — no cross-country edge without explicit verified
evidence recorded in the ledger.
Acceptance: audit stays 0 one-way / 0 dangling and CI now fails otherwise; `*_text`
fields reduced to 0 with a decision trail; pairs count did not drop except by
deliberate dedup.
Likely files: `scripts/relationship_audit.rb`, `.github/workflows/seo-lint.yml`,
the affected listing files, `_data/relationship_evidence.yml`.
Risks: dedup deleting a genuinely separate branch — verify addresses before merging.
Do not touch: the harvest pipeline scripts; AU expansion (separate workstream).

### Stage 4 — Provenance and trust

Goal: every claim classifiable as verified / likely / ambiguous / unsupported / stale.
Tasks: replace the 22 `User-supplied list` placeholders (find the real source or
mark `sources_note: community submission, unverified`); backfill `source_urls` for
the 229 (batched by collection; only URLs actually checked); backfill ledger
evidence for pre-ledger pairs hub-by-hub (start with the top hubs; medium confidence
with the listing's stockist-page URL); add `last_checked` to the 265 missing (from
git history); write the 12-month refresh policy into README; add a short public
"how verification works" section to `about.html` or `listing-criteria.html`.
Acceptance: `evidence_audit.rb` unevidenced count falls (target: top-10 hubs fully
evidenced); 0 non-URL `source_urls`; 0 missing `last_checked`; policy documented.
Likely files: listing files, `_data/relationship_evidence.yml`,
`scripts/evidence_audit.rb`, `about.html`/`listing-criteria.html`, `README.md`.
Risks: fabricating evidence — a URL goes in only if it was actually opened and
supports the claim; batches small enough to review.
Do not touch: practice tags (never add without evidence); listing copy.

### Stage 5 — User discovery

Goal: discovery parity across both directories.
Tasks: bring `store.html`/`vendor.html` to the collapsible-`<details>` connection
parity of `listing.html`; verify no-results states name the active country; homepage
gets a short "how the web of connection works" explainer near the trust list;
keep `/map/` connection lines deferred unless Josh pulls it forward.
Acceptance: gate passes; store/vendor pages render the same connection block as
listings; empty search states are country-explicit.
Likely files: `_layouts/store.html`, `_layouts/vendor.html`, `index.html`,
`assets/js/main.js` (empty-state strings).
Risks: layout regressions — compare rendered pages before/after.
Do not touch: `connections-map.js` mode logic beyond what Stage 2 added.

### Stage 6 — SEO and indexability

Goal: country-clear crawl paths without thin doorway pages.
Tasks: decide the fate of country-neutral collection pages (recommended: keep the
URLs but make them country-aware landing pages that link prominently to the two
country-scoped versions, with meta describing both countries — no server-blended
listing dump); AU title disambiguation decision (recommend adding ", Australia"
only where city+state is ambiguous — doctrine now permits it); footer/nav internal
links to both country trees; verify sitemap picks up any new pages; region pages
with very few listings stay indexed only if they carry real content (no new thin
pages).
Acceptance: seo_lint passes; both country trees reachable by crawl from the
homepage without JS; no page describes AU content with NZ-only meta.
Likely files: `farms.md` etc. (9 neutral pages), `_layouts/directory_browse.html`,
`_includes/seo-meta.html`, `_includes/footer.html`, `SEO_DOCTRINE.md` (record the
title decision).
Risks: mass URL churn — do not change permalinks; doctrine drift — update the
doctrine in the same commit as behaviour.
Do not touch: listing permalinks, canonical generation logic.

### Stage 7 — Accessibility and mobile

Goal: practical WCAG 2.2 AA on the paths users actually take.
Tasks: honour `prefers-reduced-motion` in `connections-map.js` (static lines instead
of ant-path animation); contrast pass on chips/badges/buttons in both themes;
tap-target check on switcher, filters, map controls; full keyboard walk of `/map/`
and `/network/` filters; confirm focus-visible everywhere and nothing obscured by
the sticky header.
Acceptance: reduced-motion users get non-animated lines; documented contrast results;
keyboard walk notes committed to this plan's changelog.
Likely files: `assets/js/connections-map.js`, `assets/css/main.css`.
Risks: none significant.
Do not touch: map data flow.

### Stage 8 — Performance / static-site cleanup

Goal: keep pages light as listings grow.
Tasks: split `search.json` into `/search-new-zealand.json` + `/search-australia.json`
(or filter server-side per country page) and load per active country — measure
before/after; resize `logo.png`; consider trimming unused fields from the index
(e.g. `geo_query`, `geo_label` if unused by JS — verify first).
Acceptance: index payload per page load drops materially (target: NZ ~<700 KB,
AU tiny); map/search/network behave identically; gate passes.
Likely files: `search.json` template, `assets/js/main.js`,
`assets/js/connections-map.js`.
Risks: network view needs cross-index awareness only if verified cross-border edges
ever exist (none today) — note the constraint in code.
Do not touch: the schema fields relationships/audits read (`sourced_from`,
`supplies_to`, `country_slug`, `slug`).

### Stage 9 — Maintainability and future workflow

Goal: make the next year of edits safe and boring.
Tasks: promote `_templates/listing-example-template.md` to the complete field
reference (documenting `type`, `brand`, `market_days`, `sourcing_tags`,
`supply_role`, `social_links`, `notes`, rating fields, etc.) and link it from
README; make `normalise_*.rb` idempotent or move them under `tools/` with a warning
header; add a `last_checked` staleness report (script or a flag on
`validate_content.rb`); optional: link checker and `bundle audit` in CI as
report-only steps; keep this plan's baseline updated when stages complete (append a
dated changelog line, do not rewrite history).
Acceptance: a new agent can add a listing for either country using only README +
template; stale-listing report exists; normalise scripts safe or clearly fenced.
Likely files: `_templates/listing-example-template.md`, `README.md`, `scripts/*`,
`.github/workflows/seo-lint.yml`.
Risks: doc drift — CLAUDE.md stays the pointer, not the encyclopedia.
Do not touch: the one-agent-at-a-time and never-force-push rules.

## 7. Machine-readable backlog

| ID | Stage | Title | Severity | Effort | AI-safe | Human review | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|
| HG-AUDIT-001 | 1 | Strip 87 stray sentence YAML keys | Medium | Small | Yes | Spot-check | — | 0 multi-word front-matter keys; gate passes |
| HG-AUDIT-002 | 1 | Normalise `country` to canonical labels + enum validation | High | Small | Yes | No | — | Exactly 2 country values; validator rejects others |
| HG-AUDIT-003 | 1 | Remove `country_slug` collection defaults from `_config.yml` | Low | Small | Yes | No | HG-AUDIT-002 | Build + validation pass; field required per file |
| HG-AUDIT-004 | 1 | Brand parents: omit empty-string coords | Low | Small | Yes | No | — | search.json emits null; map unaffected |
| HG-AUDIT-005 | 1 | Geocode or mark 3 coordinate gaps | Low | Small | Partial | Yes | — | 0 unexplained missing coords |
| HG-AUDIT-006 | 2 | Two-country homepage copy + site meta (incl. em dash) | High | Small | Yes | Yes (voice) | — | Homepage/meta name both countries; seo_lint passes |
| HG-AUDIT-007 | 2 | Country-scope `/network/` with default-to-active-country | High | Medium | Yes | No | — | Network opens scoped; toggle visible; no listing lost |
| HG-AUDIT-008 | 2 | Footer links to both country indexes | Low | Small | Yes | No | — | Both trees crawlable from every page |
| HG-AUDIT-009 | 3 | Make relationship audit `--strict` blocking in CI + per-country counts | Medium | Small | Yes | No | — | CI fails on one-way/dangling; AU counts visible |
| HG-AUDIT-010 | 3 | Merge/relate near-duplicate listings (bellbird, ashley-river) | Medium | Medium | Partial | Yes | — | Dedup with redirects; pairs not lost |
| HG-AUDIT-011 | 3 | Resolve 59 `*_text` relationship fields to edges or notes | Medium | Medium | Partial | Yes | HG-AUDIT-009 | 0 `*_text` fields; every new edge evidenced |
| HG-AUDIT-012 | 4 | Replace 22 `User-supplied list` source placeholders | Medium | Small | Partial | Yes | — | 0 non-URL source_urls |
| HG-AUDIT-013 | 4 | Backfill `source_urls` for 229 listings (batched) | Medium | Large | Partial | Yes | — | Sourced count rises per batch; only verified URLs |
| HG-AUDIT-014 | 4 | Backfill evidence ledger for top-10 hubs' pre-ledger pairs | Medium | Medium | Partial | Yes | — | evidence_audit unevidenced count drops |
| HG-AUDIT-015 | 4 | Backfill `last_checked` (265) + 12-month refresh policy | Medium | Small | Yes | Policy: Yes | — | 0 missing; policy in README |
| HG-AUDIT-016 | 4 | Public "how verification works" section | Low | Small | Yes | Yes (copy) | — | Live on about/listing-criteria |
| HG-AUDIT-017 | 5 | Store/vendor connection-block parity | Medium | Medium | Yes | No | — | Same `<details>` treatment as listing.html |
| HG-AUDIT-018 | 5 | Country-explicit empty-search states + homepage web explainer | Low | Small | Yes | Yes (copy) | HG-AUDIT-006 | Empty states name active country |
| HG-AUDIT-019 | 6 | Country-neutral collection pages: country-aware strategy | Medium | Medium | Partial | Yes | HG-AUDIT-006 | No blended listing dump with NZ-only meta |
| HG-AUDIT-020 | 6 | AU title disambiguation decision + doctrine update | Low | Small | Partial | Yes | — | Decision recorded in SEO_DOCTRINE |
| HG-AUDIT-021 | 7 | Reduced-motion guard for ant-path animations | Medium | Small | Yes | No | — | Static lines under prefers-reduced-motion |
| HG-AUDIT-022 | 7 | Contrast / tap-target / keyboard audit pass | Medium | Medium | Partial | Yes | — | Findings fixed or logged here |
| HG-AUDIT-023 | 8 | Per-country search index split | Medium | Medium | Yes | Review | HG-AUDIT-007 | Payload drop measured; behaviour identical |
| HG-AUDIT-024 | 9 | Complete annotated field reference | Medium | Medium | Yes | Review | — | All real fields documented; linked from README |
| HG-AUDIT-025 | 9 | Fence or fix non-idempotent normalise scripts | Low | Small | Yes | No | — | Safe re-run or explicit warning + relocation |
| HG-AUDIT-026 | 9 | Staleness report for `last_checked` | Low | Small | Yes | No | HG-AUDIT-015 | Report lists listings >12 months old |

---

*Changelog: created 2026-07-02 (Stage 0 executed in the same session). Append dated
lines here as stages complete; update §3 counts only with re-measured values.*
