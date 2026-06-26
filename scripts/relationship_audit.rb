#!/usr/bin/env ruby
# frozen_string_literal: true

# Interconnectedness audit for the listing relationship graph.
#
# Builds the directed graph from every listing's `sourced_from` / `supplies_to`
# and reports: coverage (listings with >=1 link), reciprocated partnerships
# (both ends declare the complementary relationship), one-way claims (X references
# Y but Y does not reference back), and orphans (no declared relationships).
#
# A pair (X, Y) is RECIPROCATED when:
#   X.supplies_to contains Y  AND  Y.sourced_from contains X   (or the mirror)
# i.e. the same supply edge is declared from both ends.
#
# Usage:
#   ruby scripts/relationship_audit.rb            # report, exits 0
#   ruby scripts/relationship_audit.rb --strict   # exits 1 if any one-way claims
#   ruby scripts/relationship_audit.rb --json      # machine-readable summary

require "yaml"
require "date"
require "set"
require "json"

ROOT = File.expand_path("..", __dir__)
COLLECTION_DIRS = %w[farms markets stores restaurants vendors distributors].freeze

strict = ARGV.include?("--strict")
as_json = ARGV.include?("--json")

def front_matter(path)
  raw = File.read(path)
  return nil unless raw.start_with?("---")

  parts = raw.split(/^---\s*\n/, 3)
  return nil if parts.size < 3

  YAML.safe_load(parts[1], permitted_classes: [Date, Time], aliases: true)
rescue Psych::Exception
  nil
end

def list(front, key)
  Array(front[key]).map { |v| v.to_s.strip }.reject(&:empty?)
end

# Load the graph.
nodes = {} # slug => { title, collection, supplies_to:[], sourced_from:[] }
COLLECTION_DIRS.each do |dir|
  Dir.glob(File.join(ROOT, "_#{dir}", "*.md")).sort.each do |path|
    next if File.basename(path).start_with?("_template")

    front = front_matter(path)
    next unless front.is_a?(Hash)

    slug = front["slug"].to_s.strip
    next if slug.empty?

    nodes[slug] ||= {
      title: front["title"] || front["name"] || slug,
      collection: dir,
      supplies_to: list(front, "supplies_to"),
      sourced_from: list(front, "sourced_from")
    }
  end
end

all_slugs = nodes.keys.to_set

reciprocated = Hash.new { |h, k| h[k] = Set.new } # slug => Set of confirmed partner slugs
one_way = []                                       # [from, field, to]
unresolved = []                                    # [from, field, to] target not in graph

nodes.each do |slug, data|
  { supplies_to: :sourced_from, sourced_from: :supplies_to }.each do |field, mirror|
    data[field].each do |target|
      unless all_slugs.include?(target)
        unresolved << [slug, field, target]
        next
      end
      if nodes[target][mirror].include?(slug)
        reciprocated[slug] << target
      else
        one_way << [slug, field, target]
      end
    end
  end
end

with_links = nodes.count { |_, d| d[:supplies_to].any? || d[:sourced_from].any? }
orphans = nodes.count { |_, d| d[:supplies_to].empty? && d[:sourced_from].empty? }
recip_listings = reciprocated.count { |_, set| set.any? }
recip_pairs = reciprocated.values.sum(&:size) / 2
top = reciprocated.reject { |_, s| s.empty? }
                  .sort_by { |_, s| -s.size }
                  .first(10)
                  .map { |slug, s| [slug, s.size] }

if as_json
  puts JSON.pretty_generate(
    listings: nodes.size,
    with_links: with_links,
    orphans: orphans,
    reciprocated_listings: recip_listings,
    reciprocated_pairs: recip_pairs,
    one_way_claims: one_way.size,
    unresolved: unresolved.size,
    verified_partner_counts: reciprocated.transform_values(&:size).reject { |_, v| v.zero? }
  )
  exit 0
end

puts "== Relationship Interconnectedness Audit =="
puts "Listings:                 #{nodes.size}"
puts "With >=1 declared link:   #{with_links}  (#{(with_links * 100.0 / nodes.size).round(1)}% coverage)"
puts "Orphans (no links):       #{orphans}"
puts "Reciprocated partnerships:#{recip_pairs} pairs across #{recip_listings} listings"
puts "One-way claims:           #{one_way.size}  (declared, target exists, not reciprocated)"
puts "Unresolved targets:       #{unresolved.size}  (slug not found; see validate_content.rb)"

unless top.empty?
  puts "\nMost-connected (reciprocated partners):"
  top.each { |slug, n| puts format("  %2d  %s", n, slug) }
end

unless one_way.empty?
  shown = one_way.first(25)
  puts "\nOne-way claims#{one_way.size > shown.size ? " (first #{shown.size} of #{one_way.size})" : ''}:"
  shown.each { |from, field, to| puts "  #{from} --#{field}--> #{to}  (no reciprocal from #{to})" }
end

if strict && !one_way.empty?
  warn "\nstrict: #{one_way.size} one-way claim(s) present."
  exit 1
end
exit 0
