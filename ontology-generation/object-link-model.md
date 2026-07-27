---
name: ontology-object-link-model
description: Use when defining object types, link types, hierarchy edges, and SKOS-aligned match relations for a domain ontology
---

# Object / Link Model

Palantir-style **plain-data** ontology: typed objects + typed links. Philosophy only — not a platform dependency. Domain-agnostic.

## Object types (crosswalk template)

| Type | Identity | Role |
|------|----------|------|
| **SourceNode** | `source:{id}` | Nodes in the source hierarchy (catalog, nav, org chart, …) |
| **TargetNode** | `target:{code}` | Canonical type nodes at one or more levels |
| **Facet** | `facet:{kind}/{value}` | Orthogonal filter/organize axes |
| **Attribute** | `attr:{type}:{code}` | Schema dimensions attached to a type leaf |

Rename prefixes and type names for your domain (`crm:`, `unspsc:`, …). Keep object inventories **closed and intentional**. Prefer **inline enums** for huge value sets over exploding millions of value nodes.

## Link types

### Hierarchy (intra-taxonomy)

- **`childOf`** — many-to-one parent edge inside one taxonomy. Do not overload this for crosswalks.

### Match (crosswalk / type alignment)

Prefer SKOS-aligned names so exports and consumers share vocabulary:

| Relation | Meaning |
|----------|---------|
| `exactMatch` | Same concept/extent; interchangeable. Require **single target** for true 1:1. |
| `closeMatch` | Overlapping / similar, not clean containment or equivalence |
| `narrowerThan` | Source more specific than target (many leaves → one type node) |
| `broaderThan` | Source more general (one node → several targets) |
| `relatedMatch` | Associative / adjacent / flagged for review — **not** containment |

Document direction carefully when exporting to SKOS (`broadMatch` / `narrowMatch`).

### Supporting links

| Link | Role |
|------|------|
| `candidateMatch` | Unconfirmed hint on deferred nodes |
| `hasFacet` | Source → Facet |
| `hasAttribute` | Type leaf → Attribute |
| coverage / walk-down markers | Optional; keep distinct from real match links |

## Match relation derivation (recommended priority)

1. **exactMatch** — label/code equivalence **and** single target (multi-variant sets stay broader, not multi-exact).
2. **Reasoning overrides** — small curated map for 1:1 cases cardinality cannot decide.
3. **Cardinality fallback** — multi-target → `broaderThan`; multi-source into one target → `narrowerThan`; else `closeMatch`.

Cardinality-only relations are sample-validate; do not claim high precision without audit.

## Schema artifact

Ship a versioned `schema.json` (or equivalent) that lists:

- object types + id prefixes + key props + sources
- link types + from/to + cardinality notes
- which links count as “match” for resolve
- match-relation derivation rules in one paragraph

Bump version when resolve policy or identity rules change.

## Graph shape tips

- **One object row per id** (upsert; never duplicate identity).
- Materialize full target hierarchy (`childOf`) even if maps only assert leaf links — reverse gaps and level checks need parents.
- Status props (`confident` / `blank` / `deferred`) live on source objects; rank upgrades carefully when the same id appears at multiple map levels.
