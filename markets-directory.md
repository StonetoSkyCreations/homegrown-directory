---
layout: default
title: Markets
description: "Markets are local hubs where growers, producers, and artisans connect directly with the community—keeping food systems human-scale, seasonal, and rooted in place."
permalink: /markets/
---
{% assign items = site.markets | sort: 'name' %}
{% assign regions = items | map: 'region' | uniq | sort %}
<section class="markets-hero">
  <div class="markets-hero__intro">
    <p class="eyebrow">Markets</p>
    <h1>Markets are the beating heart of local food culture.</h1>
    <p class="lead">Not every market is fully organic or regenerative, but all of them carry the same essential pulse: people meeting people, growers meeting eaters, producers meeting the community they feed. They are grassroots ecosystems where food, craft, culture, and relationship move in real time—without the distance or abstraction of industrial systems.</p>
  </div>
  <div class="markets-hero__body">
    <p>A market is more than a place to buy food. It’s a living network where small farms find their customers, artisans test new ideas, and seasonal abundance becomes part of local life. It keeps wealth circulating close to home, strengthens local infrastructure, and helps communities rely less on centralised supply chains.</p>
    <p>This is exactly the spirit behind Homegrown: food grown here, businesses built here, economies rooted in place rather than extraction. Markets show what that looks like on the ground—vibrant, diverse, human-scale, and continually renewing.</p>
    <div class="markets-quote">
      <p class="muted">Condensed: Markets are local hubs where growers, producers, and artisans connect directly with the community. They keep food systems human-scale, seasonal, and rooted in place—even when not fully organic—reflecting the Homegrown ethos of local resilience and real relationships.</p>
    </div>
    <div class="markets-cta">
      <a class="button" href="{{ '/submit.html?type=market' | relative_url }}">Add / update a market</a>
      <a class="button ghost" href="{{ '/map/' | relative_url }}">See markets on the map</a>
    </div>
  </div>
</section>

<section class="directory-page">
  <header class="collection-index__header">
    <p class="eyebrow">Find markets</p>
    <h2>Browse farmers' markets, market halls, and local hubs.</h2>
    <p class="lead">Filter by region, practices, and type to find seasonal food close to home.</p>
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
