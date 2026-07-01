---
paths:
  - "_farms/**"
  - "_markets/**"
  - "_stores/**"
  - "_restaurants/**"
  - "_distributors/**"
  - "_vendors/**"
  - "_data/relationship_evidence.yml"
  - "assets/js/connections-map.js"
  - "scripts/relationship_audit.rb"
  - "scripts/reciprocate.rb"
  - "scripts/harvest_import.rb"
  - "scripts/evidence_audit.rb"
---

# Relationship graph rules

The web of connection is the product. Treat every edge as a factual claim.

- `sourced_from` / `supplies_to` are plain arrays of existing listing slugs.
  Keep them that way — search.json, both map views, and all audit scripts
  depend on it.
- **Graph invariant: 0 one-way claims, 0 dangling references.** Run
  `ruby scripts/relationship_audit.rb` before and after your change; pairs must
  hold or rise unless a deliberate, explained dedup lowers them.
- Never add an edge without evidence: a real source URL recorded in
  `_data/relationship_evidence.yml` (keyed `"<from>|<field>|<to>"`;
  `harvest_import.rb` writes this automatically).
- Reciprocate only when the source supports both directions. "Coming soon"
  stockists, one-off collaborations, and distributor middle-hops are not
  supply edges.
- Distributor relationships are distinct from direct grower relationships —
  route them through the `_distributors` listing, don't shortcut producer→store.
- Edges stay within one country. A cross-border edge needs explicit verified
  evidence and a note in `AUDIT_MASTER_PLAN.md` (none exist as of 2026-07-02).
- Legacy `sourced_from_text` / `supplies_to_text` fields are unrendered leads,
  not live data. Converting one to a real edge requires the target listing to
  exist and the original source to support the claim (HG-AUDIT-011).
- Orphans are fine. Never pad the graph to make a listing look connected.
