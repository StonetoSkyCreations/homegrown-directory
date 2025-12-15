---
layout: default
title: Farms
permalink: /farms/
seo_title: "Farms & Producers | Organic, Spray-Free, Regenerative | Homegrown"
seo_description: >
  Discover growers focused on soil health, ecological stewardship and clean farming practices across Aotearoa.
---
{% assign items = site.farms | sort: 'slug' %}
{% assign regions = items | map: 'region' | uniq %}
<section class="directory-page">
  <div class="directory-hero">
    <div>
      <p class="eyebrow">Farms & producers</p>
      <h1>Find farms and producers</h1>
      <p class="lead">Organic, regenerative, spray-free, biodynamic, and pasture-raised farms for people and businesses.</p>
      <div class="filter-row">
        <p class="filter-label">Looking for</p>
        <div class="pill-group">
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="market-garden">
            <span>Market garden</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="orchard">
            <span>Orchard</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="vineyard">
            <span>Vineyard</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="livestock">
            <span>Livestock</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="dairy-farm">
            <span>Dairy farm</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="apiary">
            <span>Apiary / honey</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="eggs">
            <span>Eggs</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="mushrooms">
            <span>Mushrooms</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="seeds">
            <span>Seeds / nursery</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="flowers">
            <span>Flowers</span>
          </label>
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="mixed">
            <span>Mixed</span>
          </label>
        </div>
      </div>
    </div>
    <div class="directory-controls">
      <label for="regionFilter">Region</label>
      <select id="regionFilter">
        <option value="all">All regions</option>
        {% for region in regions %}
        <option value="{{ region | downcase }}">{{ region }}</option>
        {% endfor %}
      </select>
      <label for="dirSearch">Search</label>
      <input id="dirSearch" type="search" placeholder="Search farms by name or city">
      <div id="dirResultsCount" class="muted"></div>
      <button type="button" class="button ghost button--sm" id="nearMeBtn">Near me</button>
      <span class="muted near-me-status" id="nearMeStatus"></span>
    </div>
  </div>

  <div class="filter-row">
    <p class="filter-label">Practices</p>
    <div class="pill-group">
      {% assign tags = "Organic,Spray-free,Regenerative,Biodynamic,Wild,Pasture-raised,Local" | split: "," %}
      {% for tag in tags %}
      <label class="pill pill--checkbox">
        <input type="checkbox" name="tag" value="{{ tag | downcase }}">
        <span>{{ tag }}</span>
      </label>
      {% endfor %}
    </div>
  </div>

  {% include featured-card.html scope="collections" key="farms" %}

  <div class="listing-grid listing-grid--tight">
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
