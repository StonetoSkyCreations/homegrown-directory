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
  const heroTypeButtons = Array.from(document.querySelectorAll("[data-type-filter]"));
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
  let heroTypeFilters = [];
  let populateDirectoryRegions;
  let auditHasRun = false;

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

  // Canonical type tokens used across filters and audits
  const TYPE_TOKENS = {
    farms: "farm",
    farm: "farm",
    markets: "market",
    market: "market",
    stores: "grocer",
    grocer: "grocer",
    restaurants: "restaurant",
    restaurant: "restaurant",
    vendors: "restaurant",
    distributors: "distributor",
    distributor: "distributor"
  };

  const DIRECTORY_PATHS = {
    farm: "/farms/",
    market: "/markets/",
    grocer: "/groceries/",
    restaurant: "/eateries/",
    distributor: "/distributors/"
  };

  const normalizeToken = (value) => (value || "").toString().trim().toLowerCase();
  const normalizeList = (arr) => (arr || []).map(normalizeToken).filter(Boolean);
  const normalizeRegion = (value) => normalizeToken(value);
  const normalizeCountry = (value) => normalizeToken(value);
  const getCanonicalType = (value) => {
    const token = normalizeToken(value);
    return TYPE_TOKENS[token] || token;
  };
  const canonicalizePractices = (list) => {
    const result = [];
    list.forEach((token) => {
      let t = token;
      if (t.includes("organic")) t = "organic";
      else if (t.includes("spray") || t.includes("chemical")) t = "spray-free";
      else if (t.includes("regen")) t = "regenerative";
      else if (t.includes("biodynamic") || t.includes("demeter")) t = "biodynamic";
      else if (t.includes("wild")) t = "wild";
      else if (t.includes("pasture") || t.includes("grass-fed") || t.includes("grassfed")) t = "pasture-raised";
      else if (t.includes("local")) t = "local";
      result.push(t);
    });
    return Array.from(new Set(result.filter(Boolean)));
  };

  const populateHeroRegions = (countrySlug) => {
    if (!heroRegionSelect || !listings.length) return;
    const activeCountry = countrySlug || getActiveCountry();
    const regions = Array.from(
      new Set(
        listings
          .filter((item) => !activeCountry || normalizeCountry(item.country_slug) === normalizeCountry(activeCountry))
          .map((item) => (item.region || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    heroRegionSelect.innerHTML = `<option value="all">All regions</option>${regions
      .map((region) => `<option value="${region.toLowerCase()}">${region}</option>`)
      .join("")}`;
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
    const canonicalKeys = typeKeys.map(getCanonicalType);
    if (typeKeys.includes(initialHash) || canonicalKeys.includes(initialHash)) {
      hashTypes = [getCanonicalType(initialHash)];
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
  populateHeroRegions(selectedCountry);

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
    const productFilters = Array.from(document.querySelectorAll('input[name="products"]'));
    const cards = Array.from(directoryContainer.querySelectorAll(".listing-card"));
    const dirResultsCount = document.getElementById("dirResultsCount");

    populateDirectoryRegions = (countrySlug) => {
      if (!regionSelect) return;
      const activeCountry = countrySlug || getActiveCountry();
      const regions = Array.from(
        new Set(
          cards
            .filter((card) => !activeCountry || normalizeCountry(card.dataset.country) === normalizeCountry(activeCountry))
            .map((card) => (card.dataset.region || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
      const current = regionSelect.value;
      regionSelect.innerHTML = `<option value=\"all\">All regions</option>${regions
        .map((region) => `<option value=\"${normalizeRegion(region)}\">${region}</option>`)
        .join("")}`;
      const restore = Array.from(regionSelect.options).some((opt) => opt.value === current);
      regionSelect.value = restore ? current : "all";
    };

    runDirectoryFilters = () => {
      const active = hasActiveFilters();
      const selectedRegion = normalizeRegion(regionSelect ? regionSelect.value : "all");
      const query = textFilter ? normalizeToken(textFilter.value) : "";
      const selectedTags = normalizeList(tagFilters.filter((c) => c.checked).map((c) => c.value));
      const selectedSubtypes = normalizeList(subtypeFilters.filter((c) => c.checked).map((c) => c.value));
      const selectedProducts = normalizeList(productFilters.filter((c) => c.checked).map((c) => c.value));
      const activeCountry = normalizeCountry(getActiveCountry());
      let visibleCount = 0;

      if (!active) {
        cards.forEach((card) => {
          const isFeatured = card.classList.contains("listing-card--featured") || card.dataset.featured === "true";
          const hide = !isFeatured;
          card.classList.toggle("hidden", hide);
          card.style.display = hide ? "none" : "";
          if (!hide) visibleCount += 1;
        });
        if (dirResultsCount) {
          dirResultsCount.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"}`;
        }
        return;
      }

      cards.forEach((card) => {
        const region = normalizeRegion(card.dataset.region);
        const practices = canonicalizePractices(normalizeList((card.dataset.practices || "").split(",")));
        const products = normalizeList((card.dataset.products || "").split(","));
        const subtype = normalizeToken(card.dataset.subtype || card.dataset.type);
        const country = normalizeCountry(card.dataset.country);
        const name = normalizeToken(card.dataset.name);
        const city = normalizeToken(card.dataset.city);

        const regionOk = selectedRegion === "all" || region === selectedRegion;
        const tagsOk = selectedTags.every((t) => practices.includes(t));
        const productsOk = selectedProducts.length === 0 || selectedProducts.every((p) => products.includes(p));
        const subtypeOk = selectedSubtypes.length === 0 || selectedSubtypes.includes(subtype);
        const countryOk = !activeCountry || country === activeCountry;
        const textOk =
          !query ||
          name.includes(query) ||
          region.includes(query) ||
          city.includes(query) ||
          practices.some((p) => p.includes(query)) ||
          products.some((p) => p.includes(query));

        const show = regionOk && tagsOk && subtypeOk && productsOk && countryOk && textOk;
        card.classList.remove("hidden");
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
      });

      if (dirResultsCount) {
        dirResultsCount.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"}`;
      }
    };

    populateDirectoryRegions(selectedCountry);

    if (regionSelect) regionSelect.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters());
    if (textFilter) textFilter.addEventListener("input", () => runDirectoryFilters && runDirectoryFilters());
    tagFilters.forEach((c) => c.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters()));
    subtypeFilters.forEach((c) => c.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters()));
    productFilters.forEach((c) => c.addEventListener("change", () => runDirectoryFilters && runDirectoryFilters()));
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

  function renderList(items, active) {
    if (!resultsContainer) return;
    const hasActive = Boolean(active);
    if (!items.length) {
      const message = hasActive ? "No listings match your filters yet." : "No featured listings are available yet.";
      resultsContainer.innerHTML = `<p class="muted">${message}</p>`;
    } else {
      resultsContainer.innerHTML = items.map(cardTemplate).join("");
    }
    if (resultsCount) {
      const noun = items.length === 1 ? "listing" : "listings";
      resultsCount.textContent = `${items.length} ${noun}`;
    }
  }

  function matchesFilters(item, selections, options = {}) {
    const includePageFilters = options.includePageFilters !== false;
    // TEXT SEARCH: multi-word, AND-of-tokens over a combined haystack
    const rawQuery = (selections.query || "").toString().trim().toLowerCase();
    const queryTokens = rawQuery
      ? rawQuery.split(/\s+/).filter(Boolean)
      : [];

    // Build a combined haystack from core fields
    const haystackParts = [];

    if (item.title) haystackParts.push(item.title);
    if (item.description) haystackParts.push(item.description);
    if (item.collection) haystackParts.push(item.collection);
    if (item.region) haystackParts.push(item.region);
    if (item.city) haystackParts.push(item.city);
    if (item.country) haystackParts.push(item.country);
    if (item.type_token) haystackParts.push(item.type_token);
    if (item.subtype_token) haystackParts.push(item.subtype_token);

    // Add tags/arrays: practices, products, services, specialty_tags
    if (Array.isArray(item.practices)) {
      haystackParts.push(canonicalizePractices(item.practices).join(" "));
    }
    if (Array.isArray(item.products)) {
      haystackParts.push(item.products.join(" "));
    }
    if (Array.isArray(item.services)) {
      haystackParts.push(item.services.join(" "));
    }
    if (Array.isArray(item.specialty_tags)) {
      haystackParts.push(item.specialty_tags.join(" "));
    }

    const haystack = haystackParts
      .filter(Boolean)
      .join(" ")
      .toString()
      .toLowerCase()
      .trim();

    const textMatches =
      !queryTokens.length ||
      queryTokens.every((token) => haystack.includes(token));
    const selectedRegion = normalizeRegion(selections.region || "all");
    const itemRegion = normalizeRegion(item.region);
    const regionMatches = selectedRegion === "all" || itemRegion === selectedRegion;

    const baseTypes = Array.isArray(selections.types) ? selections.types : [];
    let typeFilters = baseTypes.slice();
    if (includePageFilters) {
      typeFilters = typeFilters.concat(hashTypes, heroTypeFilters);
    }
    typeFilters = typeFilters.map(getCanonicalType).filter(Boolean);
    const itemTypeToken = normalizeToken(item.type_token || getCanonicalType(item.collection || item.type));
    const typeMatches = !typeFilters.length || typeFilters.includes(itemTypeToken);

    const selectedPractices = normalizeList(selections.practices);
    const selectedProducts = Array.isArray(selections.products) ? normalizeList(selections.products) : [];
    const selectedServices = normalizeList(selections.services);
    const itemPractices = canonicalizePractices(normalizeList(item.practices || item.practices_tags || item.services));
    const itemProducts = normalizeList(item.products || item.products_tags);
    const itemServices = normalizeList(item.services);
    const practicesMatch = !selectedPractices.length || selectedPractices.every((p) => itemPractices.includes(p));
    const productsMatch = !selectedProducts.length || selectedProducts.every((p) => itemProducts.includes(p));
    const servicesMatch = !selectedServices.length || selectedServices.every((p) => itemServices.includes(p));

    const countrySelection = normalizeCountry(selections.country || (includePageFilters ? getActiveCountry() : ""));
    const itemCountry = normalizeCountry(item.country_slug || item.country);
    const countryMatch = !countrySelection || itemCountry === countrySelection;

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

  // Diagnostic: ensure each listing would pass its own country/region/type filters on its directory page.
  function runListingSelfFilterAudit(items = []) {
    if (auditHasRun || !Array.isArray(items) || !items.length || typeof matchesFilters !== "function") return;
    auditHasRun = true;
    items.forEach((item) => {
      const typeToken = normalizeToken(item.type_token || getCanonicalType(item.collection || item.type));
      const selections = {
        query: "",
        region: item.region ? normalizeRegion(item.region) : "all",
        country: item.country_slug || item.country,
        types: [typeToken],
        practices: [],
        products: [],
        services: []
      };
      const passesSelfFilter = matchesFilters(item, selections, { includePageFilters: false });
      if (!passesSelfFilter) {
        const payload = {
          title: item.title,
          slug: item.slug,
          collection: item.collection,
          expectedDirectory: DIRECTORY_PATHS[typeToken] || "",
          country_slug: item.country_slug,
          region: item.region,
          typeToken
        };
        console.warn("Listing fails self-filter audit", payload);
        if (item.featured) {
          console.warn("FEATURED listing fails self-filter audit", payload);
        }
      }
    });
  }

  function hasActiveFilters() {
    const q = (document.querySelector("#searchInput, #dirSearch")?.value || "").trim();
    const regionEl = document.querySelector("#heroRegion, #regionFilter");
    const region = regionEl ? regionEl.value : "";

    const typeChecked = !!document.querySelector('input[name="type"]:checked, input[name="subtype"]:checked');
    const tagChecked = !!document.querySelector('input[name="tag"]:checked');
    const extraChecked = !!document.querySelector(
      'input[name="practice"]:checked, input[name="product"]:checked, input[name="service"]:checked, input[name="practices"]:checked, input[name="products"]:checked, input[name="services"]:checked'
    );

    const heroTypeActive = Array.isArray(heroTypeFilters) && heroTypeFilters.length > 0;
    const hashTypeActive = Array.isArray(hashTypes) && hashTypes.length > 0;

    return !!(q || (region && normalizeRegion(region) !== "all") || typeChecked || tagChecked || extraChecked || heroTypeActive || hashTypeActive);
  }

  function applyFilters() {
    if (!hasSearchUI) return;
    const active = hasActiveFilters();
    const selections = {
      query: searchInput ? searchInput.value : "",
      region: heroRegionSelect ? heroRegionSelect.value : "all",
      country: getActiveCountry(),
      types: [],
      practices: [],
      products: [],
      services: []
    };

    document.querySelectorAll('input[name="type"]:checked').forEach((el) => selections.types.push(getCanonicalType(el.value)));
    document.querySelectorAll('input[name="practice"]:checked').forEach((el) => selections.practices.push(el.value));
    document.querySelectorAll('input[name="practices"]:checked').forEach((el) => selections.practices.push(el.value));
    const selectedProducts = normalizeList(
      Array.from(document.querySelectorAll('input[name="products"]:checked')).map((el) => el.value)
    );
    selections.products = selectedProducts;
    document.querySelectorAll('input[name="product"]:checked').forEach((el) => selections.products.push(el.value));
    document.querySelectorAll('input[name="service"]:checked').forEach((el) => selections.services.push(el.value));
    document.querySelectorAll('input[name="services"]:checked').forEach((el) => selections.services.push(el.value));

    const source = window.HG_INDEX || listings || [];
    filtered = active
      ? source.filter((item) => matchesFilters(item, selections))
      : source.filter((item) => item.featured === true || item.featured === "true");
    renderList(filtered, active);
  }

  function clearFilters() {
    if (filtersForm) {
      filtersForm.querySelectorAll('input[type="checkbox"]').forEach((input) => (input.checked = false));
    }
    if (searchInput) searchInput.value = "";
    if (heroRegionSelect) heroRegionSelect.value = "all";
    heroTypeFilters = [];
    if (heroTypeButtons.length) {
      heroTypeButtons.forEach((btn) => btn.classList.remove("is-active"));
    }
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
    populateHeroRegions(selectedCountry);
    if (typeof populateDirectoryRegions === "function") populateDirectoryRegions(selectedCountry);
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
    if (mapShouldStartOpen && !map) {
      openMap();
    }
    try {
      const url = window.HG_INDEX_URL || "/search.json";
      const response = await fetch(url);
      const data = await response.json();
      window.HG_INDEX = data;
      listings = data;
      filtered = data;
      populateHeroRegions(getActiveCountry());
      applyFilters();
      runListingSelfFilterAudit(listings);
      if (mapShouldStartOpen) openMap();
      refreshMap(filtered);
    } catch (err) {
      console.error("Failed to load search index", err);
      if (resultsCount) resultsCount.textContent = "Could not load listings right now.";
      if (mapShouldStartOpen && map) {
        refreshMap([]);
      }
    }
  };

  // Event listeners
  heroTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filters = (btn.dataset.typeFilter || "")
        .split(",")
        .map((v) => getCanonicalType(v))
        .filter(Boolean);
      const isActive = btn.classList.contains("is-active");
      heroTypeFilters = isActive ? [] : filters;
      heroTypeButtons.forEach((b) => b.classList.toggle("is-active", b === btn && !isActive));
      applyFilters();
      document.getElementById("listingResults")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
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
