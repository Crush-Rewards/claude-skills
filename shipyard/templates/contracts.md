# <Refactor Name> Contracts — Single Source of Truth

```yaml
contract-version: 1.0.0
last-breaking-change: <YYYY-MM-DD>
last-additive-change: <YYYY-MM-DD>
owner: Worktree A
```

All Phase 1 worktrees depend on the contracts in this file. Downstream worktrees pin to the version above. Agents executing these worktrees MUST re-read this file at task start and **halt if `contract-version` has bumped** since their last run.

**Versioning rules:**
- **Major (X.0.0):** breaking change. Requires acknowledgment from every affected worktree owner before implementation continues.
- **Minor (X.Y.0):** additive change (new contract, new optional field). Affected worktrees re-pin but do not need to halt.
- **Patch (X.Y.Z):** clarification, typo, comment. No re-pin required.

---

## Contract 1: <Name> (<Producer> → <Consumer>)

<One-paragraph context: what flows from producer to consumer, why this boundary exists.>

### <Spec section, e.g. "Path structure" / "Schema" / "Job payload">

```<lang>
<exact format / type / schema>
```

**Rules:**
- <Invariant 1>
- <Invariant 2 — e.g. immutability, ordering, idempotency>

### Failure modes / DLQ

<Where bad payloads go, how replay works.>

---

## Contract 2: <Name>

...

---

## Contract N: Migration Layout

The repo uses flat numbered migrations in `<path>`. Each worktree is **assigned a contiguous range** so no two worktrees collide on a number:

| Worktree | Reserved migration numbers |
|----------|----------------------------|
| A | 0007–0011 |
| C | 0012–0016 |
| E | 0017 |
| F | 0018 |
| I | 0019 |

If a worktree exceeds its range, bump the contract version (minor) and reserve the next range.

---

## Contract version handling (for agents)

At task start:

```bash
grep "contract-version:" docs/worktrees/phase-1/contracts.md
# Pin the version shown. Save it in your branch's PR description.
```

At commit time:

```bash
PINNED=<your pinned version>
CURRENT=$(grep "contract-version:" docs/worktrees/phase-1/contracts.md | awk '{print $2}')
[ "$PINNED" != "$CURRENT" ] && { echo "CONTRACT DRIFT — halt + escalate"; exit 1; }
```

Drift = stop. Don't commit. Notify a human.
