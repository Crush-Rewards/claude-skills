---
name: user-audit
description: Investigate why a Crush user's account is in risk_state review/banned (or why their receipts were rejected). Resolves the escalation source from users.risk_reason + risk_decisions/risk_signals, pulls Plaid peer overlap / session geo / CRUSH earned-held-sold evidence, and judges whether it's a false positive. Use for support investigations like "why was <email> blocked / put in review / receipts rejected" or "show the overlapping bank details and peers".
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

```sql
with u as (select * from public.users where email = :email)  -- <-- set :email
select jsonb_pretty(jsonb_build_object(
  'user', jsonb_build_object(
    'id', u.id, 'email', u.email, 'phone', u.phone_number,
    'risk_state', u.risk_state, 'risk_reason', u.risk_reason,
    'risk_flagged_at', u.risk_flagged_at, 'risk_reviewed_at', u.risk_reviewed_at,
    'risk_reviewed_by', u.risk_reviewed_by, 'created_at', u.created_at,
    'foundry_recommend_action', u.foundry_recommend_action,
    'foundry_risk_reason', u.foundry_risk_reason, 'foundry_ml_score', u.foundry_ml_score),
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
| `policy:review:score=…: <signal>×n(w=…)` | Composite risk policy (signal-driven) | `signals`/`decisions` — the embedded signal name is the cause |
| `ip_velocity` / `device_velocity` | Signup-velocity gate at account creation | `signup_attempts` (shared `ip_hash`/`device_id` within 24h). **No decision/signal rows.** |
| `admin_ban` / `admin_review` / free text | Manual admin | `risk_reviewed_by` = the admin; `decisions` row `decided_by`=email |
| `NULL` while `review` | Legacy/direct write or admin-cleared-then-reflagged | fall back to `decisions` + `signals` + `signup_attempts` |

Foundry columns (`foundry_recommend_action` etc.) are an **advisory ML pipeline — recommendations
only, they do NOT set `risk_state`.** `foundry_recommend_action='REVIEW'` + `risk_state='ok'` = flagged but no action taken.

## Step 3 — read the evidence
- **`decisions`** (`risk_decisions`) = the state-change spine. `decided_by` `system:*` = automated,
  an email = admin. **Forgiveness boundary:** the most recent decision with `to_state='ok'` AND a
  non-`system:` `decided_by` is the last admin clear — only signals *after* it still count.
- **`signals`** (`risk_signals`) = detector firings. Only `mode='enforce'` rows count toward the
  policy. `evidence` JSONB holds the specifics. Signal reference:

| signal_name | weight | auto-escalates? | evidence | means |
|---|---|---|---|---|
| `receipt_fraud` | 1.0 | **yes** | `{rejection_reason}` | ≥2 `fraud_`-coded receipt rejections in 30d **after** last admin clear to `ok` (forgiveness floor; pre-clear rejects no longer count) |
| `plaid_tx_overlap` | 1.0 | **yes** | `{hit_count, max_overlap, peer_user_ids, …}` | shared Plaid transactions with other users |
| `plaid_account_collision` | 1.0 | **yes** | `{bucket, peer_count, peer_user_ids}` | same bank account across users |
| `device_burst` | 0.6 | no (observe) | `{device_id, user_count_on_device}` | many accounts one device |
| `email_family` | 0.5 | no (observe) | `{stem, member_count}` | `foo+1@`, `foo+2@` … |
| `phone_npa_nxx` | 0.4 | no (observe) | `{prefix, member_count}` | clustered phone prefixes |

Review threshold = 1.0 over a 30-day lookback, so **one enforce weight-1.0 signal escalates alone**;
the three sub-1.0 signals are observe-mode and don't escalate today.

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

Joint-account guard (`tunedWeightOverride`):
- **1 peer, tx_overlap only** → weight 0 (observe/record, no escalate) — spouses/roommates
- **`persistent_account_id` in any hit** → full weight even at 1 peer
- **2+ peer users** → full weight (sybil-ring shape; extremely rare as a legit joint account)

Clearing `risk_state` to `ok` without unlinking the shared bank **will re-fire** on the next
Plaid sync / backstop sweep.

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

## Step 5 — if it's `plaid_tx_overlap`, pull peers + overlapping bank details
This is the expanded path from the monasonly cluster investigation. Run these after Step 1
when `risk_reason` / signals show `plaid_tx_overlap`.

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

Same `institution_id` + `mask` across users = the smoking gun (e.g. Chime checking `****1413`
on three Crush accounts).

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

## Step 6 — verdict + remediation
State whether the flag is **justified** or a **false positive** (per signal), and whether
**account-level** `review` is the right hammer (often it is not).

**Household / roommate bar (default lenient):** two people sharing a home (partners, family)
who submit the same physical receipt is expected, not a sophisticated attack. Matching
extracted fields + a confirmed same-slip photo (Step 4b) means they tried to get paid twice
for one basket. If **the second copy was rejected**, that is the control working. Do **not**
recommend ban or keeping the account frozen when all of these hold:

- Distinct Plaid identity — no `plaid_account_collision` / `plaid_tx_overlap`, or only one
  side linked. Shared bank (same `institution_id`+`mask`, or PID match) fails this bar.
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

- Shared bank across 2+ Crush accounts (Plaid collision or high tx-overlap, 2+ peers).
- Second copy was **approved** (uniqueness failed) or they farm 3+ accounts / many devices.
- Vision says tampered, synthetic, or a screenshot of a digital receipt reused as “physical.”
- `receipt_fraud` on authentic receipts with an explicable non-dup reason (mixed EBT basket,
  `fraud_total_eq_card_last4` OCR, etc.) → likely rule FP, not abuse.

Other signals unchanged:

- `plaid_tx_overlap` with 2+ peers on same institution+mask → usually genuine multi-account /
  shared-bank cluster (not FP). Single peer may be joint household (guard already weight-0).
- Incomplete token dump does **not** prove innocence (staking / not enough time to sell).
- `ip_velocity`/`device_velocity` → check whether it's a shared network (family/dorm) vs real farming.

Remediation is admin-only (do not run unprompted): `POST /v1/admin/risk/:id/clear` (or
`bulkRiskTransition action:'clear'`) resets to `ok` **and releases withheld pending rewards**;
`…/ban` forfeits them. For Plaid clusters: clearing one user without unlinking / disabling
secondary bank links will re-escalate. Prefer treating the **cluster** together. For
household receipt-dup pairs, clear the frozen side; do not ban the peer who is still `ok`.

If the flag is a systemic false-positive class, fix the rule + consider a backfill
(see the EBT case: `scripts/backfill-ebt-tax-false-positives.ts`).

### Product direction (not yet shipped)
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

## Related
- Code: `src/services/sybil/plaidTxFingerprint.ts`, `src/services/risk/*`,
  `docs/RISK_SIGNALS_PIPELINE.md`
- Memory: `fraud-tax-on-ebt-false-positive`, `support-investigation-db-access`
- GitHub: https://github.com/Crush-Rewards/crush-backend/issues/291 (assignee `smohamedjavid`)
