---
name: marketing-site
description: Data-driven recommendations for crushrewards.app messaging, copy, bounce, visibility, and agent readiness. Use when asked what to change on the marketing/landing site, how to reduce bounce, improve homepage copy, or combine is-agentic with engagement and page-meta. Distinct from blog production (content-engine) and from search-only reports (npm run health).
---

# Marketing-site recommendations

Orchestrates existing content-engine reports into copy/layout/agent recs for **crushrewards.app** (the landing repo, not Sanity blog posts).

Work from `~/dev/crush/marketing/apps/engine`. Landing-page code: `~/dev/crush/marketing/apps/crush-web`. For Syntalic.com, pass `--site syntalic` and use `~/dev/crush/marketing/apps/syntalic-web`.

## Run this sequence

```bash
npm run health                       # are we found? (GSC + GA4 organic)
npm run engagement                   # what happens after the click?
npm run page-meta                    # title/description for non-blog routes
npm run indexation -- --agent-check  # per-page markdown + Article/FAQ JSON-LD
npm run site-recs                    # cover sheet + npx is-agentic <domain>
```

`npm run site-recs` does **not** re-run health/engagement. Run those first when the artifacts are stale (`research/engagement-analysis-*.md`, `research/page-meta-proposals.md`).

Then read, in this order:

1. `research/site-recs-<date>.md` — cover sheet
2. Latest engagement report — bounce, attention, CTA `ct=` placement, device gap
3. `page-meta-proposals.md` — apply accepted rows in the landing repo `metadata` export
4. is-agentic failures — domain plumbing (llms.txt, 404s, robots). Not a substitute for `--agent-check`

Judgment rules for engagement live in the `site-engagement` skill. Do not restate them; load that skill when interpreting bounce/CTA numbers.

## Which tool answers which question

| Question | Tool | Writes |
|----------|------|--------|
| Are we found? CTR waste? | `npm run health` | stdout |
| Bounce, attention, which button? | `npm run engagement` | `research/engagement-analysis-*.md` |
| Homepage / FAQ / token copy (title, description) | `npm run page-meta` | `research/page-meta-proposals.md` |
| Blog post title/excerpt | `npm run optimize-meta` | Sanity draft |
| Domain agent score | `npx is-agentic crushrewards.app` | `research/is-agentic.json` via site-recs |
| One post lost markdown/JSON-LD | `npm run indexation -- --agent-check` | indexation snapshot |

`npx is-agentic` grades the **domain**. A new blog post that stopped serving `text/markdown` or lost Article JSON-LD will not move that score — that is why `--agent-check` exists.

## Copy vs layout

- CTA table (`ct=hero` vs `ct=final_cta`) is **layout**, not copy.
- Entry-page bounce is session-scoped (`landingPage`). Pageviews are not bounce.
- `/legal/*` converting 0% is not a messaging failure.
- Blog conversion concentration is a content-brief signal (`content-engine`), not a homepage rewrite.

## Do not

- Mix GSC position with GA4 bounce in one verdict.
- Edit Sanity posts for a page-meta finding (wrong surface).
- Treat is-agentic as per-URL QA.
- Invent copy without the engagement CTA table and page-meta top queries in hand.
