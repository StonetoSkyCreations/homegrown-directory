<!-- Index page listing all restaurant entries in the directory. -->
---
layout: default
title: Restaurants
permalink: /restaurants/
---
<section class="collection-index">
  <header>
    <h1>Restaurants</h1>
    <p class="lead">Eateries partnering with growers and telling the provenance story on the plate.</p>
  </header>
  <div class="listing-grid">
    {% assign items = site.restaurants | sort: 'title' %}
    {% for listing in items %}
      {% include listing-card.html listing=listing %}
    {% endfor %}
  </div>
</section>
