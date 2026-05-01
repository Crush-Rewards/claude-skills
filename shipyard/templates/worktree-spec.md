# Worktree <Letter> — <Name>

**Phase:** <N>
**Branch:** `worktree-<letter>-<name>`
**Depends on:** <list of upstream worktrees, or "none". Depends-on means "I read this worktree's outputs at dispatch time" — it should NEVER mean "I block on its merge within the same phase". Cross-phase only.>
**Goal:** <one-paragraph outcome — what's true after this worktree merges that wasn't true before>

---

## What you're building

```mermaid
flowchart LR
    <diagram of this worktree's components and data flow>
```

## File structure

```
src/
  <module>/
    <file>.ts    ← <short description>
    <file>.ts    ← <short description>
scripts/
  <script>.ts    ← <entrypoint description>
```

## Files you do NOT touch

These belong to other worktrees or other phases. Editing them = scope violation:

- `<path>` — owned by Worktree <X>
- `<path>` — phase <N+1>
- `<path>` — frozen by contracts.md Contract <K>

## Task list

Each task is one atomic commit. The `VERIFY:` line is the shell command that proves the task is done — agents run it before claiming complete.

### Task 1: <name>

- [ ] <step>
- [ ] <step>
- [ ] <step>

`VERIFY: <shell one-liner that exits 0 when this task is correct>`

### Task 2: <name>

- [ ] <step>
- [ ] <step>

`VERIFY: <shell one-liner>`

### Task 3: <name>

...

## Acceptance criteria

- [ ] All tasks above checked + their VERIFY commands green
- [ ] `npm run verify:<letter>` green (runs all VERIFYs in sequence)
- [ ] `npm run e2e:smoke` green against this branch
- [ ] PR opened against the integration branch (NOT `dev`)
- [ ] PR description includes: pinned `contract-version`, list of files modified, list of new env vars
- [ ] Conflict-zone files coordinated with affected worktrees per phase README

## Out of scope

What this worktree explicitly does NOT do, often deferred to a later phase. Anchor here so reviewers don't ask for scope creep.

## Notes for the dispatched agent

- Re-read this spec at task start — your context window may have rotated.
- Re-read `phase-1/contracts.md` and pin `contract-version`. Halt if it bumps mid-run.
- Run `scripts/worktree-bootstrap.sh <letter>` before touching code.
- Do not skip VERIFY commands. They are the only thing standing between "looks done" and "is done."
