# <Refactor Name> — Architecture (v<N>)

**Date:** <YYYY-MM-DD>
**Status:** Proposal | Approved | In progress | Shipped
**Authors:** <names>
**Version:** v<N>

---

## Problem Statement

<One paragraph: what's broken, why we're rewriting, what success looks like.>

| Issue | Impact |
|-------|--------|
| <issue 1> | <consequence today> |
| <issue 2> | <consequence today> |

## Design Principles

Numbered, opinionated, short. Each principle should be quotable in PR reviews.

1. **<Principle 1>** — <one-line rationale>
2. **<Principle 2>** — <one-line rationale>
3. **<Principle 3>** — <one-line rationale>

## High-Level Architecture

```mermaid
flowchart TB
    <subgraphs for each layer / domain>
    <arrows for data + control flow>
```

## Key Decisions

For each decision: rationale, rejected alternatives, and a **measured trigger** that would flip the decision later. Pre-commit to the metric or signal that would cause re-evaluation, so future-you doesn't have to relitigate from memory.

### Why <X> over <Y>

<Rationale. Cost / complexity / vendor lock / team familiarity. What you accepted.>

**Rejected alternative:** <Y> because <reason>.

**Promotion trigger:** <metric or signal that flips this decision>.

### Why <Z> (deferred optimization)

<Why we're not doing the optimal thing yet. What we get without it. What we accept.>

**Promotion trigger:** <e.g. "API p95 > 500ms sustained 7 days" or "raw table size > 50GB">.

**Promotion path:** <concrete steps when the trigger fires>.

## Out of Scope

What this rewrite explicitly does NOT do, and why. Anchor scope here so worktree specs can refer back.

## Open Items

- [ ] <unresolved question 1 — needs decision before contracts are frozen>
- [ ] <unresolved question 2>
