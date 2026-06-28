#!/usr/bin/env python3
"""Harvester: AsureQuality certified organic register (XLSX) -> staging CSV.

Parses the AsureQuality "Certified Operators & Products" workbook with the Python
standard library only (no openpyxl). Reads the "Primary Producers" and "Processors
and Handlers" sheets, keeps NZ Active operators, dedupes to one row per operator
(aggregating multi-site / multi-scope rows), and writes the shared data/imports
staging header. Certification is recorded as "AsureQuality Organic".

Region is taken from the address tail only when it matches a known NZ region;
otherwise left blank (the importer / a later geocode pass resolves it). This file
is a node source only: it carries no relationships.

Usage:
  python3 scripts/harvesters/asurequality.py [data/harvest/cache/asurequality.xlsx]
"""
import sys, os, re, csv, zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data/harvest/cache/asurequality.xlsx")
OUT = os.path.join(ROOT, "data/imports/asurequality.csv")
SOURCE_URL = "https://www.asurequality.com"

# Must mirror _data/geography.yml new-zealand region names.
REGIONS = {
    "Auckland", "Bay of Plenty", "Canterbury", "Central Otago", "Chatham Islands",
    "Coromandel", "Gisborne", "Hauraki Plains", "Hawke's Bay", "Manawatū-Whanganui",
    "Marlborough", "Mid Canterbury", "Nelson", "Northland", "Otago", "Southland",
    "Taranaki", "Tasman", "Waikato", "Wairarapa", "Wellington", "West Coast",
}
HEADER = ["id","name","type","category","description","address","suburb","city_town",
          "region","postcode","lat","lon","phone","email","website","social_links",
          "products","practices_tags","certifications","supply_role","notes",
          "source_urls","last_checked"]

# Sheet file name is resolved by sheet display name via the workbook rels.
SHEET_TYPE = {"Primary Producers": "Farm", "Processors and Handlers": "Vendor"}


def col_index(ref):
    s = re.match(r"([A-Z]+)\d+", ref).group(1)
    n = 0
    for ch in s:
        n = n * 26 + (ord(ch) - 64)
    return n


def load_shared(z):
    return ["".join(t.text or "" for t in si.iter(f"{NS}t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]


def sheet_files(z):
    """Map sheet display name -> worksheets/sheetN.xml using workbook + rels."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    rid_to_target = {r.get("Id"): r.get("Target")
                     for r in rels if r.get("Type", "").endswith("/worksheet")}
    out = {}
    for s in wb.iter(f"{NS}sheet"):
        rid = s.get(f"{R}id")
        out[s.get("name")] = "xl/" + rid_to_target[rid].lstrip("/")
    return out


def rows_of(z, shared, path):
    sd = ET.fromstring(z.read(path)).find(f"{NS}sheetData")
    for r in sd.findall(f"{NS}row"):
        cells = {}
        for c in r.findall(f"{NS}c"):
            t = c.get("t")
            v = c.find(f"{NS}v")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif v is not None:
                val = v.text
            else:
                val = ""
            cells[col_index(c.get("r"))] = (val or "").strip()
        yield cells


def norm_name(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"\b(the|cafe|café|restaurant|ltd|limited|co|company|organics?|farm|farms|nz|new zealand)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def clean_display(name):
    name = re.split(r"\s+(?:also\s+)?t/as?\b", name, flags=re.I)[0]
    name = re.split(r"\s+t/a\b", name, flags=re.I)[0]
    name = re.sub(r"\s+(ltd|limited)\s*$", "", name, flags=re.I)
    return name.strip().strip(",").strip()


def parse_place(address):
    parts = [p.strip() for p in re.split(r"[,;]", address.split("\n")[0]) if p.strip()]
    parts = [p for p in parts if p.lower() not in ("new zealand", "nz")]
    region = ""
    city = ""
    if parts and parts[-1] in REGIONS:
        region = parts[-1]
        city = parts[-2] if len(parts) >= 2 else ""
    elif parts:
        city = parts[-1]
    city = re.sub(r"\s*\(.*?\)\s*$", "", city).strip()
    city = re.sub(r"^RD\s*\d*\s*", "", city, flags=re.I).strip()
    return region, city


def clean_products(text):
    text = re.sub(r"\s+", " ", text.replace("\n", "; ")).strip(" ;,")
    return text[:160].rstrip(" ;,")


def main():
    z = zipfile.ZipFile(SRC)
    shared = load_shared(z)
    files = sheet_files(z)

    ops = {}  # normname -> record
    order = []
    for sheet_name, sheet_type in SHEET_TYPE.items():
        path = files.get(sheet_name)
        if not path:
            continue
        rows = list(rows_of(z, shared, path))
        header = rows[0]

        def col(substr):
            for k, v in header.items():
                if substr.lower() in (v or "").lower():
                    return k
            return None
        cN, cA, cC = col("operator name"), col("physical address"), col("country")
        cP, cS = col("product list"), col("status")
        for cells in rows[1:]:
            name = cells.get(cN, "")
            if not name:
                continue
            country = cells.get(cC, "")
            if country and country.lower() not in ("new zealand", "nz"):
                continue
            if cS is not None and cells.get(cS, "").lower() not in ("active", ""):
                continue
            key = norm_name(name)
            if not key:
                continue
            if key not in ops:
                region, city = parse_place(cells.get(cA, ""))
                ops[key] = {
                    "name": clean_display(name),
                    "type": sheet_type,
                    "address": cells.get(cA, "").split("\n")[0].strip(),
                    "city": city,
                    "region": region,
                    "products": clean_products(cells.get(cP, "")),
                }
                order.append(key)
            else:
                rec = ops[key]
                if not rec["products"]:
                    rec["products"] = clean_products(cells.get(cP, ""))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for i, key in enumerate(order, 1):
            o = ops[key]
            place = o["city"] or o["region"] or "New Zealand"
            desc = f"Certified-organic producer in {place}." if place != "New Zealand" else "Certified-organic producer in New Zealand."
            w.writerow([
                i, o["name"], o["type"], "Organic certified operator", desc,
                o["address"], "", o["city"], o["region"], "", "", "", "", "", "", "",
                o["products"], "organic", "AsureQuality Organic", "Producer", "",
                SOURCE_URL, "",
            ])

    have_region = sum(1 for k in order if ops[k]["region"])
    print(f"Wrote {OUT}")
    print(f"  operators: {len(order)}  (with a resolved region: {have_region}, without: {len(order) - have_region})")


if __name__ == "__main__":
    main()
