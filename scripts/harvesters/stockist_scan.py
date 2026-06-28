#!/usr/bin/env python3
"""Harvester (detect-only): find producers' "where to buy / stockists" pages.

Step 1 of the web-scan harvest loop (see HARVEST.md / SOURCING_PLAN.md). Reads the
listing collections, selects the NZ producers that have a website but no outlets
linked yet (the same "unmined producers with a website" set hub_report.rb prints),
fetches each homepage politely, and detects links that look like a stockist /
where-to-buy / suppliers page.

This pass is DETECT ONLY: it does not extract business names, follow the candidate
pages, or write anything to the site. It only fetches each producer homepage and
reports the candidate hub-page URLs it found, so we can see how many producers even
have such a page before investing in name extraction (the next task).

Politeness: honours robots.txt, sends a descriptive User-Agent, rate-limits to about
one request per second, and caches raw homepage HTML under the gitignored
data/harvest/cache/ so re-runs are free (no network unless --refresh).

Output: data/harvest/stockist-candidates.csv with columns
  producer_slug, homepage, candidate_page_url, link_text, http_status
One row per candidate; producers with no candidate (or a failed fetch) get a single
row with empty candidate fields and the status in http_status.

Usage:
  python3 scripts/harvesters/stockist_scan.py            # top 20 unmined producers
  python3 scripts/harvesters/stockist_scan.py --top 40   # change the cut-off
  python3 scripts/harvesters/stockist_scan.py --all      # every unmined producer
  python3 scripts/harvesters/stockist_scan.py --slugs biofarm,bostock-new-zealand
  python3 scripts/harvesters/stockist_scan.py --refresh  # ignore the cache, re-fetch
"""
import sys, os, re, csv, time, glob
import urllib.request, urllib.error, urllib.parse
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Supply side, same as hub_report.rb FORWARD. These are the listings whose own
# site is likely to carry a "where to buy / stockists" page.
FORWARD = ["farms", "vendors", "distributors"]
NZ = "new-zealand"
CACHE_DIR = os.path.join(ROOT, "data/harvest/cache/stockist")
OUT = os.path.join(ROOT, "data/harvest/stockist-candidates.csv")
HEADER = ["producer_slug", "homepage", "candidate_page_url", "link_text", "http_status"]

UA = ("HomegrownDirectoryBot/0.1 (+https://homegrowndirectory.com; "
      "organic food relationship harvest; contact josh@stonetosky.nz)")
TIMEOUT = 20
MAX_BYTES = 2_000_000      # cap on homepage read
MAX_CANDIDATES = 6         # most informative few per producer
RATE_SECONDS = 1.0         # >= 1 request/second

# The producer queue is produce-first: drinks brands (wine, cider, beer, coffee)
# and pure eateries (cafes, food trucks) are out of scope for the forward harvest
# (see the sourcing-focus memory). We match these on the listing's slug, title and
# subtype only, never its products, so a produce grower that happens to sell e.g.
# apple cider vinegar is kept.
EXCLUDE_SUBTYPES = {
    "vineyard", "winery", "wines", "brewery", "distillery", "cidery",
    "food-truck", "cafe", "café", "coffee-roaster", "roastery",
    "restaurant", "eatery", "bistro", "bar",
}
EXCLUDE_KEYWORD_RE = re.compile(
    r"\b(wine|wines|winery|wineries|vineyard|cider|cidery|brewery|brewing|"
    r"beer|distillery|coffee|roaster|roastery|cafe|café|restaurant|"
    r"eatery|eateries|bistro)\b", re.I)

# A link is a candidate when its href slug or visible text matches one of these.
# Forward (producer -> outlet): where to buy / stockists / find a store.
# Reverse (grocer / distributor -> producer): our producers / suppliers.
PATTERNS = [
    r"where[\s\-]?to[\s\-]?buy",
    r"\bstockist", r"\bretailer", r"\bresellers?\b",
    r"find[\s\-]?(?:us|a[\s\-]?store|a[\s\-]?stockist|in[\s\-]?store)",
    r"store[\s\-]?(?:locator|finder|list)", r"\bwhere[\s\-]?to[\s\-]?find",
    r"our[\s\-]?(?:producers?|growers?|farmers?|suppliers?|makers?)",
    r"meet[\s\-]?(?:the|our)[\s\-]?(?:producers?|growers?|farmers?|makers?|suppliers?)",
    r"\bsuppliers?\b", r"\bour[\s\-]?partners?\b",
]
PATTERN_RE = re.compile("|".join(PATTERNS), re.I)

