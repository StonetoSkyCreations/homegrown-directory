Homegrown SEO Doctrine

Canonical rules for SEO, metadata, and AI retrieval

Version: 1.0
Applies to: Homegrown Directory (Jekyll, static)
Scope: Titles, meta descriptions, canonical URLs, schema, AI retrievability

0. Purpose (Read This First)

Homegrown is an entity-first directory.

SEO here is not about keywords or ranking tricks.
It is about clarity, consistency, and machine legibility across hundreds (eventually thousands) of listing pages.

This document defines non-negotiable rules that ensure:

Search engines correctly index listings

AI systems correctly interpret entities

Metadata remains consistent as the site scales

Future contributors do not accidentally degrade SEO

If a proposed change conflicts with this doctrine, the doctrine wins unless explicitly revised.

1. Core Principles

Entity clarity beats keyword cleverness

Consistency beats expressiveness

System defaults beat manual overrides

Machine legibility beats human persuasion at the meta layer

Conservative semantics beat speculative optimisation

2. Single Source of Truth
2.1 Meta generation

All titles, meta descriptions, canonicals, Open Graph, and Twitter tags are generated via:

_includes/seo-meta.html


No layout, page, or collection should emit its own <title> or meta tags unless explicitly approved.

3. Title Doctrine
3.1 One title per page

Exactly one <title> tag per page.

No duplicates, no overrides unless justified.

3.2 Listing title format (canonical)
{Name} — {Type} in {City}, {Region} | Homegrown Directory


Rules:

Name is always first.

Type must be the canonical collection label (see Section 5).

City used when present; otherwise fall back to Region.

Avoid repeating identical locality/region strings.

Country is omitted by default (NZ assumed) unless disambiguation is required.

Practice tags, marketing phrases, or adjectives are never appended.

3.3 Non-listing pages

Homepage: concise, mission-based.

Collection pages:
Farms in Canterbury | Homegrown Directory

Region pages:
{Type} in {Region} | Homegrown Directory

4. Meta Description Doctrine
4.1 Purpose

Meta descriptions serve AI summarisation first, click-through second.

They must be:

Factual

Entity-specific

Reusable by AI systems without rewriting

4.2 Fallback hierarchy (listings)

page.summary

page.description

page.intro

page.excerpt (cleaned)

site.description (last resort)

4.3 Contextual prefix (listings)

When generating a listing description, prepend:

{Name} in {City}, {Region}. …


This context is metadata-only and must not alter page body content.

4.4 Truncation rules

Target length: ~155–160 characters

Truncate at:

Sentence boundary where possible

Otherwise last word boundary before limit

Strip dangling punctuation (- – — , ; :) before adding ellipsis

Use a single ellipsis character (…)

Never clip mid-word

No copy rewriting is permitted at the meta layer.

5. Canonical Type Mapping (Non-Negotiable)

Each listing collection maps to one stable noun.

Collection	Canonical Type
farms	Farm
markets	Market
stores	Store
vendors	Vendor
restaurants	Restaurant
distributors	Distributor
5.1 Explicit overrides (allowed)

A more specific type may be used only when an explicit, reliable signal already exists in front matter or collection logic.

Examples:

Store → Grocery Store (only if explicitly marked as grocery)

Vendor → Restaurant (only if classified as restaurant)

Cafe/Coffee Shop → only with explicit signal

5.2 Forbidden

Guessing type from description text

Synonym drift (e.g. “Hub”, “Grocer”, “Eatery” without explicit signal)

Marketing language in type labels

6. Canonical URLs

Every indexable page must emit a canonical URL.

Canonicals must:

Use HTTPS

Use the production domain

Match the actual page URL

Canonicals are generated automatically; manual overrides are not permitted.

7. Schema (JSON-LD) Governance
7.1 Purpose

Schema exists to anchor entity understanding, not to chase rich results.

7.2 Rules

JSON-LD must:

Parse as valid JSON

Reflect visible page content exactly

Use conservative @type selection

Base type defaults to LocalBusiness or the collection’s established schema.

Address, geo, hours, phone are emitted only if present.

No empty schema shells.

No schema stuffing.

7.3 Alignment

Schema output must remain aligned with:

Title

Meta description

On-page facts

If they diverge, schema is wrong.

8. Overrides Policy (Strict)
8.1 Allowed overrides

seo_title

seo_description

schema_type

Only allowed when:

The default output is clearly insufficient

There is a documented reason

The override improves clarity, not marketing appeal

8.2 Forbidden overrides

Keyword stuffing

Location repetition

Marketing slogans

Emojis

Subjective claims (“best”, “leading”, etc.)

9. AI Retrieval Readiness

Homegrown listings should be easily quotable by AI systems.

Therefore:

Titles must clearly identify the entity

Descriptions must answer “what is this and where is it?”

HTML must remain clean and semantic

Hidden content, obfuscation, or SEO hacks are prohibited

10. What Not To Do (Ever)

Do not add per-page SEO hacks

Do not optimise for “clickbait”

Do not add duplicate meta logic in layouts

Do not introduce new schema types casually

Do not chase SEO trends without evidence

11. Maintenance & Review

SEO doctrine is reviewed quarterly, not continuously.

Changes require:

Evidence

System-wide impact analysis

Documentation update

SEO should evolve slowly and intentionally.

12. Final Rule

If you are unsure whether a change improves SEO:

Do nothing.

Stability beats speculation.
