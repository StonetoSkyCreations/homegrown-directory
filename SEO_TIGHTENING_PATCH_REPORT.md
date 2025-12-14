# SEO Tightening Patch Report

## What changed
- Canonicalised listing type labels in meta titles/descriptions to stable per-collection nouns (Farm, Market, Store, Vendor, Restaurant, Distributor) with only explicit overrides (e.g., grocery/cafe/restaurant signals already present in front matter).
- Improved meta description truncation to respect word boundaries, prefer ~155–160 chars, and strip dangling punctuation before adding an ellipsis.

## Files changed
- `_includes/seo-meta.html`

## Before/after examples (titles + descriptions)
- Farm (`/farms/ashley-river-organics/`):  
  - After: `Ashley River Organics — Farm in Loburn, Canterbury | Homegrown Directory`  
    `Ashley River Organics in Loburn, Canterbury. Certified-organic orchard on the banks of the Ashley River growing heritage apples, pears and producing zero-waste juices.`
- Market (`/markets/titirangi-village-market/`):  
  - After: `Titirangi Village Market — Market in Titirangi, Auckland | Homegrown Directory`  
    `Titirangi Village Market in Titirangi, Auckland. Monthly community market in Titirangi Village featuring food, produce, arts, crafts, vintage goods, health products, and live music.`
- Store (`/stores/bin-inn-glenfield/`):  
  - After: `Bin Inn Glenfield — Store in Auckland, Auckland | Homegrown Directory`  
    `Bin Inn Glenfield in Auckland, Auckland. Bin Inn – bulk wholefoods & specialty grocery`
- Vendor (`/vendors/mapu-test-kitchen/`):  
  - After: `MAPU Test Kitchen — Restaurant in Lyttelton, Canterbury | Homegrown Directory`  
    `MAPU Test Kitchen in Lyttelton, Canterbury. Foraging-based micro-restaurant in Lyttelton using wild and home-grown ingredients.`
- Restaurant (`/restaurants/akito-eatery/`):  
  - After: `Akito Eatery — Restaurant in Oneroa, Auckland | Homegrown Directory`  
    `Akito Eatery in Oneroa, Auckland. Plant-based eatery embracing slow food and regenerative principles, serving seasonal breakfasts, brunches and lunches made from local ingredients.`
- Distributor (`/distributors/first-light-farms/`):  
  - After: `First Light Farms — Distributor in Havelock North, Hawke's Bay | Homegrown Directory`  
    `First Light Farms in Havelock North, Hawke's Bay. Collective of farmers producing 100% grass-fed Wagyu beef and venison raised on pasture and ethically sourced from New Zealand farms.`

*(Before: titles/descriptions used prior heuristics that could emit varied type nouns like GroceryStore/CafeOrCoffeeShop and a simpler word-count truncation; after: canonical labels and cleaner truncation.)*

## Verification
- `bundle exec jekyll build` (pass)
- Spot checks confirm canonical type labels and cleanly truncated descriptions on the sampled pages above.

