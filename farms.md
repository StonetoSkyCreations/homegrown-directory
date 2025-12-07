<!-- Index page listing all farm entries in the directory. -->
---
layout: default
title: Farms
permalink: /farms/
---
<section class="collection-index">
  <header>
    <h1>Farms</h1>
    <p class="lead">Producers focused on soil health, biodiversity, and transparent practices.</p>
  </header>
  <div class="listing-grid">
    {% assign items = site.farms | sort: 'title' %}
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
