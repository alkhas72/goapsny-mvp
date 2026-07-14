# T1 isolated Supabase apply gate — HOLD

Issued by: SOL  
Issued at: 2026-07-15 00:41 MSK  
Target: separate free G1/G2 Supabase project only; production excluded  
Current verdict: **HOLD schema/seed apply until the immutable fixture harness exists**

## Staff preparation accepted

In `feat/pwa-public`, `.env.test.local` exists, is 589 bytes, and has mode `0600`. Only key names were inspected:

- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_SUPABASE_SERVICE_ROLE_KEY`
- `TEST_SUPABASE_PROJECT_REF`

Values remain outside chat, reports, and git. Do not rename, print, copy into `VITE_*`, or commit the service-role value.

## Why apply is held

1. `feat/pwa-public` is still entirely uncommitted at base HEAD `97af435`; the three T1 migrations and all harness/UI work are mutable untracked/modified files.
2. No deterministic fixture setup exists. Current repository has only canonical lookup seeds (`categories.sql`, `methodology.sql`), not the four place/photo cases required by the G1 contract.
3. `scripts/smoke-public.mjs:22-43,70-71` reads `.env` and only `SUPABASE_*`/`VITE_SUPABASE_*`. It does not read `.env.test.local` or any `TEST_SUPABASE_*` variable.
4. The current smoke counts absent gray/colored rows and a skipped positive signed-URL case as PASS. Applying schema without a fixture-backed rewrite would not close the SOL blocker.

## Required T1 follow-up before GO

T1 remains the sole writer in `feat/pwa-public` and must first return one coherent pushed **database/harness block** that:

1. Preserves the reviewed migration scope. UI/a11y fixes and the Russian-only/click-to-geolocate decisions remain mandatory for G1, but they do not have to wait in the same commit as this database gate.
2. Adds a test-only fixture setup using the service-role key only from `TEST_SUPABASE_SERVICE_ROLE_KEY`:
   - deterministic published gray place + facade photo metadata/object;
   - deterministic published colored place + facade photo metadata/object;
   - deterministic pending place + facade photo metadata/object;
   - deterministic hidden place + facade photo metadata/object;
   - stable IDs/names and idempotent reruns.
3. Fails closed unless the URL host matches `TEST_SUPABASE_PROJECT_REF`; it must never accept a `VITE_*` key as service role and must never print credential values.
4. Makes the public smoke explicitly consume `.env.test.local`/`TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` for this gate and fail when any required positive fixture is absent. `skipped` must not count as PASS.
5. Proves through a fresh anon client:
   - both published rows and their photo metadata are visible;
   - both published facade objects can produce signed URLs;
   - pending/hidden place rows, photo metadata, and object signing are denied;
   - anon writes remain denied and the bucket remains private.
6. Commits and pushes the database/harness block, supplies the exact SHA, proves that the relevant migration/fixture/smoke paths have no later dirty delta, and returns `READY FOR SOL DB RE-REVIEW`. No deploy or remote apply by T1.

## Staff apply order after SOL changes HOLD → GO

Staff applies only the reviewed pushed database/harness SHA, in this order. T1 may continue unrelated UI fixes in the worktree, but staff must verify that migration/fixture/smoke paths exactly match the accepted SHA:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/seed/categories.sql`
3. `supabase/seed/methodology.sql`
4. `supabase/migrations/20260714140000_lock_karma_rpc.sql`
5. `supabase/migrations/20260714141000_public_read_published.sql`
6. `supabase/migrations/20260714142000_align_active_categories.sql`
7. reviewed deterministic fixture setup
8. fixture-backed anon smoke

Record commands, exit codes, applied project ref, row/object counts, and smoke summary without credential values. Confirm `place-photos.public=false` after apply.

## Auth safety seam

Baseline `0001_initial_schema.sql` still defaults `profiles.role` to `tester`. Do not create an email OTP user in this test project until T2's accepted additive migration changes the default to `public_user`. T1 anonymous fixture rows can use null creator/uploader identities and do not authorize bypassing this gate.

No production command, Vercel deploy, Auth configuration, auditor secret, webhook, or merge is authorized by this document.
