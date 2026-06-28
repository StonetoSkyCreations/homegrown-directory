# frozen_string_literal: true

# Shared helpers for the harvest pipeline (see HARVEST.md): load the existing
# listing index and match harvested rows against it by slug / website host /
# normalised name, so we never create a second listing for a business already in
# the directory. No external dependencies.

require "yaml"
require "date"
require "set"

module Harvest
  ROOT = File.expand_path("..", __dir__)
  COLLECTION_DIRS = %w[farms markets stores restaurants vendors distributors].freeze

  module_function

  def front_matter(path)
    raw = File.read(path)
    return nil unless raw.start_with?("---")

    parts = raw.split(/^---\s*\n/, 3)
    return nil if parts.size < 3

    YAML.safe_load(parts[1], permitted_classes: [Date, Time], aliases: true)
  rescue Psych::Exception
    nil
  end

  def slugify(text)
    text.to_s.downcase.strip
        .gsub(/['’"]/, "")
        .gsub(/[^a-z0-9]+/, "-")
        .gsub(/\A-+|-+\z/, "")
  end

  # Drop common words/suffixes so "The Cheese Barn Ltd" ~ "Cheese Barn".
  def norm_name(s)
    s.to_s.downcase.gsub("&", " and ")
     .gsub(/\b(the|cafe|café|restaurant|ltd|limited|co|company|organics?|farm|farms|nz|new zealand)\b/, " ")
     .gsub(/[^a-z0-9]+/, " ").strip.squeeze(" ")
  end

  def host(url)
    u = url.to_s.strip.downcase
    return "" if u.empty?

    u.sub(%r{^https?://}, "").sub(/^www\./, "").split("/").first.to_s
  end

  def load_listings
    out = []
    COLLECTION_DIRS.each do |dir|
      Dir.glob(File.join(ROOT, "_#{dir}", "*.md")).sort.each do |path|
        next if File.basename(path).start_with?("_template")

        fm = front_matter(path) or next
        slug = fm["slug"].to_s.strip
        next if slug.empty?

        out << {
          slug: slug,
          collection: dir,
          path: path,
          title: (fm["title"] || fm["name"]).to_s,
          host: host(fm["website"]),
          nname: norm_name(fm["title"] || fm["name"])
        }
      end
    end
    out
  end

  # Returns [status, matched_slug, reason]; status = :existing | :ambiguous | :new
  def match(name, website, listings, slug_guess = nil)
    slug_guess ||= slugify(name)

    by_slug = listings.find { |l| l[:slug] == slug_guess }
    return [:existing, by_slug[:slug], "slug"] if by_slug

    h = host(website)
    unless h.empty?
      by_host = listings.find { |l| l[:host] == h }
      return [:existing, by_host[:slug], "website"] if by_host
    end

    nn = norm_name(name)
    unless nn.empty?
      exact = listings.find { |l| l[:nname] == nn }
      return [:existing, exact[:slug], "name"] if exact

      near = listings.find { |l| !l[:nname].empty? && (l[:nname].start_with?(nn) || nn.start_with?(l[:nname])) }
      return [:ambiguous, near[:slug], "near-name"] if near
    end

    [:new, nil, ""]
  end

  # Insert a value into a YAML block-list front-matter field, preserving the
  # surrounding formatting. Returns true if the file changed. Mirrors the proven
  # logic in scripts/reciprocate.rb.
  def add_to_list_field(path, field, value)
    value = value.to_s.strip
    return false if value.empty?

    lines = File.readlines(path)
    idx = lines.index { |l| l =~ /\A(\s*)#{Regexp.escape(field)}:\s*(.*)\Z/ }
    return false unless idx

    m = lines[idx].match(/\A(\s*)#{Regexp.escape(field)}:\s*(.*)\Z/)
    indent = m[1]
    rest = m[2].rstrip

    item_indent = nil
    items = []
    j = idx + 1
    while j < lines.length && lines[j] =~ /\A(\s*)-\s+(.*)\Z/
      item_indent ||= Regexp.last_match(1)
      items << Regexp.last_match(2).strip
      j += 1
    end

    if !items.empty?
      return false if items.include?(value)

      lines.insert(j, "#{item_indent}- #{value}\n")
    elsif rest == "[]" || rest.empty?
      lines[idx] = "#{indent}#{field}:\n"
      lines.insert(idx + 1, "#{indent}- #{value}\n")
    else
      return false
    end

    File.write(path, lines.join)
    true
  end

  # Replace a scalar front-matter field's value (first occurrence). Returns true if changed.
  def set_scalar_field(path, field, value)
    lines = File.readlines(path)
    idx = lines.index { |l| l =~ /\A\s*#{Regexp.escape(field)}:(?:\s.*)?\Z/ }
    return false unless idx

    indent = lines[idx][/\A(\s*)/, 1]
    newline = "#{indent}#{field}: '#{value}'\n"
    return false if lines[idx] == newline

    lines[idx] = newline
    File.write(path, lines.join)
    true
  end
end
