---
name: ontology-identity-bindings
description: Use when defining stable IDs, warehouse join keys, and machine-readable binding contracts between ontology graphs and analytical tables
---

# Identity & Bindings

Domain-agnostic.

## Identity rules

1. **Stable external keys** — system ids / codes, not display titles.
2. **Prefixed ontology ids** — `namespace:{key}`. Prefix encodes type namespace.
3. **Exactly one object per id** — hard invariant. Upsert when merging seed properties with map status.
4. **Never join on titles for identity** — titles are labels; they change, collide, and localize.
5. **Link endpoints must exist** — every `from`/`to` appears in the object store (hard fail).

## Bindings contract

Ship a machine-readable twin (`bindings.json`) plus a short human doc (`BINDINGS.md`):

| Concern | Document |
|---------|----------|
| Entity → warehouse key → ontology id | Table of primary keys |
| What to join for “type” | Resolve API, not navigation path |
| Match vs hierarchy edges | Semantics of each |
| Multi-match handling | Co-equal set + optional depth convenience |
| Denormalized projections | Unified flat files (e.g. one row per source node) |

### Example shape (abstract)

```json
{
  "entity_types": {
    "SourceNode": {
      "id_prefix": "source:",
      "primary_key": "source_id",
      "ontology_id": "source:{source_id}"
    },
    "TargetNode": {
      "id_prefix": "target:",
      "primary_key": "code",
      "ontology_id": "target:{code}"
    }
  },
  "resolution": {
    "level_preference": "leaf > mid > root (domain-specific names)",
    "multi_match": "co-equal; best is depth convenience only"
  }
}
```

## Warehouse join pattern

1. Start from the operational key (`source_id`, entity id, …).
2. Call **`resolve(id)`** (or pre-materialize resolve into a mart).
3. Join `best.target_code` (or the full match set) to the target dimension table.
4. Attach facets as **extra dimensions**, never as the type key.

## Denormalized projections

A unified map file (one row per source node with `match_source: self|inherited|none`) is a consumer convenience. Keep ids 1:1 with ontology objects so graph and flat views never disagree.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Joining warehouse facts on display name | Collisions and renames |
| Using top-level navigation as type | Wrong branch for nested leaves |
| Two tables both “canonical” for the same code | Drift; pick one source of truth |
| Ontology ids without prefixes | Ambiguous merges across systems |
