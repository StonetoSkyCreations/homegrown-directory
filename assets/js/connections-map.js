/* Web-of-connection Leaflet map. Powers the in-listing mini-map (focused on one
   listing) and the /network/ page (full graph). Lazy-loads Leaflet + leaflet-ant-path
   from CDN (with SRI) only when a map container scrolls into view. Data comes from
   /search.json (slug, lat, lon, sourced_from, supplies_to, collection, url, title).
   No build step. Falls back silently to the server-rendered chip list when coords are
   missing. */
(function () {
  "use strict";

  var CDN = {
    leafletCss: ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="],
    leafletJs: ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="],
    antPath: ["https://unpkg.com/leaflet-ant-path@1.3.0/dist/leaflet-ant-path.js", "sha256-tAYlAN1qth0gHGwN3e85JLm82kzjYc4ozrVjBfO+7nM="]
  };

  // The focus listing shows its type emoji so "this is the farm" reads instantly;
  // every connection is a small colour dot so nearby points stop stacking.
  var TYPES = {
    farms: { color: "#4caf50", emoji: "🌱" },
    markets: { color: "#ab47bc", emoji: "🧺" },
    stores: { color: "#2196f3", emoji: "🛒" },
    restaurants: { color: "#ff7043", emoji: "🍽️" },
    vendors: { color: "#8d6e63", emoji: "🍞" },
    distributors: { color: "#607d8b", emoji: "📦" }
  };
  function typeMeta(collection) { return TYPES[collection] || { color: "#777", emoji: "" }; }

  var baseEl = document.querySelector("base");
  var BASE = baseEl ? baseEl.getAttribute("href").replace(/\/$/, "") : "";

  var _loading = null;
  function addCss(href, integrity) {
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; if (integrity) { l.integrity = integrity; } l.crossOrigin = "";
    document.head.appendChild(l);
  }
  function addScript(src, integrity) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; if (integrity) { s.integrity = integrity; } s.crossOrigin = "";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function loadLeaflet() {
    if (window.L && window.L.Polyline && window.L.Polyline.AntPath) { return Promise.resolve(); }
    if (_loading) { return _loading; }
    _loading = new Promise(function (resolve, reject) {
      var steps = Promise.resolve();
      if (!window.L) { addCss(CDN.leafletCss[0], CDN.leafletCss[1]); steps = addScript(CDN.leafletJs[0], CDN.leafletJs[1]); }
      steps.then(function () {
        if (window.L && window.L.Polyline && window.L.Polyline.AntPath) { return; }
        return addScript(CDN.antPath[0], CDN.antPath[1]);
      }).then(resolve, reject);
    });
    return _loading;
  }

  var _data = null;
  function getData() {
    if (_data) { return _data; }
    _data = fetch(BASE + "/search.json").then(function (r) { return r.json(); });
    return _data;
  }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function hasCoords(r) { return r && num(r.lat) !== null && num(r.lon) !== null; }

  function pinIcon(collection, isFocus) {
    var meta = typeMeta(collection);
    if (isFocus) {
      var fs = 36;
      return window.L.divIcon({
        className: "conn-pin conn-pin--focus",
        html: '<span class="conn-pin__badge" style="background:' + meta.color + '">' + (meta.emoji || "") + "</span>",
        iconSize: [fs, fs], iconAnchor: [fs / 2, fs / 2], popupAnchor: [0, -fs / 2]
      });
    }
    var s = 13;
    return window.L.divIcon({
      className: "conn-pin",
      html: '<span class="conn-pin__dot" style="background:' + meta.color + '"></span>',
      iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2]
    });
  }

  // Gentle quadratic-bezier arc between two [lat,lng] points, for flowing lines.
  function curve(a, b) {
    var clat = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.14;
    var clng = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.14;
    var pts = [];
    for (var t = 0; t <= 1.0001; t += 0.1) {
      var u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * clat + t * t * b[0], u * u * a[1] + 2 * u * t * clng + t * t * b[1]]);
    }
    return pts;
  }

  function edge(map, a, b, reciprocated) {
    var opts = reciprocated
      ? { color: "#4caf50", weight: 3, opacity: 0.9, delay: 700, dashArray: [8, 14], pulseColor: "#ffffff" }
      : { color: "#9e9e9e", weight: 2, opacity: 0.7, delay: 1100, dashArray: [4, 14], pulseColor: "#ffffff" };
    return window.L.polyline.antPath(curve(a, b), opts).addTo(map);
  }

  function popupHtml(r) {
    var meta = typeMeta(r.collection);
    return '<strong>' + esc(r.title || r.name || r.slug) + "</strong><br>" +
      '<span class="conn-popup__type">' + esc(r.type || r.collection) + "</span>" +
      (r.region ? '<br><span class="conn-popup__where">' + esc(r.region) + "</span>" : "") +
      '<br><a href="' + BASE + (r.url || "/") + '">Open listing</a>';
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Connections of a focus listing: any node referenced in either direction.
  function connectionsOf(focus, records) {
    var out = [];
    var fSup = focus.supplies_to || [], fSrc = focus.sourced_from || [];
    records.forEach(function (r) {
      if (r.slug === focus.slug) { return; }
      var fToR = fSup.indexOf(r.slug) !== -1 || fSrc.indexOf(r.slug) !== -1;
      var rToF = (r.supplies_to || []).indexOf(focus.slug) !== -1 || (r.sourced_from || []).indexOf(focus.slug) !== -1;
      if (fToR || rToF) { out.push({ node: r, reciprocated: fToR && rToF }); }
    });
    return out;
  }

  function renderFocused(container, focusSlug, records) {
    var bySlug = {};
    records.forEach(function (r) { if (r.slug && !bySlug[r.slug]) { bySlug[r.slug] = r; } });
    var focus = bySlug[focusSlug];
    if (!focus || !hasCoords(focus)) { container.classList.add("connections__map--empty"); return; }

    var conns = connectionsOf(focus, records).filter(function (c) { return hasCoords(c.node); });
    if (!conns.length) { container.classList.add("connections__map--empty"); return; }

    var map = window.L.map(container, { scrollWheelZoom: false, zoomControl: true });
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var pts = [];
    var fll = [num(focus.lat), num(focus.lon)];
    conns.forEach(function (c) {
      var cll = [num(c.node.lat), num(c.node.lon)];
      edge(map, fll, cll, c.reciprocated);
      window.L.marker(cll, { icon: pinIcon(c.node.collection, false) }).addTo(map).bindPopup(popupHtml(c.node));
      pts.push(cll);
    });
    window.L.marker(fll, { icon: pinIcon(focus.collection, true), zIndexOffset: 1000 }).addTo(map).bindPopup(popupHtml(focus));
    pts.push(fll);
    map.fitBounds(window.L.latLngBounds(pts).pad(0.25));
    container.classList.add("connections__map--ready");
    setTimeout(function () { map.invalidateSize(); }, 80);
  }

  function fillSelect(sel, values) {
    if (!sel) { return; }
    values.forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
  }

  // Full network map for /network/: every listing + every supply edge, filterable,
  // click a marker to trace its connections.
  function renderFull(container, records) {
    var bySlug = {};
    records.forEach(function (r) { if (r.slug && !bySlug[r.slug]) { bySlug[r.slug] = r; } });

    var edgeMap = {};
    function addRef(from, to) {
      if (!from || !to || from === to) { return; }
      if (!bySlug[from] || !bySlug[to] || !hasCoords(bySlug[from]) || !hasCoords(bySlug[to])) { return; }
      var a = from < to ? from : to, b = from < to ? to : from;
      var e = edgeMap[a + "|" + b] || (edgeMap[a + "|" + b] = { a: a, b: b, refs: {} });
      e.refs[from] = true;
    }
    records.forEach(function (r) {
      (r.supplies_to || []).forEach(function (t) { addRef(r.slug, t); });
      (r.sourced_from || []).forEach(function (t) { addRef(r.slug, t); });
    });
    var edges = Object.keys(edgeMap).map(function (k) {
      var e = edgeMap[k];
      return { a: e.a, b: e.b, reciprocated: !!(e.refs[e.a] && e.refs[e.b]) };
    });
    var coordRecords = records.filter(hasCoords);

    var map = window.L.map(container, { scrollWheelZoom: true, zoomControl: true });
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var linesLayer = window.L.layerGroup().addTo(map);
    var emphasisLayer = window.L.layerGroup().addTo(map);
    var markersLayer = window.L.markerClusterGroup
      ? window.L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false, spiderfyOnMaxZoom: true })
      : window.L.layerGroup();
    map.addLayer(markersLayer);

    var regionSel = document.getElementById("net-region");
    var practiceSel = document.getElementById("net-practice");
    var collSel = document.getElementById("net-collection");
    var statsEl = document.getElementById("net-stats");

    var regions = {}, practices = {};
    records.forEach(function (r) {
      if (r.region) { regions[r.region] = true; }
      (r.practices || []).forEach(function (p) { if (p) { practices[p] = true; } });
    });
    fillSelect(regionSel, Object.keys(regions).sort());
    fillSelect(practiceSel, Object.keys(practices).sort());

    function passes(r) {
      if (regionSel && regionSel.value && r.region !== regionSel.value) { return false; }
      if (collSel && collSel.value && r.collection !== collSel.value) { return false; }
      if (practiceSel && practiceSel.value && (r.practices || []).indexOf(practiceSel.value) === -1) { return false; }
      return true;
    }

    function emphasize(focus) {
      emphasisLayer.clearLayers();
      var fll = [num(focus.lat), num(focus.lon)];
      connectionsOf(focus, records).forEach(function (c) {
        if (hasCoords(c.node)) { edge(emphasisLayer, fll, [num(c.node.lat), num(c.node.lon)], c.reciprocated); }
      });
    }

    function render(fit) {
      linesLayer.clearLayers(); emphasisLayer.clearLayers(); markersLayer.clearLayers();
      var visible = {};
      coordRecords.forEach(function (r) { if (passes(r)) { visible[r.slug] = r; } });

      edges.forEach(function (e) {
        if (!visible[e.a] || !visible[e.b]) { return; }
        var a = [num(bySlug[e.a].lat), num(bySlug[e.a].lon)];
        var b = [num(bySlug[e.b].lat), num(bySlug[e.b].lon)];
        window.L.polyline(curve(a, b), e.reciprocated
          ? { color: "#4caf50", weight: 1.5, opacity: 0.4 }
          : { color: "#9e9e9e", weight: 1, opacity: 0.25, dashArray: "4 6" }).addTo(linesLayer);
      });

      var pts = [], count = 0;
      Object.keys(visible).forEach(function (slug) {
        var r = visible[slug], ll = [num(r.lat), num(r.lon)];
        var m = window.L.marker(ll, { icon: pinIcon(r.collection, false) }).bindPopup(popupHtml(r));
        m.on("click", function () { emphasize(r); });
        markersLayer.addLayer(m); pts.push(ll); count++;
      });

      var lineCount = edges.filter(function (e) { return visible[e.a] && visible[e.b]; }).length;
      if (statsEl) { statsEl.textContent = count + " listings, " + lineCount + " connections"; }
      if (fit && pts.length) { try { map.fitBounds(window.L.latLngBounds(pts).pad(0.1)); } catch (err) { /* noop */ } }
    }

    [regionSel, practiceSel, collSel].forEach(function (el) { if (el) { el.addEventListener("change", function () { render(true); }); } });
    render(true);
    setTimeout(function () { map.invalidateSize(); }, 80);
  }

  function initContainer(container) {
    if (container.dataset.cmInit) { return; }
    container.dataset.cmInit = "1";
    var focusSlug = container.getAttribute("data-focus");
    var mode = container.getAttribute("data-mode");
    loadLeaflet()
      .then(getData)
      .then(function (records) {
        if (mode === "full") { renderFull(container, records); }
        else if (focusSlug) { renderFocused(container, focusSlug, records); }
      })
      .catch(function (e) { container.classList.add("connections__map--empty"); console.error("connections-map:", e); });
  }

  function start() {
    var maps = document.querySelectorAll("[data-connections-map]");
    if (!maps.length) { return; }
    if (!("IntersectionObserver" in window)) { maps.forEach(initContainer); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { obs.unobserve(en.target); initContainer(en.target); } });
    }, { rootMargin: "200px" });
    maps.forEach(function (m) { io.observe(m); });
  }

  if (document.readyState !== "loading") { start(); }
  else { document.addEventListener("DOMContentLoaded", start); }
})();
