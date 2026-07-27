---
name: ontology-generation
description: Use when designing, building, verifying, or evolving domain ontologies and multi-taxonomy crosswalks — object/link modeling, facets vs types, identity bindings, resolve APIs, invariants, and curated-map → derived-graph pipelines. Domain-agnostic; optional retail GPC case study under examples/.
---

# Ontology Generation

**General-purpose** guidance for building ontologies and crosswalks between hierarchical type systems. Tool-agnostic (JSONL graphs, RDF/SKOS, warehouse joins).

The modules below are **domain-agnostic**. Concrete retail worked examples live only in `examples/` and are optional.

## Scope of this skill

| In scope (general) | Out of scope / elsewhere |
|--------------------|---------------------------|
| Object + link modeling, identity, resolve, invariants | A specific catalog’s leaf codes or map files |
| Crosswalk methodology between any two taxonomies | Running the GPC/browse project itself (that repo’s CLAUDE.md) |
| Facets vs type, certain-or-blank, gated rebuilds | Product-data pipelines (use `data-engineering`) |

## Which module?

**General (start here):**

- **Design stance & lifecycle** → `principles.md`
- **Object types, link types, SKOS relations** → `object-link-model.md`
- **Identity, warehouse joins, bindings** → `identity-bindings.md`
- **Facets vs type (orthogonal axes)** → `facets.md`
- **Resolve API, multi-match, inheritance** → `resolution.md`
- **Invariants, verify→fix, quality gates** → `verification.md`
- **Derivation pipeline, slices, exports** → `pipeline.md`

**Worked case study only (optional):**

- **Amazon browse nodes ↔ GS1 GPC** → `examples/gpc-browse-crosswalk.md`

If the question spans areas, start with `principles.md`, then the most relevant general module. Open the case study only when applying patterns to that retail crosswalk or when you need concrete illustrations.

## Core stance

An ontology is a **queryable derived view** over carefully curated assertions. Humans edit **maps** (or seed assertions); machines rebuild objects, links, and APIs. Prefer honest blanks over confident wrongs. Separate **what something is** (domain type) from **how it is organized or filtered** (facets). Identity is stable codes/ids, never display titles.
