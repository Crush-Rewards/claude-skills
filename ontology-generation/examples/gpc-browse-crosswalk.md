---
name: ontology-example-gpc-browse
description: Optional case study — Amazon browse nodes ↔ GS1 GPC crosswalk. Read only when applying the general skill to that retail project or when you need concrete illustrations. Not the default scope of ontology-generation.
---

# Case study: Amazon browse ↔ GS1 GPC

> **This file is a worked example only.**  
> General principles live in the parent modules (`principles.md`, `object-link-model.md`, …).  
> Do not treat browse/GPC vocabulary as required for every ontology.

**Origin project:** `gpc-to-bnodes-map` — map Amazon retail browse nodes to GS1 Global Product Classification (GPC), then derive a queryable object/link graph.

## Domain mapping (general concept → this project)

| General term | This project |
|--------------|--------------|
| Source taxonomy | Amazon browse nodes (`nodes.jsonl`, ~33k) |
| Target taxonomy | GPC v20260520 (segment → family → class → brick) |
| SourceNode | `BrowseNode` · id `amazon:{browse_id}` |
| TargetNode | `GpcNode` · id `gpc:{code}` · levels segment/family/class/brick |
| Fine / coarse | brick > class > family > segment |
| Facet | Orthogonal merchandising axes (audience, genre, platform, …) |
| Attribute | GPC L5 attributes on bricks; L6 values inline |
| Curated maps | `toplevel-map.json` + `level{2,3,4}-map.json` |
| Derived graph | `objects.jsonl` + `links.jsonl` via `build_ontology.py` |

## Principles as applied here

- **Certain or blank** — only confident browse→GPC links; deferred nodes keep candidate hints.
- **Co-equal multi-match** — a browse node may map to several GPC nodes; no ranked primary.
- **Facets** — Baby / Handmade / Pet species / Music genre / Fan Shop team brand, etc. map product type separately; dual `hasFacet` + match is expected (I6 stats, not failure).
- **Services** — out of GPC product scope (UNSPSC-style, separate effort).
- **Scope** — crops, industrial, etc. out-of-scope; inherits **down** only (`scope.json`).

## Object / link inventory (illustrative)

| Type | Prefix | Notes |
|------|--------|-------|
| BrowseNode | `amazon:` | depth, status, path, in_scope |
| GpcNode | `gpc:` | level, title, definition |
| Facet | `facet:` | closed kinds in `facet_policy.py` |
| Attribute | `gpcattr:` | brick_code:attr_code; values inline |

**Match links:** exactMatch · closeMatch · broaderThan · narrowerThan · relatedMatch (SKOS-aligned).  
**Other:** childOf · hasFacet · hasAttribute · candidateMatch · coveredAtDepth.

**Relation derivation priority:** title-equivalent exactMatch (only if n_targets==1) → reasoning overrides (`relation-overrides.json`) → cardinality broader/narrower/close.

## Resolve policy (as implemented)

```text
resolve(browse_id):
  walk childOf up ≤ 12
  prefer brick > class > family > segment for `best`
  multi-match co-equal
  match_source: self | inherited | none
```

**Brick-beats-class:** dual class+brick match links are invariant **I1** failures; clear redundant class when a brick exists.

**Classic pitfall:** L1 aisle ≠ product type (e.g. Protein Bars under Health resolve to Food/Beverage brick `10008059`).

## Facet kinds used

`demographic` / `audience` · `genre` · `species` · `sourcing` · `platform` · `topic` · `condition`

**Facet-leak fixes applied historically:** sport→clothing containers leaking to Sports Equipment; Fan Shop non-apparel team merch leaking to apparel families.

## Bindings (join contract)

| Entity | Warehouse key | Ontology id |
|--------|---------------|-------------|
| Browse | `browse_id` | `amazon:{browse_id}` |
| GPC | `code` | `gpc:{code}` |

Never join on titles. Machine twin: `bindings.json` + `docs/BINDINGS.md`.

## Invariants (project I1–I6)

| Id | Project meaning |
|----|-----------------|
| I1 | No dual class+brick match on one browse node |
| I2 | resolve best is deepest among direct matches |
| I3 | GPC brick has materialised parent chain |
| I4 | No multi-exactMatch mess |
| I5 | Unique ids; link endpoints exist |
| I6 | Unknown facet kind hard-fails; dual facet+match is OK |

## Pipeline layout (project)

```text
seed_source/           GPC JSON, nodes.jsonl
output/taxonomy-mapping/   curated maps (SoT)
output/ontology/           schema, build, resolve API, slice/, SKOS
docs/                      BINDINGS, FACETS, QUERY_COOKBOOK
VERIFY.md / CERTIFY.md     sample verify vs exhaustive certify runbooks
```

Gated: `rebuild_all.py` → build → full invariants → slice → slice invariants → tests.

## Verification lessons (portable, concrete numbers)

- Defect rate grew with depth (~7% → ~35% L0→L4 on lexical pipeline).
- Systematic detectors (facet leak, periodicals, surgical devices, brick-beats-class) beat one-off leaf fixes for aggregate lift.
- Residual blanks often = **GPC has no brick** (auto parts, passive components) — correct certain-or-blank, not a map bug.
- Placement: cheap reasoning LLM + tight candidate context; **not** embeddings-only.

## When to open this file

- Extending or re-verifying the browse↔GPC project  
- Teaching the general skill with a real scale example  
- Porting patterns (not codes) to another retail crosswalk  

## When not to

- Designing a non-retail ontology (CRM, services, internal product types, …) — stay on parent modules  
- Looking up a GPC brick or browse id — use the project data / tools, not this skill  
