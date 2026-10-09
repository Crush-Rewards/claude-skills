---
name: user-audit
description: Investigate why a Crush user's account is in risk_state review/banned (or why their receipts were rejected). Resolves the escalation source from users.risk_reason + risk_decisions/risk_signals (automated policy, referral hub / device farm tells, manual admin batch holds), pulls Plaid peer overlap / session geo / CRUSH earned-held-sold evidence, and judges whether it's a false positive. Use for support investigations like "why was <email> blocked / put in review / receipts rejected" or "show the overlapping bank details and peers".
---

# Crush user audit — "why is this account in review?"

A repeatable runbook for support investigations. Given a user (email/phone/id), find why
they're in `risk_state='review'` (or `banned`, or why receipts were rejected) and judge whether
it's justified. Derived from the wence_chan / EBT-tax investigation and the 2026-07
`monasonly1@icloud.com` Plaid-overlap cluster (datbaby / tipp / mona).

## Data access (read this first)
The authoritative data is **Supabase Postgres** (Crush Prod project). Prefer **Supabase MCP**
`execute_sql` on project `hwiipvdjzeyywnytibia` (Crush Prod). Staging is
`twlhpcckpticaapgjnca` — do not audit prod users there.

Privacy note: session/IP/geo queries may require Smart Mode approval (read-only, but
sensitive). They do **not** write. Prefer aggregated summaries over dumping full session rows
when possible.

Do NOT trust PostHog for this — its receipt events carry no rejection/review reasons, and the
project reachable here is often test data.

## Step 0 — two review mechanisms (don't conflate them)
- **Account-level:** `users.risk_state` ∈ `ok | review | banned`. `review` = fully restricted
  (earnings escrow to `pending_rewards`), `banned` = terminal. This is "the account is blocked."
- **Receipt-level:** `receipts.status='review'` + `ocr_data->>'review_reason'` gates ONE receipt for
  admin approval; it does NOT change `risk_state`. Only the `receipt_fraud` escalation (≥2 fraud
  rejections) crosses into account-level risk.

## Step 1 — run the audit query
Replace the email. Returns one JSON blob (user risk state + decision spine + signals + signup
attempts + recent fraud rejections). If a column errors, wrap the offending row in `to_jsonb(t.*)`
to inspect actual columns (e.g. `receipts` has **no `created_at`** — use `submitted_at`).
`execute_sql` returns **only the last statement's result** — send one statement per call (or
fold extras into subselects).

```sql
with u as (select * from public.users where email = :email)  -- <-- set :email
select jsonb_pretty(jsonb_build_object(
  'user', jsonb_build_object(
    'id', u.id, 'email', u.email, 'phone', u.phone_number,
    'risk_state', u.risk_state, 'risk_reason', u.risk_reason,
    'risk_flagged_at', u.risk_flagged_at, 'risk_reviewed_at', u.risk_reviewed_at,
    'risk_reviewed_by', u.risk_reviewed_by, 'created_at', u.created_at,
    'last_active_at', u.last_active_at,
    'risk_notified_at', u.risk_notified_at, 'risk_notified_via', u.risk_notified_via),
  'decisions', (select coalesce(jsonb_agg(to_jsonb(d.*) order by d.decided_at), '[]')
                from public.risk_decisions d where d.user_id = u.id),
  'signals', (select coalesce(jsonb_agg(to_jsonb(s.*) order by s.fired_at), '[]')
              from public.risk_signals s where s.user_id = u.id),
  'signup_attempts', (select coalesce(jsonb_agg(to_jsonb(a.*) order by a.created_at), '[]')
                      from public.signup_attempts a where a.user_id = u.id),
  'fraud_rejections', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'submitted_at', r.submitted_at, 'store', r.store_name, 'total', r.total_amount,
        'rejection_reason', r.ocr_data->>'rejection_reason',
        'review_reason', r.ocr_data->>'review_reason',
        'fraud_details', r.ocr_data->'fraud_details',
        'authenticity', r.ocr_data->'authenticity',
        'reject_reason', r.reject_reason, 'admin_notes', r.admin_notes) order by r.submitted_at desc), '[]')
      from public.receipts r
      where r.user_id = u.id and r.status = 'rejected'
        and r.ocr_data->>'rejection_reason' like 'fraud_%'
        and r.submitted_at >= now() - interval '90 days')
)) as audit
from u;
```

## Step 2 — classify the source from `users.risk_reason`
`risk_reason` tells you which mechanism flagged them:

| `risk_reason` | Source | Where to look next |
|---|---|---|
| `policy:review:score=…: <signal>×n(w=…)` | Composite risk policy (signal-driven) | `signals`/`decisions` — the embedded signal names are the cause; `decided_by` = `system:<signal that tipped it>`. The summary lists signals as of the decision; later signals appear only in `risk_signals`. |
| `plaid_card_shared:policy:review:…` | Same policy, scored by `plaid_shared_card` | The prefix is a contract with shipped app builds (the app shows reason-specific copy). Look at the signal's peer set (Step 5). |
| `ip_velocity` / `device_velocity` | Signup-velocity gate at account creation | `signup_attempts` (shared `ip_hash`/`device_id` within 24h). Usually **no decision/signal rows** (a shadow `signup_velocity` signal is recorded in observe mode). |
| `admin_ban` / `admin_review` / free text | Manual admin | `risk_reviewed_by` = the admin; `decisions` row `decided_by`=email. A `(via claude-cli)` suffix means the admin acted through a Claude session. **Check whether it is a batch** (below). |
| `NULL` while `review` | Legacy/direct write or admin-cleared-then-reflagged | fall back to `decisions` + `signals` + `signup_attempts` |

