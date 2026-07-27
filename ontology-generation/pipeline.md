---
name: ontology-pipeline
description: Use when building curated-map → derived-ontology rebuild pipelines, mini-slices, SKOS exports, or gated release workflows
---

# Derivation Pipeline

Domain-agnostic layout and process.

## Preferred layout

```text
seed_source/           # immutable inputs (taxonomies, dumps)
maps/                  # curated source of truth (level maps, overrides)
ontology/
  schema.json          # object/link types + resolve policy
  bindings.json        # warehouse join contract
  build_ontology.py    # maps → objects + links
  ontology.py          # load + resolve + gaps API
  check_invariants.py  # hard gates
  build_slice.py       # mini subgraph for tests
  export_skos.py       # optional RDF/SKOS
  rebuild_all.py       # gated pipeline
docs/
  BINDINGS.md  FACETS.md  QUERY_COOKBOOK.md
tests/                 # slice vs control, full invariants
```

Adapt names and languages to the repo; keep the **separation of seed / maps / derived ontology / docs / tests**.

## Gated rebuild

Order matters; fail hard on invariants:

1. Build / refresh curated unified map if needed  
2. Build ontology → objects + links  
3. Full-graph invariants  
4. Build mini-slice  
5. Slice invariants  
6. Optional SKOS export (slice first; full graph optional/large)  
7. Unit tests (slice ≈ control on anchors)

## Mini-slice hardening

Carve a few **diverse subtrees** into an isolated subgraph with the same schema. Use for:

- fast invariant iteration
- resolve/bindings smoke tests
- SKOS export review without full-graph noise

Slice answers for anchor ids must match full-graph control.

## Attribute / schema layer

Attach attributes to target leaves; store large allowed-value enumerations **inline** on the attribute object. Source nodes inherit schema via `resolve` → mapped leaf → `hasAttribute`.

## Scope application

Config-driven in/out-of-scope lists on roots/branches; **inherit down only**. Persist `in_scope` on objects and denormalized rows for warehouse filters.

## Placement generation (when building maps)

- Code pre-filter: single-child branches need no model call.
- For multi-candidate nodes: assemble **tight** candidate set + include/exclude definitions as prompt context.
- Cheap **reasoning** LLM for placement; not pure embeddings.
- Threshold to blank; sample-audit with stronger models.
- Systematic domain rules beat thousands of one-offs when patterns exist.

## Export

Map internal relations to SKOS predicates in bindings:

| Internal | SKOS (typical) |
|----------|----------------|
| exactMatch | skos:exactMatch |
| closeMatch | skos:closeMatch |
| relatedMatch | skos:relatedMatch |
| narrowerThan / broaderThan | skos:broadMatch / skos:narrowMatch (document direction!) |
| childOf | skos:broader |

## Release hygiene

- Version `schema.json` / `bindings.json`
- Backup maps before bulk fixes
- Provenance: fix scripts + validation run folders over silent JSON edits
- Large seeds in object storage; lean git for maps + code + docs
