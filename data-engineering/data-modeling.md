---
name: data-modeling
description: Use when designing database schemas for scraped or ingested data — covers raw/staging/mart layering, naming conventions, slowly changing dimensions, source-of-truth discipline, and schema evolution
---

# Data Modeling

How to structure stored data for reliability and evolution.

## Principles

**Schema layering** — Separate raw from clean from consumption-ready:
- **Raw/Landing** — Exactly what the source gave you. Untransformed, append-only. This is your insurance policy — you can always reprocess from raw.
- **Staging/Clean** — Deduplicated, typed, normalized. Business logic starts here. One row = one entity.
- **Mart/Serving** — Shaped for the consumer (API, dashboard, export). Denormalized where it helps performance.

**Naming conventions** — The name tells you the layer and the domain. Pattern: `{layer}_{source}_{entity}`. Examples: `raw_apify_products`, `stg_products_cleaned`, `mart_product_prices`. Consistent prefixes make discovery trivial.

**Slowly Changing Dimensions** — When a value changes, decide per field:
- Type 1: Overwrite. Current state only. Simple, loses history.
- Type 2: Add row with valid_from/valid_to. Full history. More storage and query complexity.
- Type 3: Add previous_value column. One level of history. Good for "what changed last."

**Source-of-truth discipline** — Every field traces to exactly one authoritative source. If two scrapers return the same field, pick one as canonical and document the decision.

**Schema evolution** — Adding columns is safe. Renaming or removing breaks downstream. Migration pattern: add new column → backfill → update consumers → drop old column. Never skip steps.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Raw and transformed data in the same table | Can't reprocess, can't audit what the source sent |
| No historical record of changes | Can't answer "what was the price last week?" |
| Ambiguous names (`status`, `type`, `value`) | No one knows what they mean without reading code |
| Multiple sources writing without dedup | Conflicting data, no single source of truth |
