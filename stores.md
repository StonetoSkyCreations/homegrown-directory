<!-- Index page listing all store and co-op entries in the directory. -->
---
layout: default
title: Stores
permalink: /stores/
---
<section class="collection-index">
  <header>
    <h1>Stores</h1>
    <p class="lead">Retailers and co-ops prioritizing provenance and regenerative sourcing.</p>
  </header>
  <div class="listing-grid">
    {% assign items = site.stores | sort: 'title' %}
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
