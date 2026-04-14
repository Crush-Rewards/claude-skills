---
name: pipeline-design
description: Use when building, reviewing, or fixing data pipelines — covers idempotency, failure isolation, backfill, retry strategies, observability, and separation of extract/transform/load concerns
---

# Pipeline Design

How to make data pipelines reliable and recoverable.

## Principles

**Idempotency** — Every step safe to re-run. Same input, same result, no duplicates. Use upserts (INSERT ON CONFLICT), deterministic IDs (hash of natural key + date), or delete-and-replace within a time window.

**Failure isolation** — A failure in step N must not corrupt step N-1's output. Each step should land data in a consistent state before the next step begins. If step 3 fails, steps 1-2's data is still valid and usable.

**Backfill capability** — Every pipeline accepts a date range parameter. When you fix a bug in transformation logic, you need to reprocess historical data. Design for this from day one — retrofitting backfill is painful.

**Retry with backoff** — Transient failures (API timeouts, connection drops) retry automatically with exponential backoff. Permanent failures (schema changes, auth revoked) alert and stop. Distinguish between the two explicitly.

**Observability** — Log what was processed: record count, time elapsed, source identifier. Not just errors — silence is the hardest failure to debug. A pipeline that "ran successfully" but processed 0 rows is a failure.

**Separation of concerns** — Extract, transform, and load as distinct steps. Even in a simple script, don't mix "fetch from API" with "normalize data" with "write to database." Each step should be independently testable and replaceable.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Fire-and-forget cron jobs | No error handling, no alerting, failures go unnoticed |
| Can't re-run without manual cleanup | Duplicates on retry, requires human intervention |
| Transform logic in the extract step | Can't fix transforms without re-extracting |
| No logging beyond "it ran" | Impossible to debug volume drops or silent failures |
