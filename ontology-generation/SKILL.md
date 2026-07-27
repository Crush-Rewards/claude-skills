---
name: ontology-generation
description: Use when designing, building, verifying, or evolving product/domain ontologies — object/link modeling, crosswalks between taxonomies, facets vs product types, identity bindings, resolve APIs, invariants, and curated-map → derived-graph pipelines
---

# Ontology Generation

Principles distilled from large multi-taxonomy crosswalks (e.g. retail browse nodes ↔ GS1 GPC). Tool-agnostic: applies whether the graph is JSONL, RDF/SKOS, or a warehouse join layer.

## Which sub-skill?

- **Design stance & lifecycle** (certain-or-blank, curated vs derived, walk-down) → Read `principles.md`
- **Object types, link types, SKOS relations** → Read `object-link-model.md`
- **Identity, warehouse joins, bindings contract** → Read `identity-bindings.md`
- **Facets vs product type (orthogonal axes)** → Read `facets.md`
- **Resolve API, multi-match, inheritance** → Read `resolution.md`
- **Invariants, verify→fix, rebuild gates** → Read `verification.md`
- **Derivation pipeline, slices, exports** → Read `pipeline.md`

If the question spans areas, start with `principles.md`, then the most relevant module.

## Core stance

An ontology is a **queryable derived view** over carefully curated assertions. Humans edit the **maps** (or seed assertions); machines rebuild objects, links, and APIs. Prefer honest blanks over confident wrongs. Separate **what something is** (product/domain type) from **how it is shelved** (facets). Identity is codes/ids, never titles.
