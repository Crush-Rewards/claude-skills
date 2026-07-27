---
name: ontology-principles
description: Use when establishing general ontology design principles, deciding what to assert, or structuring curated-map vs derived-graph work
---

# Ontology Principles

Domain-agnostic. For a full retail illustration, see `examples/gpc-browse-crosswalk.md`.

## Certain or blank

Assert only mappings you would defend under review. Leave honest blanks (deferred + optional candidate hints) for later refinement. A wrong confident link is worse than a gap: gaps are queryable; silent errors poison every downstream join.

## Two representations, one source of truth

| Layer | Role | Edit how |
|-------|------|----------|
| **Curated maps / assertions** | Source of truth | Deterministic fix scripts or intentional map edits |
| **Derived ontology** | Object/link graph + query API | Rebuild only — never hand-edit instances |

If generators rebuild maps from scratch, **baked fixes live in the map files**, not only in generator code. Document: re-running generate without re-applying fixes **reverts** human work.

## Walk down, precision up

Map coarse → fine along the target type hierarchy (root → mid → leaf, or whatever levels the target defines). Coarse structure is cheap and stable; leaf precision is hard. Defect rate usually **grows with depth** — budget verification accordingly.

## Co-equal multi-match, no silent primary

A node may map to an **unordered set** of targets. Do not invent a ranked “primary” unless the product explicitly needs a ranker. A convenience `best` (deepest level, etc.) is fine if documented as non-semantic.

## Facets for orthogonal axes

When one taxonomy organizes on an axis the other does not model (audience, genre, platform, geography, condition, …), tag a **Facet**. Map the **domain type** separately. Dual facet + match is expected, not a conflict. See `facets.md`.

## Ontology derived as you go

Re-derive and run invariants at each checkpoint. Defer hand-refining relation typing and authoring-directly-in-ontology until structure is trusted. Semantic polish (exactMatch refinement, SKOS export) is an endgame, not a prerequisite for useful resolve.

## What the ontology buys you

Things you would maintain by hand become **queries**:

- type resolution with inheritance along hierarchy
- forward gaps (unmapped sources) / reverse gaps (unused targets)
- typed neighbors and relation distributions
- inherited attribute schemas via the mapped type node
- facet dimensions alongside type

## Scope discipline

Define in-scope vs out-of-scope early (product domains, business lines, geographies). Out-of-scope **inherits down** the tree only — never force parents out because a descendant is out.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Hand-editing instance graphs / triples | Diverges from maps; rebuilds wipe work |
| Asserting from parent labels alone | Over-span and wrong branch |
| Using navigation path as domain type | Path ≠ type (a leaf’s aisle can disagree with its true type) |
| Embeddings-only placement | Placement needs include/exclude boundary reasoning |
| Forcing foreign domains into one taxonomy | Separate vocabularies or leave blank |
| Treating every blank as a bug | Many blanks are correct (target vocab has no leaf) |
