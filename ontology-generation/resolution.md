---
name: ontology-resolution
description: Use when designing resolve APIs, multi-match policy, inheritance along hierarchies, or consumer query cookbooks for ontologies
---

# Resolution & Query API

Domain-agnostic.

## Resolve policy (recommended default)

1. Start at the source node.
2. Collect **match** links (`exactMatch`, `closeMatch`, `broaderThan`, `narrowerThan`, `relatedMatch` — exclude candidates / coverage markers unless documented).
3. If none, walk **`childOf` upward** (bounded depth) and inherit the first ancestor with matches.
4. Prefer **deepest target level** for convenience `best` (leaf > mid > root — use your level names).
5. Multi-match remains a **co-equal set**; `best` is not a ranked primary.

Return shape:

| Field | Meaning |
|-------|---------|
| `match_source` | `self` \| `inherited` \| `none` |
| `inherited_from` | Ancestor id when inherited |
| `matches` | Full typed set |
| `best` | Depth-preferred convenience hit |
| `facets` | Optional orthogonal axes on the node |
| `path` | Human navigation path (label only) |

## Fine-beats-coarse

If a node has both coarse-level and fine-level match links, **fine wins**. Prefer clearing redundant coarser links at build time so inventory matches resolve policy (invariant). Dual coarse+fine on the same node is a hard fail in strict graphs.

## Multi-match rules

- Multiple targets → do **not** emit multiple `exactMatch` without proof of true 1:1 synonymy.
- Multi-variant targets (same concept, several packing/form variants) stay `broaderThan` or multi co-equal — not multi-exact.
- Analytics needing a single leaf type: filter on finest level or apply an **explicit** ranker outside the ontology core.

## Inheritance semantics

- Inheritance is **upward along hierarchy**, not sideways.
- Document max walk depth.
- Unified flat maps should expose `inherited_from` consistently with the graph API.

## Query cookbook essentials

Document worked examples for:

- resolve self vs inherited
- co-equal multi-match parents vs single-leaf children
- facet + type dual
- `forward_gaps()` / `reverse_gaps(strict=)`
- attribute schema inheritance via mapped type leaf

## Consumer anti-patterns

1. Using top-level navigation as domain type.
2. Taking `matches[0]` without level preference.
3. Treating multi-match as a single primary without a stated ranker.
4. Joining on titles.
5. Using facet values as type keys.
