---
name: performance-indexing
description: Use when queries are slow, tables are growing, or designing index and partitioning strategies — covers index selection, EXPLAIN ANALYZE, partitioning, query patterns, and database maintenance
---

# Performance & Indexing

How to keep queries fast as data grows.

## Principles

**Index for your queries, not your schema** — Don't index every column. Look at actual query patterns: what appears in WHERE, JOIN, and ORDER BY clauses? Index those. Every index speeds reads but slows writes and costs storage. If nothing queries a column, don't index it.

**Use EXPLAIN before guessing** — Never optimize without reading the query plan first. `EXPLAIN ANALYZE` shows what the database actually does, not what you think it does. Look for sequential scans on large tables, nested loops where hash joins would be better, and sort operations that could be avoided with an index.

**Composite indexes follow query patterns** — A composite index on `(store_id, scraped_at)` serves queries filtering by both, or by `store_id` alone, but NOT `scraped_at` alone. Left-to-right prefix rule: the index is useful for any left prefix of its columns.

**Partition large tables by time** — When a table grows past millions of rows and most queries filter by date range, partition by time period (day, week, month). This lets the database skip irrelevant partitions entirely. Common pattern for scraped data: partition by `scraped_at` month.

**Avoid N+1 query patterns** — One query returning 100 rows is faster than 100 queries returning 1 row each. Batch lookups. Use JOINs or IN clauses instead of loops. This is the most common performance problem in application code hitting a database.

**Maintain your database** — Tables accumulate dead rows from updates and deletes. Run VACUUM and ANALYZE regularly (Postgres does this automatically, but verify it's keeping up). Stale statistics lead the query planner to choose bad plans.

**Denormalize at the serving layer** — Raw and staging tables should be normalized. But mart/serving tables can and should be denormalized if it avoids expensive JOINs at query time. Pre-compute what consumers need. The cost is storage and update complexity; the benefit is fast reads.

## Anti-patterns

| Pattern | Problem |
|---------|---------|
| Index every column | Write slowdown, wasted storage, no clear benefit |
| Optimize without EXPLAIN | Guessing wastes time, often makes things worse |
| No partitioning on time-series data | Full table scans as data grows, queries slow linearly |
| SELECT * in application code | Fetches unused columns, wastes I/O and memory |
| Missing index on foreign keys | JOINs become sequential scans on the child table |
