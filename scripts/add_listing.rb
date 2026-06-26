#!/usr/bin/env ruby
# frozen_string_literal: true

# Streamlined add-a-listing generator.
#
# Creates a validated listing Markdown file under the right collection, scaffolding
# the canonical front matter, coercing tags to the canonical vocabulary in
# _data/taxonomies.yml, optionally geocoding via Nominatim, and then running
# scripts/validate_content.rb so a new listing is correct by construction.
#
# Examples:
#   ruby scripts/add_listing.rb --collection farms --name "River Bend Farm" \
#     --region Canterbury --city Oxford --website riverbend.co.nz \
#     --practice-tags organic,regenerative --subtype market-garden --geocode
#
#   ruby scripts/add_listing.rb --collection stores --name "Good Grocer" \
#     --region Wellington --sourced-from river-bend-farm --dry-run
#
#   ruby scripts/add_listing.rb --collection restaurants --csv data/imports/au-eateries-vic.csv --row 2
#
# Run with --help for all options.

require "yaml"
require "json"
require "date"
require "set"
require "optparse"
require "csv"
require "net/http"
require "uri"

ROOT = File.expand_path("..", __dir__)
COLLECTION_DIRS = %w[farms markets stores restaurants vendors distributors].freeze
LAYOUT_BY_COLLECTION = {
  "farms" => "farm",
  "markets" => "listing",
  "stores" => "store",
  "restaurants" => "listing",
  "vendors" => "vendor",
  "distributors" => "listing"
}.freeze

def load_yaml(path)
  YAML.safe_load(File.read(path), permitted_classes: [Date, Time], aliases: true) || {}
end

TAXONOMIES = load_yaml(File.join(ROOT, "_data", "taxonomies.yml"))
GEOGRAPHY = load_yaml(File.join(ROOT, "_data", "geography.yml")).fetch("countries")
SUBTYPE_TOKENS = TAXONOMIES.fetch("subtype_tokens", []).map(&:to_s)
PRACTICE_TOKENS = TAXONOMIES.fetch("practice_tokens", []).map(&:to_s)

