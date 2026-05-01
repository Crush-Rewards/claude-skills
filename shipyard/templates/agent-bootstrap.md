# Agent Bootstrap — <Refactor Name>

How any agent (or human) initializes a clean local environment for worktree execution.

## One-time setup

```bash
git clone <repo-url>
cd <repo>
<install command, e.g. npm install --include=dev>

# Local services (Docker)
docker-compose -f docker-compose.dev.yml up -d

# Apply migrations
<migration command, e.g. DATABASE_URL=... npx drizzle-kit migrate>

# Seed dev data
<seed commands>
```

## Per-worktree setup

Before starting work on a worktree:

```bash
# 1. Create git worktree for isolation
git worktree add ../worktree-<letter> -b worktree-<letter>-<name>
cd ../worktree-<letter>-<name>

# 2. Run bootstrap script (ensures local env green before you touch anything)
npm run worktree:bootstrap -- <letter>

# 3. Read your worktree spec
cat docs/worktrees/phase-<N>/worktree-<letter>-<name>.md

# 4. Pin contract version
grep "contract-version:" docs/worktrees/phase-1/contracts.md
# Note the version. Halt + escalate if it changes during your run.
```

## Local services

`docker-compose.dev.yml` runs the dev-only versions of every external dependency. Production-only services (cloud storage, hosted Redis, third-party APIs) are mocked at the lib boundary or use prerecorded fixtures.

## Fixtures per worktree

`tests/fixtures/worktree-<letter>/` contains the inputs each worktree's tests need (sample API responses, sample envelopes, sample raw rows). Worktrees writing against production-shaped data MUST use fixtures first; real third-party integration is gated to the foundational worktree.

## Env vars per role

Each worktree needs the env vars for its specific role. The full list lives in `.env.development.template`. Copy and fill locally:

```bash
cp .env.development.template .env.development
```

Common patterns:
- One DATABASE_URL per role (extract, loader, dbt, api, cron) so connection-pool isolation is enforced from day 1.
- Mock tokens for paid third-party APIs in dev; real tokens only in prod env.

## Bootstrap script

`scripts/worktree-bootstrap.sh` (committed in the foundational worktree):

```bash
#!/bin/bash
set -e

WORKTREE=$1
[ -z "$WORKTREE" ] && { echo "Usage: $0 <letter>"; exit 1; }

echo "→ Installing dependencies..."
<install command>

echo "→ Starting local services..."
docker-compose -f docker-compose.dev.yml up -d
sleep 3

echo "→ Applying migrations..."
<migration command>

echo "→ Seeding worktree-specific fixtures..."
[ -d "tests/fixtures/worktree-${WORKTREE}" ] && npm run seed:worktree -- ${WORKTREE}

echo "→ Running baseline tests..."
npm run test

echo "→ Worktree ${WORKTREE} ready."
```

## Baseline green

Run after bootstrap:

```bash
npm run test       # must green
npm run typecheck  # must green
npm run lint       # should green
```

If baseline isn't green, don't start worktree work — diagnose first. A red baseline before you start means red won't be your fault, and you'll waste time chasing it.

## End-to-end smoke

After all foundational worktrees green:

```bash
npm run e2e:smoke
```

Exercises the full pipeline (or full request path) end-to-end. Must green before next phase dispatch. Runs in <2 min on dev.

## Tear down

```bash
cd ../<repo>
git worktree remove ../worktree-<letter>
git branch -D worktree-<letter>-<name>  # only after PR merged
```
