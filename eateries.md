---
layout: default
title: Eateries
permalink: /eateries/
---
{% assign items = site.vendors | concat: site.restaurants | sort: 'name' %}
{% assign regions = items | map: 'region' | uniq | sort %}
<section class="directory-page">
  <header class="collection-index__header">
    <p class="eyebrow">Cafés & restaurants</p>
    <h1>Find places that name their farmers</h1>
    <p class="lead">Eateries and kitchens using organic, seasonal, and local ingredients.</p>
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
      <p class="filter-label">Type</p>
      <div class="pill-group">
        {% assign subtypes = "cafe,restaurant,bar-restaurant,bakery,deli" | split: "," %}
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