def slugify(text)
  text.to_s.downcase.strip
      .gsub(/['’"]/, "")
      .gsub(/[^a-z0-9]+/, "-")
      .gsub(/\A-+|-+\z/, "")
end

# Every slug already in use, across all collections (mirrors validate_content.rb).
def existing_slugs
  slugs = {}
  COLLECTION_DIRS.each do |dir|
    Dir.glob(File.join(ROOT, "_#{dir}", "*.md")).each do |path|
      next if File.basename(path).start_with?("_template")

      front = front_matter(path)
      slug = front && front["slug"].to_s.strip
      slugs[slug] = path if slug && !slug.empty?
    end
  end
  slugs
end

def front_matter(path)
  raw = File.read(path)
  return nil unless raw.start_with?("---")

  parts = raw.split(/^---\s*\n/, 3)
  return nil if parts.size < 3

  YAML.safe_load(parts[1], permitted_classes: [Date, Time], aliases: true)
rescue Psych::Exception
  nil
end

# Resolve a region passed as either a canonical name or a slug to the canonical name.
def resolve_region(input, country_slug)
  return nil if input.to_s.strip.empty?

  country = GEOGRAPHY[country_slug]
  return input unless country

  regions = country.fetch("regions", [])
  by_slug = regions.find { |r| r["slug"].to_s.casecmp?(input.to_s.strip) }
  return by_slug["name"] if by_slug

  by_name = regions.find { |r| r["name"].to_s.casecmp?(input.to_s.strip) }
  return by_name["name"] if by_name

  warn "  warning: region '#{input}' is not a known #{country_slug} region (writing as-is)"
  input
end

def normalise_website(url)
  return nil if url.to_s.strip.empty?

  url = url.strip
  url.include?("://") ? url : "https://#{url}"
end

def split_list(value)
  Array(value).flat_map { |v| v.to_s.split(",") }.map(&:strip).reject(&:empty?)
end

def canonicalise(tokens, allowed, label)
  tokens.map do |t|
    slug = slugify(t)
    unless allowed.include?(slug)
      warn "  warning: #{label} '#{t}' is not a canonical token (#{allowed.join(', ')})"
    end
    slug
  end
end

def geocode(query, country_slug)
  cc = country_slug == "new-zealand" ? "nz" : nil
  uri = URI("https://nominatim.openstreetmap.org/search")
  params = { q: query, format: "json", limit: 1 }
  params[:countrycodes] = cc if cc
  uri.query = URI.encode_www_form(params)

  req = Net::HTTP::Get.new(uri)
  req["User-Agent"] = "homegrown-directory-add-listing/1.0 (josh@stonetosky.nz)"
  res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) do |http|
    http.request(req)
  end
  return nil unless res.is_a?(Net::HTTPSuccess)

  data = JSON.parse(res.body)
  return nil if data.empty?

  [data[0]["lat"].to_f.round(6), data[0]["lon"].to_f.round(6)]
rescue StandardError => e
  warn "  geocode failed: #{e.message}"
  nil
end

# ---- Options ---------------------------------------------------------------

options = { country_slug: "new-zealand" }
parser = OptionParser.new do |o|
  o.banner = "Usage: ruby scripts/add_listing.rb --collection COLLECTION --name NAME [options]"
  o.on("--collection C", COLLECTION_DIRS, "Collection: #{COLLECTION_DIRS.join(', ')}") { |v| options[:collection] = v }
  o.on("--name NAME", "Listing name (becomes title)") { |v| options[:name] = v }
  o.on("--slug SLUG", "Override slug (default: slugified name)") { |v| options[:slug] = v }
  o.on("--country-slug SLUG", "Country slug (default: new-zealand)") { |v| options[:country_slug] = v }
  o.on("--region R", "Region name or slug") { |v| options[:region] = v }
  o.on("--city CITY") { |v| options[:city] = v }
  o.on("--address ADDR") { |v| options[:address] = v }
  o.on("--website URL") { |v| options[:website] = v }
  o.on("--email EMAIL") { |v| options[:email] = v }
  o.on("--phone PHONE") { |v| options[:phone] = v }
  o.on("--description TEXT", "One-sentence description for cards/SEO") { |v| options[:description] = v }
  o.on("--long-description TEXT", "Full body paragraph(s)") { |v| options[:long_description] = v }
  o.on("--subtype TOKEN", "Farm subtype: #{SUBTYPE_TOKENS.join(', ')}") { |v| options[:subtype] = v }
  o.on("--practices LIST", "Display practice labels, comma-separated") { |v| options[:practices] = v }
  o.on("--practice-tags LIST", "Canonical practice tokens, comma-separated") { |v| options[:practice_tags] = v }
  o.on("--products LIST", "Comma-separated") { |v| options[:products] = v }
  o.on("--services LIST", "Comma-separated") { |v| options[:services] = v }
  o.on("--certifications LIST", "Comma-separated") { |v| options[:certifications] = v }
  o.on("--sourced-from LIST", "Slugs this listing buys from, comma-separated") { |v| options[:sourced_from] = v }
  o.on("--supplies-to LIST", "Slugs this listing supplies, comma-separated") { |v| options[:supplies_to] = v }
  o.on("--source-urls LIST", "Provenance URLs, comma-separated") { |v| options[:source_urls] = v }
  o.on("--geocode", "Look up lat/lon via Nominatim (1 req/sec policy)") { options[:geocode] = true }
  o.on("--csv PATH", "Read defaults from a staging CSV row") { |v| options[:csv] = v }
  o.on("--row N", Integer, "1-indexed data row in --csv (default 1)") { |v| options[:row] = v }
  o.on("--force", "Overwrite if the file already exists") { options[:force] = true }
  o.on("--dry-run", "Print the file instead of writing it") { options[:dry_run] = true }
  o.on("--no-validate", "Skip running validate_content.rb") { options[:no_validate] = true }
  o.on("-h", "--help") { puts o; exit 0 }
end
parser.parse!(ARGV)

# ---- CSV row defaults (CLI flags override) ---------------------------------

if options[:csv]
  rows = CSV.read(options[:csv], headers: true)
  idx = (options[:row] || 1) - 1
  row = rows[idx] or abort "No row #{options[:row] || 1} in #{options[:csv]} (#{rows.size} rows)"
  map = {
    name: "name", description: "description", address: "address", city: "city_town",
    region: "region", phone: "phone", email: "email", website: "website",
    products: "products", practice_tags: "practices_tags", certifications: "certifications",
    source_urls: "source_urls"
  }
  map.each { |opt, col| options[opt] ||= row[col] if row[col].to_s.strip != "" }
  if options[:collection].nil? && row["type"]
    t = row["type"].to_s.downcase
    options[:collection] = COLLECTION_DIRS.find { |c| c.start_with?(t) || t.start_with?(c.chomp("s")) }
  end
  options[:lat] ||= row["lat"] if row["lat"].to_s.strip != ""
  options[:lon] ||= row["lon"] if row["lon"].to_s.strip != ""
end

abort parser.help unless options[:collection] && options[:name]

# ---- Build front matter ----------------------------------------------------

collection = options[:collection]
country_slug = options[:country_slug]
country_label = (GEOGRAPHY[country_slug] && GEOGRAPHY[country_slug]["label"]) || country_slug

slug = options[:slug] ? slugify(options[:slug]) : slugify(options[:name])
taken = existing_slugs
if taken.key?(slug) && !options[:force]
  suffix = slugify(options[:city].to_s)
  candidate = suffix.empty? ? slug : "#{slug}-#{suffix}"
  candidate = "#{slug}-2" if candidate == slug || taken.key?(candidate)
  warn "  slug '#{slug}' already used by #{taken[slug].sub("#{ROOT}/", '')}; using '#{candidate}'"
  slug = candidate
end

region = resolve_region(options[:region], country_slug)
warn "  warning: no region given (validate_content.rb requires it)" if region.to_s.strip.empty?

sourced_from = split_list(options[:sourced_from])
supplies_to = split_list(options[:supplies_to])
[["sourced_from", sourced_from], ["supplies_to", supplies_to]].each do |field, list|
  list.each { |s| warn "  warning: #{field} '#{s}' does not resolve to an existing slug" unless taken.key?(s) }
end

practice_tags = canonicalise(split_list(options[:practice_tags]), PRACTICE_TOKENS, "practice tag")
subtype = nil
if collection == "farms"
  subtype = options[:subtype] ? slugify(options[:subtype]) : "mixed"
  warn "  warning: subtype '#{subtype}' is not canonical" unless SUBTYPE_TOKENS.include?(subtype)
end

lat = options[:lat]&.to_f
lon = options[:lon]&.to_f
if options[:geocode] && (lat.nil? || lon.nil?)
  query = [options[:address], options[:city], region, country_label].compact.reject(&:empty?).join(", ")
  if (coords = geocode(query, country_slug))
    lat, lon = coords
    puts "  geocoded -> #{lat}, #{lon}"
  end
end

fm = {}
fm["layout"] = LAYOUT_BY_COLLECTION[collection]
fm["title"] = options[:name]
fm["slug"] = slug
fm["country_slug"] = country_slug
fm["country"] = country_label
fm["region"] = region.to_s
fm["city"] = options[:city] if options[:city]
fm["address"] = options[:address] if options[:address]
fm["website"] = normalise_website(options[:website]) if options[:website]
fm["email"] = options[:email] if options[:email]
fm["phone"] = options[:phone] if options[:phone]
fm["description"] = options[:description] if options[:description]
fm["long_description"] = options[:long_description] if options[:long_description]
fm["subtype"] = subtype if subtype
fm["practices"] = split_list(options[:practices])
fm["products"] = split_list(options[:products])
fm["services"] = split_list(options[:services])
fm["practices_tags"] = practice_tags
fm["products_tags"] = []
fm["services_tags"] = []
fm["certifications"] = split_list(options[:certifications])
fm["specialty_tags"] = []
fm["source_urls"] = split_list(options[:source_urls])
fm["sourced_from"] = sourced_from
fm["supplies_to"] = supplies_to
fm["relationships_declared"] = !(sourced_from.empty? && supplies_to.empty?)
if lat && lon
  fm["lat"] = lat
  fm["lon"] = lon
end
fm["last_checked"] = Date.today.to_s

yaml = YAML.dump(fm, line_width: -1).sub(/\A---\s*\n/, "").sub(/\n\.\.\.\s*\n?\z/, "\n")
body = options[:long_description] ? "" : "\nWrite a short paragraph about #{options[:name]}, how it grows or operates, and how people can connect.\n"
content = +"---\n#{yaml}---\n#{body}"

target = File.join(ROOT, "_#{collection}", "#{slug}.md")

if options[:dry_run]
  puts "\n# would write #{target.sub("#{ROOT}/", '')}\n\n"
  puts content
  exit 0
end

abort "Refusing to overwrite #{target} (use --force)" if File.exist?(target) && !options[:force]

File.write(target, content)
puts "Wrote #{target.sub("#{ROOT}/", '')}"

unless options[:no_validate]
  puts "\nRunning validate_content.rb ..."
  system("ruby", File.join(ROOT, "scripts", "validate_content.rb")) || abort("Validation failed - fix the new listing.")
end