# Never treat these as candidates even if a pattern grazes them.
SKIP_HREF = re.compile(r"^(mailto:|tel:|javascript:|#)", re.I)


# ---- front matter (minimal, stdlib only) -----------------------------------

def read_front_matter(path):
    """Return {slug, website, country_slug, has_supplies} from a listing file.

    Light line parser: we only need three scalars and whether supplies_to has any
    items, so we avoid a YAML dependency (mirrors add_listing.rb's field handling).
    """
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if not text.startswith("---"):
        return None
    parts = re.split(r"^---\s*$", text, maxsplit=2, flags=re.M)
    if len(parts) < 3:
        return None
    lines = parts[1].splitlines()
    out = {"slug": "", "website": "", "country_slug": "", "subtype": "",
           "title": "", "name": "", "has_supplies": False}

    def scalar(v):
        v = v.strip()
        if len(v) >= 2 and v[0] in "\"'" and v[-1] == v[0]:
            v = v[1:-1]
        return v.strip()

    for i, line in enumerate(lines):
        m = re.match(r"^(slug|website|country_slug|subtype|title|name):(.*)$", line)
        if m and out.get(m.group(1)) == "":
            out[m.group(1)] = scalar(m.group(2))
            continue
        m = re.match(r"^supplies_to:(.*)$", line)
        if m:
            inline = m.group(1).strip()
            if inline and inline != "[]":
                out["has_supplies"] = True
            else:
                for nxt in lines[i + 1:]:
                    if re.match(r"^\s*-\s+\S", nxt):
                        out["has_supplies"] = True
                        break
                    if re.match(r"^\S", nxt):
                        break
    return out


def is_drinks_or_eatery(fm):
    if fm["subtype"].strip().lower() in EXCLUDE_SUBTYPES:
        return True
    hay = " ".join([fm["slug"].replace("-", " "), fm["title"], fm["name"]])
    return bool(EXCLUDE_KEYWORD_RE.search(hay))


def unmined_producers(include_all=False):
    """NZ FORWARD listings with a website and no supplies_to, sorted by slug.

    Returns (rows, excluded). Drinks brands and pure eateries are dropped from the
    produce-first queue unless include_all is set.
    """
    rows = []
    excluded = 0
    for coll in FORWARD:
        for path in sorted(glob.glob(os.path.join(ROOT, f"_{coll}", "*.md"))):
            if os.path.basename(path).startswith("_template"):
                continue
            fm = read_front_matter(path)
            if not fm or not fm["slug"]:
                continue
            if fm["country_slug"] != NZ:
                continue
            if not fm["website"] or fm["has_supplies"]:
                continue
            if not include_all and is_drinks_or_eatery(fm):
                excluded += 1
                continue
            rows.append((fm["slug"], fm["website"]))
    rows.sort(key=lambda r: r[0])
    return rows, excluded


# ---- polite fetch ----------------------------------------------------------

_last_request = [0.0]
_robots_cache = {}  # base_url -> [(path_pattern, is_allow), ...] for our group


def throttle():
    wait = RATE_SECONDS - (time.time() - _last_request[0])
    if wait > 0:
        time.sleep(wait)
    _last_request[0] = time.time()


def normalise_url(url):
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url.lstrip("/")
    return url


UA_TOKEN = "homegrowndirectorybot"


def _fetch_robots(base):
    throttle()
    try:
        req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return ""
            return resp.read(500_000).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _rules_for_us(txt):
    """Allow/Disallow rules from the group matching our UA token, else the * group.

    Python's urllib.robotparser applies the first matching rule in file order, which
    breaks Allow-overrides-Disallow (it false-blocks e.g. Google's `Allow: /maps/d/`
    under `Disallow: /maps/`). We instead keep both groups and apply longest-match
    with allow-wins-on-tie at check time, per the robots standard.
    """
    star, mine, cur_uas, pending = [], [], [], []

    def flush():
        for ua in cur_uas:
            u = ua.lower()
            if u == "*":
                star.extend(pending)
            elif UA_TOKEN.startswith(u):
                mine.extend(pending)
        pending.clear()

    for raw in txt.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        key, _, val = line.partition(":")
        key, val = key.strip().lower(), val.strip()
        if key == "user-agent":
            if pending:          # rules already seen -> previous group ends here
                flush()
                cur_uas = []
            cur_uas.append(val)
        elif key in ("allow", "disallow") and cur_uas and val:
            pending.append((val, key == "allow"))
    if pending:
        flush()
    return mine if mine else star


