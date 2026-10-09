---
name: skill-name
description: "What this skill does, in one sentence. Use when <the requests and situations that should trigger it, in the words someone would say>. Say what it is not if a neighbouring skill could be mistaken for it."
---

<!--
FORMAT RULES. Delete this whole comment before you commit.

1. Frontmatter is exactly `name` and `description`, each on ONE line. Put the description in double quotes. An unquoted ": " (or a leading quote) makes the YAML invalid: Claude Code forgives it, but Obsidian cannot read the header and shows all of it as red raw text. Escape any double quote inside as \".
2. Write each paragraph on one line. Obsidian draws a single newline as a line break, so text wrapped at 100 columns renders ragged. Lists, tables and code blocks are not affected.
3. Use real `##` headings, not bold lines. They build Obsidian's Outline pane and GitHub's table of contents.
4. Link bundled files with relative paths, for example [references/example.md](references/example.md), so the link works in the repo, in Obsidian and for the agent.
5. Encode how to decide, not what was decided. Paused lists, "next up" and dated holds belong in code or a tracker. A skill that lists them is stale within a week.
6. Portable skills live in this repo; a skill that names absolute paths, npm scripts or a schema belongs with the code it is about.
-->

# Skill title

One or two sentences: what this skill does and the situation it exists for.

**Where it runs:** the working directory, the tools and MCP servers it needs, and anything it assumes. State the working directory before the first command: these skills load in every project, and one that assumes ambient context misfires in the wrong repo.

## When to use

- The request or situation that should trigger it, in the words someone would actually say.
- The neighbouring skill this is not, and which one to use instead.

## How to do it

1. First step. Say what to read or run, and what a good outcome looks like before moving on.
2. Second step.
3. Third step.

## What a good result looks like

- A check someone can observe, not an adjective.
- What the skill says it could not do or did not check.

## What cost time the first time

- A gotcha, with the reason it happens.

## Reference files

| File | What it is |
|---|---|
| `references/example.md` | What it holds, and when to read it. |
