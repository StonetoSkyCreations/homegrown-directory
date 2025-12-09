#!/usr/bin/env ruby
# Simple front-matter validator for collection items.
# - Ensures YAML is parseable
# - Checks required fields and flags placeholders
# - Normalizes website protocol in-memory (does not rewrite)

require "yaml"
require "date"

COLLECTION_DIRS = %w[_farms _markets _stores _restaurants _vendors _distributors].freeze
REQUIRED_KEYS = %w[slug country country_slug region].freeze
PLACEHOLDER_URLS = ["#", "/", "", nil].freeze
WARNING_LIMIT = 120

def load_front_matter(path)
  text = File.read(path)
  return nil unless text.start_with?("---")
  parts = text.split(/^---\s*\n/)
  return nil if parts.size < 2
  fm_raw = parts[1]
  YAML.safe_load(fm_raw, permitted_classes: [Date, Time], aliases: true)
end

def normalize_url(url)
  return nil if PLACEHOLDER_URLS.include?(url)
  return url if url.to_s.include?("//")
  "https://#{url}"
end

errors = []
warnings = []
warning_counts = Hash.new(0)
COLLECTION_DIRS.each do |dir|
  Dir.glob(File.join(dir, "*.md")).each do |path|
    begin
      data = load_front_matter(path)
    rescue Psych::Exception => e
      errors << "#{path}: YAML parse error – #{e.message.lines.first&.strip}"
      next
    end
    next unless data.is_a?(Hash)

    REQUIRED_KEYS.each do |key|
      val = data[key]
      errors << "#{path}: missing #{key}" if val.nil? || val.to_s.strip.empty?
    end

    website = normalize_url(data["website"])
    if PLACEHOLDER_URLS.include?(data["website"])
      errors << "#{path}: website placeholder"
    end
    if data["website"] && website && !data["website"].to_s.include?("//")
      errors << "#{path}: website missing protocol (would normalize to #{website})"
    end

    if data["address"].to_s.strip.empty?
      warnings << "#{path}: missing address"
      warning_counts[:missing_address] += 1
    end
    if data["phone"].to_s.strip.empty?
      warnings << "#{path}: missing phone"
      warning_counts[:missing_phone] += 1
    end
  end
end

unless errors.empty?
  puts "Validation issues (#{errors.size}):"
  errors.each { |e| puts "- #{e}" }
end

unless warnings.empty?
  puts "\nWarnings (#{warnings.size}):"
  warnings.first(WARNING_LIMIT).each { |w| puts "- #{w}" }
  if warnings.size > WARNING_LIMIT
    puts "... #{warnings.size - WARNING_LIMIT} more warnings truncated"
  end
  puts "\nWarning counts: #{warning_counts}"
end

if errors.empty? && warnings.empty?
  puts "All collection files passed basic validation."
end

exit(errors.empty? ? 0 : 1)
