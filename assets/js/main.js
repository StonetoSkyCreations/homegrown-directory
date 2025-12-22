(() => {
  const searchInput = document.querySelector("#searchInput");
  const resultsContainer = document.querySelector("#listingResults");
  const resultsCount = document.querySelector("#resultsCount");
  const countryButtons = Array.from(document.querySelectorAll("[data-country-option]"));
  const countryLabelEls = Array.from(document.querySelectorAll("[data-country-label]"));
  const mapPanel = document.querySelector(".map-panel");
  const countryPage = document.querySelector("[data-country-page]");
  const toggleMapBtn = document.querySelector("#toggleMap");
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const clearFiltersBtn = document.querySelector("#clearFilters");
  const filtersForm = document.querySelector(".filters");
  const heroRegionSelect = document.querySelector("#heroRegion");
  const heroTypeButtons = Array.from(document.querySelectorAll("[data-type-filter]"));
  const navToggle = document.querySelector("[data-nav-toggle]");
  const primaryNav = document.querySelector("[data-primary-nav]");
  const mapShouldStartOpen = mapPanel && mapPanel.classList.contains("map-panel--open");
  const initialHash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  const nearMeButtons = Array.from(document.querySelectorAll("[data-near-me], #nearMeBtn"));
  const nearMeStatuses = Array.from(document.querySelectorAll("[data-near-me-status], #nearMeStatus"));
  const featuredSections = Array.from(document.querySelectorAll(".featured-section"));

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
    farms: "#2f5b3f",
    markets: "#c27d38",
    stores: "#3c6b73",
    restaurants: "#8b4f2a",
    vendors: "#8b4f2a",
    distributors: "#6d7a3c"
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

  const params = new URLSearchParams(window.location.search);
  const nearMeDebugEnabled = params.get("debug") === "1";
  if (nearMeDebugEnabled) window.DEBUG_NEAR_ME = true;

  const nearMeState = {
    userLocation: null,
    active: false,
    clickCount: 0,
    isLocating: false,
    lastLocationAt: 0,
    lastRequestStartedAt: 0,
    envLogged: false
  };
  const LOCATION_CACHE_MS = 1000 * 60 * 5;

  const nearMeDebug = (...args) => {
    if (window.DEBUG_NEAR_ME) console.log("[near-me]", ...args);
  };

  const isFacebookInApp = () => /FBAN|FBAV|FB_IAB|FBIOS|FBMD/i.test(navigator.userAgent || "");
  const isInstagramInApp = () => /Instagram/i.test(navigator.userAgent || "");
  const isInAppBrowser = () => isFacebookInApp() || isInstagramInApp();

  const logNearMeEnvironment = () => {
    if (!window.DEBUG_NEAR_ME || nearMeState.envLogged) return;
    nearMeState.envLogged = true;
    nearMeDebug("Near me environment", {
      ua: navigator.userAgent,
      isSecureContext: Boolean(window.isSecureContext),
      protocol: window.location.protocol,
      hasPermissionsApi: Boolean(navigator.permissions),
      facebookInApp: isFacebookInApp(),
      instagramInApp: isInstagramInApp(),
      inAppBrowser: isInAppBrowser()
    });
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => nearMeDebug("Geolocation permission state", { state: status.state }))
        .catch((err) => nearMeDebug("Permissions query failed", err));
    }
  };

  const setTheme = (mode, persist = true) => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
      mode = "light";
    }
    if (persist) {
      try {
        localStorage.setItem("hg-theme", mode);
      } catch (err) {
        // ignore storage errors
      }
    }
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      themeToggle.classList.toggle("is-dark", mode === "dark");
    }
  };

  const parseCoord = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : null;
  };

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (value) => {
    if (!Number.isFinite(value)) return "";
    if (value < 10) return `${value.toFixed(1)} km away`;
    return `${Math.round(value)} km away`;
  };

  const setNearMeStatus = (text = "") => {
    nearMeStatuses.forEach((el) => {
      el.textContent = text;
    });
  };

  const setNearMeButtonsDisabled = (state) => {
    nearMeButtons.forEach((btn) => {
      btn.disabled = state;
    });
  };

  const promptManualSearch = () => {
    try {
      if (searchInput) searchInput.focus();
      else if (heroRegionSelect) heroRegionSelect.focus();
    } catch (err) {
      // ignore focus errors
    }
  };

  const refreshNearMeResults = () => {
    if (typeof runDirectoryFilters === "function") runDirectoryFilters();
    applyFilters();
  };

  const requestLocation = () => {
    logNearMeEnvironment();
    const startedAt = Date.now();
    nearMeState.lastRequestStartedAt = startedAt;
    nearMeState.clickCount += 1;
    nearMeDebug("Near me click", { click: nearMeState.clickCount, startedAt });
    if (!navigator.geolocation) {
      setNearMeStatus("Geolocation not supported");
      return;
    }

    const now = Date.now();
    const cachedIsFresh = nearMeState.userLocation && now - nearMeState.lastLocationAt < LOCATION_CACHE_MS;
    if (cachedIsFresh) {
      nearMeDebug("Using cached location", nearMeState.userLocation);
      nearMeState.active = true;
      setNearMeStatus("Sorted by distance");
      refreshNearMeResults();
      return;
    }

    if (nearMeState.isLocating) {
      nearMeDebug("Already locating; ignoring click", { click: nearMeState.clickCount });
      return;
    }

    nearMeState.active = false;
    nearMeState.isLocating = true;
    setNearMeButtonsDisabled(true);
    setNearMeStatus("Locating…");

    const inAppBrowser = isInAppBrowser();
    const geoOptions = {
      enableHighAccuracy: false,
      timeout: inAppBrowser ? 10000 : 15000,
      maximumAge: LOCATION_CACHE_MS
    };
    nearMeDebug("Requesting geolocation", {
      click: nearMeState.clickCount,
      options: geoOptions,
      isLocating: nearMeState.isLocating,
      inAppBrowser
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const completedAt = Date.now();
        nearMeState.userLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        nearMeState.lastLocationAt = Date.now();
        nearMeState.active = true;
        nearMeState.isLocating = false;
        setNearMeButtonsDisabled(false);
        setNearMeStatus("Sorted by distance");
        nearMeDebug("Geolocation success", {
          coords: nearMeState.userLocation,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          click: nearMeState.clickCount,
          startedAt,
          completedAt,
          durationMs: completedAt - startedAt
        });
        refreshNearMeResults();
      },
      (error) => {
        const completedAt = Date.now();
        nearMeState.active = false;
        nearMeState.isLocating = false;
        setNearMeButtonsDisabled(false);
        nearMeDebug("Near me error", {
          code: error.code,
          message: error.message,
          click: nearMeState.clickCount,
          startedAt,
          completedAt,
          durationMs: completedAt - startedAt,
          inAppBrowser
        });
        const inAppHelp = "Open in your browser to use Near me. You can search or choose a region instead.";
        if (inAppBrowser) {
          setNearMeStatus(inAppHelp);
          promptManualSearch();
        } else if (error.code === 1) setNearMeStatus("Location blocked");
        else if (error.code === 2) setNearMeStatus("Location unavailable");
        else if (error.code === 3) setNearMeStatus("Location timed out — try again");
        else setNearMeStatus("Couldn’t get location");
      },
      geoOptions
    );
  };

  nearMeButtons.forEach((btn) => {
    btn.addEventListener("click", requestLocation);
  });

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
    list.forEach((value) => {
      const token = normalizeToken(value);
      if (!token) return;
      let mapped = "";
      if (token.includes("organic") || token.includes("biogro") || token.includes("asurequality")) {
        mapped = "organic";
      } else if (token.includes("spray-free") || token.includes("spray free") || token.includes("no-spray") || token.includes("no spray")) {
        mapped = "spray-free";
      } else if (token.includes("regenerative") || token.includes("regen") || token.includes("regeneration")) {
        mapped = "regenerative";
      } else if (token.includes("biodynamic") || token.includes("demeter")) {
        mapped = "biodynamic";
      } else if (token.includes("wild-foraged") || token.includes("wild harvested") || token.includes("wild-harvest") || token.includes("foraged")) {
        mapped = "wild";
      } else if (token.includes("pasture-raised") || token.includes("pasture raised") || token.includes("100% grass")) {
        mapped = "pasture-raised";
      } else if (token.includes("supports-local") || token.includes("supports local")) {
        mapped = "supports-local";
      } else if (
        token.includes("local") ||
        token.includes("locally grown") ||
        token.includes("locally sourced") ||
        token.includes("local growers") ||
        token.includes("local producers") ||
        token.includes("made locally") ||
        token.includes("nz-made")
      ) {
        mapped = "locally-sourced";
      }
      result.push(mapped || token);
    });
    return Array.from(new Set(result.filter(Boolean)));
  };

  const initShareControls = () => {
    const shareControls = Array.from(document.querySelectorAll("[data-share]"));
    if (!shareControls.length) return;

    const getShareData = () => {
      const titleEl = document.querySelector(".listing__header h1, h1");
      const title = titleEl ? titleEl.textContent.trim() : document.title;
      const url = window.location.href.split("#")[0];
      return { title, url };
    };

    const closeAllMenus = () => {
      shareControls.forEach((control) => {
        const menu = control.querySelector(".share-menu");
        const trigger = control.querySelector(".share-button");
        if (menu) menu.classList.remove("share-menu--open");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    };

    document.addEventListener("click", (event) => {
      if (!shareControls.length) return;
      const isInside = shareControls.some((control) => control.contains(event.target));
      if (!isInside) closeAllMenus();
    });

    shareControls.forEach((control) => {
      const trigger = control.querySelector(".share-button");
      const menu = control.querySelector(".share-menu");
      const copyBtn = control.querySelector("[data-share-copy]");
      const emailLink = control.querySelector("[data-share-email]");
      const facebookLink = control.querySelector("[data-share-facebook]");
      if (!trigger || !menu) return;

      const populateLinks = () => {
        const { title, url } = getShareData();
        if (emailLink) {
          emailLink.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
        }
        if (facebookLink) {
          facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
          facebookLink.target = "_blank";
          facebookLink.rel = "noopener";
        }
        return { title, url };
      };

      const toggleMenu = (state) => {
        const willOpen = typeof state === "boolean" ? state : !menu.classList.contains("share-menu--open");
        closeAllMenus();
        if (willOpen) {
          populateLinks();
          menu.classList.add("share-menu--open");
          trigger.setAttribute("aria-expanded", "true");
        } else {
          menu.classList.remove("share-menu--open");
          trigger.setAttribute("aria-expanded", "false");
        }
      };

      trigger.addEventListener("click", async () => {
        const { title, url } = populateLinks();
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch (err) {
            if (err && err.name === "AbortError") return;
          }
        }
        toggleMenu(true);
      });

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const { url } = getShareData();
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(url);
            } else {
              const textarea = document.createElement("textarea");
              textarea.value = url;
              textarea.setAttribute("readonly", "");
              textarea.style.position = "absolute";
              textarea.style.left = "-9999px";
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              textarea.remove();
            }
            copyBtn.textContent = "Copied";
            setTimeout(() => {
              copyBtn.textContent = "Copy link";
              toggleMenu(false);
            }, 1200);
          } catch (err) {
            console.error("Copy failed", err);
          }
        });
      }
    });
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

  const getActiveFeatured = () => {
    const activeCountry = normalizeCountry(getActiveCountry());
    let section =
      featuredSections.find((sec) => normalizeCountry(sec.dataset.featuredCountry || "") === activeCountry) ||
      featuredSections[0];
    const slug =
      (section?.dataset?.featuredSlug || "").trim() ||
      (section?.querySelector(".listing-card")?.dataset?.slug || "").trim();
    const collection =
      (section?.dataset?.featuredCollection || "").trim() ||
      (section?.querySelector(".listing-card")?.dataset?.collection || "").trim();
    return { section, slug, collection };
  };

  const setFeaturedHeroVisible = (visible) => {
    const { section: activeSection } = getActiveFeatured();
    featuredSections.forEach((sec) => {
      const isActive = activeSection ? sec === activeSection : false;
      sec.style.display = visible && isActive ? "" : "none";
    });
  };

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

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
    // Sync initial UI state to current theme
    const initial = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(initial, false);
  }

  // Directory filtering (region + tags + subtype + country) for directory pages
  const directoryContainer = document.querySelector(".directory-page");
  if (directoryContainer) {
    const regionSelect = document.getElementById("regionFilter");
    const textFilter = document.getElementById("dirSearch");
    const tagFilters = Array.from(document.querySelectorAll('input[name="tag"]'));
    const subtypeFilters = Array.from(document.querySelectorAll('input[name="subtype"]'));
    const productFilters = Array.from(document.querySelectorAll('input[name="products"]'));
    const cards = Array.from(directoryContainer.querySelectorAll(".listing-grid .listing-card"));
    const dirResultsCount = document.getElementById("dirResultsCount");
    const nearMeStatus = document.querySelector("[data-near-me-status], #nearMeStatus");

    const ensureFeaturedStyling = (card) => {
      if (!card) return;
      card.classList.add("listing-card--featured");
      card.dataset.featured = "true";
      const metaContainer = card.querySelector(".listing-card__meta > div");
      if (!metaContainer) return;
      if (!metaContainer.querySelector(".featured-badge")) {
        metaContainer.insertAdjacentHTML("beforeend", '<span class="featured-badge">Featured</span>');
      }
    };

    const setDistanceBadge = (card, distance) => {
      const badge = card.querySelector("[data-distance]");
      if (!badge) return distance;
      if (!Number.isFinite(distance)) {
        badge.hidden = true;
        badge.textContent = "";
      } else {
        badge.hidden = false;
        badge.textContent = formatDistance(distance);
      }
      return distance;
    };

    const clearDistances = (cardList) => {
      cardList.forEach((card) => setDistanceBadge(card, Infinity));
    };

    const sortByDistance = (cardList, location) => {
      let anyDistance = false;
      const sorted = cardList.slice().sort((a, b) => {
        const latA = parseCoord(a.dataset.lat);
        const lonA = parseCoord(a.dataset.lon);
        const latB = parseCoord(b.dataset.lat);
        const lonB = parseCoord(b.dataset.lon);
        const distA =
          latA !== null && lonA !== null ? haversineKm(location.lat, location.lon, latA, lonA) : Infinity;
        const distB =
          latB !== null && lonB !== null ? haversineKm(location.lat, location.lon, latB, lonB) : Infinity;
        if (Number.isFinite(distA) || Number.isFinite(distB)) anyDistance = true;
        setDistanceBadge(a, distA);
        setDistanceBadge(b, distB);
        return distA - distB;
      });
      sorted.forEach((card) => card.parentNode.appendChild(card));
      if (!anyDistance && nearMeStatus) {
        nearMeStatus.textContent = "No listings with coordinates";
      } else if (nearMeStatus && nearMeState.active) {
        nearMeStatus.textContent = "Sorted by distance";
      }
    };

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
      const nearMeMode = nearMeState.active && nearMeState.userLocation;
      const activeUI = nearMeMode || hasActiveFilters();
      const selectedRegion = normalizeRegion(regionSelect ? regionSelect.value : "all");
      const query = textFilter ? normalizeToken(textFilter.value) : "";
      const selectedTags = normalizeList(tagFilters.filter((c) => c.checked).map((c) => c.value));
      const selectedSubtypes = normalizeList(subtypeFilters.filter((c) => c.checked).map((c) => c.value));
      const selectedProducts = normalizeList(productFilters.filter((c) => c.checked).map((c) => c.value));
      const activeCountry = normalizeCountry(getActiveCountry());
      const { section: activeFeaturedSection, slug: activeFeaturedSlug } = getActiveFeatured();
      const featuredResultCard = activeFeaturedSlug
        ? cards.find((card) => (card.dataset.slug || "").trim() === activeFeaturedSlug)
        : null;
      ensureFeaturedStyling(featuredResultCard);
      const setFeaturedSectionVisible = (visible) => {
        featuredSections.forEach((section) => {
          const isActive = activeFeaturedSection ? section === activeFeaturedSection : false;
          section.style.display = visible && isActive ? "" : "none";
        });
      };
      setFeaturedSectionVisible(!activeUI);
      let visibleCount = 0;

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

      if (!activeUI && featuredResultCard) {
        if (featuredResultCard.style.display !== "none") {
          visibleCount -= 1;
        }
        featuredResultCard.classList.add("hidden");
        featuredResultCard.style.display = "none";
      }

      if (dirResultsCount) {
        dirResultsCount.textContent = `${visibleCount} result${visibleCount === 1 ? "" : "s"}`;
      }
      if (nearMeMode) {
        sortByDistance(cards.filter((card) => card.style.display !== "none"), nearMeState.userLocation);
        const withCoords = cards.filter((card) => parseCoord(card.dataset.lat) !== null && parseCoord(card.dataset.lon) !== null);
        nearMeDebug("Near me render", {
          click: nearMeState.clickCount,
          visibleCount,
          withCoords: withCoords.length,
          nearMeMode: true
        });
      } else {
        clearDistances(cards);
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

  const isFeaturedItem = (item) => {
    if (!item) return false;
    if (item.featured === true) return true;
    const { slug } = getActiveFeatured();
    return Boolean(slug) && (item.slug || "") === slug;
  };

    const cardTemplate = (item) => {
      const tags =
        item.practices && item.practices.length
          ? item.practices
          : item.products && item.products.length
          ? item.products
          : item.services || [];
      const tagsMarkup = (tags || []).slice(0, 4).map((tag) => `<li>${tag}</li>`).join("");
      const city = item.city || "";
      const region = item.region || "";
      const locText = city && region ? `${city}, ${region}` : city || region || "Location not provided";
      const isFeatured = isFeaturedItem(item);
      return `
        <article class="listing-card${isFeatured ? " listing-card--featured" : ""}" data-lat="${item.lat ?? ""}" data-lon="${item.lon ?? ""}">
          <div class="listing-card__meta">
            <div>
              <span class="pill pill--type">${typeLabels[item.collection] || item.type}</span>
              ${isFeatured ? '<span class="featured-badge">Featured</span>' : ""}
            </div>
            <span class="listing-card__location">${locText}</span>
            <p class="listing-card__distance" data-distance hidden></p>
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
        <div class="listing-card__actions">
          <a class="button ghost button--sm" href="${item.url}">Learn more</a>
        </div>
      </article>
    `;
  };

  function renderList(items, active) {
    if (!resultsContainer) return;
    const hasActive = Boolean(active);
    const emptyTemplate = document.querySelector("#emptyStateTemplate");
    if (!items.length) {
      if (emptyTemplate) {
        resultsContainer.innerHTML = emptyTemplate.innerHTML;
      } else {
        const message = hasActive ? "No listings match your filters yet." : "No featured listings are available yet.";
        resultsContainer.innerHTML = `<p class="muted">${message}</p>`;
      }
    } else {
      resultsContainer.innerHTML = items.map(cardTemplate).join("");
    }
    if (resultsCount) {
      resultsCount.classList.remove("is-loading");
      if (!hasActive && items.length === 0) {
        resultsCount.textContent = "";
      } else {
        const noun = items.length === 1 ? "listing" : "listings";
        resultsCount.textContent = `${items.length} ${noun}`;
      }
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
    const itemPractices = canonicalizePractices(normalizeList(item.practices || item.practices_tags));
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

    const nearMeEngaged = nearMeState.active || nearMeState.isLocating;

    return !!(
      q ||
      (region && normalizeRegion(region) !== "all") ||
      typeChecked ||
      tagChecked ||
      extraChecked ||
      heroTypeActive ||
      hashTypeActive ||
      nearMeEngaged
    );
  }

  function applyFilters() {
    if (!hasSearchUI) return;
    const nearMeMode = nearMeState.active && nearMeState.userLocation;
    const active = hasActiveFilters() || nearMeMode;
    setFeaturedHeroVisible(!active);
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
    filtered = active ? source.filter((item) => matchesFilters(item, selections)) : [];
    if (nearMeMode) {
      filtered = (filtered.length ? filtered : source.slice()).map((item) => {
        const lat = parseCoord(item.lat);
        const lon = parseCoord(item.lon);
        const distance = lat !== null && lon !== null ? haversineKm(nearMeState.userLocation.lat, nearMeState.userLocation.lon, lat, lon) : Infinity;
        return { ...item, _distance: distance };
      });
      filtered.sort((a, b) => (a._distance || Infinity) - (b._distance || Infinity));
      nearMeDebug("Near me render (search)", {
        click: nearMeState.clickCount,
        count: filtered.length,
        nearMeMode: true
      });
      setNearMeStatus(filtered.some((item) => Number.isFinite(item._distance)) ? "Sorted by distance" : "No listings with coordinates");
    } else {
      setNearMeStatus("");
    }
    renderList(filtered, active);
    if (nearMeMode) {
      const cards = resultsContainer ? Array.from(resultsContainer.querySelectorAll(".listing-card")) : [];
      cards.forEach((card, index) => {
        const badge = card.querySelector("[data-distance]");
        const distance = filtered[index]?._distance;
        if (!badge) return;
        if (!Number.isFinite(distance)) {
          badge.hidden = true;
          badge.textContent = "";
        } else {
          badge.hidden = false;
          badge.textContent = formatDistance(distance);
        }
      });
    } else if (resultsContainer) {
      resultsContainer.querySelectorAll("[data-distance]").forEach((badge) => {
        badge.hidden = true;
        badge.textContent = "";
      });
    }
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
    if (resultsCount) {
      resultsCount.classList.add("is-loading");
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
      if (resultsCount) resultsCount.classList.remove("is-loading");
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

  initShareControls();
  fetchListings();
})();
