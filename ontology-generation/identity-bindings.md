---
name: ontology-identity-bindings
description: Use when defining stable IDs, warehouse join keys, and machine-readable binding contracts between ontology graphs and analytical tables
---

# Identity & Bindings

## Identity rules

1. **Stable external keys** — system ids / codes, not display titles.
2. **Prefixed ontology ids** — `amazon:6973705011`, `gpc:10008059`. Prefix encodes type namespace.
3. **Exactly one object per id** — hard invariant. Upsert when merging seed depth with map status.
4. **Never join on titles for identity** — titles are labels; they change, collide, and localize.
5. **Link endpoints must exist** — every `from`/`to` appears in the object store (hard fail).

## Bindings contract

Ship a machine-readable twin (`bindings.json`) plus a short human doc (`BINDINGS.md`):

| Concern | Document |
|---------|----------|
| Entity → warehouse key → ontology id | Table of primary keys |
| What to join for “type” | Resolve API, not aisle/path |
| Match vs hierarchy edges | Semantics of each |
| Multi-match handling | Co-equal set + optional depth convenience |
| Denormalized projections | Unified flat files (e.g. one row per source node) |

### Example shape

```json
{
  "entity_types": {
    "BrowseNode": {
      "id_prefix": "amazon:",
      "primary_key": "browse_id",
      "ontology_id": "amazon:{browse_id}"
    }
  },
  "resolution": {
    "level_preference": "brick > class > family > segment",
    "multi_match": "co-equal; best is depth convenience only"
  }
}
```

## Warehouse join pattern

1. Start from the operational key (`browse_id`, SKU type id, …).
2. Call **`resolve(id)`** (or pre-materialize resolve into a mart).
3. Join `best.target_code` (or the full match set) to the target dimension table.
4. Attach facets as **extra dimensions**, never as the type key.

## Denormalized projections

A unified map file (one row per source node with `match_source: self|inherited|none`) is a consumer convenience. Keep ids 1:1 with ontology objects so graph and flat views never disagree.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Joining warehouse facts on node name | Collisions and renames |
| Using L1 aisle as product type | Wrong domain for nested leaves |
| Two tables both “canonical” for the same code | Drift; pick one SoT |
| Ontology ids without prefixes | Ambiguous merges across systems |
