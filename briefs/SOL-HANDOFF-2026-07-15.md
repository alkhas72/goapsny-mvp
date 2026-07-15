# SOL conductor passport — recovery handoff

Written at: 2026-07-15 18:02 MSK
Authoritative writer: Codex Desktop rollout `019f663a-2513-7263-8e94-e56a51241752`
Sprint worktree: `feat/goapsny-sprint`
Authoritative sprint commit before this passport: `953d6ce`

## Why this passport exists

The prior SOL panel stalled after 13:51. Architect delivered a recovery directive through a cross-process resume path, which created or resumed a parallel Codex rollout while the old Supacode/Desktop panel may still exist. Latest append-only run-log and commits from this rollout are authoritative. Any old panel must read this passport before acting; simultaneous conductor writers are forbidden.

## Recovery outcome

1. T1 immutable re-review at `fc2b7dd`: complete. Verdict `CHANGES REQUIRED`; test-DB `HOLD`. Full evidence: `briefs/T1-REREVIEW-2026-07-15.md`.
2. T3 immutable re-review at `faa7993`: complete. Verdict `CHANGES REQUIRED`; G2/deploy `HOLD`. Full evidence: `briefs/T3-REREVIEW-2026-07-15.md`.
3. Side lanes were not activated before reviews. No DB apply, deploy, secret/webhook change, external Telegram message, PR, or main merge occurred.

## Critical findings to route next

### T1

- DB harness provisions no deterministic fixtures, never enforces URL host against `TEST_SUPABASE_PROJECT_REF`, and falls back to non-test keys. Actual test-target smoke: 3/9, all required fixtures absent.
- Public PWA replaces the repository's single Telegram Mini App entrypoint unless an explicit product decision or separate route/build is added.
- `VITE_SUPABASE_*` client names are missing from `.env.example`.
- Populated data → marker → sheet → filter and real Tab/Shift-Tab focus behavior remain unproved; public data load is unbounded.

### T3

- Create flow enters `create_status`, but callback validation rejects its `st:*` keyboard as `wrong_state`; creation cannot complete.
- A retry after successful DB publish but failed Telegram/session completion can delete the already-committed facade.
- A process death after idempotency claim can leave `processing` forever; no lease/reclaim uses `claimed_at`.
- Prior-step skip/enum buttons remain valid across the whole flow nonce; no end-to-end verify/create/edit tests; real SQL/RPC atomicity remains unproved.

## Permanent contract updates

Arbiter's signature-statistics and naming rules were added and verified in:

- `/Users/alkhas.abaza/Obsidian/wiki/06-AI-TECH/01-Agents/conductor-startup-brief.md`
- `/Users/alkhas.abaza/Obsidian/wiki/06-AI-TECH/02-Toolstack/supacode-orchestrator-2026-07-04.md`
- `/Users/alkhas.abaza/Obsidian/wiki/06-AI-TECH/token-budget-monitor.md`

Session/tab audit and exact target names: `briefs/SESSION-NAME-AUDIT-2026-07-15.md`. Rename remains `WAITING ON HQ/UI` because the Supacode CLI has no rename command and Computer Use is not approved; direct mutation of live `layouts.json` was rejected as noncanonical.

## Channels and gates

Direct channels verified historically and retained:

- current Codex Desktop/cross-process conductor rollout;
- filesystem + git for all sprint worktrees;
- Supacode bundled CLI/socket for supported list/focus/new/close/split operations;
- T1 Cursor chat `0f612cc8-592a-43da-b3e1-7b5316696270`;
- T3 Cursor chat `5e0e4d3c-f9ed-4cf6-8dec-60d986d80b79`;
- Antigravity `agy` only in sandboxed read-only mode.

Closed or absent:

- Telegram one-time exception is closed; no new external message gate.
- Z/T2 has no worktree/session/provider config.
- Kimi field test-belt has no worktree; the earlier probe session is not a launched lane.
- Mistral/Vibe is retired by Arbiter.

Unchanged Arbiter gates: deploy, secrets, webhook registration, DB/migration/fixture apply, external messages, PR/main merge, destructive archive/delete.

## Native conductor statistics at passport time

- Rollout start: 17:41:54 MSK.
- Latest machine sample used for the passport: 17:58:47 MSK rollout event.
- Context: 83,449 / 258,400 = 32.3% used.
- Subscription rate-limit window: 13% used; this is distinct from context occupancy.
- Observed rollout growth: about 3,880 context tokens/min across 17 native samples.
- Linear forecast to context wall at that observed rate: about 45 minutes. This is a planning estimate from machine samples, not a native provider promise; compaction/traffic can change it.

## NEXT / WAITING

NEXT after conductor authority is unambiguous:

1. Resume existing T1 Cursor chat with `briefs/T1-REREVIEW-2026-07-15.md`; require ACK and focused correction SHAs. Do not create a second writer.
2. Resume existing T3 Cursor chat with `briefs/T3-REREVIEW-2026-07-15.md`; require ACK and focused correction SHAs. Do not create a second writer.
3. Only after those correction lanes are launched and observed, decide whether to launch Kimi test-belt or Z/T2; their briefs alone do not count as LAUNCHED.

WAITING:

- HQ/UI applies and verifies the exact session/tab names in the name audit.
- Arbiter resolves the product-surface decision for T1: separate public entrypoint versus intentional replacement of Mini App.
- Arbiter gates any future test-DB apply, deploy, secrets, webhook, external messages, PR, or merge.

## Rotation rule

Rotate only the conductor, never the live executor chats/worktrees. The incoming conductor reads, in order: latest `run-log.md`, this passport, T1/T3 15.07 re-reviews, then verifies branch tips and working-tree cleanliness. It writes one `SESSION-START` echo with channels, roster states, native statistics, and exact NEXT before resuming any lane.