**Batch holds.** An admin-typed reason shared by many users (e.g. `referral_cluster_<CODE>: plaid
earnings under review`, 35 users in ~100 seconds on 2026-09-24) carries **no per-user evidence**:
`signals` is usually empty and `composite_score` is 0. Detect it with
`select count(*), min(decided_at), max(decided_at) from risk_decisions where reason_summary = '<reason_summary>'`
and `select count(*) from users where risk_reason = '<reason>'`. Judge each member on their own record
(Steps 5–6) — membership alone is not evidence — and note that the database does not record *why the
cluster was drawn that way*; ask the admin who set it. Members may also have an earlier, unrelated
automated hold (look at the full `decisions` spine, not just the latest row).

The `foundry_*` columns earlier versions of this skill selected (`foundry_recommend_action`, …) do
**not** exist on `public.users` (`42703`, confirmed 2026-10-09). Do not select them; if an advisory ML
score matters, find where it lives before citing it.

## Step 3 — read the evidence
- **`decisions`** (`risk_decisions`) = the state-change spine. `decided_by` `system:<signal>` =
  automated (the signal that tipped the score), an email = admin. **Forgiveness boundary:** the most
  recent decision with `to_state='ok'` AND a non-`system:` `decided_by` is the last admin clear — only
  signals *after* it still count.
- **`signals`** (`risk_signals`) = detector firings. Only `mode='enforce'` rows count toward the
  policy; `observe` rows are recorded and score nothing. `evidence` JSONB holds the specifics.
  `occurrences` / `last_seen_at` count repeat sightings of the *same* evidence, not new signals.

### How the score becomes a hold (verified against `riskPolicyService.ts`, policy v5)
- **Composite** = sum, over **distinct signal names**, of each name's **max stored `score_weight`**
  in the last 30 days (after the admin-clear floor). A signal that fired 98 times counts once.
  Retired signals are skipped. The policy reads the *stored* weight, not the registry default.
- **Review at composite ≥ 1.0.** The auto ladder stops at `review`: **ban is never automatic.** A
  banned user is never auto-downgraded; an account already in `review` stays there.
- **Grades** (`signalRegistry.ts`): **hard** = weight 1.0, holds alone and ignores the guards below;
  **derived** = weight < 1.0, an inference that misfires on honest accounts, needs a partner — *two
  derived tells hold a fresh account* (0.5 + 0.5 = 1.0); **mixed** = `receipt_fraud` (1.0, but 3 of
  its 4 counted codes are OCR-derived — known debt); **never_escalate** = weight 0.
- **Guards, derived-only composites only:** (1) *established* account — ≥14 days old, approved
  receipts on ≥3 distinct days, **no** `review`/`banned` anywhere in its decision history — is not
  held, a human gets an alert instead; (2) *cleared once* by an admin — needs **≥1.5**, not 1.0.
  So after you clear someone, a single new derived pair will not re-hold them.
- **Fail-open:** a read failure alerts instead of holding.

### Signal reference
Synced to `src/services/risk/signalRegistry.ts` and live `risk_signals` on **2026-10-09**. "Live"
= distinct users with a row in that mode; it drifts, re-check with
`select signal_name, mode, score_weight, count(*), count(distinct user_id) from risk_signals group by 1,2,3`.

**Receipt**

| signal_name | weight / grade | live | evidence | means |
|---|---|---|---|---|
| `receipt_fraud` | 1.0 mixed | enforce, 10 | `{rejection_reason}` | ≥2 `fraud_`-coded receipt rejections in 30d **after** last admin clear (forgiveness floor; pre-clear rejects no longer count) |
| `cross_user_duplicate_pair` | 0.6 derived | enforce, 8 | read a row | the same slip submitted by two users (see 4b to confirm visually) |
| `synthetic_receipt_repeat` | 0.6 derived | enforce, 2 | read a row | repeated synthetic-receipt verdicts (`docs/RECEIPT_DEDUPE_AND_EARLY_SIGNALS.md`) |
| `single_store_volume` | 0.5 derived | observe, 3 | read a row | 20+ receipts at one store in 30d whose printed dates barely move or whose lines are department keys (6h sweep) |
| `onboarding_bundle_burst` | 0.5 derived | observe, 72 | `{onboarding_total, approved_receipts, burst_size_bucket}` | account ≥3d old whose only earnings are onboarding grants (≥225 CRUSH), ≤2 approved receipts, created in a 7-day window with ≥5 others of the same shape |

**Device / login / identity** (most fire at login or in the 6h sweep; known on first session)

