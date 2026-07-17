# Composer 1 — Epoch 3 contract-test lane

You are the sole writer for `feat/epoch3-contract-tests-composer`.

Read `.ui-craft/brief.md`, `.ui-craft/tokens.md`, `DESIGN.md`, and the current test suite. Do not redesign or implement the unified shell. Own only tests and test fixtures.

Create a bounded contract-test layer for the approved target:

1. one application shell for public / mapper / administrator modes;
2. one map component boundary;
3. one real Supabase client/data path — mapper mock/localStorage must not silently pass as live;
4. email OTP and Telegram auth converge on DB-backed roles;
5. 8-digit OTP remains accepted;
6. no second navigation or second Mini App.

Tests may initially expose current failures, but the branch itself must remain runnable and clearly distinguish target-contract failures from regressions. Do not edit production UI or service implementation. Run focused tests, full suite and build. Commit and push only this branch with a factual report.

Start response: `ACK COMPOSER-1 CONTRACT-TESTS`.

