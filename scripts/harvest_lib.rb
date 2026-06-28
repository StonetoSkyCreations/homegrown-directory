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
end
