## Stage 1 — Title system refinement
**Objective:** Standardise concise, location-anchored titles without keyword bloat.  
**Files changed:** `_includes/seo-meta.html`  
**What changed:**
- Added consistent listing title pattern: “Name — Type in City, Region | Homegrown Directory” (falls back to region if city missing; omits practice tags).
- Home title remains site name + tagline; non-listing pages keep existing pattern with clarified fallbacks.
- Ensured single title source via the shared seo include.
**What did NOT change:** URLs/permalinks, page copy, collection index overrides, or any layout markup.  
**Verification (bundle exec jekyll build):** Pass.  
Examples (rendered titles):
- Home: `Homegrown Directory — Find Food Grown With Care`
- Farm: `Ashley River Organics — Farm in Loburn, Canterbury | Homegrown Directory`
- Market: `Titirangi Village Market — Market in Titirangi, Auckland | Homegrown Directory`
- Store: `Bin Inn Glenfield — Grocer in Auckland, NZ | Homegrown Directory`
- Vendor: `MAPU Test Kitchen — Eatery in Lyttelton, Canterbury | Homegrown Directory`
- Distributor: `First Light Farms — Hub in Havelock North, Hawke's Bay | Homegrown Directory`

## Stage 2 — Meta description strategy
**Objective:** Keep concise, clean descriptions with stable fallbacks and better truncation.  
**Files changed:** `_includes/seo-meta.html`  
**What changed:**
- Cleaned description pipeline and switched to word-boundary truncation (~28 words, ~155–160 chars).
- Contextualised listing descriptions with “Name in City/Region. …” while removing practice-tag bloat.
**What did NOT change:** No content rewrites; truncation kept conservative; OG/Twitter description usage unchanged.  
**Verification (bundle exec jekyll build):** Pass.  
Examples (meta description):
- Farm: `Ashley River Organics in Loburn, Canterbury. Certified-organic orchard on the banks of the Ashley River growing heritage apples, pears and producing zero-…`
- Market: `Titirangi Village Market in Titirangi, Auckland. The Titirangi Village Market is a long-running monthly market held in the heart of Titirangi Village,…`
- Store: `Bin Inn Glenfield in Auckland. Bin Inn Glenfield is a grocery store located in Glenfield Mall, Downing St (Shop 209, L2), Auckland, New Zealand, New…`

## Stage 3 — Entity & schema hardening
**Objective:** Ensure valid JSON-LD across collections with conservative, explicit type selection.  
**Files changed:** (no new changes in this stage; prior schema work already in place for all collections)  
**What changed:** No additional edits required; confirmed schema present for farms, markets, restaurants, distributors, stores, vendors after earlier parity work.  
**Verification (bundle exec jekyll build):** Pass. Sample JSON-LD parsed:
- Store: `@type` LocalBusiness, geo present.
- Vendor: `@type` Restaurant (explicit vendor type), geo present.
- Farm/Market/Restaurant/Distributor: schema unchanged and valid with geo where available.

## Final summary
- Stages completed: 1/2/3  
- Build status: OK  
- Files changed: 1 (`_includes/seo-meta.html`)  
- Before/after snapshots:
  - Titles now use “Name — Type in City, Region | Homegrown Directory” (removed practice tag suffixes).
  - Descriptions now use word-boundary truncation with location-first context.
  - Schema remains valid across collections (parity previously established for stores/vendors).
