# Kimi — independent T1/T3 test belt

Owner: Kimi K2.7 Code on Cursor CLI
Worktree/branch: `feat/test-belt`, separate from T1/T3
Priority: parallel quality belt; must not block Composer critical-path work
Mode: `superpowers-full` for new tests and any explicitly assigned tested fix
Conductor: SOL; do not edit `run-log.md` or active Composer worktrees.

## Goal

Independently pressure-test the exact defects returned in the T1 and T3 SOL reviews, add missing unit/contract regression tests in a separate branch, and prepare a bounded minor-fix package only after SOL assigns non-overlapping items. Green Composer reports are inputs, not truth.

## Inputs

Read completely:

- root `AGENTS.md`, `DESIGN.md`, backend contract, RLS checklist;
- `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/OBJECT-CONTRACT.md`;
- `T1-REVIEW-2026-07-14.md`, `T1-TESTDB-GATE-2026-07-15.md`, and `T3-REREVIEW-2026-07-14.md`;
- read-only local refs/commits from `feat/pwa-public` and `feat/tg-auditors` as they become committed.

Staff creates `feat/test-belt` from `origin/main`. Do not create a nested worktree. Never write T1/T3 paths. Pin every tested product snapshot by SHA in the report; a moving branch name is not evidence.

## Phase K0 — start immediately

1. Inventory the two review documents into a test matrix: finding → existing test → missing assertion → feasible layer (`unit`, `contract/static`, `integration prerequisite`, `manual`).
2. Read current committed T1/T3 refs without treating intermediate commits as final.
3. Prepare focused test scaffolding in `feat/test-belt`; no copied secrets, env files, database state, or generated build artifacts.

## Phase K1 — pinned-SHA regression belt

When T1/T3 provide pushed SHAs, staff/SOL supplies those exact values. Materialize/cherry-pick them only inside `feat/test-belt` for testing; never merge or push into their branches.

Required T1 regression targets:

- smoke fails if gray/colored published fixtures or positive signed facade cases are absent;
- hidden/pending photo/object probes use privileged fixture IDs but assert through anon;
- test-env loader cannot fall back from service-role to `VITE_*` and validates project ref;
- keyboard operation and focus return for pins, menu/filter, and loading/error place sheets;
- browser zoom is not disabled; Russian-only switch removal; geolocation only after user action;
- visible tile attribution and no placeholder external link presented as a real destination.

Required T3 regression targets:

- exact `AUDITOR_TELEGRAM_*` env names, missing-env failure, and no shared-token fallback;
- one atomic idempotency claim under concurrency, recoverable failure, completed duplicate behavior;
- processed-update SQL schema matches runtime writes;
- atomic place+photo metadata publication and no half-object window;
- correct facade path expression and minimum RPC execute grants;
- facade photo present/missing behavior before verdict;
- callbacks bound to expected state/session revision; stale/wrong-state buttons rejected;
- enum/text validation and Telegram non-2xx retry path;
- unique migration versions and no duplicated T1 category migration.

Prefer behavior tests over regex. Static SQL/source assertions are acceptable only where no local runtime exists and must be labeled as contract tests, not live proof.

## Phase K2 — minor package

Do not modify product behavior speculatively. After pinned-SHA results, SOL may assign specific remaining LOW/MEDIUM findings that do not overlap active Composer edits. Implement only those named items with red→green tests in `feat/test-belt`; otherwise return test-only commits.

## Verification and handoff

Run all applicable T1 npm/Vitest/build checks and T3 Deno fmt/lint/test/check checks from the materialized snapshots, plus test-belt tests and `git diff --check`. Never use production or the service-role key.

Push coherent test-only/minor commits to `feat/test-belt`. Return `KIMI-TEST-BELT-REPORT.md` with:

- pinned T1/T3 SHAs;
- matrix of covered/uncovered review findings;
- new red→green tests and any test that exposed a defect;
- exact commands/exits/counts;
- any assigned minor fixes as separate commits;
- integration/cherry-pick notes without performing integration;
- `READY FOR SOL REVIEW` or `BLOCKED`.

No deploy, DB apply, secrets, webhook, external message, force-push, PR, merge, or `main` mutation.
