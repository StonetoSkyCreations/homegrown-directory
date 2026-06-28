#!/usr/bin/env ruby
# frozen_string_literal: true

# Reciprocate one-way relationship claims.
#
# For every one-way edge A --field--> B (B exists but does not declare the mirror
# relationship back to A), add A to B's mirror list. Mirrors the detection in
# relationship_audit.rb (supplies_to <-> sourced_from). Dangling targets (slug not
# in the graph) are left alone; resolve those first.
#
# Edits are surgical line surgery on each target file's front matter, so key order,
# unicode escapes and the *_text fields are untouched. Idempotent: a second run
# (or --apply after a clean one) is a no-op.
#
# Usage:
#   ruby scripts/reciprocate.rb           # report what would change
#   ruby scripts/reciprocate.rb --apply   # write the back-references
#
# Run in a clean working tree and review `git diff` afterwards.

require "yaml"
require "date"
require "set"

ROOT = File.expand_path("..", __dir__)
COLLECTION_DIRS = %w[farms markets stores restaurants vendors distributors].freeze
MIRROR = { "supplies_to" => "sourced_from", "sourced_from" => "supplies_to" }.freeze

apply = ARGV.include?("--apply")

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

# Build slug => path and the graph (first file per slug wins, mirroring the audit).
paths = {}
nodes = {}
COLLECTION_DIRS.each do |dir|
  Dir.glob(File.join(ROOT, "_#{dir}", "*.md")).sort.each do |path|
    next if File.basename(path).start_with?("_template")

    front = front_matter(path)
    next unless front.is_a?(Hash)

    slug = front["slug"].to_s.strip
    next if slug.empty? || nodes.key?(slug)

    paths[slug] = path
    nodes[slug] = {
      "supplies_to" => list(front, "supplies_to"),
      "sourced_from" => list(front, "sourced_from")
    }
  end
end

# Collect back-references to add: additions[target_slug][mirror_field] = [from_slug, ...]
additions = Hash.new { |h, k| h[k] = Hash.new { |h2, k2| h2[k2] = [] } }
nodes.each do |slug, data|
  MIRROR.each do |field, mirror|
    data[field].each do |target|
      next unless nodes.key?(target)               # dangling: resolve separately
      next if nodes[target][mirror].include?(slug) # already reciprocated
      list = additions[target][mirror]
      list << slug unless list.include?(slug)
    end
  end
end

to_add = additions.values.sum { |fields| fields.values.sum(&:size) }
if to_add.zero?
  puts "No one-way claims to reciprocate. The relationship graph is fully reciprocal."
  exit 0
end

# Insert a slug into a block-list front-matter field, preserving formatting.
# Returns true if the file changed.
def add_to_field(path, field, slug)
  lines = File.readlines(path)
  idx = lines.index { |l| l =~ /\A(\s*)#{Regexp.escape(field)}:\s*(.*)\Z/ }
  return false unless idx

  m = lines[idx].match(/\A(\s*)#{Regexp.escape(field)}:\s*(.*)\Z/)
  indent = m[1]
  rest = m[2].rstrip

  # Existing block-list items immediately under the key.
  item_indent = nil
  items = []
  j = idx + 1
  while j < lines.length && lines[j] =~ /\A(\s*)-\s+(.*)\Z/
    item_indent ||= Regexp.last_match(1)
    items << Regexp.last_match(2).strip
    j += 1
  end

  if !items.empty?
    return false if items.include?(slug)

    lines.insert(j, "#{item_indent}- #{slug}\n")
  elsif rest == "[]" || rest.empty?
    lines[idx] = "#{indent}#{field}:\n"
    lines.insert(idx + 1, "#{indent}- #{slug}\n")
  else
    warn "  ! #{path}: unexpected inline value for #{field}, skipped"
    return false
  end

  File.write(path, lines.join)
  true
end

puts "#{apply ? 'Applying' : 'Would add'} #{to_add} back-reference(s) across #{additions.size} listing(s):"
changed = Set.new
additions.sort.each do |target, fields|
  rel = paths[target].sub("#{ROOT}/", "")
  fields.each do |field, slugs|
    slugs.sort.each do |slug|
      if apply
        ok = add_to_field(paths[target], field, slug)
        changed << rel if ok
        puts "  #{ok ? 'added' : 'skip '} #{rel}: #{field} += #{slug}"
      else
        puts "  #{rel}: #{field} += #{slug}"
      end
    end
  end
end

if apply
  puts "\nUpdated #{changed.size} file(s). Review with `git diff`, then run the audit."
else
  puts "\nRe-run with --apply to write these back-references."
end
