Mode: superpowers-full because new safety-sensitive seed utility.

Delivery files are scripts/lib/g1-test-fixtures.mjs, scripts/seed-g1-test-data.mjs, tests/g1-test-fixtures.test.mjs, MISTRAL-FIELD-REPORT.md.

Fixtures are four hard-coded immutable stable records (NO PRNG and NO crypto).

Operation plan is deterministic; apply uses injected adapter; guard rejects production-like targets without explicit override; CLI defaults to offline plan and --apply requires env.

Tests cover validation, determinism, guards, fake adapter, immutability and CLI.

Verification facts: node --test tests/g1-test-fixtures.test.mjs = 42 tests, 42 pass, 0 fail, 7 suites, exit 0; node scripts/seed-g1-test-data.mjs --plan = exit 0, mode plan, 4 fixtures, 12 operations.

Risk: live Supabase adapter untested and table/column/bucket names need contract review before any apply. Self-review must note no live calls.

READY FOR SOL FIELD REVIEW