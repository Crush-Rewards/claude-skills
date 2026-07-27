---
name: ontology-verification
description: Use when defining ontology invariants, verify→fix loops, sampling vs certification, or quality gates for taxonomy crosswalks
---

# Verification & Invariants

Domain-agnostic. Number invariants so reports and CI stay stable.

## Hard invariants (gate the rebuild)

| Id | Rule |
|----|------|
| **I1** | No dual coarse+fine match on the same source when fine should win |
| **I2** | `resolve().best` level is the deepest among direct matches |
| **I3** | Target hierarchy materialised (leaf has parent chain) |
| **I4** | No multi-`exactMatch` without single-target discipline |
| **I5** | Unique object ids; every link endpoint exists |
| **I6** | Facet kinds ∈ closed vocabulary (unknown kind = fail; dual facet+match = stats only) |

Exit non-zero on hard failures. Soft warnings for sample-only precision issues. Add domain-specific invariants only when they are universal for that graph (not one-off data fixes).

## Certain-or-blank in practice

- Threshold low-confidence model output → blank + optional `candidateMatch`.
- Verify against **target leaves**, not parent titles alone.
- Orthogonal-axis branches false-flag deterministic audits — require reasoning review.

## Verify → fix loop (per level)

1. **Deterministic audit** (cheap, noisy filter): over-span, miss, mismatch scores from child content vs scoped targets.
2. **Reasoning verification** (real check): chunk balanced groups; agents judge against leaf definitions; write findings tables only.
3. **Orchestrator spot-check**: drop lexical false flags; keep evidenced issues.
4. **Deterministic fix scripts**: corrections table keyed by stable id; SET/ADD/REMOVE/BLANK; backup maps first; never hand-edit huge JSON in chat.
5. **Re-derive ontology** + re-run invariants.
6. **Cascade**: fixing level N invalidates N+1 — regenerate or re-verify downstream.

## Sampling vs certification

| Mode | Goal |
|------|------|
| **VERIFY** | Find error clusters; raise confidence on sampled structure |
| **CERTIFY** | Exhaustive certain-or-blank: every node asserted or honestly blank — **not** 100% leaf coverage (vocab gaps remain) |

100% confidence ≠ 100% leaf coverage. Missing target leaves correctly stay at mid-level or blank.

## Failure pattern library

Track recurring defects and close them with tree-wide detectors, not one-off leaf edits:

- Facet leaks (container type inherited by wrong-type children)
- Coarse inheritance on deep leaves
- Lexical near-miss leaves
- Domain rules that should be systematic (format, material vs device, …)
- Redundant coarse match blocking fine resolve

## Evaluation harness

- Frozen holdout samples with independent judges
- Coarse-branch accuracy vs leaf accuracy (report both)
- Revalidation of previously-wrong nodes after fixes (prove non-circular)
- Cost: bulk placement with cheap reasoning models; audits with stronger models on samples

## Do not

- Trust embeddings alone for include/exclude boundaries
- Re-run map generators after baking fixes without a fix-reapply path
- Claim precision from the same agents that proposed the maps without independent re-judge
