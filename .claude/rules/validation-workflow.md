---
paths:
  - "scripts/**"
  - "tools/**"
  - ".github/workflows/**"
  - "_config.yml"
  - "Gemfile"
---

# Validation and tooling rules

- The gate (all five, in order, before every commit):
  ```bash
  eval "$(rbenv init - zsh)"
  ruby scripts/validate_content.rb
  python3 scripts/check_layouts.py
  bundle exec jekyll build
  python3 scripts/seo_lint.py
  ruby scripts/relationship_audit.rb
  ```
  CI mirrors this in `.github/workflows/seo-lint.yml`. If you strengthen a check
  locally, keep CI in sync in the same commit.
- Never weaken a validation check to make data pass. Fix the data, or if the
  check is genuinely wrong, change it in its own commit with the reasoning.
- `scripts/normalise_*.rb` are non-idempotent (a re-run rewrites ~90 files by
  re-inferring tags). Run only deliberately, alone, with a clean git tree.
- Harvest scripts (`scripts/harvesters/`, `harvest_import.rb`) follow
  `HARVEST.md`: robots.txt honoured, ~1 req/s, raw fetches cached under
  `data/harvest/cache/`, LLM reviews ambiguity only — never bulk-extracts.
- Geocoding goes through `tools/` (Nominatim → review CSV → `apply_geocode.py`,
  which writes backups). Don't hand-edit coordinates in bulk.
- `_config.yml` `exclude:` keeps internal docs (README, ROADMAP, SOURCING_PLAN,
  SEO_DOCTRINE, HARVEST, CLAUDE.md, AUDIT_MASTER_PLAN.md, scripts, tools, data,
  reports, archive, _backups) out of the published site. New internal files must
  be added to that list.
- Ruby is 3.2.0 via rbenv (`eval "$(rbenv init - zsh)"` first); gems live in
  project-local `vendor/bundle`. Python scripts are stdlib + requirements in
  `tools/requirements.txt` only.
