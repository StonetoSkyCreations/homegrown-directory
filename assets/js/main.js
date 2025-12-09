(() => {
  const searchInput = document.querySelector("#searchInput");
  const resultsContainer = document.querySelector("#listingResults");
  const resultsCount = document.querySelector("#resultsCount");
  const countryButtons = Array.from(document.querySelectorAll("[data-country-option]"));
  const countryLabelEls = Array.from(document.querySelectorAll("[data-country-label]"));
  const mapPanel = document.querySelector(".map-panel");
  const countryPage = document.querySelector("[data-country-page]");
  const toggleMapBtn = document.querySelector("#toggleMap");
  const clearFiltersBtn = document.querySelector("#clearFilters");
  const filtersForm = document.querySelector(".filters");
  const heroRegionSelect = document.querySelector("#heroRegion");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const primaryNav = document.querySelector("[data-primary-nav]");
  const mapShouldStartOpen = mapPanel && mapPanel.classList.contains("map-panel--open");
  const initialHash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";

  const defaultCountry = "new-zealand";
  const COUNTRY_STORAGE_KEY = "hg-country";
  const countryDefaults = {
    "new-zealand": { center: [-41.2, 174.7], zoom: 5 },
    australia: { center: [-25.3, 133.8], zoom: 4 }
  };

  let selectedCountry = "";
  let hashTypes = [];
  let listings = [];
  let filtered = [];
  let map;
  let markerLayer;
  let runDirectoryFilters;

  const typeLabels = {
    farms: "Farms",
    markets: "Markets",
    stores: "Grocers",
    restaurants: "Eateries",
    vendors: "Eateries",
    distributors: "Hubs"
  };

  const typeColors = {
    farms: "#2b7a0b",
    markets: "#ff8a3d",
    stores: "#2d6cdf",
    restaurants: "#a05c1f",
    vendors: "#a05c1f",
    distributors: "#725ac1"
  };

  const getStoredCountry = () => {
    try {
      return localStorage.getItem(COUNTRY_STORAGE_KEY) || "";
    } catch (err) {
      return "";
    }
  };

  const getCountryName = (slug) => {
    if (slug === "australia") return "Australia";
    return "New Zealand";
  };

  const setDocumentCountry = (slug) => {
    document.documentElement.setAttribute("data-country", slug);
  };

  const updateCountryLabels = (slug) => {
    const label = getCountryName(slug);
    countryLabelEls.forEach((el) => {
      const prefix = el.dataset.countryPrefix || "";
      const suffix = el.dataset.countrySuffix || "";
      el.textContent = `${prefix}${label}${suffix}`;
    });
  };

  const syncCountryButtons = (slug) => {
    countryButtons.forEach((btn) => {
      const isActive = btn.dataset.countryOption === slug;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const getActiveCountry = () => selectedCountry || defaultCountry;

  const applyHashPrefill = () => {
    if (!initialHash) return;
    const typeKeys = Object.keys(typeLabels);
    if (typeKeys.includes(initialHash)) {
      hashTypes = [initialHash];
      const typeInput = document.querySelector(`input[name="type"][value="${initialHash}"]`);
      if (typeInput) typeInput.checked = true;
      return;
    }
    selectedCountry = initialHash;
  };

  applyHashPrefill();
  if (!selectedCountry && countryPage) {
    selectedCountry = countryPage.dataset.countryPage;
  }
  if (!selectedCountry) {
    const storedCountry = getStoredCountry();
    selectedCountry = storedCountry || defaultCountry;
  }
  setDocumentCountry(selectedCountry);
  syncCountryButtons(selectedCountry);
  updateCountryLabels(selectedCountry);

  // Mobile navigation toggle
  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    primaryNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (primaryNav.classList.contains("is-open")) {
          primaryNav.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  // Directory filtering (region + tags + subtype + country) for directory pages
  const directoryContainer = document.querySelector(".directory-page");
  if (directoryContainer) {
    const regionSelect = document.getElementById("regionFilter");
    const textFilter = document.getElementById("dirSearch");
    const tagFilters = Array.from(document.querySelectorAll('input[name="tag"]'));
    const subtypeFilters = Array.from(document.querySelectorAll('input[name="subtype"]'));
    const cards = Array.from(directoryContainer.querySelectorAll(".listing-card"));
    const dirResultsCount = document.getElementById("dirResultsCount");

    runDirectoryFilters = () => {
      const selectedRegion = regionSelect ? regionSelect.value : "all";
      const query = textFilter ? textFilter.value.toLowerCase().trim() : "";
      const selectedTags = tagFilters.filter((c) => c.checked).map((c) => c.value.toLowerCase());
      const selectedSubtypes = subtypeFilters.filter((c) => c.checked).map((c) => c.value.toLowerCase());
      const activeCountry = getActiveCountry();
      let visibleCount = 0;

      cards.forEach((card) => {
        const region = (card.dataset.region || "").toLowerCase();
        const practices = (card.dataset.practices || "").toLowerCase().split(",").filter(Boolean);
        const subtype = (card.dataset.type || "").toLowerCase();
        const country = (card.dataset.country || "").toLowerCase();
        const name = (card.dataset.name || "").toLowerCase();
        const city = (card.dataset.city || "").toLowerCase();

        const regionOk = selectedRegion === "all" || region === selectedRegion.toLowerCase();
        const tagsOk = selectedTags.every((t) => practices.includes(t));
        const subtypeOk = selectedSubtypes.length === 0 || selectedSubtypes.includes(subtype);
        const countryOk = !activeCountry || country === activeCountry;
        const textOk = !query || name.includes(query) || region.includes(query) || city.includes(query) || practices.join(" ").includes(query);

        const show = regionOk && tagsOk && subtypeOk && countryOk && textOk;
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
      });

      if (dirResultsCount) {
        dirResultsCount.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"}`;
      }
    };

    if (regionSelect) regionSelect.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters());
    if (textFilter) textFilter.addEventListener("input", () => runDirectoryFilters && runDirectoryFilters());
    tagFilters.forEach((c) => c.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters()));
    subtypeFilters.forEach((c) => c.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters()));
  }

  if (typeof runDirectoryFilters === "function") runDirectoryFilters();

  const hasSearchUI = resultsContainer || mapPanel;

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

  function renderList(items) {
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
  }

  function matchesFilters(item, selections) {
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
    const regionMatches =
      selections.region === "all" ||
      (item.region || "").toLowerCase() === selections.region;

    const typeFilters = selections.types.concat(hashTypes);
    const collection = (item.collection || "").toLowerCase();
    const typeMatches = !typeFilters.length || typeFilters.includes(collection);

    const practicesMatch =
      !selections.practices.length ||
      selections.practices.every((p) => (item.practices || []).includes(p));

    const productsMatch =
      !selections.products.length ||
      selections.products.every((p) => (item.products || []).includes(p));

    const servicesMatch =
      !selections.services.length ||
      selections.services.every((p) => (item.services || []).includes(p));

    const countryMatch = !getActiveCountry() || item.country_slug === getActiveCountry();

    return (
      textMatches &&
      regionMatches &&
      typeMatches &&
      practicesMatch &&
      productsMatch &&
      servicesMatch &&
      countryMatch
    );
  }

  function applyFilters() {
    if (!hasSearchUI) return;
    const selections = {
      query: searchInput ? searchInput.value : "",
      region: heroRegionSelect ? heroRegionSelect.value : "all",
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
  }

  function clearFilters() {
    if (filtersForm) {
      filtersForm.querySelectorAll('input[type="checkbox"]').forEach((input) => (input.checked = false));
    }
    if (searchInput) searchInput.value = "";
    if (heroRegionSelect) heroRegionSelect.value = "all";
    applyFilters();
  }

  function openMap() {
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
  }

  function closeMap() {
    if (!mapPanel) return;
    mapPanel.classList.remove("is-open");
    if (toggleMapBtn) toggleMapBtn.textContent = "Show map";
  }

  function refreshMap(items) {
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
      const activeCountry = getActiveCountry();
      const fallback = countryDefaults[activeCountry] || countryDefaults[defaultCountry];
      map.setView(fallback.center, fallback.zoom);
    }
  }

  function setCountry(slug, options = {}) {
    selectedCountry = slug || defaultCountry;
    try {
      localStorage.setItem(COUNTRY_STORAGE_KEY, selectedCountry);
    } catch (err) {
      // ignore storage errors
    }
    setDocumentCountry(selectedCountry);
    syncCountryButtons(selectedCountry);
    updateCountryLabels(selectedCountry);
    if (countryPage && countryPage.dataset.countryPage !== selectedCountry) {
      const base = window.HG_BASEURL || "";
      window.location.href = `${base}/country/${selectedCountry}/`;
      return;
    }
    if (typeof runDirectoryFilters === "function") runDirectoryFilters();
    if (hasSearchUI) {
      applyFilters();
      if (mapShouldStartOpen && map) refreshMap(filtered);
    }
    if (options.updateHash) {
      const base = window.location.href.split("#")[0];
      window.history.replaceState(null, "", `${base}#${selectedCountry}`);
    }
  }

  const fetchListings = async () => {
    if (!hasSearchUI) return;
    try {
      const url = window.HG_INDEX_URL || "/search.json";
      const response = await fetch(url);
      const data = await response.json();
      listings = data;
      filtered = data;
      if (heroRegionSelect) {
        const regions = Array.from(
          new Set(
            listings
              .map((item) => (item.region || "").trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        heroRegionSelect.innerHTML = `<option value="all">All regions</option>${regions
          .map((region) => `<option value="${region.toLowerCase()}">${region}</option>`)
          .join("")}`;
      }
      applyFilters();
      if (mapShouldStartOpen) openMap();
      refreshMap(filtered);
    } catch (err) {
      console.error("Failed to load search index", err);
      if (resultsCount) resultsCount.textContent = "Could not load listings right now.";
    }
  };

  // Event listeners
  countryButtons.forEach((btn) => {
    btn.addEventListener("click", () => setCountry(btn.dataset.countryOption, { updateHash: true }));
  });
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  if (heroRegionSelect) {
    heroRegionSelect.addEventListener("change", applyFilters);
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
