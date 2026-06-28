#!/usr/bin/env ruby
# frozen_string_literal: true

# Enrich existing listings with a certification from a REVIEWED CSV.
# Input columns: slug, operator (note only), certification, source_url.
# For each row it adds the certification + source_url + an "organic" practice tag
# where missing, and bumps last_checked. Surgical front-matter edits only.
#
# Only ever run this on a curated, human-confirmed list (the AsureQuality register
# has no website and uses legal names, so auto-matching is not safe enough to
# assert a certification). Report-only by default; --apply writes.
#
# Usage:
#   ruby scripts/enrich_certifications.rb [data/imports/asurequality-confirmed.csv]
#   ruby scripts/enrich_certifications.rb --apply

require "csv"
require "date"
require_relative "harvest_lib"

apply = ARGV.delete("--apply")
csv = ARGV[0] || File.join(Harvest::ROOT, "data/imports/asurequality-confirmed.csv")
abort "Not found: #{csv}" unless File.exist?(csv)

paths = Harvest.load_listings.each_with_object({}) { |l, h| h[l[:slug]] = l[:path] }
today = Date.today.to_s
changed = 0

CSV.read(csv, headers: true).each do |r|
  slug = r["slug"].to_s.strip
  next if slug.empty?

  path = paths[slug]
  unless path
    warn "  no listing for slug '#{slug}'"
    next
  end

  unless apply
    puts "  #{slug}: would add certification '#{r['certification']}' (+ organic tag, source, last_checked)"
    next
  end

  acts = []
  acts << "cert" if Harvest.add_to_list_field(path, "certifications", r["certification"])
  acts << "source" if r["source_url"].to_s.strip != "" && Harvest.add_to_list_field(path, "source_urls", r["source_url"])
  acts << "organic-tag" if Harvest.add_to_list_field(path, "practices_tags", "organic")
  acts << "last_checked" if Harvest.set_scalar_field(path, "last_checked", today)
  changed += 1 unless acts.empty?
  puts "  #{slug}: #{acts.empty? ? 'no change' : acts.join(', ')}"
end

puts "\n#{apply ? "Updated #{changed} listing(s)." : 'Dry run. Re-run with --apply to write.'}"
