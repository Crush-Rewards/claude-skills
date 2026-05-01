# Phase <N> — <Phase Name>

**Goal:** <one-sentence outcome>
**Integration branch:** `<branch-name>`
**Phase exit gate:** `npm run verify:phase-<N>` + `npm run e2e:smoke`

## Worktrees in this phase (all run in parallel)

| # | Worktree | Responsible for | Spec |
|---|----------|-----------------|------|
| <X> | **<Name>** | <one-line summary> | [`worktree-<x>-<name>.md`](./worktree-<x>-<name>.md) |
| <Y> | **<Name>** | <one-line summary> | [`worktree-<y>-<name>.md`](./worktree-<y>-<name>.md) |
| <Z> | **<Name>** | <one-line summary> | [`worktree-<z>-<name>.md`](./worktree-<z>-<name>.md) |

> **The Iron Law of Phases:** every worktree above is mutually independent. None blocks another's merge. If you find a dependency between two of these worktrees, push the dependent one to phase <N+1> instead. Pure-parallel phases are the only way to fully amortize agent dispatch.

## Conflict zones

Files multiple worktrees in this phase touch — coordinate via the resolution policy:

| File | Worktrees | Resolution |
|------|-----------|------------|
| `<path>` | <X>, <Y> | <e.g. each appends a distinct block; additive> |
| `package.json` | All | Real conflicts — resolve by accepting both sides. |
| `<config>` | <X>, <Z> | <e.g. ordered list at top; coordinate placement> |

## Entry criteria

- [ ] All phase <N-1> worktrees merged to integration branch
- [ ] `npm run verify:phase-<N-1>` green
- [ ] `npm run e2e:smoke` green
- [ ] Contract version pinned for this phase: `<X.Y.Z>`

## Exit criteria

- [ ] All worktrees in this phase merged to integration branch
- [ ] `npm run verify:phase-<N>` green
- [ ] `npm run e2e:smoke` green
- [ ] <Phase-specific gate, e.g. "MCP contract CI green" / "100% flag rollout stable 7 days">

## Out of scope for this phase

What we are explicitly deferring to phase <N+1> or later. Anchor here so worktree specs can refer back without re-litigating scope.
