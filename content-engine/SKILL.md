---
name: content-engine
description: Run Crush marketing content-engine workflows — produce, hydrate, keyword-intel, rank tracking, citation prospecting — with spend guardrails. Use when generating or refilling blog content, scoring keyword opportunities, checking whether new articles ranked, or turning AEO citation targets into outreach.
---

# Content-engine operator

Work from `~/dev/crush/marketing/apps/engine`. Commands and flags live in that app's `CLAUDE.md`; this skill is the order of operations and the spend rules.

Pass `--site syntalic` for Syntalic organic/blog (AEO is paused there). Default `--site` is `crush-rewards`.

## Produce loop

```bash
npm run doctor -- --domain intelligence
npm run aeo-monitor -- --cluster <id>    # partial scan; do not trend against a full panel
npm run hydrate -- --cluster <id> --dry-run
npm run hydrate -- --cluster <id>
npm run produce -- --cluster <id> --count 1
```

Hydrate now scores Labs volume/KD/intent and merges SERP-overlapping targets. Queue rows carry `keywordScore`; `smart-next` uses it. Skip DataForSEO scoring if those env keys are missing (fail-open).

Full-panel AEO (`npm run aeo-monitor` with no `--cluster`) is the only scan that may overwrite `aeo-gaps.json` / drive hydrate's default input.

### Cluster targeting

`targetKeyword` / spoke anchors come from Labs volume + live SERP + GSC, not slogans.

- Cashback money page is Fetch-alternatives (`apps like fetch`), not "cashback that never expire". Dual-cluster with receipt-scanning is intentional.
- `crypto-rewards-everyday-shoppers` and `loyalty-programs-fail` are in `PAUSED_CLUSTERS` (Play Store / HBR SERPs). `produce` / `smart-next` refuse them unless `--force`. Discovery hydrate skips them; `hydrate --cluster <paused-id>` still runs.
- Credit-card spoke is retargeted at "do credit card points expire". Do not `optimize-meta --force` that slug.
- Do not retitle Fetch-alternatives until `check-meta` on `meta-fetch-alternatives-2026-08` (~2026-08-31).
- **Next produce:** `--cluster receipt-scanning-apps`. Weekly: `npm run ranks` + `npm run keyword-intel`.

## Keyword intel → decisions

```bash
npm run keyword-intel                    # weekly; domain+subdomains
npm run keyword-intel -- --url https://crushrewards.app/blog/<slug>
npm run keyword-intel -- --domain crushrewards.app --path /blog --scope subfolder
npm run intelligence
npm run intel-act -- --type keyword-gap
```

`--url` / `--domain` runs do not promote `latest.json`. Default `--max-cost 2` is fresh spend only (cache hits free).

## Did it rank?

GSC average position only exists after impressions. For intended keywords:

```bash
npm run ranks -- --cluster <id> --dry-run
npm run ranks -- --cluster <id>
```

Depth 10, `--max-cost 1`. Compare to `rank-snapshots/latest.json` (full runs only).

## Citation outreach

```bash
npm run prospect -- --dry-run            # needs a full AEO scan in aeo-history.json
npm run prospect                         # Serper resource SERPs
npm run prospect -- --backlinks          # paid referring-domain counts
```

Do not invent emails or names. Visit the resource URL for a contact path.

## Spend

| Call | When | Cap |
|------|------|-----|
| DataForSEO Labs overview | hydrate stage 3 | cached 7d |
| DataForSEO SERP | ranks | `--max-cost`, 24h cache |
| DataForSEO backlinks | prospect `--backlinks` | `--max-cost` |
| Serper | hydrate coverage, prospect resources | 24h serp_cache |

`--force` bypasses cache and re-spends. `--dry-run` first.

## Not this skill

Post-click bounce/CTA/copy on crushrewards.app → `marketing-site` + `site-engagement`. Search performance → `npm run health`. Per-page agent markdown/JSON-LD → `npm run indexation -- --agent-check` (`npx is-agentic` is domain-level only).
