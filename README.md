# Crush Rewards — Claude Code Skills

Custom skills for the Crush Rewards team. These are loaded by Claude Code to provide domain-specific guidance.

## Available Skills

### data-engineering
Principles-first, tool-agnostic data engineering guidance. Covers:
- **Pipeline design** — idempotency, failure handling, backfill, observability
- **Data modeling** — schema layering (raw/staging/mart), naming conventions, SCDs
- **Data quality** — validation, contracts, freshness monitoring, quarantine patterns
- **Data architecture** — tool selection, scaling signals, batch vs. stream
- **Performance & indexing** — query optimization, EXPLAIN, partitioning, maintenance

### shipyard
Process for orchestrating large multi-component refactors as parallel agent dispatches. Decomposes a rebuild into isolated git-worktree drydocks built in parallel against versioned engineering contracts. Use for system rewrites, pipeline overhauls, monolith decomposition, or any refactor where 5+ independent units of work could run concurrently. Six stages:
- **Brainstorm** → align on intent (composes with `superpowers:brainstorming` + `data-engineering`)
- **Blueprint** → architecture doc (problem, principles, decisions)
- **Contracts** → versioned interface specs between worktrees
- **Phases** → pure-parallel groupings (the Iron Law: no inter-worktree dependencies inside a phase)
- **Drydocks** → self-contained worktree specs with `VERIFY:` shell commands per task
- **Dispatch** → DAG, agent brief template, contract-version pinning, phase exit gates

Includes templates for every doc type (blueprint, contracts, phase README, worktree spec, agent orchestration, agent bootstrap).

### ontology-generation
**General** principles for designing and shipping domain ontologies and multi-taxonomy crosswalks (not tied to any one catalog). Covers:
- **Principles** — certain-or-blank, curated maps vs derived graph, walk-down precision
- **Object/link model** — typed objects, SKOS-aligned match relations, schema artifacts
- **Identity & bindings** — prefixed ids, warehouse join contracts, no title joins
- **Facets** — orthogonal axes vs domain type (dual links by design)
- **Resolution** — inherit-up resolve API, multi-match co-equal, fine-beats-coarse
- **Verification** — numbered invariants, verify→fix loops, sampling vs certify
- **Pipeline** — gated rebuild, mini-slices, SKOS export, placement generation

Optional worked example only (not default scope): `examples/gpc-browse-crosswalk.md` — Amazon browse nodes ↔ GS1 GPC, showing how the general patterns were applied at scale.

## Installation

Clone this repo and symlink the skills into your Claude Code / agents skills directories:

```bash
git clone git@github.com:Crush-Rewards/claude-skills.git ~/crush-skills

# Symlink individual skills (Claude Code)
ln -s ~/crush-skills/data-engineering ~/.claude/skills/data-engineering
ln -s ~/crush-skills/shipyard ~/.claude/skills/shipyard
ln -s ~/crush-skills/ontology-generation ~/.claude/skills/ontology-generation

# Open skills / multi-agent path (optional mirror)
ln -s ~/crush-skills/ontology-generation ~/.agents/skills/ontology-generation
```

Or copy the skill directories directly into `~/.claude/skills/`.

If this repo is already checked out under `crush/shared/tooling/claude-skills`, symlink from that path instead of a second clone.

## Contributing

To add a new skill:
1. Create a directory with a `SKILL.md` containing YAML frontmatter (`name` and `description`)
2. Keep skills under 500 words each
3. Follow the "Use when..." pattern for descriptions
4. Test with and without the skill to verify it improves Claude's responses
