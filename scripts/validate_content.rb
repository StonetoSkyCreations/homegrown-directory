#!/usr/bin/env ruby

require "date"
require "set"
require "yaml"

ROOT = File.expand_path("..", __dir__)
COLLECTION_DIRS = %w[_farms _markets _stores _restaurants _vendors _distributors].freeze
LIST_FIELDS = %w[
  practices
  practices_tags
  products
  products_tags
  services
  services_tags
  specialty_tags
  sourced_from
  supplies_to
  sources
].freeze
RELATIONSHIP_FIELDS = %w[sourced_from supplies_to].freeze
KNOWN_DUPLICATE_SLUGS = Set[
  "live2give-organics",
  "all-things-organic-tairua",
  "earth-store-whitianga",
  "toad-hall-motueka",
  "awarua-organics"
].freeze
KNOWN_UNRESOLVED_RELATIONSHIPS = Set[
  ["_farms/moana-organics.md", "supplies_to", "supply-circle-hub"],
  ["_farms/the-farm-byron-bay.md", "supplies_to", "three-blue-ducks-byron-bay"],
  ["_farms/waipuna-pastures.md", "supplies_to", "supply-circle-hub"],
  ["_stores/city-honest-grocer.md", "sourced_from", "supply-circle-hub"],
  ["_stores/locavore-byron.md", "sourced_from", "brooklet-springs-farm"],
  ["_restaurants/amisfield-bistro-queenstown.md", "sourced_from", "amisfield-estate-garden-and-vineyard"],
  ["_restaurants/amisfield-bistro-queenstown.md", "sourced_from", "central-otago-hunters-and-fishers"],
  ["_restaurants/amisfield-bistro-queenstown.md", "sourced_from", "local-foragers"],
  ["_restaurants/kopupako-kitchen.md", "sourced_from", "supply-circle-hub"]
].map { |parts| parts.join("|") }.to_set.freeze

def rel(path)
  path.sub("#{ROOT}/", "")
end

def present?(value)
  !value.nil? && !value.to_s.strip.empty?
end

def load_front_matter(path)
  text = File.read(path)
  return nil unless text.start_with?("---")

  parts = text.split(/^---\s*\n/)
  return nil if parts.size < 2

  YAML.safe_load(parts[1], permitted_classes: [Date, Time], aliases: true)
end

def load_yaml(path)
  YAML.safe_load(File.read(path), aliases: true)
end

def valid_number?(value)
  Float(value)
  true
rescue ArgumentError, TypeError
  false
end

geography = load_yaml(File.join(ROOT, "_data", "geography.yml")).fetch("countries")
valid_country_slugs = geography.keys.to_set
valid_regions = geography.transform_values do |country|
  country.fetch("regions", []).map { |region| region.fetch("name") }.to_set
end

errors = []
warnings = []
records = []
slug_index = {}

COLLECTION_DIRS.each do |dir|
  Dir.glob(File.join(ROOT, dir, "*.md")).sort.each do |path|
    next if File.basename(path).start_with?("_template")

    begin
      data = load_front_matter(path)
    rescue Psych::Exception => e
      errors << "#{rel(path)}: YAML parse error - #{e.message.lines.first&.strip}"
      next
    end

    unless data.is_a?(Hash)
      errors << "#{rel(path)}: missing valid front matter"
      next
    end

    records << [path, data]

    slug = data["slug"].to_s.strip
    next if slug.empty?

    if slug_index.key?(slug)
      message = "#{rel(path)}: duplicate slug '#{slug}' also used by #{rel(slug_index[slug])}"
      if KNOWN_DUPLICATE_SLUGS.include?(slug)
        warnings << "#{message} (legacy exception)"
      else
        errors << message
      end
    else
      slug_index[slug] = path
    end
  end
end

records.each do |path, data|
  file = rel(path)

  errors << "#{file}: missing title or name" unless present?(data["title"]) || present?(data["name"])
  %w[slug country country_slug region].each do |key|
    errors << "#{file}: missing #{key}" unless present?(data[key])
  end

  country_slug = data["country_slug"].to_s.strip
  region = data["region"].to_s.strip

  if present?(country_slug) && !valid_country_slugs.include?(country_slug)
    errors << "#{file}: unknown country_slug '#{country_slug}'"
  end

  if present?(country_slug) && present?(region) && valid_country_slugs.include?(country_slug)
    unless valid_regions.fetch(country_slug).include?(region)
      errors << "#{file}: region '#{region}' is not valid for country_slug '#{country_slug}'"
    end
  end

  LIST_FIELDS.each do |field|
    next unless data.key?(field)
    next if data[field].nil?

    errors << "#{file}: #{field} must be an array" unless data[field].is_a?(Array)
  end

  lat = data["lat"]
  lon = data["lon"]
  lat_present = present?(lat)
  lon_present = present?(lon)

  if lat_present ^ lon_present
    errors << "#{file}: lat and lon must be provided together"
  end

  if lat_present && lon_present
    unless valid_number?(lat) && valid_number?(lon)
      errors << "#{file}: lat and lon must be numeric"
    else
      lat_value = lat.to_f
      lon_value = lon.to_f
      errors << "#{file}: lat #{lat_value} outside -90..90" unless lat_value.between?(-90, 90)
      errors << "#{file}: lon #{lon_value} outside -180..180" unless lon_value.between?(-180, 180)
    end
  end

  if data.key?("rating_average") && !data["rating_average"].nil?
    unless valid_number?(data["rating_average"]) && data["rating_average"].to_f.between?(0, 5)
      errors << "#{file}: rating_average must be numeric between 0 and 5"
    end
  end

  if data.key?("rating_count") && !data["rating_count"].nil?
    rating_count = data["rating_count"]
    unless rating_count.is_a?(Integer) || rating_count.to_s.match?(/\A\d+\z/)
      errors << "#{file}: rating_count must be an integer"
    end
  end

  RELATIONSHIP_FIELDS.each do |field|
    next unless data[field].is_a?(Array)

    data[field].each do |target|
      target_slug = target.to_s.strip
      next if target_slug.empty?

      next if slug_index.key?(target_slug)

      key = [file, field, target_slug].join("|")
      message = "#{file}: #{field} target '#{target_slug}' does not resolve to a listing slug"
      if KNOWN_UNRESOLVED_RELATIONSHIPS.include?(key)
        warnings << "#{message} (legacy exception)"
      else
        errors << message
      end
    end
  end
end

if errors.empty?
  puts "Validation passed for #{records.size} listing files."
  unless warnings.empty?
    puts "\nWarnings (#{warnings.size}):"
    warnings.each { |warning| puts "- #{warning}" }
  end
  exit 0
end

puts "Validation errors (#{errors.size}):"
errors.each { |error| puts "- #{error}" }
unless warnings.empty?
  puts "\nWarnings (#{warnings.size}):"
  warnings.each { |warning| puts "- #{warning}" }
end
exit 1
