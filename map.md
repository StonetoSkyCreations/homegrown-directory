---
layout: default
title: Map
permalink: /map/
map: true
seo_title: "Map | Homegrown Directory"
seo_description: "Explore organic, spray-free, regenerative, biodynamic, pasture-raised, wild, and locally sourced food listings on the Homegrown map."
---

<section class="hero">
  <p class="eyebrow">Explore the map</p>
  <h1>Find real food grown with integrity.</h1>
  <p class="lead">Browse farms, markets, grocers, eateries, and distributors across Aotearoa. Filter the list and the map updates with you. Tap a pin to open the listing.</p>
</section>

<section class="map-explorer" aria-label="Interactive directory map">
  <div class="map-explorer__filters">
    <div class="map-explorer__field">
      <label for="searchInput" class="muted">Search</label>
      <input id="searchInput" type="search" placeholder="Region, food, practice, or listing name" autocomplete="off">
    </div>
    <div class="map-explorer__field">
      <label for="heroRegion" class="muted">Region</label>
      <select id="heroRegion">
        <option value="all">All regions</option>
      </select>
    </div>
    <div class="map-explorer__field filters">
      <span class="muted">Practices</span>
      <div class="map-explorer__checks">
        <label><input type="checkbox" name="practice" value="organic"> Organic</label>
        <label><input type="checkbox" name="practice" value="regenerative"> Regenerative</label>
        <label><input type="checkbox" name="practice" value="spray-free"> Spray-free</label>
        <label><input type="checkbox" name="practice" value="biodynamic"> Biodynamic</label>
        <label><input type="checkbox" name="practice" value="pasture-raised"> Pasture-raised</label>
        <label><input type="checkbox" name="practice" value="wild"> Wild</label>
        <label><input type="checkbox" name="practice" value="local"> Locally sourced</label>
      </div>
    </div>
  </div>

  <div class="map-explorer__types">
    <button class="button ghost button--sm" type="button" data-type-filter="farm">Farms</button>
    <button class="button ghost button--sm" type="button" data-type-filter="market">Markets</button>
    <button class="button ghost button--sm" type="button" data-type-filter="store">Grocers</button>
    <button class="button ghost button--sm" type="button" data-type-filter="restaurant,vendor">Eateries</button>
    <button class="button ghost button--sm" type="button" data-type-filter="distributor">Distributors</button>
    <button class="button ghost button--sm" id="clearFilters" type="button">Clear</button>
  </div>

  <ul class="map-legend" aria-hidden="true">
    <li><span class="map-legend__swatch" style="background:#2f5b3f"></span> Farms</li>
    <li><span class="map-legend__swatch" style="background:#c27d38"></span> Markets</li>
    <li><span class="map-legend__swatch" style="background:#3c6b73"></span> Grocers</li>
    <li><span class="map-legend__swatch" style="background:#8b4f2a"></span> Eateries</li>
    <li><span class="map-legend__swatch" style="background:#6d7a3c"></span> Distributors</li>
  </ul>

  <div class="map-explorer__toolbar">
    <div id="resultsCount" class="muted results-count is-loading">Loading listings&hellip;</div>
    <div class="results-actions">
      <button type="button" class="button ghost button--sm" data-near-me>Near me</button>
      <span class="muted near-me-status" data-near-me-status></span>
      <button type="button" class="button ghost button--sm map-view-toggle" data-map-view-toggle aria-pressed="false">Show map</button>
    </div>
  </div>

  <div class="map-explorer__body">
    <div class="map-explorer__list">
      <div id="listingResults" class="listing-grid" aria-live="polite"></div>
      <template id="emptyStateTemplate">
        <div class="empty-panel">
          <p class="eyebrow">No matching listings</p>
          <p>No listings match those filters yet. Try clearing a filter, choosing a broader region, or searching by food type, practice, or business name.</p>
        </div>
      </template>
    </div>
    <div class="map-explorer__map">
      <div class="map-panel map-panel--open">
        <div id="map"></div>
      </div>
    </div>
  </div>
</section>
