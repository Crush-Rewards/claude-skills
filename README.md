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

Includes templates for every doc type and a real-world reference (the `ecommerce-scrape-x402` pipeline-v2 rebuild — 12 worktrees across 3 phases).

## Installation

Clone this repo and symlink the skills into your Claude Code skills directory:

```bash
git clone git@github.com:Crush-Rewards/claude-skills.git ~/crush-skills

# Symlink individual skills
ln -s ~/crush-skills/data-engineering ~/.claude/skills/data-engineering
ln -s ~/crush-skills/shipyard ~/.claude/skills/shipyard
```

Or copy the skill directories directly into `~/.claude/skills/`.

## Contributing

To add a new skill:
1. Create a directory with a `SKILL.md` containing YAML frontmatter (`name` and `description`)
2. Keep skills under 500 words each
3. Follow the "Use when..." pattern for descriptions
4. Test with and without the skill to verify it improves Claude's responses
