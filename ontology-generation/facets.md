---
name: ontology-facets
description: Use when modeling orthogonal classification or merchandising axes that must not be confused with domain type
---

# Facets vs Domain Type

Domain-agnostic. Facets are **orthogonal axes** one taxonomy uses for organization or filtering that the target type system does not encode as type.

## Dual links are intentional

| Link | Role |
|------|------|
| `hasFacet` | How the source organizes / filters the node |
| match (`exactMatch` / …) | **What the entity is** in the target type system |

Treating a facet value as a type join key — or blanking type because a facet exists — is the core anti-pattern.

## Closed kind vocabulary

Define allowed `kind` values in code or config. Unknown kinds are **hard failures** (vocabulary drift). Dual facet+match counts are **stats**, not failures.

Kinds are domain-specific. Illustrative only:

| Kind | Role |
|------|------|
| audience / demographic | Who it is for |
| genre / topic | Content theme |
| platform / channel | Where it runs or sells |
| condition / sourcing | State or supply axis |
| species / region | Domain-specific axes |

Do not copy a kind list from another project without validating it for yours.

## Facet-leak pattern (common defect)

Containers organized by facet (sport, brand, audience) whose **children are a different product type** inherit the container’s type match. Fix by asserting type match links on the **true type containers** so resolve prefers the right type over a coarser inherited link.

Detection sketch: node path/name signals type A, but resolved target branch is type B (the facet parent’s type).

## Query guidance

```text
facets(source_id)  → [{kind, value}]   # filters / dimensions
resolve(source_id) → domain type       # join key for type
```

Do **not** use facet value as the target-type join key.

## Scope vs facets

Out-of-scope subtrees (wrong business line, pure services, non-product) are **scope**, not facets. Facets explain axes *within* an in-scope catalog; scope excludes whole subtrees from type mapping.
