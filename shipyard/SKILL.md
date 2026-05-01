---
name: shipyard
description: Use when planning a large multi-component refactor or rebuild that needs parallel agent execution — system rewrites, pipeline overhauls, monolith decomposition, infrastructure cutover, anything where 5+ independent units of work could run concurrently if their interfaces were defined upfront.
---

# Shipyard

## Overview

A Shipyard refactor decomposes a large rebuild into **isolated drydocks (git worktrees)** that get built in parallel against **shared engineering specs (contracts)**. Phases are launch windows — within a phase every drydock builds simultaneously; between phases the fleet runs sea trials before the next batch starts.

**Core principle:** Define the interfaces (contracts) first. Any worktree that only touches its own files and respects the contracts can be dispatched to a Claude agent in parallel with every other worktree in the same phase.

## When to Use

- Multi-week refactor that touches 5+ subsystems
- System rewrite with a cutover (legacy + v2 side-by-side)
- Monolith → services decomposition
- Infrastructure migration with multiple co-dependent services
- Anything where you'd want 4+ Claude agents running in parallel

**Don't use** for: single-file changes, isolated bug fixes, exploratory spikes, anything that fits in one PR.

## The Six Stages

```
1. Brainstorm  →  superpowers:brainstorming  (+ data-engineering if data infra)
2. Blueprint   →  templates/blueprint.md
3. Contracts   →  templates/contracts.md
4. Phases      →  templates/phase-readme.md      (one per phase)
5. Drydocks    →  templates/worktree-spec.md     (one per worktree)
6. Dispatch    →  templates/agent-orchestration.md + templates/agent-bootstrap.md
```

### 1. Brainstorm
Before any docs, run **superpowers:brainstorming** to surface intent, constraints, and tradeoffs. If the refactor touches data pipelines, schemas, or storage, also load **data-engineering** for principles. Output: a written design spec the blueprint can build on.

### 2. Blueprint — `docs/<refactor-name>-architecture.md`
Single source of truth for **why** and **what**. Sections: Problem statement (table of issues + impact), Design principles (numbered, opinionated), High-level architecture (mermaid), Key decisions (each with rationale + rejected alternatives + measured trigger for re-eval), Open items.

### 3. Contracts — `docs/worktrees/phase-1/contracts.md`
Single source of truth for **how the parts talk**. Every shared boundary gets a numbered contract: file formats, schema specs, audit tables, job schemas, ID generation, shared types package, feature flags, retention policies, schema-evolution policy.

**Versioned.** Top-of-file YAML header has `contract-version: X.Y.Z`. Agents pin to a version at dispatch and **halt** if it bumps mid-run. Breaking changes need a major bump and acknowledgment from every affected worktree.

### 4. Phases — `docs/worktrees/phase-N/README.md`

> **THE IRON LAW:** A phase contains only worktrees that are TRULY parallel. If worktree X blocks merge of worktree Y — even partially — they belong in different phases.

This is the rule you most often violate. Symptoms:

- "B can start coding once A1 lands but can't merge until A2"
- "C consumes B's job format"
- "F tests against E's middleware"

If any of those is true, that worktree goes in a later phase. Better to have 5 phases of pure-parallel worktrees than 2 phases with hidden serial dependencies. Pure-parallel phases let you dispatch N agents simultaneously with zero coordination overhead; mixed phases force agents to wait on each other and silently re-introduce serial execution.

Each phase README lists: worktrees in this phase, conflict zones (files multiple worktrees touch + resolution policy), the integration branch, the entry criteria, and the phase exit gate (`npm run verify:phase-N` + `e2e:smoke`).

### 5. Drydocks — `docs/worktrees/phase-N/worktree-<letter>-<name>.md`
One self-contained spec per worktree. An agent re-reads this at dispatch and has everything it needs to ship without context from outside the spec. Sections: phase, branch, depends-on, goal, what-you're-building (mermaid), file structure, **task list with `VERIFY:` shell command per task**, files-you-do-NOT-touch, acceptance criteria, out-of-scope.

### 6. Dispatch — `docs/worktrees/agent-orchestration.md` + `agent-bootstrap.md`

- **agent-orchestration.md:** DAG (yaml form), dispatch waves (one wave per phase), agent brief template (the exact prompt each dispatched agent reads at start), contract-version handling, failure modes table, human checkpoints.
- **agent-bootstrap.md:** one-time repo setup, per-worktree `git worktree add` + `worktree-bootstrap.sh`, env vars per role, baseline-green check, e2e smoke command, teardown.

**Integration branch:** every worktree PR targets `<refactor-name>` (long-lived integration branch), NOT `dev`/`main`. Merges to `dev` are per-worktree once verified, to avoid wasted CI/deploys on docs and in-progress work.

## Verify-Driven Discipline

Every acceptance criterion in a worktree spec has a `VERIFY:` shell one-liner. Agents run it before claiming a task done. Each worktree gets `npm run verify:<letter>` (runs all VERIFYs in sequence). Each phase gets `npm run verify:phase-N` (runs all worktree verifies + e2e smoke).

No green VERIFY = task not done. No exceptions.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Coding before contracts are written | Stop. Write contracts.md first. Pin a version. |
| Phase 1 has worktree B "depending on" worktree A | Move B to phase 2. Phases are pure-parallel only. |
| Worktree spec says "see codebase" instead of files-you-touch list | Make it self-contained. The agent will not have your context. |
| Acceptance criterion without a VERIFY command | Write the shell one-liner. If you can't, the criterion is too vague. |
| Contracts changed without version bump | Halt. Bump version. All affected worktrees re-pin. |
| Worktree PRs target `dev` directly | Target the integration branch. `dev` is for finished, verified worktrees. |
| Skipping the agent brief template | Agents that don't re-read brief + contracts at task start commit against stale assumptions. |
