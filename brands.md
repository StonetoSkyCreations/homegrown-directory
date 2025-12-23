---
layout: default
title: Brand Umbrellas
permalink: /brands/
seo_title: "Brand umbrellas connecting multi-location listings | Homegrown Directory"
seo_description: "Browse multi-location brand umbrellas and jump to their individual locations."
---
{% assign all = site.farms | concat: site.markets | concat: site.stores | concat: site.restaurants | concat: site.distributors | concat: site.vendors %}
{% assign umbrellas = all | where_exp: 'item', 'item.type == "brand"' | sort: 'title' %}

<section class="collection-index">
  <header class="collection-index__header">
    <p class="eyebrow">Brand umbrellas</p>
    <h1>{{ page.title }}</h1>
    <p class="lead">Multi-location brands with all locations linked in one place.</p>
  </header>

  {% if umbrellas == empty %}
    <p class="muted">No brand umbrellas are published yet.</p>
  {% else %}
  <div class="listing-grid">
    {% for brand in umbrellas %}
      {% assign locations = brand.locations | default: empty %}
      {% assign location_docs = "" | split: "" %}
      {% for slug in locations %}
        {% assign match = all | where: "slug", slug | first %}
        {% if match %}{% assign location_docs = location_docs | push: match %}{% endif %}
      {% endfor %}
      <article class="listing-card">
        <div class="listing-card__meta">
          <span class="badge badge--meta badge--type">Brand</span>
        </div>
        <h3 class="listing-card__title">{{ brand.title }}</h3>
        <div class="listing-card__location-block">
          <span class="listing-card__location">{{ brand.country | default: "Multi-region" }}</span>
        </div>
        <div class="listing-card__tags">
          {% if location_docs and location_docs != empty %}
            <p class="muted">{{ location_docs.size }} location{% if location_docs.size != 1 %}s{% endif %}</p>
            <ul class="tag-list">
              {% for loc in location_docs %}
                <li><a href="{{ loc.url | relative_url }}">{{ loc.title }}</a></li>
              {% endfor %}
            </ul>
          {% else %}
            <p class="muted">No locations linked yet.</p>
          {% endif %}
        </div>
        {% if brand.description %}<p class="listing-card__summary">{{ brand.description }}</p>{% endif %}
      </article>
    {% endfor %}
  </div>
  {% endif %}
</section>
