---
name: site-engagement
description: Analyse how people behave on crushrewards.app once they arrive — per-page engagement, conversion, CTA placement, device gaps, scroll depth — and produce a UX/product findings report. Use for questions like "what should we improve on the landing page", "which pages actually convert", "where is attention going", "give me engagement stats per page", or when planning UI/UX work from evidence rather than opinion. Distinct from search performance (that's `npm run health`).
---

# Site engagement analysis — "what do people do once they get here?"

A repeatable runbook for turning GA4 behaviour data into UX decisions. Derived from the
2026-08-24 analysis that found the homepage carrying 75% of pageviews at 6 seconds of engaged
time per view, and `/faq` holding the most attentive audience on the site with no conversion
path at all.

**This is not a search report.** `npm run health` answers "are we found?" (GSC: impressions,
positions, CTR). This answers "what happens after the click?" (GA4: attention, conversion,
device). Use both; do not conflate them.

## Run it

```bash
cd ~/dev/crush/marketing/apps/engine
npm run engagement                       # 90d → sites/<site>/research/engagement-analysis-<date>.md
npm run engagement -- --site syntalic    # Syntalic.com (own GA4 property)
npm run engagement -- --days 28          # tighter window
npm run engagement -- --out ~/Desktop    # also drop a copy where someone will find it
npm run engagement -- --json             # machine-readable, no file written
npm run engagement -- --min-sessions 30  # raise the bar for "worth reporting"
```

Free — GA4 Data API only, no paid calls. Needs `site.analytics.ga4PropertyId` (Crush:
`GA4_PROPERTY_ID`; Syntalic: `SYNTALIC_GA4_PROPERTY_ID`) and Google credentials
(`npm run doctor -- --domain intelligence` to check).

The command writes the whole report: findings and recommendations at the **top**, then the data
behind them. It is meant to be handed to someone who was not in the room.

## What it pulls

| Section | GA4 dimensions → metrics | Answers |
|---|---|---|
| Page table | `pagePath` → `screenPageViews`, `totalUsers`, `userEngagementDuration` | How much attention per page |
| Entry table | `landingPagePlusQueryString` → `sessions`, `engagementRate`, `bounceRate`, `sessionKeyEventRate`, `keyEvents` | What sessions that *started* there did |
| CTA placement | `linkUrl` on `click` → `eventCount`, grouped by the `ct=` param | Which buttons people actually press |
| Events | `eventName` → `eventCount`, `sessions`, `totalUsers` | What the site's own instrumentation sees |
| Device | `deviceCategory` → `sessions`, `engagementRate`, `sessionKeyEventRate` | Where conversion diverges from engagement |
| Scroll | `pagePath` filtered to `scroll` → `eventCount` | Who reaches the bottom (GA4 fires at 90%) |

### The scope trap — get this right or the analysis is wrong

Two scopes, and they answer different questions:

- **Page-scoped** (`pagePath`): every view of the page, anywhere in a session. Use for attention.
- **Session-scoped** (`landingPagePlusQueryString`): only sessions that *started* on the page.
  Use for bounce and conversion.

A page can have thousands of views and near-zero entry sessions (an internal step), or the
reverse. Reporting one as the other is the most common way this analysis goes wrong.

`sec/view` = `userEngagementDuration ÷ screenPageViews` — engaged seconds, not wall-clock.
`averageSessionDuration` is a *session* metric and will disagree with it; that is expected.

## The five findings it detects

Computed in `intelligence/engagement-lib.ts` so the same evidence always produces the same
finding — not whatever the reader happens to notice.

| id | Pattern | Why it matters |
|---|---|---|
| `dominant-page-shallow` | One page holds >40% of views AND less engaged time than the median of every other page | The page carrying the site is the one nobody reads |
| `attention-without-action` | Engaged time >1.5× median AND zero key events | Content works, the call to action is missing — usually the cheapest fix available |
| `conversion-concentration` | The top 2 blog posts produce ≥60% of blog conversions | Most content converts nobody; find out what the winners do before commissioning more |
| `narrow-pages-convert` | Pages converting >2× the site rate | Single-purpose pages beating the omnibus one is a design signal |
| `device-gap` | A device engages ≥90% as well as the leader but converts <70% as often | Almost always a call to action that device cannot use |

Recommendations are derived from findings by rule (`buildRecommendations`), each carrying the
finding ids it follows from. They are a starting set — **the judgment about whether to act is
the human's**, and the report says so.

## Interpreting — the judgment layer

The command finds patterns; these are the calls it cannot make for you.

1. **Ask what the page is for before calling a number bad.** `/legal/privacy` averaging 303
   seconds and converting 0% is not a failure — nobody installs an app from a privacy policy.
   But for a brand whose pitch is data ownership, it is a trust surface worth treating as
   marketing rather than boilerplate. `/contact` converting 0% while its form completes at 91%
   is working perfectly.

2. **Separate "no conversion path" from "wrong audience".** `/faq` holds 149 entry sessions at
   50s/view with 5.5 FAQ expansions per session and zero conversions → missing CTA, act on it.
   A post ranking for a competitor-navigational query converting 0% → wrong audience, leave it.
   Cross-check intent with `npm run health` section 5b.

3. **Check instrumentation before believing a zero.** A key event created after the window
   started cannot show conversions in it. `npm run health` section 3b lists every key event with
   its creation date and names the dead ones. On 2026-08-24 `purchase` and `app_ads_conversion`
   were configured and had never fired — a page "converting 0%" on those alone means nothing.

4. **Respect the sample size.** The report marks confidence and always prints `n`. Under 30
   sessions is directional; the 2026-08 pull had `/receipt-scanning` at "100% engaged, 60%
   conversion" on **5 sessions**. Rate comparisons use Wilson intervals
   (`shared/seo/proportion.ts`) and only claim a difference when the intervals clear each other.

5. **Deep scroll is a layout verdict.** `scroll` fires at 90% depth. A homepage at ~12% means
   anything below the fold reaches roughly one visitor in eight — check it against the CTA
   placement table before recommending "add a CTA at the bottom".

6. **The CTA placement table is the highest-signal section for UI work.** It is the only place
   that says which *specific button* earns the click. In 2026-08: `hero` 288, `header_mobile`
   84, `final_cta` 23 — the bottom CTA earning 8% of the top one is a layout finding, not a
   copy finding.

## Output format

Fixed structure, in this order. Do not reorder — readers stop after the first screen.

1. **Title + window + source + generation command**
2. **Key findings** — numbered, headline leads with the number, evidence line beneath,
   `Confidence: High|Medium|Low (n=…)`
3. **Recommendations** — table ranked by confidence: `# | Do this | Why | Confidence (n)`
4. **How to read this** — the scope table and metric definitions, plus the sample-size warning
5. **Data** — the split, non-blog pages, blog posts, CTA placement, events, device, scroll
6. **Caveats** — sample size, GA4's engagement definition, instrumentation history, new pages
7. **Reproducing** — the commands

If you hand-write a version of this report, keep the same order and always carry `n` next to
every rate.

## Pitfalls

- **Do not compare engagement rate to an external benchmark.** GA4's definition (>10s, or a
  conversion, or 2+ pageviews) makes 26% unremarkable for a single-page-heavy site. Compare
  pages against each other.
