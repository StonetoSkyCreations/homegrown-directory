# Geocoding toolchain (internal)

This workflow stays local (or CI) and never touches public UI.

## Setup
```bash
pip3 install -r tools/requirements.txt
```

## Step 1: Geocode
Run against the generated `search.json` (local file or URL).
```bash
python3 tools/geocode_nominatim.py --search-json ../search.json --output tools/geocode_results.csv
```
- Respects Nominatim rate limits (1 rps) with retries.
- Outputs `tools/geocode_results.csv` with a confidence bucket and notes.
- Summary prints to stdout.

## Step 2: Review
- Open `tools/geocode_results.csv` and filter to `confidence_bucket` high/medium.
- Use the geo audit page (/geo-audit/) to cross-check queues if needed.

## Step 3: Apply
Apply only high/medium rows; backups + log are created automatically.
```bash
python3 tools/apply_geocode.py --results tools/geocode_results.csv
```
- Add `--overwrite` to replace existing valid coords (default skips valid).
- Backups land in `tools/backup/`; log at `tools/apply_geocode_log.txt`.

## Restore
Copy files back from `tools/backup/` to their original locations if needed.
