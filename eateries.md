---
layout: default
title: Eateries
permalink: /eateries/
seo_title: "Cafés & Restaurants Sourcing Ethical Ingredients | Homegrown"
seo_description: >
  Explore cafés and restaurants committed to sourcing local, organic and spray-free ingredients from trusted producers.
---
{% assign items = site.vendors | concat: site.restaurants %}
{% assign regions = items | map: 'region' | uniq %}
<section class="directory-page">
  <div class="directory-hero">
    <div>
      <p class="eyebrow">Eateries</p>
      <h1>Find places that name their farmers</h1>
      <p class="lead">Cafés, restaurants, bars, bakeries, and food trucks using organic, seasonal, and local ingredients.</p>
      <div class="filter-row">
        <p class="filter-label">Looking for</p>
        <div class="pill-group">
          {% assign subtypes = "cafe,restaurant,food-truck" | split: "," %}
          {% for sub in subtypes %}
          <label class="pill pill--checkbox">
            <input type="checkbox" name="subtype" value="{{ sub }}">
            <span>{{ sub | replace: '-', ' ' | capitalize }}</span>
          </label>
          {% endfor %}
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
      <input id="dirSearch" type="search" placeholder="Search eateries by name or city">
      <div id="dirResultsCount" class="muted"></div>
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

  {% include featured-card.html scope="collections" key="eateries" %}

  <div class="listing-grid listing-grid--tight">
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
