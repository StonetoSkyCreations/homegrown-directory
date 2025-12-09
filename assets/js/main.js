(() => {
  const searchInput = document.querySelector("#searchInput");
  const resultsContainer = document.querySelector("#listingResults");
  const resultsCount = document.querySelector("#resultsCount");
  const mapPanel = document.querySelector("#mapPanel");
  const toggleMapBtn = document.querySelector("#toggleMap");
  const clearFiltersBtn = document.querySelector("#clearFilters");
  const filtersForm = document.querySelector(".filters");
  const mapShouldStartOpen = mapPanel && mapPanel.classList.contains("map-panel--open");
  const initialHash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  let hashCountry = "";
  let hashTypes = [];

  const typeLabels = {
    farms: "Farms",
    markets: "Markets",
    stores: "Stores",
    restaurants: "Restaurants",
    distributors: "Hubs"
  };

  const typeColors = {
    farms: "#2b7a0b",
    markets: "#ff8a3d",
    stores: "#2d6cdf",
    restaurants: "#a05c1f",
    distributors: "#725ac1"
  };

  let listings = [];
  let filtered = [];
  let map;
  let markerLayer;

  const hasUI = resultsContainer || mapPanel;
  if (!hasUI) return;

  // Simple directory filtering (region + tags + subtype) for directory pages
  const directoryContainer = document.querySelector(".directory-page");
  if (directoryContainer) {
    const regionSelect = document.getElementById("regionFilter");
    const tagFilters = Array.from(document.querySelectorAll('input[name="tag"]'));
    const subtypeFilters = Array.from(document.querySelectorAll('input[name="subtype"]'));
    const cards = Array.from(directoryContainer.querySelectorAll(".listing-card"));
    const dirResultsCount = document.getElementById("dirResultsCount");

    const applyDirectoryFilters = () => {
      const selectedRegion = regionSelect ? regionSelect.value : "all";
      const selectedTags = tagFilters.filter((c) => c.checked).map((c) => c.value.toLowerCase());
      const selectedSubtypes = subtypeFilters.filter((c) => c.checked).map((c) => c.value.toLowerCase());
      let visibleCount = 0;

      cards.forEach((card) => {
        const region = (card.dataset.region || "").toLowerCase();
        const practices = (card.dataset.practices || "").toLowerCase().split(",").filter(Boolean);
        const subtype = (card.dataset.type || "").toLowerCase();

        const regionOk = selectedRegion === "all" || region === selectedRegion.toLowerCase();
        const tagsOk = selectedTags.every((t) => practices.includes(t));
        const subtypeOk = selectedSubtypes.length === 0 || selectedSubtypes.includes(subtype);

        const show = regionOk && tagsOk && subtypeOk;
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
      });

      if (dirResultsCount) {
        dirResultsCount.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"}`;
      }
    };

    if (regionSelect) regionSelect.addEventListener("change", applyDirectoryFilters);
    tagFilters.forEach((c) => c.addEventListener("change", applyDirectoryFilters));
    subtypeFilters.forEach((c) => c.addEventListener("change", applyDirectoryFilters));
    applyDirectoryFilters();
  }

  const applyHashPrefill = () => {
    if (!initialHash) return;
    const typeKeys = Object.keys(typeLabels);
    if (typeKeys.includes(initialHash)) {
      hashTypes = [initialHash];
      const typeInput = document.querySelector(`input[name="type"][value="${initialHash}"]`);
      if (typeInput) typeInput.checked = true;
      return;
    }
    hashCountry = initialHash;
  };

  const fetchListings = async () => {
    try {
      const url = window.HG_INDEX_URL || "/search.json";
      const response = await fetch(url);
      const data = await response.json();
      listings = data;
      filtered = data;
      applyHashPrefill();
      applyFilters();
      if (mapShouldStartOpen) openMap();
      refreshMap(filtered);
    } catch (err) {
      console.error("Failed to load search index", err);
      if (resultsCount) resultsCount.textContent = "Could not load listings right now.";
    }
  };

  const cardTemplate = (item) => {
    const tags =
      item.practices && item.practices.length
        ? item.practices
        : item.products && item.products.length
        ? item.products
        : item.services || [];
    const tagsMarkup = (tags || []).slice(0, 4).map((tag) => `<li>${tag}</li>`).join("");
    return `
      <article class="listing-card">
        <div class="listing-card__meta">
          <span class="pill pill--type">${typeLabels[item.collection] || item.type}</span>
          <span class="listing-card__location">${item.city || ""}${item.city && item.region ? ", " : ""}${item.region || ""}</span>
        </div>
        <h3 class="listing-card__title"><a href="${item.url}">${item.title}</a></h3>
        <p class="listing-card__summary">${item.description || ""}</p>
        <div class="listing-card__tags">
          ${
            tagsMarkup
              ? `<ul class="tag-list">${tagsMarkup}</ul>`
              : `<p class="muted">Details coming soon.</p>`
          }
        </div>
      </article>
    `;
  };

  const renderList = (items) => {
    if (!resultsContainer) return;
    if (!items.length) {
      resultsContainer.innerHTML = `<p class="muted">No listings match those filters yet.</p>`;
    } else {
      resultsContainer.innerHTML = items.map(cardTemplate).join("");
    }
    if (resultsCount) {
      const noun = items.length === 1 ? "listing" : "listings";
      resultsCount.textContent = `${items.length} ${noun}`;
    }
  };

  const matchesFilters = (item, selections) => {
    const textQuery = selections.query.toLowerCase().trim();
    const haystack = [
      item.title,
      item.city,
      item.region,
      item.country,
      item.description,
      (item.practices || []).join(" "),
      (item.products || []).join(" "),
      (item.services || []).join(" ")
    ]
      .join(" ")
      .toLowerCase();
    const textMatches = !textQuery || haystack.includes(textQuery);

    const typeFilters = selections.types.concat(hashTypes);
    const typeMatches =
      !typeFilters.length ||
      typeFilters.includes(item.collection) ||
      typeFilters.includes(item.collection?.toLowerCase());

    const practicesMatch =
      !selections.practices.length ||
      selections.practices.every((p) => (item.practices || []).includes(p));

    const productsMatch =
      !selections.products.length ||
      selections.products.every((p) => (item.products || []).includes(p));

    const servicesMatch =
      !selections.services.length ||
      selections.services.every((p) => (item.services || []).includes(p));

    const countryMatch = !hashCountry || item.country_slug === hashCountry;

    return textMatches && typeMatches && practicesMatch && productsMatch && servicesMatch && countryMatch;
  };

  const applyFilters = () => {
    const selections = {
      query: searchInput ? searchInput.value : "",
      types: [],
      practices: [],
      products: [],
      services: []
    };

    document.querySelectorAll('input[name="type"]:checked').forEach((el) => selections.types.push(el.value.toLowerCase()));
    document.querySelectorAll('input[name="practices"]:checked').forEach((el) => selections.practices.push(el.value));
    document.querySelectorAll('input[name="products"]:checked').forEach((el) => selections.products.push(el.value));
    document.querySelectorAll('input[name="services"]:checked').forEach((el) => selections.services.push(el.value));

    filtered = listings.filter((item) => matchesFilters(item, selections));
    renderList(filtered);
    refreshMap(filtered);
  };

  const clearFilters = () => {
    if (filtersForm) {
      filtersForm.querySelectorAll('input[type="checkbox"]').forEach((input) => (input.checked = false));
    }
    if (searchInput) searchInput.value = "";
    applyFilters();
  };

  const openMap = () => {
    if (!mapPanel) return;
    mapPanel.classList.add("is-open");
    if (toggleMapBtn) toggleMapBtn.textContent = "Hide map";
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
    }
    refreshMap(filtered);
  };

  const closeMap = () => {
    if (!mapPanel) return;
    mapPanel.classList.remove("is-open");
    if (toggleMapBtn) toggleMapBtn.textContent = "Show map";
  };

  const refreshMap = (items) => {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();
    const withCoords = items.filter((item) => typeof item.lat === "number" && typeof item.lon === "number");
    withCoords.forEach((item) => {
      const color = typeColors[item.collection] || "#305c24";
      const marker = L.circleMarker([item.lat, item.lon], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.9
      }).bindPopup(
        `<div><strong>${item.title}</strong><br><small>${typeLabels[item.collection] || item.type}</small><br><small>${item.city || ""}${
          item.city && item.region ? ", " : ""
        }${item.region || ""}</small><br><a href="${item.url}">View listing</a></div>`
      );
      markerLayer.addLayer(marker);
    });
    if (withCoords.length) {
      const bounds = L.latLngBounds(withCoords.map((item) => [item.lat, item.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      map.setView([-41.2, 174.7], 5);
    }
  };

  // Event listeners
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  if (filtersForm) {
    filtersForm.addEventListener("change", applyFilters);
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", clearFilters);
  }
  if (toggleMapBtn) {
    toggleMapBtn.addEventListener("click", () => {
      if (mapPanel && mapPanel.classList.contains("is-open")) {
        closeMap();
      } else {
        openMap();
      }
    });
  }

  fetchListings();
})();
