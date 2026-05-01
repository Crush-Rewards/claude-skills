# Agent Orchestration — <Refactor Name>

How to dispatch Claude Code agents to execute the worktree plan.

## Integration branch — all worktree PRs target `<integration-branch>`, NOT `dev`

Why: `dev` typically auto-deploys + runs Pre-Deploy migrations. Merging docs / spec / in-progress worktree PRs to `dev` triggers wasted deploys and redundant DB work. Use a long-lived integration branch named after the refactor.

```
feature/worktree-<x>  →  PR (target: <integration-branch>)  →  no deploy
                                       ↓  per-worktree when ready
                          PR (target: dev)  →  deploy once per merged worktree
                                       ↓
                          dev  →  main  (prod via standard flow)
```

**Sync cadence:**
- `<integration-branch>` must be re-synced with `dev` before opening any new worktree PR (rebase or merge `origin/dev` in). This catches hotfixes that land on `dev` directly.
- `<integration-branch>` → `dev` merges are per-worktree, not per-phase.

## DAG

```yaml
worktrees:
  A:
    phase: 1
    depends_on: []
    parallel_with: []          # foundational; nothing else runs in phase 1
    verify: npm run verify:a

  B:
    phase: 2                   # NOT phase 1 — depends on A's contracts
    depends_on: [A]
    parallel_with: [C, D, E]
    verify: npm run verify:b

  C:
    phase: 2
    depends_on: [A]
    parallel_with: [B, D, E]
    verify: npm run verify:c

  # ... etc
```

> **Iron Law check:** every worktree in `parallel_with: [...]` must be in the same `phase`, and none may appear in another's `depends_on`. If yes → split phases.

## Dispatch waves

### Wave 1 — Phase 1 worktrees (parallel)
Dispatch <N> agents simultaneously, one per worktree. Use Claude Code's parallel agent dispatch (one message, N Agent tool calls).

### Wave 2 — Phase 1 verification
Single agent runs `npm run verify:phase-1` + `npm run e2e:smoke`. On green, proceed.

### Wave 3 — Phase 2 worktrees (parallel)
...

### Wave N — Phase N verification + cutover

## Agent brief template

Every dispatched agent receives this prompt verbatim, with placeholders filled in:

```
You are executing Worktree <letter> of the <refactor-name> plan.

Required reading before you start:
- docs/worktrees/phase-<N>/worktree-<letter>-<name>.md (your spec — full content)
- docs/worktrees/phase-1/contracts.md (pin contract-version <X.Y.Z>; halt if mismatched)
- docs/<refactor-name>-architecture.md (architecture context)
- docs/worktrees/agent-bootstrap.md (local-dev setup)
- root CLAUDE.md (repo conventions, git workflow)

Your branch: worktree-<letter>-<name>
Your base: <integration-branch>

Run `scripts/worktree-bootstrap.sh <letter>` before starting.

For each task in your spec's task list:
1. Implement the task
2. Run the task's VERIFY command — must exit 0
3. Commit the task as one atomic commit
4. Move to next task

When all tasks complete:
1. Run `npm run verify:<letter>` — must exit 0 (all VERIFY commands in sequence)
2. Run `npm run e2e:smoke` against your branch — must green
3. Open a PR against `<integration-branch>` (NOT `dev`)

Do not modify files listed in "Files you do NOT touch."
Do not skip VERIFY commands.
Do not mark done until all VERIFY + e2e:smoke green.
If contract-version bumps mid-run, halt and escalate.
```

## Contract version handling

Every agent re-reads `contracts.md` at start of run and pins `contract-version`. If the version at commit time differs from pin time:
- Agent halts
- Task tracker flags "contract drift detected; human review"
- Human arbitrates (usually: rebase + re-verify)

## Failure modes

| Mode | Detection | Action |
|------|-----------|--------|
| Agent hits a tool/command error | Non-zero exit | Retry once; escalate to human if still failing |
| Agent passes VERIFY but fails e2e:smoke | e2e fails | Task NOT marked complete; diagnose missing integration |
| Multiple agents edit same file | Git merge conflict on push | First merge wins; second agent rebases + re-verifies |
| Contract version bumped mid-run | Pinned ≠ current | Agent halts; human arbitrates |
| VERIFY missing for a criterion | Agent asks for human | Add VERIFY or relax criterion; update spec |

## Human checkpoints

1. After foundational worktree (A) lands: review contracts + schema/role definitions
2. After each phase exit: review e2e smoke output + integration-branch diff
3. Before any production cutover: review observability + load test
4. Before flag rollout to >10% traffic: on-call drill complete + rollback runbook reviewed

## Success signals

Each phase green when:

- **Phase 1:** all worktrees merged, `npm run verify:phase-1` green, `npm run e2e:smoke` green.
- **Phase 2:** `npm run verify:phase-2` green, <phase-specific gate, e.g. "100% flag rollout stable 7 days, zero rollback events">.
- **Phase 3:** `npm run verify:phase-3` green, <perf/quality targets met>.
