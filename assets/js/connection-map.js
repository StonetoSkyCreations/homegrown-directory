/* Connection-map progressive enhancement: draws curved SVG connector lines from the
   centre listing to each visible supplier/outlet node. No library. The server-rendered
   columns are fully usable without this; lines are decorative and skipped on mobile. */
(function () {
  "use strict";

  function pathEl(a, b, verified) {
    var mx = (a.x + b.x) / 2;
    var d = "M " + a.x + " " + a.y + " C " + mx + " " + a.y + ", " + mx + " " + b.y + ", " + b.x + " " + b.y;
    var stroke = verified ? "#4caf50" : "#c9c9c9";
    var w = verified ? 2 : 1.25;
    var dash = verified ? "" : ' stroke-dasharray="4 4"';
    return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + dash + ' />';
  }

  function draw(map) {
    var svg = map.querySelector(".connection-map__lines");
    var self = map.querySelector("[data-self]");
    if (!svg || !self) { return; }
    if (window.matchMedia("(max-width: 720px)").matches) { svg.innerHTML = ""; return; }

    var mapRect = map.getBoundingClientRect();
    var selfRect = self.getBoundingClientRect();
    var midY = selfRect.top - mapRect.top + selfRect.height / 2;
    var selfLeft = { x: selfRect.left - mapRect.left, y: midY };
    var selfRight = { x: selfRect.right - mapRect.left, y: midY };

    svg.setAttribute("viewBox", "0 0 " + mapRect.width + " " + mapRect.height);
    var parts = [];

    map.querySelectorAll(".connection-map__col--suppliers .cnode").forEach(function (node) {
      if (node.offsetParent === null) { return; }
      var r = node.getBoundingClientRect();
      var p = { x: r.right - mapRect.left, y: r.top - mapRect.top + r.height / 2 };
      parts.push(pathEl(p, selfLeft, node.classList.contains("cnode--verified")));
    });
    map.querySelectorAll(".connection-map__col--outlets .cnode").forEach(function (node) {
      if (node.offsetParent === null) { return; }
      var r = node.getBoundingClientRect();
      var p = { x: r.left - mapRect.left, y: r.top - mapRect.top + r.height / 2 };
      parts.push(pathEl(selfRight, p, node.classList.contains("cnode--verified")));
    });

    svg.innerHTML = parts.join("");
  }

  function init() {
    var maps = document.querySelectorAll("[data-connection-map]");
    if (!maps.length) { return; }
    function redraw() { maps.forEach(draw); }

    redraw();
    setTimeout(redraw, 250); // after fonts/layout settle

    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(redraw, 150); });
    maps.forEach(function (map) {
      map.querySelectorAll("details").forEach(function (d) { d.addEventListener("toggle", redraw); });
    });
  }

  if (document.readyState !== "loading") { init(); }
  else { document.addEventListener("DOMContentLoaded", init); }
})();
