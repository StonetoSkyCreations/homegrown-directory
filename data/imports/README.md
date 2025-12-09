# Import staging files

Working copies of external listing data, kept out of the live site content:

- `au-eateries-vic.csv` — AU eateries (VIC-focused), with full CSV headers used by the form importer.
- `au-eateries-nsw-qld.csv` — AU eateries (NSW/QLD).
- `au-grocers-markets-vic.csv` — AU grocers/markets (VIC-focused).
- `nz-stores-list.txt` — quick NZ store list for triage (name, city/region, type).
- `nz-missing-data.txt` — checklist of NZ listings missing address/coord/contact fields.

Notes:
- All CSVs share the same header row: `id,name,type,category,description,address,suburb,city_town,region,postcode,lat,lon,phone,email,website,social_links,products,practices_tags,certifications,supply_role,notes,source_urls,last_checked`.
- Files are intentionally left as staging/reference data; they are not pulled into the site build directly. When importing, convert rows to proper Markdown/YAML entries under the relevant collection.
