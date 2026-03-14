(() => {
  const ENTITY_TYPES = window.HG_ENTITY_TYPES || {};
  const searchInput = document.querySelector("#searchInput");
  const resultsContainer = document.querySelector("#listingResults");
  const resultsCount = document.querySelector("#resultsCount");
  const countryButtons = Array.from(document.querySelectorAll("[data-country-option]"));
  const countryLabelEls = Array.from(document.querySelectorAll("[data-country-label]"));
  const mapPanel = document.querySelector(".map-panel");
  const countryPage = document.querySelector("[data-country-page]");
  const directoryPage = document.querySelector(".directory-page[data-directory-collections]");
  const directoryResultsContainer = document.querySelector("[data-directory-results]");
  const directoryLoadMoreBtn = document.querySelector("[data-directory-load-more]");
  const directoryFiltersForm = document.querySelector("[data-directory-filters]");
  const directoryClearBtn = document.querySelector("[data-directory-clear]");
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
  let directoryState = null;
  let auditHasRun = false;

  const getEntityLabel = (key) => ENTITY_TYPES[key]?.label || key;
  const getEntityToken = (key) => ENTITY_TYPES[key]?.token || key;
  const getEntityBrowsePath = (key) => ENTITY_TYPES[key]?.browse_path || "/";
  const typeLabels = Object.keys(ENTITY_TYPES).reduce((acc, key) => {
    acc[key] = ENTITY_TYPES[key].label;
    return acc;
  }, {});

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
    stores: "store",
    store: "store",
    grocer: "store",
    grocery: "store",
    groceries: "store",
    restaurants: "restaurant",
    restaurant: "restaurant",
    vendors: "vendor",
    vendor: "vendor",
    distributors: "distributor",
    distributor: "distributor"
  };

  const TYPE_ICONS = {
    store:
      '<svg class="icon icon--grocer" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1.8 9H5.8L4 10Z"></path><path d="M9 10l3-4 3 4"></path></svg>',
    restaurant:
      '<svg class="icon icon--restaurant" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7"></path><path d="M5 3v4"></path><path d="M9 3v4"></path><path d="M7 10v11"></path><path d="M14 3v18"></path><path d="M14 3c3 0 3 5 0 5"></path></svg>',
    vendor:
      '<svg class="icon icon--restaurant" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7"></path><path d="M5 3v4"></path><path d="M9 3v4"></path><path d="M7 10v11"></path><path d="M14 3v18"></path><path d="M14 3c3 0 3 5 0 5"></path></svg>',
    market:
      '<svg class="icon icon--market" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16"></path><path d="M5 10l1-4h12l1 4"></path><path d="M6 10v8h12v-8"></path><path d="M9 18v-5h6v5"></path></svg>',
    distributor:
      '<svg class="icon icon--distributor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="6" r="2"></circle><circle cx="18" cy="18" r="2"></circle><path d="M8 12h6"></path><path d="M16 8l-2 2"></path><path d="M16 16l-2-2"></path></svg>',
    farm:
      '<svg class="icon icon--farm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c7-1 12-6 14-14-8 2-13 7-14 14Z"></path><path d="M5 19c3-3 6-5 10-7"></path></svg>'
  };

  const DIRECTORY_PATHS = {
    farm: "/farms/",
    market: "/markets/",
    store: "/groceries/",
    restaurant: "/eateries/",
    vendor: "/eateries/",
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
  const trackEvent = (eventName, params = {}) => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, params);
  };
  let searchTrackTimer = null;
  const scheduleSearchTrack = (surface, value) => {
    const query = (value || "").trim();
    if (searchTrackTimer) window.clearTimeout(searchTrackTimer);
    if (query.length < 2) return;
    searchTrackTimer = window.setTimeout(() => {
      trackEvent("directory_search", {
        surface,
        query_length: query.length,
        country: getActiveCountry()
      });
    }, 500);
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
    trackEvent("near_me_requested", {
      surface: directoryPage ? "directory" : "home",
      country: getActiveCountry()
    });
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
  const normalizeRegion = (value) =>
    normalizeToken(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
            trackEvent("share_action", { method: "native" });
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
            trackEvent("share_action", { method: "copy_link" });
            setTimeout(() => {
              copyBtn.textContent = "Copy link";
              toggleMenu(false);
            }, 1200);
          } catch (err) {
            console.error("Copy failed", err);
          }
        });
      }
      if (emailLink) {
        emailLink.addEventListener("click", () => trackEvent("share_action", { method: "email" }));
      }
      if (facebookLink) {
        facebookLink.addEventListener("click", () => trackEvent("share_action", { method: "facebook" }));
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
      .map((region) => `<option value="${normalizeRegion(region)}">${region}</option>`)
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
  if (!selectedCountry && directoryPage?.dataset?.directoryCountry) {
    selectedCountry = directoryPage.dataset.directoryCountry;
  }
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
  if (directoryPage && directoryResultsContainer) {
    const pageSize = parseInt(directoryPage.dataset.directoryPageSize || "24", 10);
    directoryState = {
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 24,
      visibleCount: 0,
      filtered: [],
      active: false,
      nearMeMode: false
    };
  }

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
      trackEvent("theme_toggled", { theme: next });
    });
    // Sync initial UI state to current theme
    const initial = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(initial, false);
  }

  const hasSearchUI = Boolean(resultsContainer || mapPanel);
  const hasDirectoryUI = Boolean(directoryPage && directoryResultsContainer);

  const isFeaturedItem = (item) => {
    if (!item) return false;
    if (item.featured === true) return true;
    const { slug } = getActiveFeatured();
    return Boolean(slug) && (item.slug || "") === slug;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const truncateText = (value, limit = 130) => {
    const text = String(value || "").trim();
    if (!text || text.length <= limit) return text;
    return `${text.slice(0, limit).trimEnd()}...`;
  };

  const getItemTags = (item) => {
    if (Array.isArray(item.practices) && item.practices.length) return item.practices;
    if (Array.isArray(item.products) && item.products.length) return item.products;
    if (Array.isArray(item.services) && item.services.length) return item.services;
    return [];
  };

  const getItemLocationText = (item) => {
    const city = item.city || "";
    const region = item.region || "";
    return city && region ? `${city}, ${region}` : city || region || "Location not provided";
  };

  const buildMapsHref = (item) => {
    const parts = [item.address, item.city, item.region, item.country].filter(Boolean);
    if (!parts.length && (!item.lat || !item.lon)) return "";
    const query = parts.length ? parts.join(", ") : `${item.lat},${item.lon}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const renderRatingMarkup = (item) => {
    const avg = Number(item.rating_average || 0);
    const count = Number(item.rating_count || 0);
    if (!count || !Number.isFinite(avg)) return "";
    const fullStars = Math.max(0, Math.floor(avg));
    const halfStar = avg > fullStars && avg < fullStars + 1 ? 1 : 0;
    const emptyStars = Math.max(0, 5 - fullStars - halfStar);
    return `
      <div class="rating" aria-label="Rating ${escapeHtml(avg.toFixed(1))} out of 5">
        <div class="rating__stars">
          ${"★".repeat(fullStars)
            .split("")
            .map((star) => `<span aria-hidden="true">${star}</span>`)
            .join("")}
          ${halfStar ? '<span aria-hidden="true">☆</span>' : ""}
          ${"☆".repeat(emptyStars)
            .split("")
            .map((star) => `<span aria-hidden="true">${star}</span>`)
            .join("")}
        </div>
        <div class="rating__text">${escapeHtml(avg.toFixed(1))} · ${escapeHtml(count)} review${count === 1 ? "" : "s"}</div>
      </div>
    `;
  };

  const setDistanceBadges = (container, items = []) => {
    if (!container) return;
    const cards = Array.from(container.querySelectorAll(".listing-card"));
    cards.forEach((card, index) => {
      const badge = card.querySelector("[data-distance]");
      if (!badge) return;
      const distance = items[index]?._distance;
      if (!Number.isFinite(distance)) {
        badge.hidden = true;
        badge.textContent = "";
      } else {
        badge.hidden = false;
        badge.textContent = formatDistance(distance);
      }
    });
  };

  const setResultsCountText = (element, visible, total) => {
    if (!element) return;
    element.classList.remove("is-loading");
    if (!total) {
      element.textContent = "0 listings";
      return;
    }
    if (visible < total) {
      element.textContent = `Showing ${visible} of ${total} listings`;
      return;
    }
    element.textContent = `${total} listing${total === 1 ? "" : "s"}`;
  };

  const cardTemplate = (item) => {
    const tagsMarkup = getItemTags(item)
      .slice(0, 4)
      .map((tag) => `<li>${escapeHtml(tag)}</li>`)
      .join("");
    const locationText = getItemLocationText(item);
    const mapsHref = buildMapsHref(item);
    const isFeatured = isFeaturedItem(item);
    const typeToken = normalizeToken(item.type_token || getCanonicalType(item.collection || item.type));
    const iconMarkup = TYPE_ICONS[typeToken] || "";
    const summary = truncateText(item.description || "", 130);
    const summaryMarkup = summary ? `<p class="listing-card__summary">${escapeHtml(summary)}</p>` : "";
    const title = escapeHtml(item.title || item.name || "Untitled");
    const url = escapeHtml(item.url || "#");
    const locationMarkup = mapsHref
      ? `<a class="listing-card__location-link" href="${escapeHtml(mapsHref)}" target="_blank" rel="noopener"><span class="listing-card__location">${escapeHtml(
          locationText
        )}</span></a>`
      : `<span class="listing-card__location muted">${escapeHtml(locationText)}</span>`;
    const typeLabel = escapeHtml(item.type || getEntityLabel(item.collection) || item.collection || "Listing");

    return `
      <article class="listing-card${isFeatured ? " listing-card--featured" : ""}" data-lat="${escapeHtml(item.lat ?? "")}" data-lon="${escapeHtml(
        item.lon ?? ""
      )}">
        <div class="listing-card__meta">
          <span class="badge badge--meta badge--type">${iconMarkup}${typeLabel}</span>
          ${isFeatured ? '<span class="badge badge--verified badge--featured">Featured</span>' : ""}
        </div>
        <h3 class="listing-card__title"><a href="${url}">${title}</a></h3>
        <div class="listing-card__location-block">
          ${locationMarkup}
          <p class="listing-card__distance" data-distance hidden></p>
        </div>
        <div class="listing-card__tags">
          ${tagsMarkup ? `<ul class="tag-list">${tagsMarkup}</ul>` : '<p class="muted">Details coming soon.</p>'}
        </div>
        ${summaryMarkup}
        ${renderRatingMarkup(item)}
        <div class="listing-card__actions">
          <a class="text-link" href="${url}">Learn more</a>
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
      if (!hasActive && items.length === 0) {
        resultsCount.classList.remove("is-loading");
        resultsCount.textContent = "";
      } else {
        setResultsCountText(resultsCount, items.length, items.length);
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
    if (item.address) haystackParts.push(item.address);
    if (item.geo_label) haystackParts.push(item.geo_label);
    if (item.geo_query) haystackParts.push(item.geo_query);
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
    const selectedSubtypes = Array.isArray(selections.subtypes) ? normalizeList(selections.subtypes) : [];
    const itemSubtype = normalizeToken(item.subtype_token || item.subtype || item.type || item.listing_type);
    const subtypeMatches = !selectedSubtypes.length || selectedSubtypes.includes(itemSubtype);

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
      subtypeMatches &&
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
          expectedDirectory: getEntityBrowsePath(item.collection) || DIRECTORY_PATHS[typeToken] || "",
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

  const getCountrySwitchTarget = (slug) => {
    const template = document.querySelector("[data-country-switch-path-template]")?.dataset?.countrySwitchPathTemplate || "";
    if (!template) return "";
    const target = template.replace("__COUNTRY__", slug || defaultCountry);
    if (/^https?:\/\//i.test(target)) return target;
    const base = window.HG_BASEURL || "";
    return `${base}${target}`;
  };

  const getDirectorySelections = () => {
    const fixedCountry = normalizeCountry(directoryPage?.dataset?.directoryCountry || "");
    const regionSelect = document.getElementById("regionFilter");
    const textFilter = document.getElementById("dirSearch");
    const tagFilters = Array.from(document.querySelectorAll('.directory-filters input[name="tag"]:checked'));
    const subtypeFilters = Array.from(document.querySelectorAll('.directory-filters input[name="subtype"]:checked'));
    const productFilters = Array.from(document.querySelectorAll('.directory-filters input[name="products"]:checked'));
    return {
      query: textFilter ? textFilter.value : "",
      region: regionSelect ? regionSelect.value : "all",
      country: fixedCountry || getActiveCountry(),
      types: [],
      subtypes: subtypeFilters.map((input) => input.value),
      practices: tagFilters.map((input) => input.value),
      products: productFilters.map((input) => input.value),
      services: []
    };
  };

  const directoryHasInteractiveFilters = (selections) =>
    Boolean(
      (selections.query || "").trim() ||
        (selections.region && normalizeRegion(selections.region) !== "all") ||
        (Array.isArray(selections.subtypes) && selections.subtypes.length) ||
        (Array.isArray(selections.practices) && selections.practices.length) ||
        (Array.isArray(selections.products) && selections.products.length) ||
        (Array.isArray(selections.services) && selections.services.length)
    );

  const getDirectorySource = (items = []) => {
    if (!hasDirectoryUI || !directoryPage) return [];
    const fixedCountry = normalizeCountry(directoryPage.dataset.directoryCountry || "");
    const activeCountry = fixedCountry || normalizeCountry(getActiveCountry());
    const fixedRegion = normalizeRegion(directoryPage.dataset.directoryRegion || "");
    const collections = (directoryPage.dataset.directoryCollections || "")
      .split(",")
      .map(normalizeToken)
      .filter(Boolean);

    return (items || [])
      .filter((item) => {
        const itemCollection = normalizeToken(item.collection);
        const itemCountry = normalizeCountry(item.country_slug || item.country);
        const itemRegion = normalizeRegion(item.region);
        const collectionMatches = !collections.length || collections.includes(itemCollection);
        const countryMatches = !activeCountry || itemCountry === activeCountry;
        const regionMatches = !fixedRegion || itemRegion === fixedRegion;
        return collectionMatches && countryMatches && regionMatches;
      })
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
  };

  populateDirectoryRegions = (countrySlug) => {
    if (!hasDirectoryUI) return;
    const regionSelect = document.getElementById("regionFilter");
    if (!regionSelect) return;

    const requestedRegion = normalizeRegion(params.get("region"));
    const fixedCountry = normalizeCountry(directoryPage?.dataset?.directoryCountry || "");
    const activeCountry = fixedCountry || normalizeCountry(countrySlug || getActiveCountry());
    const source = getDirectorySource(window.HG_INDEX || listings || []).filter((item) => {
      const itemCountry = normalizeCountry(item.country_slug || item.country);
      return !activeCountry || itemCountry === activeCountry;
    });
    const regions = Array.from(new Set(source.map((item) => (item.region || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    const current = normalizeRegion(regionSelect.value || "");
    regionSelect.innerHTML = `<option value="all">All regions</option>${regions
      .map((region) => `<option value="${normalizeRegion(region)}">${region}</option>`)
      .join("")}`;
    const preferred = requestedRegion || current;
    const hasPreferred = Array.from(regionSelect.options).some((option) => option.value === preferred);
    regionSelect.value = hasPreferred ? preferred : "all";
  };

  const renderDirectoryResults = (items) => {
    if (!hasDirectoryUI || !directoryState || !directoryResultsContainer) return;
    const emptyTemplate = document.querySelector("#directoryEmptyStateTemplate");
    directoryResultsContainer.setAttribute("aria-busy", "false");

    if (!items.length) {
      directoryResultsContainer.innerHTML = emptyTemplate ? emptyTemplate.innerHTML : '<p class="muted">No listings found.</p>';
    } else {
      directoryResultsContainer.innerHTML = items.map(cardTemplate).join("");
    }

    setResultsCountText(
      document.querySelector("[data-directory-results-count], #dirResultsCount"),
      Math.min(directoryState.visibleCount, directoryState.filtered.length),
      directoryState.filtered.length
    );
    if (directoryLoadMoreBtn) {
      directoryLoadMoreBtn.hidden = directoryState.visibleCount >= directoryState.filtered.length;
    }
    setDistanceBadges(directoryResultsContainer, items);
  };

  const scrollDirectoryResults = () => {
    if (!directoryResultsContainer) return;
    directoryResultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearDirectoryFilters = () => {
    if (!directoryFiltersForm) return;
    directoryFiltersForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    const regionSelect = document.getElementById("regionFilter");
    const textFilter = document.getElementById("dirSearch");
    if (regionSelect) regionSelect.value = "all";
    if (textFilter) textFilter.value = "";
    nearMeState.active = false;
    setNearMeStatus("");
    if (typeof runDirectoryFilters === "function") runDirectoryFilters();
  };

  runDirectoryFilters = ({ resetVisible = true } = {}) => {
    if (!hasDirectoryUI || !directoryState) return;

    const source = getDirectorySource(window.HG_INDEX || listings || []);
    const selections = getDirectorySelections();
    const nearMeMode = nearMeState.active && nearMeState.userLocation;
    const activeFilters = directoryHasInteractiveFilters(selections);
    let items = source.filter((item) => matchesFilters(item, selections, { includePageFilters: false }));

    if (!activeFilters && !nearMeMode) {
      const { slug: activeFeaturedSlug } = getActiveFeatured();
      if (activeFeaturedSlug) {
        items = items.filter((item) => (item.slug || "") !== activeFeaturedSlug);
      }
      setFeaturedHeroVisible(true);
    } else {
      setFeaturedHeroVisible(false);
    }

    if (nearMeMode) {
      items = items
        .map((item) => {
          const lat = parseCoord(item.lat);
          const lon = parseCoord(item.lon);
          const distance =
            lat !== null && lon !== null ? haversineKm(nearMeState.userLocation.lat, nearMeState.userLocation.lon, lat, lon) : Infinity;
          return { ...item, _distance: distance };
        })
        .sort((a, b) => (a._distance || Infinity) - (b._distance || Infinity));
      setNearMeStatus(items.some((item) => Number.isFinite(item._distance)) ? "Sorted by distance" : "No listings with coordinates");
    } else {
      setNearMeStatus("");
    }

    directoryState.filtered = items;
    directoryState.active = activeFilters;
    directoryState.nearMeMode = Boolean(nearMeMode);
    if (resetVisible || !directoryState.visibleCount) {
      directoryState.visibleCount = directoryState.pageSize;
    }
    renderDirectoryResults(items.slice(0, directoryState.visibleCount));
  };

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
    trackEvent("country_switched", { country: selectedCountry });
    syncCountryButtons(selectedCountry);
    updateCountryLabels(selectedCountry);
    populateHeroRegions(selectedCountry);
    if (typeof populateDirectoryRegions === "function") populateDirectoryRegions(selectedCountry);
    const switchTarget = getCountrySwitchTarget(selectedCountry);
    if (switchTarget && switchTarget !== window.location.pathname && switchTarget !== window.location.href) {
      window.location.href = switchTarget;
      return;
    }
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
    if (!hasSearchUI && !hasDirectoryUI) return;
    if (mapShouldStartOpen && !map) {
      openMap();
    }
    if (resultsCount) {
      resultsCount.classList.add("is-loading");
    }
    const directoryResultsCount = document.querySelector("[data-directory-results-count], #dirResultsCount");
    if (directoryResultsCount) {
      directoryResultsCount.classList.add("is-loading");
      directoryResultsCount.textContent = "Loading listings...";
    }
    if (directoryResultsContainer) {
      directoryResultsContainer.setAttribute("aria-busy", "true");
    }
    try {
      const url = window.HG_INDEX_URL || "/search.json";
      const response = await fetch(url);
      const data = await response.json();
      window.HG_INDEX = data;
      listings = data;
      filtered = data;
      populateHeroRegions(getActiveCountry());
      if (hasSearchUI) {
        applyFilters();
      }
      if (hasDirectoryUI) {
        populateDirectoryRegions(getActiveCountry());
        runDirectoryFilters();
      }
      runListingSelfFilterAudit(listings);
      if (mapShouldStartOpen) openMap();
      refreshMap(filtered);
    } catch (err) {
      console.error("Failed to load search index", err);
      if (resultsCount) resultsCount.textContent = "Could not load listings right now.";
      if (resultsCount) resultsCount.classList.remove("is-loading");
      if (directoryResultsCount) {
        directoryResultsCount.textContent = "Could not load listings right now.";
        directoryResultsCount.classList.remove("is-loading");
      }
      if (directoryResultsContainer) {
        directoryResultsContainer.setAttribute("aria-busy", "false");
        directoryResultsContainer.innerHTML = '<p class="muted">Could not load listings right now.</p>';
      }
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
      trackEvent("directory_filter_change", {
        surface: "home",
        filter_type: "type",
        value: isActive ? "all" : filters.join(","),
        country: getActiveCountry()
      });
      applyFilters();
      document.getElementById("listingResults")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  countryButtons.forEach((btn) => {
    btn.addEventListener("click", () => setCountry(btn.dataset.countryOption, { updateHash: true }));
  });
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      scheduleSearchTrack("home", searchInput.value);
      applyFilters();
    });
  }
  if (heroRegionSelect) {
    heroRegionSelect.addEventListener("change", () => {
      trackEvent("directory_filter_change", {
        surface: "home",
        filter_type: "region",
        value: heroRegionSelect.value || "all",
        country: getActiveCountry()
      });
      applyFilters();
      const target = document.getElementById("directory") || document.getElementById("listingResults");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  if (filtersForm) {
    filtersForm.addEventListener("change", applyFilters);
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      trackEvent("directory_filters_cleared", { country: getActiveCountry() });
      clearFilters();
    });
  }
  if (hasDirectoryUI && directoryFiltersForm) {
    const regionSelect = document.getElementById("regionFilter");
    const textFilter = document.getElementById("dirSearch");

    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        trackEvent("directory_filter_change", {
          surface: "directory",
          filter_type: "region",
          value: regionSelect.value || "all",
          country: getActiveCountry()
        });
        runDirectoryFilters && runDirectoryFilters();
        scrollDirectoryResults();
      });
    }

    if (textFilter) {
      textFilter.addEventListener("input", () => {
        scheduleSearchTrack("directory", textFilter.value);
        runDirectoryFilters && runDirectoryFilters();
      });
    }

    directoryFiltersForm.querySelectorAll('input[name="tag"]').forEach((input) => {
      input.addEventListener("change", () => {
        trackEvent("directory_filter_change", {
          surface: "directory",
          filter_type: "practice",
          value: input.value,
          country: getActiveCountry()
        });
        runDirectoryFilters && runDirectoryFilters();
      });
    });

    directoryFiltersForm.querySelectorAll('input[name="subtype"]').forEach((input) => {
      input.addEventListener("change", () => {
        trackEvent("directory_filter_change", {
          surface: "directory",
          filter_type: "subtype",
          value: input.value,
          country: getActiveCountry()
        });
        runDirectoryFilters && runDirectoryFilters();
      });
    });

    directoryFiltersForm.querySelectorAll('input[name="products"]').forEach((input) => {
      input.addEventListener("change", () => {
        trackEvent("directory_filter_change", {
          surface: "directory",
          filter_type: "product",
          value: input.value,
          country: getActiveCountry()
        });
        runDirectoryFilters && runDirectoryFilters();
      });
    });
  }
  if (directoryClearBtn) {
    directoryClearBtn.addEventListener("click", () => {
      trackEvent("directory_filters_cleared", { country: getActiveCountry() });
      clearDirectoryFilters();
    });
  }
  if (directoryLoadMoreBtn) {
    directoryLoadMoreBtn.addEventListener("click", () => {
      if (!directoryState) return;
      directoryState.visibleCount += directoryState.pageSize;
      renderDirectoryResults(directoryState.filtered.slice(0, directoryState.visibleCount));
      trackEvent("directory_results_expanded", {
        country: getActiveCountry(),
        total: directoryState.filtered.length
      });
    });
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
  document.addEventListener("click", (event) => {
    const listingLink = event.target.closest(".listing-card a");
    if (listingLink) {
      trackEvent("listing_opened", {
        surface: directoryPage ? "directory" : "home",
        href: listingLink.getAttribute("href") || ""
      });
      return;
    }

    const contactLink = event.target.closest(".listing__contact a");
    if (contactLink) {
      trackEvent("listing_contact_click", {
        channel: (contactLink.textContent || "").trim().toLowerCase()
      });
      return;
    }

    const navCta = event.target.closest(".nav__cta");
    if (navCta) {
      trackEvent("submission_cta_clicked", { surface: "nav" });
    }
  });
  fetchListings();
})();