| signal_name | weight / grade | live | evidence | means |
|---|---|---|---|---|
| `device_farm` | 1.0 hard | enforce, 90 | `{peer_count, peer_user_ids, fingerprint_suffix}` | ≥5 *other* accounts have logged in on one `sessions.fingerprint`. 0 genuine accounts at that size when measured; holds alone |
| `device_cluster` | 0.6 derived | enforce, 6 | same | 2–4 other accounts on one fingerprint. One extra account (a household) fires nothing |
| `device_burst` | 0.6 derived | enforce, 4 (+52 observe-only) | `{device_id, user_count_on_device}` | many accounts on one **signup** `device_id` (different key from the session fingerprint above) |
| `market_timezone_mismatch` | 0.5 derived | enforce, 100 | `{timezone}` | device timezone outside `America/*`, `US/*`, `Canada/*`, Honolulu, UTC/GMT. The app is US/CA only; the printed-receipt farm ran on `Asia/Dhaka` (a second ring on `Africa/Lagos`) |
| `old_device` | 0.4 derived | enforce, 87 | `{model}` | 2015–2018-era model on first session (12.9" iPad Pro 1st/2nd/3rd/5th gen, older iPads, iPhone ≤8/X/XR/XS, SE 1st gen). Weakest tell: + foreign clock = 0.9 (no hold); + shared device (0.6) holds |
| `hosting_asn` | 0.5 derived | enforce, 49 | `{asn, asn_org}` or `{source:'netinfo_vpn'}` | session IP on a hosting/VPN network, or the app reports VPN transport |
| `emulator_device` | 1.0 hard | never fired | `{model}` | app reports a simulator/emulator (seeded observe) |
| `jailbroken_device` | 0.5 derived | never fired | `{model}` | rooted/jailbroken/hooked (seeded observe) |
| `email_domain_junk` | 0.6 derived | never fired | `{domain, reason}` | typo TLD, provider typo, throwaway shape, or no MX record |
| `email_family` | 0.5 derived | never fired | `{stem, member_count}` | ≥3 accounts on one name stem in 14 days (`foo+1@`, `foo.01@` …) |
| `phone_npa_nxx` | 0.4 derived | enforce, 10 (+45 observe) | `{prefix, member_count}` | clustered phone prefixes |
| `phone_changed_out_of_band` | 1.0 hard | never fired | read a row | phone moved on Privy with no completed change request of ours |
| `signup_velocity` | 1.0 hard | observe, 3 | read a row | shadow record of the older IP/device signup-velocity gate. That gate still enforces on its own (`risk_reason` `ip_velocity`/`device_velocity`); this signal scores nothing |

**Referral** (swept every 6h; evidence is bucketed so sliding windows don't re-fire an unchanged hub)

| signal_name | weight / grade | live | evidence | means |
|---|---|---|---|---|
| `referral_hub` | 1.0 hard | enforce, 5 | `{referee_band, flagged_share_band, flagged_sample}` | on the **referrer**: ≥5 referees in 90d and ≥50% of them held/banned or carrying ≥2 distinct enforce signals. Genuine promoters measured 0 flagged referees; the hubs behind two rings 87% and 100% |
| `referred_by_hub` | 0.5 derived | enforce, 96 | `{referrer_id, flagged_share_band}` | on each **new referee** (<30 days) of a hub. Guilt by association: read the referrer, then the referee's own tells |

**Plaid**

| signal_name | weight / grade | live | evidence | means |
|---|---|---|---|---|
| `plaid_tx_overlap` | 0.5 derived (0 under the joint-account guard) | enforce, weights 0 and 0.5 only | `{hit_count, max_overlap, peer_user_ids, joint_account_guard_applied, persistent_account_id_match}` | overlapping transaction tuples with peers on the same `(institution_id, mask)`; see the section below. Softened 1.0 → 0.5 on 2026-08-03, so it no longer holds alone |
| `plaid_farm` | 1.0 hard | never fired | read a row | ≥10 other users on one bank account (135 of 136 such accounts were banned when measured) |
| `plaid_shared_card` | 1.0 hard | observe, 11 | the peer set | an account pair on one card (same institution, same known last 4) sharing ≥20 identical `(date, amount, merchant)` tuples on ≥3 days at ≥5 per active month. Compares **all** accounts via `plaid_transactions.tuple_hash`, so it sees streams the bucket prefilter cannot (the `9JS08AWO` cluster, crush-backend #567). Holds alone, even with one peer |
| ~~`plaid_account_collision`~~ | **retired 2026-09-01** | — | — | mask-only bucketing with no transaction evidence: 96% of all signal rows, zero confirmed true positives (some institutions serialise masks across customers — American Express returns `1000`–`1008` on many customers). Old rows remain; the policy skips them and their stored weights were zeroed. **A user whose only automated hold was a collision is a false-positive candidate** |

### `plaid_tx_overlap` specifics (important)
Detector: `src/services/sybil/plaidTxFingerprint.ts`.

Match key = same `institution_id` + same `mask` (last4) + ≥ `MIN_OVERLAP` (3) overlapping
`(date, cents, normalized merchant)` tuples from recent TXs (`TX_PULL_LIMIT=100`).
Merchant comes from `merchant_name` **or** `raw_json.name` / `raw_json.merchant_name` (often
`merchant_name` is null — naive date+amount joins explode with false positives; always use
`tupleKey` logic).

Evidence fields:
- `hit_count` = number of **peer users/accounts**, not number of overlapping TXs
- `max_overlap` = best tuple-overlap count against a peer (capped by the 100-TX pull)
- `joint_account_guard_applied` = true when weight was forced to 0
- `persistent_account_id_match` = Plaid PID hit (conclusive when present; many neobanks omit it)

Joint-account guard (`tunedWeightOverride`, tiers measured 2026-09-06 — 1 peer: 19 accounts, all
fine; 2 peers: 8, all cleared; 3–9: 10, one banned; 10+: 136, 135 banned):
- **≤ 2 peer *users*, no `persistent_account_id` hit** → weight **0** (recorded, no score) — spouses,
  an adult child, roommates. Peers are counted as users: one co-holder with three matching
  sub-accounts is still one peer.
- **3–9 peers** → the derived default, **0.5**. Never holds alone; needs a partner signal.
- **10+ peers** → the hard `plaid_farm` (1.0) is recorded beside it.
- **`persistent_account_id` in any hit** → default weight even at 1 peer (conclusive when present).

**The `(institution_id, mask)` match is a prefilter, not evidence.** Several institutions reuse or
serialise masks across customers (American Express returns `1000`–`1008` on many unrelated people;
that is why `plaid_account_collision` was retired). Before calling anything a shared bank, confirm
with overlapping **tuples** (5c). Conversely, the prefilter has a **blind spot**: the same transaction
stream linked under *different* institution/mask buckets is never compared by this detector (the
`9JS08AWO` cluster, #567: 390 accounts in 358 buckets). `plaid_shared_card` and the cross-bucket query
in 5c cover that case. A clean mask check does **not** rule out a shared stream.

Clearing `risk_state` to `ok` without unlinking a genuinely shared bank can re-fire
`plaid_tx_overlap` on the next Plaid sync / backstop sweep — but note the policy: it is 0.5 now and
the admin-clear floor plus the cleared-once threshold (1.5) apply, so it needs a partner signal to
re-hold. `plaid_shared_card` only re-fires on a **new** peer (its evidence is the peer set).

## Step 4 — if it's `receipt_fraud`, decode the rejections
The `fraud_rejections` array holds the receipts that escalated them. `rejection_reason` codes
(`FraudRejectionReason`): `fraud_chain_state_mismatch`, `fraud_ebt_structure`,
`fraud_total_eq_card_last4`, `fraud_cross_user_duplicate`,
`fraud_image_duplicate`, `fraud_synthetic_receipt`. Historical only (no longer emitted as hard
rejects): `fraud_tax_on_ebt`, `fraud_future_dated` — both demoted to soft `review_*` so they
cannot account-escalate. (`ineligible_*`, `screenshot_detected`, `no_receipt_detected`,
`no_eligible_items`, and any `review_*` including `review_tax_on_ebt` do **not** count toward
escalation.)
Check `authenticity` (`is_physical_receipt`, `tamper_signals`) and `fraud_details`
(`priorReceiptId`, `hammingDistance`, `peerUserId`, `taxRate`, …) to judge each. Then read the rule
in `src/services/fraud/receiptFraudRules.ts` / `fraud/index.ts` to see exactly what fired.

### 4b — visually confirm `fraud_cross_user_duplicate` / `fraud_image_duplicate`
Do **not** treat a fingerprint hit as visual proof. Extracted store/date/total matching is
necessary but not sufficient — two different slips can share those fields, and two photos of
the same slip can look different (angle, crop, lighting). Compare the **image pair**.

Pairs: each reject's `fraud_details.priorReceiptId` + the reject itself. Compare the pair
that triggered the latest escalate first; add more pairs only if that one is inconclusive.

**Images live in the private `receipts` bucket.** Stored `image_url` looks like
`https://<ref>.supabase.co/storage/v1/object/public/receipts/<path>` but public GETs 400.
Parse `<path>` after `/object/public/receipts/` (typically
`receipts/<user_id>/receipt_<ts>_….jpg`). Sign with the service role. The key is **not**
in `~/.zshrc`; it is on Render `crush-backend-prd` (`srv-d77vv8pr0fns739ooakg`). Run a
one-off job whose `node -e` uses `process.env.SUPABASE_URL` +
`process.env.SUPABASE_SERVICE_ROLE_KEY`, `createSignedUrl` on bucket `receipts` (TTL 3600),
and prints `SIGNED_URLS_JSON_BEGIN` / JSON array of `{path,url,error}` / `SIGNED_URLS_JSON_END`.
Then `render logs -r <job-id> --limit 200 -o json` and parse the line between the markers
(service-level `--text` logs miss the job stdout). Inline the storage paths in the job command. If `SUPABASE_SERVICE_ROLE_KEY` is already in
the local env, sign locally instead. Prefer thumbs (`receipt-thumbs` / `thumb_url`) only
when the original will not fit the model; originals are the source of truth.

**Vision call — AgentCash → blockrun.ai** (paid x402; check `agentcash__get_balance` first;
balance is required). Origin `https://blockrun.ai`. Endpoint
`POST https://blockrun.ai/api/v1/chat/completions`. Always
`agentcash__check_endpoint_schema` before the first `agentcash__fetch` in the session.

Use a vision model (`google/gemini-2.5-flash` default; `nvidia/nemotron-nano-12b-v2-vl` if
you need the explicit VL id). OpenAPI types `messages[].content` as a string, but the
gateway is OpenAI-compatible — send multimodal content:

```
image A = first-approved / priorReceiptId
image B = the rejected duplicate
```

```json
{
  "model": "google/gemini-2.5-flash",
  "max_tokens": 800,
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Two grocery/gas receipts. A is the earlier submission, B is the later one our system flagged as the same slip. Decide if they are the same physical receipt. Compare merchant, date, time, total, transaction/auth codes, last4, and layout. Note if B is a reshoot, screenshot, crop, or digitally altered. Reply JSON only: {same_physical_receipt: bool, confidence: 0-1, why, store, date, total, differing_fields: [], b_is: \"same_photo\"|\"reshoot\"|\"screenshot\"|\"different_receipt\"|\"tampered\"}"},
      {"type": "image_url", "image_url": {"url": "<signed A>"}},
      {"type": "image_url", "image_url": {"url": "<signed B>"}}
    ]
  }]
}
```

If signed URLs are not fetchable from BlockRun, download locally and send
`data:image/jpeg;base64,…` instead. Cap `agentcash__fetch.maxAmount` at `1` unless the
quote is higher. Do not paste signed URLs into the user-facing writeup.

Read-back: `same_physical_receipt=true` confirms the detector; `false` is a fingerprint
false positive (do not treat as multi-accounting). `tampered` / `screenshot` of a digital
receipt upgrades severity. The vision result does **not** by itself justify an account
freeze — apply the household bar in Step 6.

## Step 5 — Plaid, device and referral evidence (peers, shared banks, devices, hubs)
This is the expanded path from the monasonly cluster investigation. Run 5a–5c when signals show
`plaid_tx_overlap` / `plaid_shared_card`, **or to rule Plaid out for a batch hold** (Step 2). Run 5d
for any device or timezone tell, 5g for `referral_hub` / `referred_by_hub` / `device_farm` /
`device_cluster`.

### 5a — peer users
```sql
-- peer ids from signal evidence.peer_user_ids
select id, email, phone_number, risk_state, risk_reason, risk_flagged_at, created_at,
       last_active_at, onboarding_completed
from public.users
where id in (:peer_ids_and_subject);
```

Also pull each peer through the Step 1 audit query (or decisions-only) — look for prior
`receipt_fraud` → admin clear → later `plaid_tx_overlap` re-flag (common).

### 5b — linked Plaid items + accounts (masks)
```sql
select u.email, i.item_id, i.institution_name, i.is_active, i.created_at, i.error_code
from public.plaid_items i
join public.users u on u.id = i.user_id
where i.user_id in (:user_ids)
order by u.created_at, i.created_at;

select u.email, a.account_id, a.name, a.mask, a.type, a.subtype,
       a.institution_id, a.institution_name, a.persistent_account_id,
       a.is_active, a.tx_overlap_checked_at, a.created_at
from public.plaid_accounts a
join public.users u on u.id = a.user_id
where a.user_id in (:user_ids)
order by u.created_at, a.created_at;
```

Same `institution_id` + `mask` across users is a **lead, not proof** (see the prefilter note in
Step 3). It was decisive for Chime checking `****1413` on three Crush accounts because ~1,168
tuples overlapped, and meaningless for American Express masks `1000`–`1008`, which many unrelated
customers share. Confirm with 5c.

### 5c — reconstruct overlapping TX tuples (use tupleKey, not bare amount)
Mirror `tupleKey()` in SQL for a chosen shared account (same institution + mask). Avoid reserved
word `overlaps` as a CTE name.

```sql
with accounts as (
  select a.user_id, u.email, a.account_id, a.mask, a.name, a.institution_name
  from public.plaid_accounts a
  join public.users u on u.id = a.user_id
  where a.user_id in (:user_ids)
    and a.institution_id = :institution_id   -- e.g. 'ins_35' Chime
    and a.mask = :mask                       -- e.g. '1413'
),
txs as (
  select t.user_id, u.email, t.account_id, t.date, t.amount, t.plaid_txn_id,
    coalesce(nullif(t.merchant_name,''), nullif(t.raw_json->>'merchant_name',''),
             nullif(t.raw_json->>'name','')) as raw_name,
    lower(regexp_replace(
      regexp_replace(
        coalesce(nullif(t.merchant_name,''), nullif(t.raw_json->>'merchant_name',''),
                 nullif(t.raw_json->>'name',''), ''),
        '[^a-zA-Z0-9 ]', ' ', 'g'),
      '\y(purchase|debit|pos|ach|card|web|payment|deposit|recurring|withdrawal|fee)\y', '', 'gi'
    )) as norm_tmp
  from public.plaid_transactions t
  join public.users u on u.id = t.user_id
  where t.account_id in (select account_id from accounts)
),
keyed as (
  select user_id, email, account_id, date, amount, plaid_txn_id, raw_name,
    date || '|' || round(amount * 100)::text || '|' ||
      trim(regexp_replace(norm_tmp, '\s+', ' ', 'g')) as tuple_key
  from txs
  where trim(regexp_replace(norm_tmp, '\s+', ' ', 'g')) <> ''
),
subject as (select * from keyed where user_id = :subject_user_id),
peer as (select * from keyed where user_id <> :subject_user_id),
ov as (
  select distinct on (s.tuple_key, p.user_id)
    s.tuple_key, s.date, s.amount, s.raw_name as subject_name, s.plaid_txn_id as subject_txn,
    p.email as peer_email, p.raw_name as peer_name, p.plaid_txn_id as peer_txn
  from subject s
  join peer p on p.tuple_key = s.tuple_key
  order by s.tuple_key, p.user_id, s.date desc
)
select peer_email, count(*) as overlap_count from ov group by peer_email
order by overlap_count desc;
-- sample: select * from ov order by date desc, amount limit 20;
```

Full history overlap can be hundreds/thousands; detector only scores the last ~100 TXs
(`max_overlap` ~90–100 is "basically the whole pull matched").

### 5c-2 — cross-bucket check by `tuple_hash` (a shared stream under different masks)
5c only compares one `(institution_id, mask)`. To test whether anyone shares a user's
transactions **regardless of bucket**, use the indexed `plaid_transactions.tuple_hash` (what
`plaid_shared_card` uses). Works for one user or a whole cluster:

```sql
with s as (select id, email from public.users where id in (:user_ids)),
h as (select t.user_id, t.tuple_hash from public.plaid_transactions t
      where t.user_id in (select id from s) and t.tuple_hash is not null),
cov as (select user_id, count(*) as txs_hashed, count(distinct tuple_hash) as distinct_hashes from h group by user_id),
pairs as (
  select h.user_id as a, p.user_id as b, count(distinct h.tuple_hash) as n
  from h join public.plaid_transactions p on p.tuple_hash = h.tuple_hash and p.user_id <> h.user_id
  group by 1, 2 having count(distinct h.tuple_hash) >= 3)
select s.email, coalesce(cov.txs_hashed,0) as txs_hashed,
       count(pairs.b) as peers_sharing_3plus, coalesce(max(pairs.n),0) as max_shared_tuples,
       count(*) filter (where pairs.n >= 20) as peers_at_shared_card_bar
from s left join cov on cov.user_id = s.id left join pairs on pairs.a = s.id
group by s.email, cov.txs_hashed order by max_shared_tuples desc;
```

Read it like this: **≥ 20 shared tuples** (on ≥ 3 days) is the `plaid_shared_card` bar; ≥ 10 is
"investigate"; **1–2 peers at exactly 3 is coincidence** (same merchant, amount and date happen) —
do not report it as overlap. **Coverage matters:** `tuple_hash` was populated on only ~15% of
transactions for the accounts checked on 2026-10-09 (195 of ~1,300), so always report
`txs_hashed` next to the result; `txs_hashed = 0` means *unknown*, not *clean*.

### 5d — session / device / geo (same device? same location?)
Tables: `sessions`, `ip_addresses`, `signup_attempts`, `device_installs`, views
`v_device_clusters` / `v_ip_clusters`.

Signup `device_id` / `ip_hash` alone are incomplete — always check `sessions` + `ip_addresses`:

```sql
with trio as (select id, email from public.users where id in (:user_ids)),
sess as (
  select u.email, s.fingerprint, s.ip, s.city as session_city, s.country as session_country,
         s.timezone, s.platform, s.model_name, s.os_version, s.app_version,
         s.created_at, s.last_active_at,
         i.city as ip_city, i.region as ip_region, i.country as ip_country,
         i.latitude, i.longitude, i.asn, i.asn_org
  from public.sessions s
  join trio u on u.id = s.user_id
  left join public.ip_addresses i on i.ip = s.ip
)
select email,
  count(*) as session_count,
  array_agg(distinct fingerprint) filter (where fingerprint is not null) as fingerprints,
  array_agg(distinct ip) filter (where ip is not null) as ips,
  array_agg(distinct coalesce(ip_city, session_city)) as cities,
  array_agg(distinct ip_region) as regions,
  array_agg(distinct model_name) filter (where model_name is not null) as models,
  array_agg(distinct timezone) filter (where timezone is not null) as timezones,
  min(created_at) as first_session,
  max(last_active_at) as last_active
from sess
group by email
order by first_session;
```

Interpretation tips (from monasonly cluster):
- **Same device?** distinct `sessions.fingerprint` / signup `device_id` → no
- **Same location?** same IP + city (e.g. two users on Charter Tallassee) → household
- **Same bank, different city/device** (e.g. Birmingham Verizon iPhone 16 vs Tallassee) →
  credential sharing / recruit, still multi-accounting against one bank identity
- Incomplete CRUSH dump ≠ innocence (staking looks legit and still earns)

### 5e — receipt stats for the cluster
```sql
select u.email, r.status,
  r.ocr_data->'authenticity'->>'is_physical_receipt' as is_physical,
  r.ocr_data->>'rejection_reason' as rejection_reason,
  r.store_name, r.total_amount, r.submitted_at, left(coalesce(r.admin_notes,''), 120) as admin_notes
from public.receipts r
join public.users u on u.id = r.user_id
where r.user_id in (:user_ids)
order by u.email, r.submitted_at desc;
```

Roll up submitted / approved / rejected / `is_physical_receipt=true` (physical totals).

### 5f — CRUSH earned / held / sold
Ledger ≠ wallet. `user_rewards.balance` / `lifetime_earned` do **not** decrease when users
swap on-chain.

```sql
-- ledger + pending + stake + wallets
select u.email,
  ur.lifetime_earned, ur.balance,
  (select jsonb_object_agg(state, total) from (
     select state, round(sum(amount)::numeric,6) total from public.pending_rewards p
     where p.user_id = u.id group by state) x) as pending_by_state,
  round(coalesce(sp.staked_amount,0)::numeric / 1e6, 6) as staked_crush,
  w.solana_address
from public.users u
left join public.user_rewards ur on ur.user_id = u.id
left join public.wallets w on w.user_id = u.id
left join lateral (
  select staked_amount from public.staking_positions s
  where s.user_id = u.id order by s.updated_at desc nulls last limit 1
) sp on true
where u.id in (:user_ids);

-- on-chain distribution (amounts are base units / 1e6)
select u.email,
  round(coalesce(sum(a.amount) filter (where a.status = 'completed'),0)::numeric/1e6,6) as airdrop_completed,
  (select round(coalesce(sum(c.total_amount),0)::numeric/1e6,6)
     from public.epoch_claim_transactions c
     where c.user_id = u.id and c.status = 'confirmed') as claims_confirmed
from public.users u
left join public.token_airdrops a on a.user_id = u.id
where u.id in (:user_ids)
group by u.id, u.email;
```

Where the CRUSH came from (`reward_transactions`; sources seen: `epoch_claim`, `achievement`,
`level_up`, `referral`). Compare the dates with the hold date: credits **before** the hold are
already out (clearing releases nothing for them); earnings **after** it should be sitting in
`pending_rewards` (state `pending`). A balance that is almost all `epoch_claim` is the number to
weigh when deciding how much a wrong clear would cost:

```sql
select type, source, count(*) as n, round(sum(amount)::numeric, 2) as total,
       min(created_at) as first, max(created_at) as last
from public.reward_transactions where user_id = :user_id group by type, source order by total desc;
```

On-chain wallet balance (Solana RPC `getTokenAccountsByOwner` for mint
`CrushF21aXLbwhrW2xoWofypGpg9cU2jJvE84hpEWHt`, 6 decimals):

| quantity | definition |
|---|---|
| **Earned** | `user_rewards.lifetime_earned` (or sum of completed airdrops + confirmed epoch claims + staking claims) |
| **Still hold** | wallet UI amount + `staked_amount/1e6` |
| **Implied sold/moved** | on-chain received − still hold (not a Jupiter trade log; includes transfers) |
| **Pending escrow** | `pending_rewards` state `pending` (review hold; not yet airdropped) |

Public Solana RPC is often 429-limited for per-tx parsing; wallet balance + stake + airdrop/claim
sums are usually enough for support.

### 5g — referral hub / device farm
Run when `referred_by_hub`, `referral_hub`, `device_farm` or `device_cluster` appear, or when a
manual batch hold is named after a referral code.

```sql
-- who referred the subject, and what the referrer's whole tree looks like
select r.referral_code, rc.user_id as referrer_id, ru.email as referrer_email,
       ru.risk_state as referrer_state, ru.risk_reason as referrer_reason, r.created_at as referred_at
from public.referrals r
join public.referral_codes rc on rc.code = r.referral_code
join public.users ru on ru.id = rc.user_id
where r.user_id = :subject_user_id;

select count(*) as referees,
       count(*) filter (where u.risk_state = 'review') as in_review,
       count(*) filter (where u.risk_state = 'banned') as banned,
       count(*) filter (where u.risk_state = 'ok') as ok,
       min(r.created_at) as first_referee, max(r.created_at) as last_referee
from public.referrals r join public.users u on u.id = r.user_id
where r.referral_code = :code;
```

Then the referrer's own signals (`select signal_name, mode, score_weight, evidence from risk_signals where user_id = :referrer_id`)
and, for device peers, 5d with `:user_ids` = subject + `evidence.peer_user_ids`; compare
`fingerprint_suffix`, places, phone area codes and signup dates. Reading it:

- **Weight sits on the referrer.** `referred_by_hub` (0.5) is guilt by association; it only matters
  with a second tell. A referrer with 50+ referees, ~100% held, and `device_farm` on 30+ peers is a
  farm. The referee's own record (device, timezone, receipts, banks) decides the referee.
- **Peers on one fingerprint but in different states, with different area codes, signing up within
  days** → not a household (one phone cannot be in two states at once). With `Asia/Dhaka` clocks
  and an old iPad/iPhone model, this is the printed-receipt farm's shape.
- **A referrer with one referee who shares their IP / city, differs in phone and device, and has
  its own receipts** is household-compatible (partner, family) — no signal fires for it. Look for a
  shared bank (5c-2) before calling it self-referral.
- A **manual** hold on a whole referral tree (Step 2, batch holds) has none of these signals; run
  5c-2 across the tree to see whether any member actually shares a stream, and rank members by
  `lifetime_earned` — the exposure is concentrated in the top few, not spread evenly.

## Step 6 — verdict + remediation
State whether the flag is **justified** or a **false positive** (per signal), and whether
**account-level** `review` is the right hammer (often it is not).

**Household / roommate bar (default lenient):** two people sharing a home (partners, family)
who submit the same physical receipt is expected, not a sophisticated attack. Matching
extracted fields + a confirmed same-slip photo (Step 4b) means they tried to get paid twice
for one basket. If **the second copy was rejected**, that is the control working. Do **not**
recommend ban or keeping the account frozen when all of these hold:

- Distinct Plaid identity — no `plaid_shared_card` / `plaid_farm`, no `plaid_tx_overlap` above
  weight 0, or only one side linked. A shared stream (overlapping tuples per 5c/5c-2, or a PID
  match) fails this bar; a bare `institution_id`+`mask` match does not.
- Second copies of identical slips are `rejected` (`fraud_cross_user_duplicate` /
  `fraud_image_duplicate`); first copy may stay approved.
- Vision (4b) says same physical slip (or extracted fields match and images are consistent),
  not synthetic/tampered.
- Cluster shape is household: 2 people, shared home IP/city, different devices/phones.
  Same email *stem* across gmail/yahoo is compatible with household; it is not by itself
  a farm.

In that shape, say the `receipt_fraud` escalate **fired correctly** but account-level
`review` is **too harsh** — recommend `clear` so both keep earning on *their own*
receipts. The uniqueness gate stays on.

**Still treat as genuine abuse (keep review / consider ban):**

- Shared bank/stream across 3+ other Crush accounts, **confirmed by tuples** (10+ is a farm).
- Farm tells stacking on the account itself: a foreign-clock timezone, a fingerprint shared with
  accounts in distant places, an old-model device or hosting/VPN ASN, and a hub referrer. Any one
  is weak (derived); together they are the printed-receipt farm's shape.
- Second copy was **approved** (uniqueness failed) or they farm 3+ accounts / many devices.
- Vision says tampered, synthetic, or a screenshot of a digital receipt reused as “physical.”
- `receipt_fraud` on authentic receipts with an explicable non-dup reason (mixed EBT basket,
  `fraud_total_eq_card_last4` OCR, etc.) → likely rule FP, not abuse.

Other signals unchanged:

- `plaid_tx_overlap`: ≤ 2 peers is a joint household (the guard already scores 0); 3–9 peers
  scores 0.5 — go to the tuples before judging; 10+ is a farm (`plaid_farm`).
- A **derived-only hold on a fresh account** (two 0.5 tells) is a hold, not a verdict. Weigh each
  tell: a foreign timezone alone is a traveller or an immigrant's phone; the pair is what the policy
  treats as enough to look, not to ban.
- A **manual batch hold** (Step 2) with no per-user tells and clean 5c-2 results looks like
  collateral damage — but the criteria the admin drew the cluster on are not in the database. Ask
  them, then recommend clear per member with a clean record, and say which evidence you checked.
- Incomplete token dump does **not** prove innocence (staking / not enough time to sell).
- `ip_velocity`/`device_velocity` → check whether it's a shared network (family/dorm) vs real farming.

Remediation is admin-only (do not run unprompted): `POST /v1/admin/risk/:id/clear` (or
`bulkRiskTransition action:'clear'`) resets to `ok` **and releases withheld pending rewards**;
`…/ban` forfeits them. Check `pending_rewards` before promising anyone a payout — a held account
can have nothing escrowed (e.g. everything earned before the hold, or only released rows). After a
clear, derived signals need a composite of **1.5** to hold that account again; a hard signal still
holds at once. For Plaid clusters: clearing one user without unlinking / disabling
secondary bank links will re-escalate. Prefer treating the **cluster** together. For
household receipt-dup pairs, clear the frozen side; do not ban the peer who is still `ok`.

If the flag is a systemic false-positive class, fix the rule + consider a backfill
(see the EBT case: `scripts/backfill-ebt-tax-false-positives.ts`).

### Product direction (partly shipped)
First-linker-wins shipped 2026-08-03 as the **contribution-layer dedupe** (`plaidDedupeService.ts`,
`docs/PLAID_DEDUPE.md`): duplicate-account paid volume is marked and zeroed there, and that — not
risk escalation — is now the primary defense (`plaid_tx_overlap` was softened to 0.5 at the same
time). The rest of the intent below was not re-verified against #291 on 2026-10-09.

Prefer **first-linker-wins / soft quarantine** over account freeze for Plaid-only overlaps:
primary keeps Plaid earnings; 2nd/3rd get non-earning link + modal; receipts still go through
uniqueness/fraud checks; escalate to review/ban when shared bank stacks with receipt fraud.
See https://github.com/Crush-Rewards/crush-backend/issues/291 (assignee `@smohamedjavid`).

## Typical question → which step
| User asks | Run |
|---|---|
| Why is X in review? | Steps 1–3 (+4 or 5) |
| Are these two receipts actually the same? | 4b (sign images → blockrun.ai vision) |
| Show the two overlapping details / peers | 5a–5c |
| Same device / location? | 5d (`sessions` + `ip_addresses`, not just signup) |
| Is this part of a farm / referral ring? | 5g, then 5d for the device peers |
| Does anyone share this user's bank stream? | 5c (one bucket) → 5c-2 (any bucket, by `tuple_hash`) |
| Held by an admin batch — safe to clear? | Step 2 batch holds → 5c-2 + 5d + 5f per member |
| How many receipts / physical? | 5e |
| CRUSH earned / still hold / sold? | 5f |
| What should we do instead of ban? | Step 6 household bar + product direction |

## Worked example — monasonly cluster (2026-07)
- Subject: `monasonly1@icloud.com` → `plaid_tx_overlap` ~30m after signup
- Peers: `datbaby02024@gmail.com`, `tipp2460@gmail.com` (also review; previously cleared from
  `receipt_fraud`, then re-flagged by Plaid overlap)
- Shared Chime masks `1413` / `2398` / `2442`; Checking `1413` had ~1168 tuple overlaps each
- Geo: datbaby+tipp same Charter IP Tallassee AL, different iPhones; mona Birmingham Verizon,
  iPhone 16 — same bank, not same device/location
- Receipts: 27 submitted cluster-wide, all physical-tagged, 14 approved
- CRUSH: ~6.0k earned; ~1.9k still held (mostly datbaby stake + mona wallet); ~4.2k implied
  sold/moved (tipp emptied); mona +375 pending escrow

## Worked example — referral hub + device cluster (2026-10)
- Subject held ~75 min after signup by `system:referred_by_hub`: score 1.00 = `referred_by_hub`
  0.5 + `market_timezone_mismatch` 0.5 (`Asia/Dhaka` clock on a US phone number).
- Referrer: `referral_hub` (57 referees, 100% in review, 0 ok) and `device_farm` on 30+ peers,
  held nine days earlier; same foreign clock, plus a first-generation 12.9" iPad Pro (`old_device`).
- A week later `device_cluster` (0.6): two other accounts on the subject's fingerprint, created
  within 8 days, in different states, with different phone area codes.
- Subject's own record: one approved physical receipt, no Plaid, 0 CRUSH earned, 350 CRUSH in
  `onboarding_hold` escrow. Verdict: hold justified; treat the three device-sharing accounts as one
  cluster. Customer reply: say a check flagged activity, rewards are held not removed, reply with
  context; name no signal, no other user, no timeline.

## Worked example — manual referral-tree batch hold (2026-09-24 → 2026-10-09)
- 35 users held within ~100 s by an admin acting through Claude, reason `referral_cluster_<CODE>:
  plaid earnings under review`; no signals, `composite_score` 0. Eight members were cleared one by
  one over the next 11 days, no reason recorded.
- Members showed no per-user tells. One had an earlier *automatic* hold from the retired
  `plaid_account_collision` (American Express serial masks), cleared by an admin before the signal was retired.
- 5c-2 over the 26 members still held: nobody at the 20-tuple shared-card bar (max 19, 18, 12; the
  rest ≤ 9, most 0), with `tuple_hash` coverage ~15%. Earnings were concentrated: the top three
  balances were ~43K, ~35K and ~31K CRUSH, the next ~6K, almost all `epoch_claim` credited before the hold.
- Takeaway: when the hold's rationale is a Plaid-stream concern, test the stream (5c-2), not the
  masks, and weigh members by what they earned, not by tree membership.

## Related
- Code: `src/services/sybil/plaidTxFingerprint.ts`, `src/services/risk/*`,
  `docs/RISK_SIGNALS_PIPELINE.md`
- Signal source of truth: `src/services/risk/signalRegistry.ts` (names, weights, grades, gates);
  scoring: `src/services/risk/riskPolicyService.ts`; detectors: `src/services/sybil/`
  (`loginClusterSignals.ts`, `accountTells.ts`, `referralHub.ts`, `onboardingBundleBurst.ts`,
  `singleStoreVolume.ts`, `plaidSharedStream*.ts`); `docs/PLAID_SYBIL.md`, `docs/PLAID_DEDUPE.md`.
  **Re-sync the Step 3 signal reference when the registry changes** (last synced 2026-10-09, `POLICY_VERSION` 5).
- Memory: `fraud-tax-on-ebt-false-positive`, `support-investigation-db-access`
- GitHub: https://github.com/Crush-Rewards/crush-backend/issues/291 (assignee `smohamedjavid`)
