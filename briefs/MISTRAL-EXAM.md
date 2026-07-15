# Vibe / Mistral Medium 3.5 — field task 1: G1 seed utility

> **CLOSED BY ARBITER — 2026-07-15.** Mistral/Vibe is removed from the field roster. Do not start, resume, review for integration, or issue follow-up tasks from this brief. The pushed exam artifact is historical evidence only; no live apply is authorized.

Owner: Mistral Vibe CLI, model `mistral-medium-3.5`
Worktree/branch: `feat/mistral-probe`
Role: draft horse for bounded mechanics; continuing field exam through real work
Priority: parallel, outside critical path; T1's fixture harness proceeds independently
Mode: `superpowers-full` for a new write-capable test utility; requirements are approved, so write a short plan then use tests first.
Conductor: SOL; do not edit `run-log.md` or any other worktree.

## START GATE — IMMEDIATE

**Start now. Do not wait for Supabase, `.env.test.local`, a Composer SHA, or another SOL message.** The coding exam is the offline implementation, test suite, CLI behavior, git discipline, and report. Use fakes and a temporary sentinel env file for all required verification. A real database write is explicitly outside this exam and cannot block `READY FOR SOL FIELD REVIEW`.

## Standing context

- Write-probe passed: exact 21-byte write and clean deletion under the native permission sandbox.
- Critic/auditor role is closed after the prior lab failure. This task evaluates only bounded implementation discipline.
- Highest available subscription model is Medium 3.5. Subscription is not renewed by default after the paid cycle around 2026-08-13; until then Vibe receives a continuing queue of mechanical tasks.
- This file supersedes the earlier synthetic migration-linter exam. Do not implement that discarded task.

## Real task

Build a deterministic, idempotent G1 test-data seed utility for the isolated Supabase test project. It prepares the exact four place/photo cases needed by the anonymous PWA smoke:

1. published gray + facade;
2. published colored + facade;
3. pending + facade;
4. hidden + facade.

This is a parallel candidate artifact. It must not delay, replace, or write into T1's critical fixture harness. SOL will compare/reuse it only after independent review.

## Read first

1. Root `AGENTS.md`, `docs/rls-checklist.md`, baseline schema and canonical seeds.
2. `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/OBJECT-CONTRACT.md` §§2–4, 7, 9.
3. `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/G1-TEST-ENV.md` and `T1-TESTDB-GATE-2026-07-15.md`.
4. Exam protocol `/Users/alkhas.abaza/Obsidian/wiki/from-codex/cursor-candidates-model-bench-exam-2026-07-12.md`: factual artifacts, independent verification, no invented cost metric.

Confirm branch `feat/mistral-probe` and clean allowed paths before writing. Do not create another worktree.

## Allowed files

Maximum five files:

- `scripts/seed-g1-test-data.mjs`
- `scripts/lib/g1-test-fixtures.mjs`
- `tests/g1-test-fixtures.test.mjs`
- `MISTRAL-FIELD-REPORT.md`
- `.gitignore` only if `.env.test.local` is not already ignored

Do not edit migrations, seeds, package/lock files, app/Edge code, config, or conductor docs.

## Interface and safety

Use only Node built-ins and dependencies already present in the repository. No install/network research.

Required commands:

```bash
node scripts/seed-g1-test-data.mjs --plan --env-file .env.test.local
node scripts/seed-g1-test-data.mjs --apply --env-file .env.test.local
```

The utility must:

- read only `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, and `TEST_SUPABASE_PROJECT_REF`; never accept service role from `VITE_*`, ordinary `SUPABASE_*`, CLI arguments, or source literals;
- fail closed unless the URL hostname project ref exactly matches `TEST_SUPABASE_PROJECT_REF`;
- require explicit `--plan` or `--apply`; default/ambiguous arguments exit nonzero;
- make `--plan` perform no network or writes and print only fixture IDs/names/paths plus intended counts;
- require `G1_TEST_SEED_CONFIRM` to equal `TEST_SUPABASE_PROJECT_REF` before `--apply`;
- never print keys, authorization headers, full env contents, or database passwords;
- treat the required `G1_TEST_SEED_CONFIRM` equality as the explicit isolated-project marker and refuse apply without it;
- use deterministic UUIDs, names, category/status/moderation combinations, coordinates near Sukhum, `details.schema_version=1`, and exact `{place_id}/facade.jpg` paths;
- upsert/rerun idempotently without deleting unrelated rows or objects;
- upload a tiny valid JPEG facade for each fixture to private `place-photos`, then upsert matching photo metadata;
- set `created_by`/`uploaded_by` null unless a reviewed test identity is explicitly provided; do not create Auth users;
- return a nonzero exit if any expected row/object operation fails or final counts differ.

Because schema apply is still an Alkhas/SOL gate, do not run `--apply` against any real project during this exam. Test apply behavior only through injected fakes. Finishing the code/tests/report requires no external dependency.

## Required tests

Use `node:test` and dependency injection/fakes so tests perform no network. Cover at minimum:

1. exact stable four-fixture definitions and unique UUID/path pairs;
2. published gray and colored plus pending/hidden lifecycle fields;
3. facade-only path and JPEG content type;
4. plan mode performs zero client calls;
5. missing/wrong project-ref guard fails before client creation;
6. service-role fallback/CLI injection is impossible;
7. missing/wrong confirmation blocks apply;
8. idempotent second apply has the same final state/counts;
9. partial upload/metadata failure returns nonzero and does not claim success;
10. logs/reports contain no supplied secret sentinel.

Run:

```bash
node --test tests/g1-test-fixtures.test.mjs
node scripts/seed-g1-test-data.mjs --plan --env-file .env.test.local
git diff --check
git status --short
```

Use a temporary fake env file containing unmistakably non-secret sentinel values for plan-mode verification. Do not wait for, copy, or inspect T1's env file.

## Commit and report

Make one focused commit and push only `feat/mistral-probe` if the session has permission. Do not open a PR.

`MISTRAL-FIELD-REPORT.md` must contain model/surface, elapsed time, plan, red→green evidence, exact changed files/line counts, commands/exits/test counts, SHA/push result, limitations, whether live apply was correctly not run, and `READY FOR SOL FIELD REVIEW` or `BLOCKED`.

No self-assigned roster verdict or cost-per-dollar estimate. SOL performs independent review. After this report, notify staff immediately for field task 2; do not start an invented task or touch critical-path work.
