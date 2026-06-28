#!/usr/bin/env ruby
# frozen_string_literal: true

# Cross-checks the declared relationship graph against the evidence ledger
# (_data/relationship_evidence.yml). A relationship (an undirected pair) counts as
# evidenced if the ledger has an entry for that pair in EITHER direction, so a
# reciprocated link only needs evidence recorded once. Reports declared edges with
# no evidence. Report-only by default; --strict exits 1 if any are unevidenced
# (turn on in CI once the backlog is backfilled).
#
# Usage:
#   ruby scripts/evidence_audit.rb
#   ruby scripts/evidence_audit.rb --strict

require "yaml"
require "date"
require_relative "harvest_lib"

strict = ARGV.include?("--strict")
ledger_path = File.join(Harvest::ROOT, "_data", "relationship_evidence.yml")
ledger = File.exist?(ledger_path) ? (YAML.safe_load(File.read(ledger_path), permitted_classes: [Date, Time]) || {}) : {}

evidenced_pairs = {}
ledger.each_key do |key|
  from, _field, to = key.to_s.split("|")
  next unless from && to

  evidenced_pairs[[from, to].sort.join("|")] = true
end

listings = Harvest.load_listings
undirected = []
listings.each do |l|
  fm = Harvest.front_matter(l[:path]) or next
  %w[supplies_to sourced_from].each do |field|
    Array(fm[field]).each do |target|
      target = target.to_s.strip
      next if target.empty?

      undirected << [l[:slug], target].sort.join("|")
    end
  end
end
undirected.uniq!

missing = undirected.reject { |pair| evidenced_pairs[pair] }

puts "Relationship evidence audit"
puts "  ledger entries:                      #{ledger.size}"
puts "  declared relationships (undirected): #{undirected.size}"
puts "  with evidence:                       #{undirected.size - missing.size}"
puts "  WITHOUT evidence:                    #{missing.size}"
unless missing.empty?
  puts "\nUnevidenced (first 25):"
  missing.first(25).each { |pair| puts "  - #{pair.tr('|', ' <-> ')}" }
  puts "  ...(#{missing.size - 25} more)" if missing.size > 25
end

exit(strict && !missing.empty? ? 1 : 0)
