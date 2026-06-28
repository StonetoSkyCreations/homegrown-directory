#!/usr/bin/env ruby
# frozen_string_literal: true

# Bulk harvest importer (see HARVEST.md). Reads a reviewed staging CSV (the shared
# data/imports header), skips rows that already match an existing listing, and for
# each NEW row shells out to add_listing.rb (reusing its tag canonicalisation,
# slug de-dup, geocoding, front-matter construction and validation). Optionally
# wires ONE hub relationship per row and records edge evidence in
# _data/relationship_evidence.yml, then runs reciprocate + validate.
#
# Never use the LLM for this; it is a deterministic parser/orchestrator.
#
# Usage:
#   ruby scripts/harvest_import.rb --csv data/imports/FILE.csv --collection vendors \
#     --hub otago-farmers-market-dunedin --hub-field supplies_to \
#     --evidence-url https://otagofarmersmarket.org.nz/vendors \
#     --evidence-snippet "Listed as a stallholder at the Otago Farmers Market" \
#     --confidence medium [--geocode] [--country-slug new-zealand] [--dry-run]

require "csv"
require "yaml"
require "date"
require "optparse"
require_relative "harvest_lib"

ROOT = Harvest::ROOT
LEDGER = File.join(ROOT, "_data", "relationship_evidence.yml")
ADD = File.join(ROOT, "scripts", "add_listing.rb")
COLLECTION_FROM_TYPE = {
  "farm" => "farms", "market" => "markets", "store" => "stores", "grocer" => "stores",
  "shop" => "stores", "restaurant" => "restaurants", "cafe" => "restaurants",
  "eatery" => "restaurants", "vendor" => "vendors", "distributor" => "distributors"
}.freeze

def norm_list(value)
  value.to_s.split(/[;,]/).map(&:strip).reject(&:empty?).join(",")
end

def load_ledger
  return {} unless File.exist?(LEDGER)

  YAML.safe_load(File.read(LEDGER), permitted_classes: [Date, Time]) || {}
end

def save_ledger(ledger)
  header = +"# Relationship evidence ledger for the harvest pipeline. See HARVEST.md.\n" \
           "# Key: \"<from-slug>|<field>|<to-slug>\"; value: list of " \
           "{source_url, snippet, date, confidence}.\n" \
           "# A relationship is evidenced if the ledger has an entry for the pair in " \
           "either direction.\n"
  File.write(LEDGER, header + YAML.dump(ledger))
end

def add_evidence(ledger, from, field, to, opt)
  key = "#{from}|#{field}|#{to}"
  (ledger[key] ||= []) << {
    "source_url" => opt[:ev_url].to_s,
    "snippet" => opt[:ev_snip].to_s,
    "date" => Date.today.to_s,
    "confidence" => opt[:confidence]
  }
end

def set_discovery_status(path, status = "scaffolded")
  lines = File.readlines(path)
  return if lines.any? { |l| l.start_with?("discovery_status:") }

  seen = 0
  idx = nil
  lines.each_with_index do |l, i|
    next unless l.strip == "---"

    seen += 1
    (idx = i) && break if seen == 2
  end
  return unless idx

  lines.insert(idx, "discovery_status: #{status}\n")
  File.write(path, lines.join)
end

opt = { country_slug: "new-zealand", hub_field: "supplies_to", confidence: "medium" }
OptionParser.new do |o|
  o.banner = "Usage: ruby scripts/harvest_import.rb --csv FILE [options]"
  o.on("--csv PATH", "Reviewed staging CSV (shared header)") { |v| opt[:csv] = v }
  o.on("--collection C", "Force collection (else inferred from row 'type')") { |v| opt[:collection] = v }
  o.on("--hub SLUG", "Existing listing every new row links to") { |v| opt[:hub] = v }
  o.on("--hub-field F", %w[supplies_to sourced_from], "New listing's field toward the hub (default supplies_to)") { |v| opt[:hub_field] = v }
  o.on("--evidence-url URL", "Evidence source URL for the hub edge") { |v| opt[:ev_url] = v }
  o.on("--evidence-snippet T", "Evidence snippet for the hub edge") { |v| opt[:ev_snip] = v }
  o.on("--confidence L", %w[high medium low], "Edge confidence (default medium)") { |v| opt[:confidence] = v }
  o.on("--country-slug S", "Country slug (default new-zealand)") { |v| opt[:country_slug] = v }
  o.on("--geocode", "Geocode via Nominatim (1 req/sec)") { opt[:geocode] = true }
  o.on("--dry-run", "Preview, write nothing") { opt[:dry] = true }
  o.on("-h", "--help") { puts o; exit 0 }
