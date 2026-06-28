#!/usr/bin/env ruby
# frozen_string_literal: true

# Harvest step 2 (classify): turn extracted candidate names into a review queue.
#
# Reads data/harvest/stockist-edges.csv (from stockist_extract.py) and runs every
# candidate name through the canonical matcher (Harvest.match in harvest_lib.rb), so
# matching/dedup logic never diverges from the rest of the pipeline. Writes
# data/harvest/stockist-review.csv with a `route` column:
#
#   auto   - candidate resolves to an existing listing by slug / website / name.
#            Ready to wire the reciprocal edge (just needs a glance + import).
#   review - candidate is a new business (scaffold decision) or a fuzzy near-name
#            (disambiguation). These are the only rows that need human/LLM judgment.
#
# No writes to the site; this only produces the queue. Apply approved rows with
# scripts/harvest_import.rb. See HARVEST.md.
#
# Usage:
#   ruby scripts/candidate_edges.rb

require "csv"
require_relative "harvest_lib"

ROOT = File.expand_path("..", __dir__)
IN = File.join(ROOT, "data/harvest/stockist-edges.csv")
OUT = File.join(ROOT, "data/harvest/stockist-review.csv")

abort "Missing #{IN} - run stockist_extract.py first." unless File.exist?(IN)

listings = Harvest.load_listings

rows = []
seen = {}
CSV.foreach(IN, headers: true) do |r|
  producer = r["producer_slug"].to_s.strip
  field = r["field"].to_s.strip
  name = r["candidate_name"].to_s.strip
  next if producer.empty? || name.empty?

  status, matched, reason = Harvest.match(name, nil, listings)

  # Never edge a producer to itself.
  next if matched && matched == producer

  route = (status == :existing && %w[slug website name].include?(reason)) ? "auto" : "review"
  confidence =
    case [status, reason]
    in [:existing, "slug" | "website" | "name"] then "high"
    in [:existing, _] then "medium"      # near-name: matched but fuzzy
    in [:new, _] then "high"             # named on the producer's own page; new listing
    else "medium"
    end

  # Dedupe: one row per (producer, field, resolved target-or-name).
  key = [producer, field, matched || name.downcase].join("|")
  next if seen[key]
  seen[key] = true

  rows << {
    route: route, producer_slug: producer, field: field, candidate_name: name,
    matched_slug: matched || "", match_status: status, reason: reason,
    confidence: confidence, evidence_url: r["evidence_url"], snippet: r["snippet"]
  }
end

rows.sort_by! { |x| [x[:route] == "auto" ? 0 : 1, x[:producer_slug], x[:candidate_name].downcase] }

CSV.open(OUT, "w") do |csv|
  csv << %w[route producer_slug field candidate_name matched_slug match_status reason confidence evidence_url snippet]
  rows.each do |x|
    csv << [x[:route], x[:producer_slug], x[:field], x[:candidate_name], x[:matched_slug],
            x[:match_status], x[:reason], x[:confidence], x[:evidence_url], x[:snippet]]
  end
end

auto = rows.count { |x| x[:route] == "auto" }
new_n = rows.count { |x| x[:match_status] == :new }
amb = rows.count { |x| x[:route] == "review" && x[:match_status] != :new }

puts "Wrote #{OUT.sub("#{ROOT}/", '')}  (#{rows.size} candidate edge(s))"
puts "  auto   (existing match, ready to wire): #{auto}"
puts "  review (new listing decision):          #{new_n}"
puts "  review (fuzzy near-name):               #{amb}"
puts "\nAuto edges (existing listings, sample):"
rows.select { |x| x[:route] == "auto" }.first(15).each do |x|
  puts format("  %-30s --%s--> %-30s (%s)", x[:producer_slug], x[:field], x[:matched_slug], x[:reason])
end
