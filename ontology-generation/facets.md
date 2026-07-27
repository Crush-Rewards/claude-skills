---
name: ontology-facets
description: Use when modeling orthogonal merchandising or classification axes that must not be confused with product or domain type
---

# Facets vs Product Type

Facets are **orthogonal axes** one taxonomy uses for shelving or filtering that the target type system does not encode as product type.

## Dual links are intentional

| Link | Role |
|------|------|
| `hasFacet` | How the source shelves / filters the node |
| match (`exactMatch` / …) | **What the product is** in the target type system |

Treating a facet value as a GPC (or other) join key — or blanking product type because a facet exists — is the core anti-pattern crosswalks are built to avoid.

## Closed kind vocabulary

Define allowed `kind` values in code (e.g. `facet_policy.py`). Unknown kinds are **hard failures** (vocabulary drift). Dual facet+match counts are **stats**, not failures.

Typical kinds:

| Kind | Examples | Type still maps to |
|------|----------|--------------------|
| `demographic` / `audience` | women, boys, baby | Clothing, Footwear, … |
| `genre` | Jazz, Rock | CD / digital music bricks |
| `species` | Dogs, Cats | Pet food / care |
| `sourcing` | handmade | Underlying craft type |
| `platform` | PlayStation, Xbox | Console / software type |
| `topic` | Business apps | App / software type |
| `condition` | collectible | Underlying product type |

## Facet-leak pattern (common defect)

Sport / audience / brand containers whose **children are apparel** (or another type) inherit equipment (or brand-apparel) matches. Fix by asserting product-type match links on the **product-type containers** so resolve prefers the right type over a coarser inherited link.

Detection sketch: node name/path matches apparel (or other type) keywords but resolved target segment ∉ expected set.

## Query guidance

```text
facets(source_id)  → [{kind, value}]   # filters / dimensions
resolve(source_id) → product type      # join key for type
```

Do **not** use facet value as the target-type join key.

## Scope vs facets

Out-of-scope trees (industrial, crops, pure services) are **scope**, not facets. Facets explain axes *within* an in-scope catalog; scope excludes whole subtrees from product mapping.
