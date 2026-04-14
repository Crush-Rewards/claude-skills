---
name: data-engineering
description: Use when designing, reviewing, or debugging data pipelines, schemas, data quality checks, or making architecture decisions about data infrastructure — tool-agnostic, principles-first
---

# Data Engineering

Principles-first guidance for building reliable data systems. Tool-agnostic — applies whether you're using cron + Postgres or Airflow + Snowflake.

## Which sub-skill?

- **Pipeline reliability** (idempotency, failure handling, backfill, retries, observability) → Read `pipeline-design.md`
- **Schema & modeling** (layering raw/staging/mart, naming, SCDs, evolution) → Read `data-modeling.md`
- **Data quality** (validation, contracts, freshness, anomaly detection, quarantine) → Read `data-quality.md`
- **Architecture decisions** (tool selection, batch vs. stream, scaling signals) → Read `data-architecture.md`
- **Performance & indexing** (query optimization, EXPLAIN, indexes, partitioning, maintenance) → Read `performance-indexing.md`

If the question spans multiple areas, start with the most relevant and cross-reference.

## Core stance

Start simple. Graduate deliberately. Every principle here applies at any scale — the implementation changes, the thinking doesn't.
