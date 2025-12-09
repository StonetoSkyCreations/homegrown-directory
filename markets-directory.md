---
layout: default
title: Markets
permalink: /markets/
---
{% assign items = site.markets | sort: 'name' %}
{% assign regions = items | map: 'region' | uniq | sort %}
<section class="directory-page">
  <header class="collection-index__header">
    <p class="eyebrow">Markets</p>
    <h1>Find farmers' markets</h1>
    <p class="lead">Weekly markets and hubs with organic, spray-free, and local producers.</p>
  </header>

  <div class="filters">
    <div class="filter-group">
      <p class="filter-label">Region</p>
      <select id="regionFilter">
        <option value="all">All regions</option>
        {% for region in regions %}
        <option value="{{ region | downcase }}">{{ region }}</option>
        {% endfor %}
      </select>
    </div>
    <div class="filter-group">
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
    <div class="filter-group">
      <p class="filter-label">Market type</p>
      <div class="pill-group">
        {% assign subtypes = "farmers-market,market,market-hall" | split: "," %}
        {% for sub in subtypes %}
        <label class="pill pill--checkbox">
          <input type="checkbox" name="subtype" value="{{ sub }}">
          <span>{{ sub | replace: '-', ' ' | capitalize }}</span>
        </label>
        {% endfor %}
      </div>
    </div>
    <div id="dirResultsCount" class="muted"></div>
  </div>

  <div class="listing-grid listing-grid--tight">
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
