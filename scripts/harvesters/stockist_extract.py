#!/usr/bin/env python3
"""Harvester step 2: extract candidate outlet/producer names from the hub pages
that step 1 detected.

Reads data/harvest/stockist-candidates.csv (from stockist_scan.py), fetches each
detected "where to buy / stockists / suppliers" page politely (robots.txt honoured,
~1 req/s, cached), and extracts candidate business names + an evidence snippet to
data/harvest/stockist-edges.csv. The Ruby classifier (scripts/candidate_edges.rb)
then runs those names through the canonical matcher (Harvest.match) to build the
review queue. This script never writes to the site and never invents names; it only
reports what a page actually lists.

Real producer pages expose their list in different ways, so this is a small
dispatcher, not one universal scraper:
  - Google My Maps embed  -> fetch the map's KML export, one row per placemark
    (the highest-yield pattern; e.g. CoralTree publishes ~105 stockists this way).
  - Plain static HTML list -> extract <li>/<td>/heading/anchor text with a strong
    boilerplate stoplist (smaller / older producer sites).
  - JS store-locator widget (WP Store Locator, Stockist.co, Shopify blog, bare
    Google Maps iframe) -> the names are not in the static HTML, so we classify the
    page as widget:<type> and extract nothing, rather than dumping nav/footer noise.
    These are handled later with a per-widget adapter.

Direction: a "where to buy / stockists / retailers" page lists outlets the producer
SUPPLIES (field supplies_to); an "our growers / suppliers / producers" page lists
producers the hub SOURCES FROM (field sourced_from). Inferred from the link text.

Usage:
  python3 scripts/harvesters/stockist_extract.py                 # all detected pages
  python3 scripts/harvesters/stockist_extract.py --slugs coraltree-organic-products
  python3 scripts/harvesters/stockist_extract.py --refresh       # re-fetch, ignore cache
"""
import sys, os, re, csv, importlib.util
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IN = os.path.join(ROOT, "data/harvest/stockist-candidates.csv")
OUT = os.path.join(ROOT, "data/harvest/stockist-edges.csv")
HEADER = ["producer_slug", "field", "candidate_name", "evidence_url", "snippet", "method", "lat", "lon"]

# Reuse the polite fetch/cache/robots layer from step 1.
_spec = importlib.util.spec_from_file_location(
    "stockist_scan", os.path.join(os.path.dirname(os.path.abspath(__file__)), "stockist_scan.py"))
ss = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ss)

# Reverse-direction link text => the page lists suppliers, not outlets.
REVERSE_RE = re.compile(r"grower|supplier|producer|maker|farmer", re.I)
MYMAPS_RE = re.compile(r"maps/d/(?:u/\d+/)?(?:embed|view|edit)?\?[^\"']*?mid=([\w-]+)", re.I)

WIDGET_SIGNS = [
    ("wpsl", r"\bwpsl\b|wp-store-locator|store-locator"),
    ("stockist", r"stockist\.co|stockist-store-locator"),
    ("storerocket", r"storerocket"),
    ("storepoint", r"storepoint"),
    ("storemapper", r"storemapper"),
    ("wix", r"wixstatic\.com|static\.wixstatic|X-Wix-|wix-warmup-data"),
    ("shopify-blog", r"/blogs/"),
    ("gmap-iframe", r"google\.com/maps/embed|maps\.google\.[a-z.]+/maps"),
]

# Static-list boilerplate: nav, footer, account, currency, payment, legal, social.
STOP_EXACT = {
    "home", "about", "about us", "shop", "blog", "news", "contact", "contact us",
    "stockists", "where to buy", "where you can buy", "search", "cart", "your basket",
    "your basket is empty", "account", "my account", "log in", "login", "sign in",
    "profile", "orders", "more", "menu", "newsletter", "subscribe", "country/region",
    "privacy policy", "refund policy", "terms", "terms of service", "shipping",
    "shipping policy", "returns", "faq", "faqs", "wholesale", "our products",
    "our story", "products", "gallery", "events", "reviews", "follow us", "sitemap",
    "place a bulk order",
}
STOP_SUBSTR = [
    "nzd", "aud", "usd", "copyright", "all rights reserved", "nzbn", "getelementbyid",
    "document.", "loading", "function(", "cookie", "javascript", "log in to check out",
    "visa", "mastercard", "american express", "apple pay", "google pay", "shop pay",
    "union pay", "paypal", "afterpay", "laybuy", "facebook", "instagram", "twitter",
    "tiktok", "youtube", "linkedin", "pinterest", "@", "://", "subscribe",
]


def strip_cdata(s):
    s = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", s, flags=re.S)
    return re.sub(r"<[^>]+>", " ", s)


def clean(s):
    return re.sub(r"\s+", " ", strip_cdata(s)).strip()


