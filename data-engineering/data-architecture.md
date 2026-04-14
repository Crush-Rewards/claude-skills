---
name: data-architecture
description: Use when making infrastructure decisions for data systems — covers when to keep cron jobs vs. adopt orchestrators, batch vs. stream, storage tiers, scaling signals, and tool selection with a "start simple" stance
---

# Data Architecture

When to keep it simple and when to graduate.

## Principles

**Start simple, graduate deliberately** — Cron jobs + Postgres is a legitimate architecture. Don't add tools to solve problems you don't have yet. Every tool you add is a tool you maintain, monitor, and debug.

**Scaling signals** — Recognize when your setup is telling you to evolve:

| Signal | Symptom | Consider |
|--------|---------|----------|
| Orchestration pain | Cron dependencies tangled, manual restarts after failures | Orchestrator (Airflow, Dagster, Prefect) |
| Transformation pain | SQL scattered, undocumented, afraid to change | dbt or structured transform layer |
| Volume pain | Single-threaded processing can't keep up | Parallel processing, columnar store |
| Team pain | Multiple people editing pipelines, stepping on each other | Version-controlled, reviewed pipeline definitions |

**Batch vs. stream** — If consumers tolerate data that's minutes or hours old, batch is simpler and cheaper. Choose streaming only when latency requirements demand it — not because it feels modern. Most scraping and analytics workloads are batch.

**Storage tier awareness** — Match storage cost to access pattern:
- Hot (queried frequently): primary database with proper indexing
- Warm (queried occasionally): same database, partitioned or archived tables
- Cold (reprocessing, compliance): object storage (S3, GCS) at a fraction of the cost

Don't pay hot-storage prices for data nobody queries.

**Reversibility** — Prefer architecture decisions that are easy to undo. Postgres doesn't lock you in — you can migrate away. Proprietary formats, vendor-specific query languages, and tightly coupled SaaS integrations are harder to reverse.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Adding orchestrator for 3 cron jobs | Overhead exceeds benefit, slows iteration |
| Choosing tools for resume appeal | Maintenance cost with no real payoff |
| Streaming for daily-consumed data | Complexity without latency benefit |
| No cold storage strategy | Primary database grows forever, costs balloon |
