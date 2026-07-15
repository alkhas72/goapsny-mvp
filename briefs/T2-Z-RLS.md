# T2-Z — roles, RLS, Storage and public submission RPC

Owner: Z (`GLM-5.2`) in the desktop ZCode environment
Worktree/branch: `feat/t2-roles-rls` from `origin/main`
Priority: P0 security seam, parallel to T1/T3
Mode: `superpowers-full`; design and object lifecycle are already approved, so start with a written plan and TDD rather than a second product brainstorm.
Conductor: SOL; do not edit `run-log.md`, T1/T3 worktrees, or product UI.

## Goal

Prepare the additive, reviewable database layer that makes a new email user a non-elevated `public_user` and allows exactly one facade-backed gray submission without broad table writes or a public half-object. Produce migrations/tests only. Database apply remains an Alkhas password gate.

## Read first

1. Root `AGENTS.md`, `docs/backend-contract-2026-06-01.md`, `docs/rls-checklist.md`, and `supabase/migrations/0001_initial_schema.sql`.
2. `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/OBJECT-CONTRACT.md` §§3, 5–7, 9.
3. `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/T2.md` for the later end-to-end product seam, but implement only this brief's database phase.
4. `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/FIELD-DELTA-ANTIGRAVITY-2026-07-14.md` and the original Antigravity cross-audit.
5. Read-only reference: `origin/feat/auth-session` commits `17cacb4`, `5bda3c1`, `c507c8c`, `cfb4dd2`; do not merge the branch or restore hand-signed JWT logic.

Confirm the branch/worktree before writing. If `feat/t2-roles-rls` does not exist, staff creates it; do not create nested worktrees.

## Ownership and non-collision

- Z owns new T2 role/profile, public-user Storage write/cleanup, and atomic `submit_public_place` migrations plus their tests.
- T1 already owns `20260714141000_public_read_published.sql` for anon reads of published places/photos/Storage and `20260714142000_align_active_categories.sql`. Do not recreate or rename those policies/migrations. Add a compatibility test that states this dependency; if T1's pushed SHA is not yet available, mark the live cross-branch assertion pending rather than duplicating SQL.
- T3 owns auditor bot tables/RPC. Do not touch them.
- Existing migrations are immutable. Use unique timestamped filenames beginning `20260715...`, not `0002`/`0003`.

## Required migration behavior

### A. Safe profile default and creation

1. Apply the exact forward safety effect:

```sql
alter table public.profiles alter column role set default 'public_user';
```

2. Add the narrowly scoped `auth.users` profile-creation trigger required for native email OTP. Baseline `origin/main` has no such trigger. A new ordinary email identity must receive a `public.profiles` row with `role='public_user'`.
3. The trigger/function must use `SECURITY DEFINER`, `SET search_path = ''`, fully qualified objects/functions, and minimum privileges. It must not trust user metadata for role, Telegram ID, trust level, or administrative fields.
4. Preserve legitimate existing `tester`/`operator` Telegram mappings. No blanket role update. If a safe backfill cannot distinguish identities, omit it and report the migration prerequisite rather than guessing.
5. Compatibility: the existing trusted Telegram flow may explicitly upsert an elevated mapped role after auth-user creation; the default/trigger must not prevent that controlled server path.

### B. Public-user facade Storage boundary

Add explicit authenticated policies so an active `public_user` may:

- insert only into private bucket `place-photos`;
- only a fresh exact `{place_id}/facade.jpg` path;
- only with object owner equal to `auth.uid()`;
- delete only the same owned facade while no `public.photos.storage_path` references it.

No public-user Storage update, list-all, extra kinds, cross-owner path, or place/photo table write. Keep the bucket private.

### C. Atomic submission RPC

Add `public.submit_public_place` with minimum typed inputs: caller-generated `place_id`, trimmed name, active category, finite lat/lng, and exact facade path. Server must:

- require an authenticated, non-banned `public_user` profile matching `auth.uid()`;
- hardcode `status='gray'`, `moderation_status='published'`, `source='public'`, `created_by=auth.uid()`, and `details={"schema_version":1}`;
- verify the owned private Storage object exists at exactly `{place_id}/facade.jpg` and no place/photo already uses the ID/path;
- insert `public.places` and `public.photos` in the same transaction/function call;
- never accept role, creator, status, moderation, source, details, audit fields, arbitrary photo kind/path, or typed owner from the client;
- use `SECURITY DEFINER`, `SET search_path = ''`, fully qualified references, and a safe owner;
- revoke execute from `PUBLIC`, `anon`, and any unintended role, then grant only `authenticated`.

After success the caller has no direct update/delete permission on the place/photo. Failure leaves neither a published place nor indexed photo row. The orphan uploaded object may be removed only by the narrow cleanup policy.

## Required tests

Create executable SQL/static tests appropriate to the repository without requiring production access. Cover at minimum:

1. profile default is `public_user`, not `tester`;
2. fresh email identity/profile is `public_user` and `current_user_can_collect()` is false;
3. existing legitimate Telegram `tester` remains unchanged;
4. role cannot be supplied through user metadata or RPC input;
5. Storage insert accepts only owned facade path and rejects cross-owner/extra-kind/update/list cases;
6. cleanup rejects referenced/cross-owner objects;
7. RPC rejects anon, missing profile, non-`public_user`, forged creator/status/source, inactive category, invalid coordinates/path, missing object, reused ID/path;
8. success writes exact gray/published/public fields plus one facade row atomically;
9. failed photo/place insert leaves no visible half-object;
10. function definition has empty search path, qualified references, and only intended execute grant;
11. migration versions do not collide with T1/T3;
12. dependency assertion names T1's anon photo/Storage read policies without recreating them.

If local Supabase/Postgres is unavailable, build deterministic definition/contract tests and record the live DB suite as a prerequisite. Do not label unexecuted database behavior PASS.

## Verification and handoff

Run every available repository check plus:

```bash
git diff --check
rg -n "default 'tester'|security definer|search_path|grant execute|TELEGRAM_BOT_TOKEN|service_role" supabase/migrations tests scripts
```

Commit/push blocks:

1. red contract tests;
2. profile/default migration;
3. Storage/RPC migration and green tests;
4. handoff corrections.

Return `T2-Z-REPORT.md` with exact SHAs, changed files, exact commands/exits/test counts, unrun live prerequisites, cross-branch dependencies, and `READY FOR SOL REVIEW` or `BLOCKED`.

## Hard gates

No DB apply/link/push, password request in chat, Auth dashboard change, test-user creation, secret mutation, deploy, webhook, frontend work, production access, PR/merge, or `main` change. Apply occurs only after SOL re-review and Alkhas supplies/uses the DB password gate.
