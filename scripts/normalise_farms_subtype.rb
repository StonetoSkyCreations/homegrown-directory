#!/usr/bin/env ruby
# frozen_string_literal: true

# Usage: ruby scripts/normalise_farms_subtype.rb
# Applies canonical farm subtypes to _farms/*.md based on structured fields and explicit text signals.

require "yaml"
require "date"
require "set"

ROOT = File.expand_path("..", __dir__)
FARMS_DIR = File.join(ROOT, "_farms")
CANONICAL = %w[market-garden orchard vineyard livestock dairy-farm apiary eggs mushrooms seeds flowers mixed].freeze

TYPE_MATCHERS = {
  /vineyard/i => "vineyard",
  /flower/i => "flowers",
  /mushroom/i => "mushrooms",
  /seed/i => "seeds"
}.freeze

PRODUCT_MATCHERS = {
  /seed/i => "seeds",
  /dairy/i => "dairy-farm",
  /meat/i => "livestock"
}.freeze

TEXT_MATCHERS = [
  [/market[\s-]?garden|veg box|vegetable|vegetables|herb|herbs|microgreens/i, "market-garden"],
  [/orchard|fruit trees|apples|pears|stonefruit|citrus/i, "orchard"],
  [/vineyard|winery|grapes/i, "vineyard"],
  [/dairy|milk|cheese/i, "dairy-farm"],
  [/beef|lamb|pork|deer|livestock|pasture\s+raised/i, "livestock"],
  [/honey|apiary|bees|m[āa]nuka\s+honey/i, "apiary"],
  [/eggs|free[-\s]?range\s+eggs/i, "eggs"],
  [/mushroom|mycology|gourmet\s+mushrooms/i, "mushrooms"],
  [/seed\b|seedlings|nursery/i, "seeds"],
  [/flowers|blooms|cut\s+flowers/i, "flowers"]
].freeze

def parse_file(path)
  raw = File.read(path)
  return nil unless raw.start_with?("---")
  fm, body = raw.split(/^---\s*$\n/, 3)[1..]
  front = YAML.safe_load(fm, permitted_classes: [Date, Time], aliases: true) || {}
  [front, body || ""]
rescue Psych::SyntaxError => e
  warn "Skipping #{path}: YAML error #{e.message}"
  nil
end

def write_file(path, front, body)
  yaml = YAML.dump(front, line_width: -1)
  yaml.sub!(/\A---\s*\n/, "")
  yaml.sub!(/\n\.\.\.\s*\n?\z/, "\n")
  File.write(path, +"---\n#{yaml}---\n#{body}")
end

def infer_subtype(front, body)
  existing = front["subtype"].to_s.strip
  return existing if CANONICAL.include?(existing)

  type_field = front["type"].to_s
  TYPE_MATCHERS.each do |regex, token|
    return token if type_field.match?(regex)
  end

  products = Array(front["products_tags"])
  products.each do |prod|
    PRODUCT_MATCHERS.each do |regex, token|
      return token if prod.to_s.match?(regex)
    end
  end

  text_sources = []
  %w[title name description long_description notes].each do |key|
    text_sources << front[key].to_s
  end
  text_sources << body.to_s
  combined = text_sources.compact.join("\n")
  TEXT_MATCHERS.each do |regex, token|
    return token if combined.match?(regex)
  end

  "mixed"
end

counts = Hash.new(0)
changes = []
non_canonical = {}

Dir.glob(File.join(FARMS_DIR, "*.md")).each do |path|
  parsed = parse_file(path)
  next unless parsed
  front, body = parsed
  slug = front["slug"] || File.basename(path, ".md")

  current = front["subtype"].to_s.strip
  if !current.empty? && !CANONICAL.include?(current)
    non_canonical[current] ||= []
    non_canonical[current] << slug
  end

  inferred = infer_subtype(front, body)
  next if current == inferred

  front["subtype"] = inferred
  write_file(path, front, body)
  counts[inferred] += 1
  changes << slug
end

puts "Subtype counts added/updated:"
CANONICAL.each do |token|
  puts "  #{token}: #{counts[token]}"
end

puts "\nChanged slugs (#{changes.size}):"
puts changes.join(", ")

unless non_canonical.empty?
  puts "\nNon-canonical subtypes found (left as-is in stats):"
  non_canonical.each do |token, slugs|
    puts "  #{token}: #{slugs.join(', ')}"
  end
end
