#!/usr/bin/env ruby

require "fileutils"
require "yaml"

ROOT = File.expand_path("..", __dir__)
GEOGRAPHY_PATH = File.join(ROOT, "_data", "geography.yml")
SECTIONS_PATH = File.join(ROOT, "_data", "directory_sections.yml")

def load_yaml(path)
  YAML.safe_load(File.read(path), aliases: true)
end

def yaml_front_matter(hash)
  payload = hash.to_yaml(line_width: -1)
  payload.sub(/\A---\s*\n?/, "")
end

def write_page(path, front_matter, body)
  content = +"---\n"
  content << yaml_front_matter(front_matter)
  content << "---\n"
  content << body
  content << "\n" unless content.end_with?("\n")

  return if File.exist?(path) && File.read(path) == content

  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, content)
  puts "Wrote #{path}"
end

geography = load_yaml(GEOGRAPHY_PATH).fetch("countries")
sections = load_yaml(SECTIONS_PATH)
all_collections = sections.values.flat_map { |section| section.fetch("collections", []) }.uniq

geography.each do |country_slug, country_data|
  country_label = country_data.fetch("label")

  sections.each do |section_key, section|
    section_path = File.join(ROOT, "country", country_slug, "#{section_key}.md")
    section_title = section.fetch("title")
    write_page(
      section_path,
      {
        "layout" => "directory_browse",
        "title" => "#{section_title} in #{country_label}",
        "permalink" => "/country/#{country_slug}/#{section_key}/",
        "directory_key" => section_key,
        "country_slug" => country_slug,
        "hero_title" => "#{section.fetch('hero_title')} in #{country_label}",
        "lead" => "Browse #{section_title.downcase} across #{country_label}.",
        "country_switch_path_template" => "/country/__COUNTRY__/#{section_key}/",
        "seo_title" => "#{section_title} in #{country_label} | Homegrown Directory",
        "seo_description" => "Browse #{section_title.downcase} in #{country_label} on Homegrown Directory."
      },
      "Explore #{section_title.downcase} across #{country_label}."
    )
  end

  country_data.fetch("regions", []).each do |region|
    region_name = region.fetch("name")
    region_slug = region.fetch("slug")
    region_path = File.join(ROOT, "country", country_slug, "#{region_slug}.md")
    write_page(
      region_path,
      {
        "layout" => "directory_browse",
        "title" => "#{region_name}, #{country_label}",
        "permalink" => "/country/#{country_slug}/#{region_slug}/",
        "country_slug" => country_slug,
        "region" => region_name,
        "region_slug" => region_slug,
        "browse_collections" => all_collections,
        "eyebrow" => "Region",
        "hero_title" => "Browse #{region_name}",
        "lead" => "Explore farms, markets, grocers, eateries, and distributors in #{region_name}, #{country_label}.",
        "country_switch_path_template" => "/country/__COUNTRY__/",
        "seo_title" => "#{region_name} Food Directory | #{country_label} | Homegrown",
        "seo_description" => "Browse transparent food listings in #{region_name}, #{country_label}."
      },
      "Explore trusted food businesses, growers, markets, and retailers in #{region_name}."
    )
  end
end
