# G1 isolated test environment request

Owner: Cowork-Claude + Alkhas  
Consumer: T1 re-verification, then T2 email OTP and G1 device gate  
Authority: Alkhas approved a separate free Supabase project; production is excluded.

## Project identities

- Supabase project display name/slug: `goapsny-pwa-test-14-07` or the closest available equivalent.
- Vercel project slug: `pwa-test-14-07`.
- Requested candidate URL: `https://pwa-test-14-07.vercel.app` if Vercel assigns that slug. The original human label “14.07-pwa-test” is not a valid hostname label because dots split DNS labels.
- This file does not authorize project creation, deployment, migration apply, or secret mutation by an executor; staff performs those steps at the Alkhas gate.

## What staff must create/provide

Create one new free Supabase project, separate from production, and keep all credentials outside git/chat transcripts. Staff needs to place the following values into an untracked local env file in the active PWA worktree and later into the Vercel Preview environment:

| Value | Local consumer | Vercel Preview | May reach browser |
| --- | --- | --- | --- |
| test project URL | `TEST_SUPABASE_URL` and/or existing `VITE_SUPABASE_URL` | `VITE_SUPABASE_URL` | yes |
| test publishable/anon key | `TEST_SUPABASE_ANON_KEY` and/or existing `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` | yes |
| test service-role key | `TEST_SUPABASE_SERVICE_ROLE_KEY` | no | **never** |
| test project ref | `TEST_SUPABASE_PROJECT_REF` | no | no |
| DB password or authorized CLI linkage/access token | staff migration runner only | no | no |

Use `.env.test.local` or another ignored file with mode `0600`. Do not overwrite production credentials, commit env files, paste keys into reports, or expose the service-role key through a `VITE_*` variable.

## Schema and deterministic fixture gate

Staff, not the field executor, authorizes and runs the following on the test project after T1 produces reviewable migrations:

1. Apply `0001_initial_schema.sql`, canonical seeds, then the accepted T1 sprint migrations in filename order.
2. Confirm `place-photos` exists and remains private.
3. Seed stable test identities/rows using server credentials:
   - one published gray place with a facade photo object;
   - one published colored place with a facade photo object;
   - one pending place with a facade photo object;
   - one hidden place with a facade photo object;
   - active category rows needed by those places.
4. Give fixtures stable names/IDs recorded without secrets so the smoke can assert positive and negative cases rather than accept zero rows.
5. Run all read/write/storage assertions through a fresh anon client. Required positive cases must fail the suite when absent; `skipped` cannot count as PASS.
6. After verification, either retain the project only through G1/G2 or delete it by an explicit Alkhas decision.

## Auth settings needed when T2 starts

- Enable Supabase email OTP for the test project.
- Set Site URL to the actual Vercel test URL.
- Add the exact test URL and any explicit local callback URL to Auth redirect allowlist; do not use wildcard production domains.
- Staff/Alkhas supplies one controlled test mailbox and can read its OTP. No OTP, access token, or mailbox credential enters git or reports.
- Keep rate/volume minimal because built-in Supabase delivery is test-only.

## Explicit exclusions

- No production Supabase project, production keys, production migration apply, or production Vercel deployment.
- No auditor bot secrets or webhook are required for PWA G1.
- No `@GoApsnyBot` or `@mapper_abh_bot` configuration is changed by this environment setup.
- No merge to `main` without Alkhas.
