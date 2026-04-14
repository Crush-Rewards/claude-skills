---
name: data-quality
description: Use when adding validation, monitoring, or quality checks to data pipelines — covers ingestion validation, schema contracts, freshness monitoring, anomaly detection, quarantine patterns, and transform testing
---

# Data Quality

How to catch problems before they propagate.

## Principles

**Validate at ingestion** — Check data before it enters your system. Row counts within expected range, null rates below threshold, values within expected bounds. A scrape returning 0 rows is not "no data" — it's a failure.

**Schema contracts** — Define what you expect from each source: required fields, types, cardinality. When a source changes its output format, you want to catch it at the boundary — not discover it through a broken dashboard three days later.

**Freshness monitoring** — Know when data is stale. If an hourly pipeline hasn't landed new rows in 3 hours, that's a signal even if nothing errored. Track `last_successful_load` timestamps per source.

**Anomaly detection (simple)** — You don't need ML. Compare today's row count to a 7-day rolling average. Flag if a price drops 90% or a product count doubles overnight. Simple thresholds with percentage-based bounds catch most real problems.

**Quarantine, don't drop** — When data fails validation, write it to a quarantine table with the failure reason and timestamp. Never silently discard records. Bad data you can inspect is better than missing data you can't explain.

**Test your transforms** — If a normalizer strips currency symbols and converts to cents, test it with known inputs and expected outputs. Transformation logic is code — treat it like code. Unit tests for pure functions, integration tests for database interactions.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| No validation between source and database | Garbage propagates silently downstream |
| Silent skipping of bad records | Data loss with no audit trail |
| No freshness tracking | Stale data served as current |
| "Looks about right" quality checks | Catches nothing until a user reports it |
