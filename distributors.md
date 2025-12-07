<!-- Index page listing all distributor and food hub entries in the directory. -->
---
layout: default
title: Distributors
permalink: /distributors/
---
<section class="collection-index">
  <header>
    <h1>Distributors</h1>
    <p class="lead">Food hubs and distributors moving transparent, regenerative goods.</p>
  </header>
  <div class="listing-grid">
    {% assign items = site.distributors | sort: 'title' %}
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
