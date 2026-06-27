Executive summary
- Hardened listing page rendering to show long descriptions when no body content exists, fixing blank content cases (e.g., Solstice Organics) while keeping design unchanged.  
- Normalised search.json generation so relationship fields (sources/supplies_to) are always emitted as arrays, preventing filter/search inconsistencies for listings missing these fields.  
- Confirmed submit form fallback messaging clearly directs users to email josh@stonetosky.nz with mailto-safe truncation.  
- Near Me, search/filter, and map logic inspected; existing guardrails and caching retained, with no regressions observed in current code.  
- Noted remaining data hygiene gaps (missing relationship fields in front matter, potential non-numeric coords) for future cleanup.

Issues fixed
- Medium – Listing long descriptions not rendered when body empty: `_layouts/listing.html` now renders `long_description` via markdownify when no page body is present; fixes blank content on new listings that rely on long_description.  
- Medium – search.json emitted strings/null for relationship fields when absent: `search.json` now coerces `sources`/`supplies_to` to arrays (empty when missing), avoiding downstream filter logic mismatches.

Risk register (not fixed)
- Front-matter consistency: many listings still omit `sources`/`supplies_to`, or may store single strings; search.json now handles output but source files remain unnormalised.  
- Coordinate validation: no automated clamp across all listings; some coords may be outdated or imprecise (but treated as-is).  
- Layout declaration drift: some collection files rely on defaults; ensure future additions use `layout: listing` or collection defaults to avoid blank pages.  
- Submit form URL input: browser-native URL validation remains relaxed only via type/text; differing formats could still slip through without server-side validation.  
- Performance: Near Me and filters query the DOM per call; acceptable today but could be profiled if dataset grows substantially.

Regression checklist
- After adding/editing listings, ensure `layout: listing` (or rely on defaults), `sources: []`, `supplies_to: []`, and numeric non-zero `lat`/`lon` when available.  
- Run `bundle exec jekyll build` to confirm pages generate (no blank outputs) and search.json includes arrays for `sources`/`supplies_to`.  
- Verify listing cards show location text and distance badges without layout overlap; Near Me sorts results and disables the button while locating.  
- Confirm submit form: lat/lon fields present, invalid coord inputs blocked, and mailto fallback text points to josh@stonetosky.nz.  
- Spot-check JSON-LD on a listing page for valid JSON and correct geo block only when coords exist.
