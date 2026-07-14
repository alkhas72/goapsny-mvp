# Mistral Medium 3.5 — bounded field exam

Model: `mistral-medium-3.5` through Mistral Vibe CLI  
Worktree/branch: `feat/mistral-probe`  
Priority: lab-only, outside the GoApsny critical path  
Mode: `superpowers-full` for a new tested utility. Design/acceptance below is approved; skip a second brainstorming session, write a short plan, then use test-first implementation.  
Conductor: SOL; do not edit conductor briefs or `run-log.md`.

## Purpose

Build a small dependency-free preflight CLI that catches two migration failures observed in the live sprint: duplicate Supabase migration versions and unsafe new `SECURITY DEFINER` search paths. This is an executor-capability exam and a potentially useful integration guard; it does not unblock T1/T3 and must not touch product runtime behavior.

## Read first

1. Root `AGENTS.md` and `docs/rls-checklist.md`.
2. `supabase/migrations/0001_initial_schema.sql` only as the named legacy baseline, not as a pattern to copy.
3. `/Users/alkhas.abaza/Obsidian/wiki/from-codex/cursor-candidates-model-bench-exam-2026-07-12.md` for the factual exam protocol: isolated CWD, artifact evidence, independent verification, no invented cost metric.

If the worktree is not `feat/mistral-probe`, or it has unrelated user changes overlapping the allowed files, stop and report. Do not create another worktree.

## Task

Implement a Node.js CLI using only built-in modules:

```bash
node scripts/check-supabase-migrations.mjs \
  --dir supabase/migrations \
  --legacy 0001_initial_schema.sql \
  --json
```

Allowed implementation boundary — no more than these four files:

- `scripts/check-supabase-migrations.mjs`
- `scripts/lib/migration-safety.mjs`
- `tests/migration-safety.test.mjs`
- `MISTRAL-EXAM-REPORT.md`

Do not modify `package.json`, migrations, application/Edge Function code, config, docs, env files, or lockfiles.

## Required behavior

1. Read only top-level `*.sql` files from `--dir`, sorted lexicographically.
2. A valid Supabase migration filename begins with decimal digits followed by `_`. The decimal prefix is its version.
3. Report `INVALID_FILENAME` for a top-level SQL filename that does not match that shape.
4. Report `DUPLICATE_VERSION` for every file participating in a duplicate version. This must catch two distinct files such as `0003_alpha.sql` and `0003_beta.sql`.
5. For every non-legacy SQL file containing executable `SECURITY DEFINER`, require the same `CREATE [OR REPLACE] FUNCTION ...` statement header to contain `SET search_path = ''`. Support ordinary PostgreSQL dollar-quoted function bodies (`$$` and `$tag$`) well enough not to split a function at semicolons inside its body.
6. Report `UNSAFE_SEARCH_PATH` when that statement uses `SET search_path = public`, and `MISSING_EMPTY_SEARCH_PATH` when it has no exact empty search path.
7. `SECURITY DEFINER` occurring only in `--` comments or `/* ... */` comments must not trigger a violation.
8. `--legacy <basename>` may be repeated. It exempts only the search-path checks for that exact basename; it never exempts filename or duplicate-version checks.
9. Output is deterministic. Violations are sorted by file, then line, then code and have this JSON shape:

```json
{
  "ok": false,
  "filesChecked": 2,
  "violations": [
    { "code": "DUPLICATE_VERSION", "file": "0003_alpha.sql", "line": 1, "message": "..." }
  ]
}
```

10. With `--json`, stdout contains JSON only. Exit codes: `0` clean, `1` policy violations, `2` invalid arguments or I/O failure. Diagnostics for exit `2` go to stderr without stack traces or secrets.
11. Export pure analysis functions from `scripts/lib/migration-safety.mjs` so unit tests do not need to spawn the CLI for every case.

## Required tests

Use `node:test`, `node:assert/strict`, and temporary directories under `os.tmpdir()`. Cover at minimum:

1. clean uniquely versioned migrations;
2. invalid filename;
3. both files reported for a duplicate version;
4. safe `SECURITY DEFINER` with `SET search_path = ''` and semicolons inside a dollar-quoted body;
5. unsafe `SET search_path = public`;
6. missing empty search path;
7. line and block comments ignored;
8. repeated `--legacy` behavior without filename/duplicate exemption;
9. deterministic violation ordering;
10. CLI JSON and exit codes `0`, `1`, and `2`.

Run and report exact outputs:

```bash
node --test tests/migration-safety.test.mjs
node scripts/check-supabase-migrations.mjs --dir supabase/migrations --legacy 0001_initial_schema.sql --json
git diff --check
git status --short
```

The real-repository scan should be clean on the isolated branch; do not weaken rules or add undocumented allowlists merely to make it green.

## Safety and stop conditions

- No network, package installation, external API/model calls, secrets, database connection, Supabase/Vercel operations, deploy, webhook, or Telegram action.
- Never write outside the existing worktree. Temporary test directories must be removed by test cleanup.
- Do not inspect or modify T1/T3 active worktrees.
- Do not merge, rebase, force-push, or touch `main`.
- If correct SQL statement association would require a full SQL parser, implement the narrow documented function-statement scanner and state its limits; do not silently broaden claims.

## Handoff

After green verification, make one focused commit and push only `feat/mistral-probe` if the existing session has that permission. Do not open a PR. `MISTRAL-EXAM-REPORT.md` must include:

- model/surface and mode used;
- start/end/elapsed wall time;
- plan followed and any red→green correction;
- exact changed files and line counts;
- exact commands, exits, and test counts;
- commit SHA and push result, or the exact permission blocker;
- remaining parser limitations;
- `READY FOR SOL EXAM REVIEW` or `BLOCKED`.

Do not self-assign a roster role or invent contribution-per-dollar: the dollar denominator is unavailable on a subscription surface. SOL independently reruns the suite and evaluates usefulness, correctness, scope discipline, and safety.
