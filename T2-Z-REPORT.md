# T2-Z report — roles, RLS, Storage and public submission RPC

Status: **READY FOR SOL REVIEW — NO LIVE APPLY**

Date: 2026-07-16
Branch: `feat/t2-roles-rls`
Base: `97af435`

## Provenance

Z / GLM-5.2 authored the written plan, the two initial migrations and the
contract-test suite through ZCode CLI. SOL corrected one rejected design
interpretation (`place_id` remains an independent per-place UUID), removed
overlapping stale Z processes, repaired the static test harness and hardened
the one-submission and Storage-cleanup boundaries. No database, Auth dashboard,
frontend, deploy, webhook, production resource or `main` branch was touched.

## Changed files

- `docs/superpowers/plans/2026-07-16-t2-roles-rls.md`
- `supabase/migrations/20260715100000_profiles_public_user_default.sql`
- `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql`
- `tests/contract/t2-roles-rls.contract.test.ts`
- `T2-Z-REPORT.md`

## Implemented contract

- New `auth.users` identity receives a `public.profiles` row with the hardcoded
  non-elevated role `public_user`; user metadata cannot choose a role.
- Existing `tester`/`operator` rows are not bulk-demoted or backfilled.
- A `public_user` may upload only an owned canonical
  `{place_id}/facade.jpg` object in the private `place-photos` bucket.
- Public-user Storage UPDATE remains denied. Cleanup is limited to an owned
  facade that no `public.photos` row references, including references hidden
  from the caller by RLS. Submit and cleanup take the same transaction lock, so
  cleanup cannot race between facade validation and photo-row insertion.
- Baseline author/owner UPDATE policies are replaced so `public_user` cannot
  change the submitted place or photo, while trusted collectors/admins retain
  their existing path.
- Baseline bucket-wide authenticated read is replaced: public users and
  identities without a profile see only objects indexed to published places;
  trusted collectors retain broad operational read.
- Storage INSERT/DELETE requires an actual matching `profiles` row; the legacy
  fallback role for a missing profile cannot authorize writes.
- `submit_public_place` accepts only the typed minimum inputs, revalidates the
  caller-owned object and writes one gray/published/public place plus one facade
  photo atomically.
- `place_id` is independent from `auth.uid()`; ownership is checked separately.
- A partial unique index plus an RPC preflight guard enforce one public
  submission per contributor even under concurrent calls.
- New SECURITY DEFINER functions have an empty search path, fully-qualified
  objects, explicit `postgres` owner and minimum execute grants.

## Verification evidence

Baseline before T2: `npm test` — `7/7 PASS`.

First Z test attempt, run by SOL:

- `npm test -- --run` — `45/56 PASS`, `11 FAIL`.
- Failures were primarily static-test extraction/comment false positives; they
  were not labelled green.

Final checks after correction:

- `npm test -- --run` — `60/60 PASS`, exit `0`.
- `npm run build` — PASS, exit `0`.
- `git diff --check` — PASS, exit `0`.
- `npm run lint` — inherited baseline failure: `10 errors`, `2 warnings` in
  pre-existing frontend files; T2 changes add no frontend source.
- Credential scan found no secret values or service credentials in T2 SQL.

## Deliberately unrun live prerequisites

No T2 migration has been linked, pushed or applied. The following remain
unproven until a separate Alkhas gate and an isolated database rehearsal:

1. actual `auth.users` trigger execution and preservation of a trusted Telegram
   role upsert;
2. runtime Storage INSERT/UPDATE/DELETE RLS behavior;
3. RLS-safe hidden-photo reference protection and submit/cleanup lock ordering;
4. atomic RPC success/rollback, concurrent one-submission enforcement and
   function-owner/grant inspection;
5. integration after the accepted T1 migrations, especially T1 anonymous photo
   and Storage read policies;
6. pre-apply check for historical duplicate `source='public'` rows per creator
   before creating the partial unique index.

No live database behavior is labelled PASS in this report.

## Git handoff

ZCode's permission client could write files but could not safely complete the
requested Git sequence. After independent review returned `READY`, SOL created
the focused implementation commits:

- `664459e` — `docs: plan t2 roles and rls`
- `7a0c23f` — `feat(db): default email profiles to public user`
- `23c308b` — `feat(db): add public gray submission boundary`

The report is committed separately after those implementation SHAs. Push target
is only `feat/t2-roles-rls`; `main` remains untouched.

**READY FOR SOL REVIEW**
