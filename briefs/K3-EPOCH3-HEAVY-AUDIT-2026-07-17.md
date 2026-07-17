# Kimi 3 / K3 — GoApsny Epoch 3 heavy audit

## Role

You are Kimi 3 (`kimi-code/k3`) acting as an external, read-only senior architecture auditor. This is a real evidence-based review of the current GoApsny codebase, not a toy benchmark.

Your first response must be exactly:

`ACK K3 EPOCH3 HEAVY AUDIT`

## Scope and safety

- Work only inside this worktree: `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/k3-epoch3-heavy-audit`.
- Read only the three approved reference documents listed below and files in this worktree.
- Do not read `.env`, credentials, API keys, tokens, private SSH material, or files outside the approved documents and worktree.
- Do not edit product code, migrations, configuration, tests, or production systems.
- The only file you may create or modify is `reports/K3-EPOCH3-HEAVY-AUDIT-2026-07-17.md`.
- Do not commit or push product changes. The report itself may be committed by the operator after review.

## Approved references

1. `/Users/alkhas.abaza/Obsidian/wiki/from-claude-code/goapsny-epoch3-proposal-crossaudit-2026-07-17.md`
2. `/Users/alkhas.abaza/Obsidian/wiki/from-claude-code/goapsny-epoch3-working-plan-2026-07-17.md`
3. `/Users/alkhas.abaza/Documents/AI-Agents/Codex/06-AI-TECH/2026-07-16-goapsny-g1-cutover-plan.md`

## Audit question

Can the current technical base safely become one product shell while preserving the proven June Telegram Mini App work and the proven G1 email-entry path? Identify what a first implementation slice should do, what must stay separate, and what can block execution.

## Required inspection areas

Inspect the actual code and tests, with exact file and line evidence, for:

1. Feasibility of unifying the public shell and the Telegram Mini App shell.
2. Boundaries and overlap between `PublicMap` and `TelegramApp`.
3. Shared Supabase client, data path, authentication, and storage assumptions.
4. Email OTP contract, including the real eight-digit code and callback/link behavior.
5. Role and RLS mapping for public user, mapper, and administrator.
6. Geolocation behavior, location toggle, and the known incorrect-position issue.
7. MapLibre adapter seam and whether it can be introduced without coupling it to the first shell slice.
8. Regression risks when preserving existing June work instead of rebuilding from zero.

## Deliverable

Write only `reports/K3-EPOCH3-HEAVY-AUDIT-2026-07-17.md` with these sections:

- Executive verdict (one paragraph, plain language)
- What is already real and reusable
- What is missing or must be rebuilt
- Evidence table: finding, exact file:line, consequence, confidence
- Dependency graph for the first implementation slice
- Blockers and stop conditions
- Prioritized recommendations (P0/P1/P2)
- Final verdict: `READY FOR FIRST SHELL SLICE` or `BLOCKED`, with explicit reasons

Do not merely restate the reference documents. Resolve contradictions by checking the code. Distinguish facts, inferences, and open questions. Be concise but technically deep; this is the senior-model benchmark.
