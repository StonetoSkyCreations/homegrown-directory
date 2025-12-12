#!/usr/bin/env ruby
# frozen_string_literal: true

# Usage: ruby scripts/normalise_markets_practices.rb
# Scans _markets/*.md, infers practices_tags from explicit wording in text fields,
# and updates front matter while preserving canonical tokens.

require "yaml"
require "date"
require "set"
require "pathname"

ROOT = Pathname.new(__dir__).parent
MARKETS_DIR = ROOT.join("_markets")
CANONICAL = %w[organic spray-free regenerative biodynamic wild pasture-raised local].freeze

PATTERNS = {
  "organic" => [
    /\borganic\b/i,
    /\bcertified\s+organic\b/i,
    /\bbiogro\b/i,
    /\basurequality\s+organic\b/i,
    /\bdemeter\b/i
  ],
  "spray-free" => [
    /\bspray[-\s]?free\b/i,
    /\bchemical[-\s]?free\b/i,
    /\bno\s+sprays\b/i,
    /\bno\s+chemical\s+sprays\b/i,
    /\bglyphosate[-\s]?free\b/i
  ],
  "regenerative" => [
    /\bregenerative\b/i,
    /\bregeneratively\b/i,
    /\bregeneration\b/i,
    /\bregenerative\s+agriculture\b/i,
    /\bsoil\s+health\b/i
  ],
  "biodynamic" => [
    /\bbiodynamic\b/i,
    /\bdemeter\b/i
  ],
  "wild" => [
    /\bwild\b/i,
    /\bwild[-\s]?harvested\b/i,
    /\bforaged\b/i,
    /\bforaging\b/i
  ],
  "pasture-raised" => [
    /\bpasture[-\s]?raised\b/i,
    /\bgrass[-\s]?fed\b/i
  ],
  "local" => [
    /\blocal\b/i,
    /\blocally\s+grown\b/i,
    /\blocal\s+growers\b/i,
    /\blocal\s+producers\b/i,
    /\bregional\s+producers\b/i,
    /\bfrom\s+the\s+region\b/i,
    /\bnearby\s+farms\b/i,
    /\bgrowers[’']\s*market\b/i,
    /\bproducer\s+market\b/i
  ]
}.freeze

TEXT_KEYS = %w[
  description long_description notes sourcing practices meta_description
  short_description summary blurb tagline body content
].freeze

IGNORE_KEYS = %w[
  layout slug name brand title type category collection website email phone
  social_links source_urls market_days rating_average rating_count country
  country_slug region city city_town suburb address postcode lon lat
  products products_tags services services_tags sourcing_tags hours
  last_checked source_urls sources source submission_url
].freeze

def collect_text(value, bucket)
  case value
  when String
    return if value.strip.empty?
    return if value =~ %r{\Ahttps?://}i

    bucket << value
  when Array
    value.each { |item| collect_text(item, bucket) }
  when Hash
    value.each_value { |inner| collect_text(inner, bucket) }
  end
end

def parse_front_matter(path)
  raw = File.read(path)
  unless raw.start_with?("---")
    warn "Skipping #{path}: missing front matter"
    return nil
  end

  matches = raw.match(/\A---\s*\n(.*?)\n---\s*\n?/m)
  unless matches
    warn "Skipping #{path}: malformed front matter"
    return nil
  end

  front_yaml = matches[1]
  body = raw[matches[0].length..] || ""
  front = YAML.safe_load(front_yaml, permitted_classes: [Date, Time], aliases: true) || {}
  [front, body]
end

def write_front_matter(path, front, body)
  yaml_str = YAML.dump(front, line_width: -1)
  yaml_str.sub!(/\A---\s*\n/, "")
  yaml_str.sub!(/\n\.\.\.\s*\n?\z/, "\n")
  File.write(path, +"---\n#{yaml_str}---\n#{body}")
end

added_counts = Hash.new(0)
changed_slugs = []

Dir.glob(MARKETS_DIR.join("*.md")).each do |path|
  parsed = parse_front_matter(path)
  next unless parsed

  front, body = parsed
  slug = front["slug"] || File.basename(path, ".md")

  text_blobs = []
  TEXT_KEYS.each { |key| collect_text(front[key], text_blobs) }
  front.each do |key, value|
    next if TEXT_KEYS.include?(key)
    next if IGNORE_KEYS.include?(key)

    collect_text(value, text_blobs)
  end
  text_blobs << body
  combined_text = text_blobs.compact.join("\n").downcase

  existing = Array(front["practices_tags"]).map(&:to_s)
  existing_downcased = existing.map(&:downcase)
  inferred = Set.new
  PATTERNS.each do |token, regexes|
    regexes.each do |regex|
      if combined_text.match?(regex)
        inferred << token
        break
      end
    end
  end

  merged = existing_downcased | inferred.to_a
  canonicalised = CANONICAL.select { |token| merged.include?(token) }

  next if canonicalised == existing

  added = canonicalised - existing_downcased
  added.each { |token| added_counts[token] += 1 }

  front["practices_tags"] = canonicalised
  write_front_matter(path, front, body)
  changed_slugs << slug
  puts "Updated #{slug}: added #{added.join(', ')}" unless added.empty?
end

puts "\nTag additions:"
CANONICAL.each do |token|
  puts "  #{token}: #{added_counts[token]}"
end

puts "\nChanged slugs (#{changed_slugs.size}):"
puts changed_slugs.join(", ")

# Sanity check for non-canonical tags.
violations = {}
Dir.glob(MARKETS_DIR.join("*.md")).each do |path|
  parsed = parse_front_matter(path)
  next unless parsed

  front, = parsed
  Array(front["practices_tags"]).each do |tag|
    tag_str = tag.to_s
    violations[tag_str] ||= [] unless CANONICAL.include?(tag_str.downcase)
    violations[tag_str] << File.basename(path, ".md") unless CANONICAL.include?(tag_str.downcase)
  end
end

unless violations.empty?
  puts "\nNon-canonical practices_tags found:"
  violations.each do |tag, slugs|
    puts "  #{tag}: #{slugs.join(', ')}"
  end
end
