# Relationships Audit

## Coverage
- Total listings scanned: 480
- Listings with `supplies_to`: 22 (4.6%)
- Listings with `sources`: 79 (16.5%)
- Relationship edges: 191 total; 108 resolve to existing listings; 83 remain unresolved (mostly URLs stored in relationship fields rather than slugs)

## Connectivity
- Top hubs (total links — supplies_to / incoming): Streamside Organics (44 — 22/22), Little Farms (20 — 10/10), Supply Circle Hub (8 — 4/4), Moana Organics (8 — 4/4), Waipuna Pastures (8 — 4/4), Untamed Earth (8 — 4/4), FreshChoice Merivale (7 — 6/1), New World Lincoln (6 — 5/1)
- Listings referenced by others but lacking relationship fields: none after fixes
- One-way relationships: none remaining after mirroring

## Integrity Issues
- Broken references: 83 entries still point to non-existent slugs because `sources` is being used for citation URLs (e.g., `https://www.streamsideorganics.co.nz/pages/about`, `https://wearelittlefarms.com/pages/the-farm`, `Producer submission`). Affected examples include rebel-gardens, vagabond-vege, six-acres-farm, wharerata-farm, woodhouse-farm-organics, little-farms-market-garden, bella-olea, martinborough-manor, beach-road-milk-co, kaitake-farm, three-oaks-organic-farm, bellbird-permaculture-farm, four-corners-organics, coastal-market-garden, wind-river-organics, kahu-glen-farm, mingiroa-farm, t-gasper, the-egg-project, cameron-family-farms, biofarm, mycobio-ohau-gourmet-mushrooms, te-manaia-organics, oamaru-organics, ohoka-farmers-market, ferrymead-night-market.
- Templates now have empty relationship fields to avoid placeholder slugs; all relationship fields are arrays with no empty or duplicate entries detected.

## Manual Review Queue
- Decide how to handle citation URLs currently stored in `sources` (83 unresolved references across the listings listed above). Consider moving URLs to `source_urls`/`source_links` or keeping relationships slug-only.
- Beckenham Butchery (`_stores/beckenham-butchery.md`) mentions sourcing organic beef from Harris Farms (no matching listing); needs a listing or confirmation before adding a relationship.
- Streamside Organics body text mentions Ashley River Organics and Bellbird Baked Goods, but no matching listings exist; leave for future listing creation if appropriate.

---

### Addendum — Relationship/Citation Separation
- Listings updated: 469
- Citation entries moved from `sources` to `source_urls`: 83
- Unresolved slug-like references left in `sources` for manual review: 0