end.parse!(ARGV)
abort "need --csv FILE" unless opt[:csv]
abort "Not found: #{opt[:csv]}" unless File.exist?(opt[:csv])

rows = CSV.read(opt[:csv], headers: true)
listings = Harvest.load_listings
hub = opt[:hub]
abort "hub slug '#{hub}' not found among existing listings" if hub && listings.none? { |l| l[:slug] == hub }

ledger = opt[:dry] ? {} : load_ledger
imported = []
skipped = []
ambiguous = []

rows.each do |r|
  name = r["name"].to_s.strip
  next if name.empty?

  status, slug, why = Harvest.match(name, r["website"], listings)
  if status == :existing
    skipped << "#{name} (= #{slug}, #{why})"
    next
  elsif status == :ambiguous
    ambiguous << "#{name} (~ #{slug})"
    next
  end

  coll = opt[:collection] || COLLECTION_FROM_TYPE[r["type"].to_s.downcase.strip] || "vendors"
  cmd = ["ruby", ADD, "--collection", coll, "--name", name,
         "--country-slug", opt[:country_slug], "--no-validate"]
  { "--region" => "region", "--city" => "city_town", "--address" => "address",
    "--website" => "website", "--email" => "email", "--phone" => "phone",
    "--description" => "description" }.each do |flag, col|
    cmd += [flag, r[col]] if r[col].to_s.strip != ""
  end
  { "--products" => "products", "--practice-tags" => "practices_tags",
    "--certifications" => "certifications", "--source-urls" => "source_urls" }.each do |flag, col|
    val = norm_list(r[col])
    cmd += [flag, val] unless val.empty?
  end
  cmd += ["--geocode"] if opt[:geocode]
  if hub
    cmd += (opt[:hub_field] == "supplies_to" ? ["--supplies-to", hub] : ["--sourced-from", hub])
  end
  cmd += ["--dry-run"] if opt[:dry]

  out = IO.popen(cmd, &:read)
  success = $?.success?

  if opt[:dry]
    puts "would import: #{name}  ->  _#{coll}/#{Harvest.slugify(name)}.md" \
         "#{hub ? "  (#{opt[:hub_field]} #{hub})" : ''}"
    imported << name
    next
  end

  unless success
    warn "  add_listing failed for #{name}"
    next
  end

  written = out[%r{Wrote _[a-z]+/(\S+)\.md}, 1]
  unless written
    warn "  could not determine written slug for #{name}"
    next
  end
  set_discovery_status(File.join(ROOT, "_#{coll}", "#{written}.md"))
  add_evidence(ledger, written, opt[:hub_field], hub, opt) if hub
  imported << written
  sleep 1 if opt[:geocode] # Nominatim courtesy (1 req/sec)
end

puts "\n#{opt[:dry] ? 'DRY RUN: ' : ''}imported #{imported.size}, skipped #{skipped.size} existing, #{ambiguous.size} ambiguous."
skipped.each { |s| puts "  skip:      #{s}" }
ambiguous.each { |a| puts "  ambiguous: #{a}  (review before importing)" }

unless opt[:dry]
  save_ledger(ledger) if hub && imported.any?
  if imported.any?
    puts "\nReciprocating + validating..."
    system("ruby", File.join(ROOT, "scripts", "reciprocate.rb"), "--apply")
    system("ruby", File.join(ROOT, "scripts", "validate_content.rb"))
  end
end