- **Do not read a recently published page's numbers.** Anything live for less than the window
  is unrepresentative; the report flags this in caveats but cannot filter it for you.
- **Do not treat `keys` as sessions.** One session can fire several key events; that is why
  `conv%` uses `sessionKeyEventRate` and not `keyEvents ÷ sessions`.
- **Referral pages (`/refer/*`) flatter the average.** They convert at 36–75% because that
  traffic arrives pre-sold. Exclude them mentally when judging whether the site converts well.

## Paid campaigns

`npm run paid` is the companion for ad spend — campaign cost/CPC/cost-per-conversion, channel comparison,
and whether spend months actually grew new users. Two traps are encoded as guards there because both were
hit on the first pass:

- **Never query `advertiserAdCost` against `yearMonth`.** GA4 re-attributes daily cost across the month;
  it reported $1,085 of real spend as $14,237. Campaign-only and campaign×date agree — the report
  cross-checks them and says so.
- **Months before the first *firing* key event are unmeasurable, not 0%.** Use the earliest key event with
  a non-zero count, not the earliest configured one.

Paid conversion is judged against the site's own non-paid baseline, never an industry benchmark. And the
conversion being measured is an App Store *button click*, not an install — true CAC needs App Store Connect
or an attribution provider, neither of which is visible from GA4.

## Two numbers people misread

- **`newUsers` is new browsers on the website, not app accounts.** ~8.5k website users since Jan 2025
  against ~744 app users — different populations. A visitor who never installs is not a user. Anyone
  comparing the two will think the analytics are broken.
- **The GA4 property is not one site.** syntalic.com, crushrewards.dev, localhost and Vercel preview URLs
  all report into it (~5% of users). Both commands filter on `hostName`; GA4 refuses that filter alongside
  imported ad-cost metrics, so those two queries opt out by design.

## Related

- `npm run paid` — ad spend, campaign verdicts, growth-vs-spend
- `npm run health` — search performance (GSC), including query intent mix and install yield
- `npm run indexation` — whether Google is serving the pages at all
- `npm run page-meta` — title/description proposals for non-blog pages
- Crush web: `~/dev/crush/marketing/apps/crush-web` (Next.js routes; metadata lives in each
  route's `metadata` export)
- Syntalic web: `~/dev/crush/marketing/apps/syntalic-web`
