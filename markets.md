<!-- Index page listing all market entries in the directory. -->
---
layout: default
title: Markets
permalink: /markets/
---
<section class="collection-index">
  <header>
    <h1>Markets</h1>
    <p class="lead">Community markets and roadside stands connecting growers with eaters.</p>
  </header>
  <div class="listing-grid">
    {% assign items = site.markets | sort: 'title' %}
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