def looks_like_name(text):
    t = text.strip()
    low = t.lower()
    if not (3 <= len(t) <= 90):
        return False
    if not re.search(r"[A-Za-z]", t):
        return False
    if low in STOP_EXACT:
        return False
    if any(s in low for s in STOP_SUBSTR):
        return False
    if re.match(r"^\+?\d[\d\s()-]{5,}$", t):     # phone-only
        return False
    return True


# ---- adapters --------------------------------------------------------------

def from_kml(slug, mid, field):
    url = f"https://www.google.com/maps/d/kml?mid={mid}&forcekml=1"
    status, kml = ss.homepage_html(f"kml-{slug}", url, REFRESH)
    rows = []
    if not kml:
        return rows, f"mymaps:{status}"
    skipped = 0
    for block in re.findall(r"<Placemark>(.*?)</Placemark>", kml, re.S):
        nm = re.search(r"<name>(.*?)</name>", block, re.S)
        if not nm:
            continue
        name = clean(nm.group(1))
        if not looks_like_name(name):
            continue
        lat = lon = ""
        co = re.search(r"<coordinates>(.*?)</coordinates>", block, re.S)
        if co:
            parts = clean(co.group(1)).split(",")
            if len(parts) >= 2:
                try:
                    lon, lat = float(parts[0]), float(parts[1])
                except ValueError:
                    lon = lat = ""
        # NZ-only harvest: keep NZ coordinates, drop AU/other. NZ lon ~166-179 E,
        # Chatham Islands ~ -176 (across the antimeridian). Keep rows lacking coords.
        if lon != "" and not (lon >= 160 or lon <= -170):
            skipped += 1
            continue
        desc = re.search(r"<description>(.*?)</description>", block, re.S)
        snippet = clean(desc.group(1))[:160] if desc and clean(desc.group(1)) else ""
        if not snippet and lat != "":
            snippet = f"map pin {lat:.4f},{lon:.4f}"
        rows.append((slug, field, name, url, snippet, "kml", lat, lon))
    note = f"mymaps:{len(rows)}" + (f" (+{skipped} non-NZ skipped)" if skipped else "")
    return rows, note


class ListParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cur = None
        self.buf = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag in ("li", "td", "th", "strong", "h2", "h3", "h4", "dd"):
            self.cur = tag
            self.buf = []

    def handle_data(self, data):
        if self.cur:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if tag == self.cur:
            txt = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            if txt:
                self.items.append(txt)
            self.cur = None


def from_static(slug, page_url, html, field):
    p = ListParser()
    try:
        p.feed(html)
    except Exception:
        pass
    rows = []
    seen = set()
    for raw in p.items:
        # A store line is often "Name, City" / "Name - City"; keep the leading name.
        name = re.split(r"\s[-–—]\s|,", raw, maxsplit=1)[0].strip()
        if not looks_like_name(name):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append((slug, field, name, page_url, raw[:160], "static", "", ""))
        if len(rows) >= 150:
            break
    return rows, f"static:{len(rows)}"


def detect_widget(html):
    for kind, pat in WIDGET_SIGNS:
        if re.search(pat, html, re.I):
            return kind
    return None


# ---- main ------------------------------------------------------------------

REFRESH = False


def candidate_pages():
    """(producer_slug, page_url, field) for each detected candidate page."""
    with open(IN, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            url = (r.get("candidate_page_url") or "").strip()
            if not url:
                continue
            field = "sourced_from" if REVERSE_RE.search(r.get("link_text", "")) else "supplies_to"
            yield r["producer_slug"], url, field


def main():
    global REFRESH
    argv = sys.argv[1:]
    REFRESH = "--refresh" in argv
    only = None
    if "--slugs" in argv:
        only = {s.strip() for s in argv[argv.index("--slugs") + 1].split(",") if s.strip()}

    if not os.path.exists(IN):
        print(f"Missing {os.path.relpath(IN, ROOT)} - run stockist_scan.py first.")
        return

    pages = [p for p in candidate_pages() if only is None or p[0] in only]
    all_rows = []
    print(f"Extracting from {len(pages)} candidate page(s):")
    for slug, url, field in pages:
        status, html = ss.homepage_html(f"page-{slug}", url, REFRESH)
        if not html:
            print(f"  {slug:<34} {field:<12} fetch={status}")
            continue
        mm = MYMAPS_RE.search(html)
        if mm:
            rows, note = from_kml(slug, mm.group(1), field)
        elif (kind := detect_widget(html)):
            rows, note = [], f"widget:{kind}"
        else:
            rows, note = from_static(slug, url, html, field)
        all_rows.extend(rows)
        print(f"  {slug:<34} {field:<12} {note}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(all_rows)
    print(f"\nWrote {os.path.relpath(OUT, ROOT)}  ({len(all_rows)} candidate edge(s))")
    print("Next: ruby scripts/candidate_edges.rb")


if __name__ == "__main__":
    main()