def _pattern_matches(pattern, path):
    rx = re.escape(pattern).replace(r"\*", ".*")
    if rx.endswith(r"\$"):
        rx = rx[:-2] + "$"
    return re.match(rx, path) is not None


def robots_ok(url):
    p = urllib.parse.urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots_cache:
        _robots_cache[base] = _rules_for_us(_fetch_robots(base))
    path = p.path or "/"
    if p.query:
        path += "?" + p.query
    best_len, best_allow = -1, True   # no matching rule => allowed
    for pattern, is_allow in _robots_cache[base]:
        if _pattern_matches(pattern, path) and (
                len(pattern) > best_len or (len(pattern) == best_len and is_allow)):
            best_len, best_allow = len(pattern), is_allow
    return best_allow


def fetch(url):
    """Return (status, html). status is 'cached', an int code as str, or an error."""
    throttle()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read(MAX_BYTES)
            charset = resp.headers.get_content_charset() or "utf-8"
            return str(resp.status), raw.decode(charset, errors="replace")
    except urllib.error.HTTPError as e:
        return f"http-{e.code}", ""
    except urllib.error.URLError as e:
        return f"error-{re.sub(r'[^a-z0-9]+', '-', str(e.reason).lower())[:30].strip('-')}", ""
    except Exception as e:
        return f"error-{type(e).__name__.lower()}", ""


def homepage_html(slug, url, refresh):
    cache = os.path.join(CACHE_DIR, f"{slug}.html")
    if not refresh and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return "cached", f.read()
    if not robots_ok(url):
        return "robots-blocked", ""
    status, html = fetch(url)
    if html:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cache, "w", encoding="utf-8") as f:
            f.write(html)
    return status, html


# ---- link detection --------------------------------------------------------

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            text = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append((self._href, text))
            self._href = None
            self._text = []


def candidates(base_url, html):
    parser = LinkParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    seen = set()
    out = []
    for href, text in parser.links:
        if not href or SKIP_HREF.match(href.strip()):
            continue
        # Match on the href path or the visible link text.
        hay = f"{href} {text}"
        if not PATTERN_RE.search(hay):
            continue
        abs_url = urllib.parse.urljoin(base_url, href.strip())
        abs_url = abs_url.split("#")[0]
        key = abs_url.lower().rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        out.append((abs_url, text[:80]))
        if len(out) >= MAX_CANDIDATES:
            break
    return out


# ---- main ------------------------------------------------------------------

def main():
    argv = sys.argv[1:]
    refresh = "--refresh" in argv
    scan_all = "--all" in argv
    include_all = "--include-all" in argv
    top = 20
    if "--top" in argv:
        top = int(argv[argv.index("--top") + 1])
    only = None
    if "--slugs" in argv:
        only = {s.strip() for s in argv[argv.index("--slugs") + 1].split(",") if s.strip()}

    producers, excluded = unmined_producers(include_all=include_all)
    if only is not None:
        producers = [p for p in producers if p[0] in only]
    elif not scan_all:
        producers = producers[:top]

    if excluded and only is None:
        print(f"Excluded {excluded} drinks/eatery listing(s) from the produce-first "
              f"queue (use --include-all to keep them).")

    if not producers:
        print("No producers matched the selection.")
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    rows = []
    n_ok = n_with = n_cands = 0
    for i, (slug, website) in enumerate(producers, 1):
        homepage = normalise_url(website)
        status, html = homepage_html(slug, homepage, refresh)
        cands = candidates(homepage, html) if html else []
        if status in ("cached",) or status.isdigit():
            n_ok += 1
        if cands:
            n_with += 1
            n_cands += len(cands)
            for url, text in cands:
                rows.append([slug, homepage, url, text, status])
        else:
            rows.append([slug, homepage, "", "", status])
        print(f"  [{i}/{len(producers)}] {slug:<38} {status:<14} {len(cands)} candidate(s)")

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)

    print(f"\nWrote {os.path.relpath(OUT, ROOT)}")
    print(f"  producers scanned: {len(producers)}   fetched ok: {n_ok}   "
          f"with >=1 candidate: {n_with}   total candidates: {n_cands}")


if __name__ == "__main__":
    main()
