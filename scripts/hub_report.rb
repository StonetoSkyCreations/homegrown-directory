#!/usr/bin/env ruby
# frozen_string_literal: true

# Hub report for the NZ connection harvest (report-only). Reads the listing
# collections and ranks where the leverage is for the next sourcing session:
#
#   - Forward hubs: producers / distributors with the most outlets already linked
#     AND a website (their "where to buy / stockists" page is the richest forward
#     mine: one page yields many more outlets + reciprocal links).
#   - Reverse hubs: stockists / distributors / markets that source from many
#     producers AND a website (their "our producers" page mines the supply side).
#   - Unmined hubs: producers / distributors with a website but no outlets linked
#     yet (untouched mines).
#   - Orphans by region (most get picked up as hubs are mined).
#
# NZ only (country_slug: new-zealand); Australia is ignored for now. Mirrors the
# parsing in relationship_audit.rb. No writes.
#
# Usage:
#   ruby scripts/hub_report.rb            # top 15 in each list
#   ruby scripts/hub_report.rb --top 25   # change the cut-off
#   ruby scripts/hub_report.rb --all      # no cut-off

require "yaml"
require "date"

ROOT = File.expand_path("..", __dir__)
COLLECTION_DIRS = %w[farms markets stores restaurants vendors distributors].freeze
FORWARD = %w[farms vendors distributors].freeze          # supply side
REVERSE = %w[stores restaurants markets distributors].freeze # demand side
NZ = "new-zealand"

top = (idx = ARGV.index("--top")) ? ARGV[idx + 1].to_i : 15
top = nil if ARGV.include?("--all")

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

nodes = []
COLLECTION_DIRS.each do |dir|
  Dir.glob(File.join(ROOT, "_#{dir}", "*.md")).sort.each do |path|
    next if File.basename(path).start_with?("_template")

    front = front_matter(path)
    next unless front.is_a?(Hash)

    slug = front["slug"].to_s.strip
    next if slug.empty?
    next unless front["country_slug"].to_s.strip == NZ

    nodes << {
      slug: slug,
      collection: dir,
      title: (front["title"] || front["name"] || slug).to_s,
      region: front["region"].to_s.strip,
      website: !front["website"].to_s.strip.empty?,
      supplies: list(front, "supplies_to").size,
      sources: list(front, "sourced_from").size
    }
  end
end

# Dedupe by slug (first wins, mirroring the audit / graph build).
seen = {}
nodes = nodes.reject { |n| seen[n[:slug]] ? true : (seen[n[:slug]] = true; false) }

def fmt(n)
  web = n[:website] ? "web" : "no-web"
  format("  %2d  %-34s %-13s %-9s %s", n[:counter], n[:slug], n[:region][0, 13], web, n[:label])
end

def table(title, rows, top)
  rows = rows.first(top) if top
  puts "\n#{title}"
  puts "  ##  #{'slug'.ljust(34)} #{'region'.ljust(13)} #{'site'.ljust(9)} count"
  rows.each_with_index do |n, i|
    n = n.merge(counter: i + 1)
    puts fmt(n)
  end
  puts "  (none)" if rows.empty?
end

by_collection = nodes.group_by { |n| n[:collection] }
counts = COLLECTION_DIRS.map { |c| "#{c} #{(by_collection[c] || []).size}" }.join(", ")
with_links = nodes.count { |n| n[:supplies].positive? || n[:sources].positive? }
orphans = nodes.select { |n| n[:supplies].zero? && n[:sources].zero? }

puts "== NZ Hub Report =="
puts "NZ listings: #{nodes.size}  (#{counts})"
puts "With >=1 link: #{with_links}   Orphans: #{orphans.size}"
puts "Distributors: #{(by_collection['distributors'] || []).size}  (mega-hubs; the biggest single gap)"

forward = nodes.select { |n| FORWARD.include?(n[:collection]) && n[:supplies].positive? }
              .sort_by { |n| -n[:supplies] }
              .map { |n| n.merge(label: "#{n[:supplies]} outlets") }
table("Forward hubs (producers/distributors by outlets linked) - mine their stockists page:", forward, top)

reverse = nodes.select { |n| REVERSE.include?(n[:collection]) && n[:sources].positive? }
              .sort_by { |n| -n[:sources] }
              .map { |n| n.merge(label: "#{n[:sources]} producers") }
table("Reverse hubs (stockists/distributors/markets by producers sourced) - mine their suppliers page:", reverse, top)

unmined = nodes.select { |n| FORWARD.include?(n[:collection]) && n[:website] && n[:supplies].zero? }
              .sort_by { |n| n[:slug] }
              .map { |n| n.merge(label: "unmined") }
puts "\nUnmined producers/distributors with a website (#{unmined.size} total) - untouched forward mines:"
table("", unmined, top)

puts "\nOrphans by region (#{orphans.size} total):"
orphans.group_by { |n| n[:region].empty? ? "(no region)" : n[:region] }
       .sort_by { |_, v| -v.size }
       .each { |region, v| puts format("  %3d  %s", v.size, region) }
