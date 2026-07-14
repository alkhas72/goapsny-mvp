# Antigravity — external cross-audit and research

Owner: Antigravity, external chat contour
Mode: read-only, bounded, non-critical path
Conductor: SOL; no repository writes, deploys, secrets, or product decisions.

## Mission A — contract/brief cross-audit

Read:

- `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/OBJECT-CONTRACT.md`
- `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/T1.md` through `T4.md`
- both field worktrees' root `AGENTS.md`, `DESIGN.md`, backend contract, RLS checklist, current migrations/functions
- secure reference commits named in the briefs

Check only:

1. internal contradictions among T1–T4 and the object lifecycle;
2. RLS/RPC/Storage privilege escalation, half-object, ownership, and enumeration risks;
3. email-profile role safety versus existing Telegram roles;
4. Telegram webhook identity/idempotency/concurrency risks;
5. missing executable acceptance evidence or task ownership collision;
6. scope drift against the explicit exclusions.

Return a findings table: severity (`BLOCKER/HIGH/MEDIUM/LOW`), exact file/section, evidence, impact, smallest correction, and whether it blocks Phase A. Do not rewrite the contract or invent product behavior. “No finding” is allowed only after tracing each lifecycle transition.

## Mission B — primary-source research

Use current official primary documentation only. Research narrowly:

- Supabase email OTP token flow and template/rate-limit constraints;
- safe profile creation/default role patterns;
- security-definer RPC hardening (`search_path`, grants, caller identity);
- private Storage ownership/RLS and signed public reads;
- Telegram webhook secret-token, retry/idempotency, callback/file-download constraints;
- installability constraints relevant to the T1 Vite PWA, especially iOS Safari.

Separate verified facts, inference/recommendation, and unresolved questions. Provide direct source links and access dates. Do not recommend a vendor/framework migration.

## Output

Send both reports to HQ/SOL in chat or place them only in `/private/tmp`:

- `/private/tmp/goapsny-antigravity-crossaudit-2026-07-14.md`
- `/private/tmp/goapsny-antigravity-research-2026-07-14.md`

Timebox: first blocker scan before Phase A's first green block; deeper research may continue in parallel. Any product fork goes to Alkhas. Any claimed issue must cite local evidence or an official source.

## Mistral handoff rule

The senior Mistral CLI model is only a candidate for one later bounded validation task chosen after SOL reviews Mission B. It is not a fallback conductor, not on the critical path, and receives no secrets/deploy authority.
