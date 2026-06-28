#!/usr/bin/env ruby
# frozen_string_literal: true

# Duplicate / near-duplicate detector for harvested staging CSVs. Matches every
# row (by slug / website host / normalised name) against existing listings so a
# business already in the directory is never added twice, and near-matches are
# flagged for human review rather than blindly imported. Report-only.
#
# Usage: ruby scripts/match_report.rb data/imports/FILE.csv

require "csv"
require_relative "harvest_lib"

csv = ARGV[0] or abort "Usage: ruby scripts/match_report.rb data/imports/FILE.csv"
abort "Not found: #{csv}" unless File.exist?(csv)

rows = CSV.read(csv, headers: true)
listings = Harvest.load_listings

counts = Hash.new(0)
puts format("%-40s %-10s %-30s %s", "name", "status", "matched", "why")
puts "-" * 92
rows.each do |r|
  name = r["name"].to_s.strip
  next if name.empty?

  status, slug, why = Harvest.match(name, r["website"], listings)
  counts[status] += 1
  puts format("%-40s %-10s %-30s %s", name[0, 40], status, (slug || "")[0, 30], why)
end

puts "-" * 92
puts "#{rows.size} rows: " + %i[new ambiguous existing].map { |s| "#{counts[s]} #{s}" }.join(", ")
puts "(review the 'ambiguous' rows before importing)" if counts[:ambiguous].positive?
