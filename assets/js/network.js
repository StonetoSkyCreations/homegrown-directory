/* Connection network graph. Reuses /search.json, builds the producer/stockist/eatery
   supply web client-side, marks edges reciprocated when declared from both sides
   (matching scripts/relationship_audit.rb), and renders with Cytoscape. */
(function () {
  "use strict";

  var COLOURS = {
    farm: "#4caf50", store: "#2196f3", restaurant: "#ff7043",
    market: "#ab47bc", distributor: "#8d6e63", vendor: "#8d6e63"
  };

  function ready(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  ready(function init() {
    var container = document.getElementById("network-graph");
    if (!container) { return; }
    // Cytoscape loads with defer; retry briefly if it is not ready yet.
    if (typeof cytoscape === "undefined") { return void setTimeout(init, 150); }

    var baseEl = document.querySelector("base");
    var base = baseEl ? baseEl.getAttribute("href").replace(/\/$/, "") : "";

    fetch(base + "/search.json")
      .then(function (r) { return r.json(); })
      .then(build)
      .catch(function (e) { container.textContent = "Could not load the network data."; console.error(e); });

    function build(records) {
      // De-duplicate listings by slug (first wins), index for lookups.
      var bySlug = {};
      records.forEach(function (r) { if (r.slug && !bySlug[r.slug]) { bySlug[r.slug] = r; } });

      // Collect supply facts keyed producer|outlet, tracking which side declared it.
      var facts = {};
      function note(producer, outlet, side) {
        if (!producer || !outlet || producer === outlet) { return; }
        if (!bySlug[producer] || !bySlug[outlet]) { return; }
        var k = producer + "|" + outlet;
        (facts[k] || (facts[k] = {}))[side] = true;
      }
      records.forEach(function (r) {
        (r.supplies_to || []).forEach(function (outlet) { note(r.slug, outlet, "p"); });
        (r.sourced_from || []).forEach(function (producer) { note(producer, r.slug, "o"); });
      });

      var edges = Object.keys(facts).map(function (k) {
        var parts = k.split("|");
        return { source: parts[0], target: parts[1], reciprocated: !!(facts[k].p && facts[k].o) };
      });

      // Degree, for the "connected only" filter.
      var degree = {};
      edges.forEach(function (e) { degree[e.source] = (degree[e.source] || 0) + 1; degree[e.target] = (degree[e.target] || 0) + 1; });

      var cy = cytoscape({
        container: container,
        elements: [],
        style: [
          { selector: "node", style: {
            "background-color": function (n) { return COLOURS[n.data("type")] || "#777"; },
            "label": "data(label)", "font-size": 9, "color": "#333",
            "text-valign": "bottom", "text-margin-y": 3, "width": 14, "height": 14,
            "text-opacity": 0, "min-zoomed-font-size": 8
          } },
          { selector: "node:selected", style: { "border-width": 3, "border-color": "#111", "text-opacity": 1 } },
          { selector: "edge", style: {
            "width": 1.5, "line-color": "#ccc", "curve-style": "haystack", "opacity": 0.6,
            "line-style": "dashed"
          } },
          { selector: "edge[?reciprocated]", style: { "line-color": "#4caf50", "width": 2.5, "line-style": "solid", "opacity": 0.85 } }
        ]
      });

      var statsEl = document.getElementById("network-stats");
      var emptyEl = document.getElementById("network-empty");
      var regionSel = document.getElementById("filter-region");
      var practiceSel = document.getElementById("filter-practice");
      var connectedChk = document.getElementById("filter-connected");

      // Populate filter dropdowns.
      var regions = {}, practices = {};
      records.forEach(function (r) {
        if (r.region) { regions[r.region] = true; }
        (r.practices || []).forEach(function (p) { if (p) { practices[p] = true; } });
      });
      fill(regionSel, Object.keys(regions).sort());
      fill(practiceSel, Object.keys(practices).sort());

      function fill(sel, values) {
        values.forEach(function (v) {
          var o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
        });
      }

      function render() {
        var region = regionSel.value, practice = practiceSel.value, connectedOnly = connectedChk.checked;

        function nodeOk(slug) {
          var r = bySlug[slug];
          if (!r) { return false; }
          if (region && r.region !== region) { return false; }
          if (practice && (r.practices || []).indexOf(practice) === -1) { return false; }
          if (connectedOnly && !degree[slug]) { return false; }
          return true;
        }

        var keptEdges = edges.filter(function (e) { return nodeOk(e.source) && nodeOk(e.target); });
        var nodeSet = {};
        keptEdges.forEach(function (e) { nodeSet[e.source] = true; nodeSet[e.target] = true; });
        if (!connectedOnly) { Object.keys(bySlug).forEach(function (s) { if (nodeOk(s)) { nodeSet[s] = true; } }); }

        var els = [];
        Object.keys(nodeSet).forEach(function (slug) {
          var r = bySlug[slug];
          els.push({ data: { id: slug, label: r.title || r.name || slug, type: r.type_token || r.collection.replace(/s$/, ""), url: r.url } });
        });
        keptEdges.forEach(function (e, i) {
          els.push({ data: { id: "e" + i, source: e.source, target: e.target, reciprocated: e.reciprocated } });
        });

        cy.elements().remove();
        cy.add(els);
        cy.layout({ name: "cose", animate: false, nodeRepulsion: 6000, idealEdgeLength: 60, padding: 20 }).run();

        var n = Object.keys(nodeSet).length, recip = keptEdges.filter(function (e) { return e.reciprocated; }).length;
        statsEl.textContent = n + " listings, " + keptEdges.length + " connections (" + recip + " confirmed both ways)";
        emptyEl.hidden = keptEdges.length > 0 || n > 0;
      }

      cy.on("tap", "node", function (evt) {
        var url = evt.target.data("url");
        if (url) { window.location.href = base + url; }
      });

      [regionSel, practiceSel, connectedChk].forEach(function (el) { el.addEventListener("change", render); });
      render();
    }
  });
})();
