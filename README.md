# Claude Code skills — portable

Skills that work **anywhere**: methods and principles, not the operating manual for one repo.
Symlinked into `~/.claude/skills/` so they load in every project.

| Skill | What it is |
|---|---|
| `data-engineering` | Principles-first pipeline design, modeling, quality, performance. Tool-agnostic. |
| `ontology-generation` | Domain ontologies and multi-taxonomy crosswalks — objects/links, facets, identity bindings. |
| `shipyard` | Decomposing a large refactor into parallel git-worktree drydocks against versioned contracts. |
| `user-audit` | Investigating why a Crush user is in review/banned — evidence gathering and false-positive judgement. |
| `interface-review` | One consolidated UI review — a11y, layout, writing, type, polish — ranked findings and a verdict. Annotates Figma frames. |

## Where the other skills went (2026-09-09)

A skill that is the operating manual for one project belongs **with that project**, so it versions
with the thing it documents and changes alongside it:

| Skill | Now lives in |
|---|---|
| `content-engine`, `marketing-site`, `site-engagement`, `outreach-dossier` | `crush/marketing` → `.claude/skills/` |
| `syntalic-dogfood` | stays in `crush/dogfooding` → `.claude/skills/`, which is now its own git repo |

They are still symlinked into `~/.claude/skills/`, so they load everywhere — the move is about
ownership and versioning, not load scope.

## The rule

**Portable → here. Repo-bound → that repo.** The test: could someone run this skill against a
different codebase and get a sensible answer? If it names absolute paths, npm scripts, or a schema,
it is repo-bound.

**State the working directory before the first command.** A user-level skill that assumes ambient
context will misfire in the wrong repo — that is the whole failure mode. Say where it runs first.

**Encode how to decide, not what was decided.** Cluster lists, "next up", dated holds and paused
flags belong in the code or a tracker. A skill that enumerates them is stale the week after it is
written.
