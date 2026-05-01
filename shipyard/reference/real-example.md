# Real-World Reference: ecommerce-scrape-x402 pipeline rebuild

The pipeline-v2 rebuild at https://github.com/Crush-Rewards/ecommerce-scrape-x402/tree/main/docs is the canonical Shipyard application. It ran 12 worktrees across 3 phases.

## Mapping to Shipyard stages

| Shipyard stage | File in repo |
|----------------|--------------|
| 1. Brainstorm | `docs/superpowers/specs/2026-04-10-commerce-scraping-bootstrap-design.md` and follow-ups |
| 2. Blueprint | `docs/data-pipeline-architecture.md` |
| 3. Contracts | `docs/worktrees/phase-1/contracts.md` (versioned, 11 contracts) |
| 4. Phases | `docs/worktrees/README.md` (DAG + index), `docs/worktrees/phase-N/README.md` (per-phase) |
| 5. Drydocks | `docs/worktrees/phase-N/worktree-<letter>-<name>.md` (12 specs) |
| 6. Dispatch | `docs/worktrees/agent-orchestration.md`, `docs/worktrees/agent-bootstrap.md` |

## Lessons that informed this skill

These are mistakes from the real application that the templates and SKILL.md are designed to prevent on the next run.

### Phase 1 wasn't pure-parallel — fix this on next refactor

The repo's Phase 1 contained Worktree A (foundational infra + contracts) PLUS B, C, D, E, F, G that all depended on A. Downstream worktrees could *start coding* against A1 contracts, but couldn't *merge* until A2 cloud provisioning was done. The DAG also had B → C → D → E → F serial dependencies inside the phase.

**This violates the Iron Law.** It's the most common mistake. The skill's Stage 4 calls it out explicitly because it's the one rule that determines whether you actually get parallel agent execution or just the *appearance* of parallel execution.

**On next refactor:** Worktree A goes alone in Phase 0. B, C, D, E, F, G that depend only on A's contracts go in Phase 1 — and only the ones that don't depend on each other. Anything that consumes another worktree's output goes in Phase 2+.

### Contract versioning saved a rebase storm

Two breaking changes mid-build forced version bumps from 1.0.0 → 1.1.0. Agents halted at task start when they saw the version had moved past their pin. Humans arbitrated (rebase + re-verify per affected worktree). Without the version field, agents would have committed silently against stale specs and integration would have been a multi-day untangling.

### Integration branch (`data-pipeline-architecture`) avoided ~40 wasted Render deploys

Each push to `dev` triggered Pre-Deploy migrations + container rebuilds. Worktree PRs targeted the long-lived integration branch instead, which doesn't deploy. Worktrees merged to `dev` one at a time once green, so each `dev` deploy was meaningful.

### VERIFY commands separated "agent claims done" from "actually done"

Tasks with explicit `VERIFY:` shell one-liners had ~3x lower rework rate than tasks without. Agents will rationalize a task as complete based on diff inspection alone; a green VERIFY is the only proof that survives.

### Agent brief template was non-negotiable

Agents that re-read the brief + contracts at task start halted on drift. Agents that skipped re-reads (or were re-dispatched into a fresh context without the brief) committed against stale assumptions. The brief is the bridge between "you've been dispatched" and "you have the context you need."

### Conflict zones are real and need a resolution policy

`render.yaml`, `package.json`, `src/api/server.ts`, `src/db/schema-v2.ts`, `src/db/migrations/*.sql` — all touched by 5+ worktrees. Without a documented resolution policy ("each worktree appends its own block; additive" / "globally-unique migration numbers reserved per worktree"), every PR became a manual merge negotiation. Phase READMEs include the conflict-zone table for this reason.

### MCP / consumer contract CI gates cutover, not deploy

The cutover (flipping the feature flag from staff → 10% → 100%) was gated on MCP contract CI being green, not just on the worktrees being merged. Cutover gates belong in the phase exit criteria, not buried in a worktree.

## Numbers from the run

- **12 worktrees** across 3 phases
- **11 numbered contracts** in `contracts.md`
- **2 contract version bumps** (both minor) during execution
- **0 wasted `dev` deploys** thanks to the integration branch
- **17 runbooks** in `docs/runbooks/` — each cutover and rollback path documented before flipping flags

## When you build the next Shipyard

Start from the templates in `../templates/`. Adapt names and structure to your refactor. The bones are right; the flesh is yours.
