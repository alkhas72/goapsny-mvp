# GoApsny RLS Checklist

Status: draft
Date: 2026-06-01
Related migration: supabase/migrations/0001_initial_schema.sql

## Before Applying Migration

- Confirm the first owner bootstrap path after the first Telegram login.
- Confirm the initial tester/operator list and promote those profiles after first login.
- Confirm whether authors may delete their own places; current policy allows update, not delete.

## Security Rules To Verify

- A `tester` can insert a `published` place with `green`, `yellow`, or `red` status.
- A `tester` cannot insert `gray`.
- A `public_user` cannot insert places or photos.
- A `banned` user cannot insert places or photos.
- A place author can update their own place.
- A non-author tester cannot update another tester's place.
- An `admin` or `owner` can update and delete places.
- Authenticated users can read `published` places and their photos.
- Hidden places are visible only to their author or an admin/owner.
- `ai_jobs` are not readable by ordinary testers/operators.
- Karma is awarded by triggers after place/photo insert.

## Extension-Owned Objects (added 2026-07-08)

Enabling an extension can silently create its own tables in `public`. RLS is OFF by
default in Postgres, so such tables ship unprotected and Supabase's linter (splinter)
flags them as `rls_disabled_in_public`.

**Rule — after every `create extension`:** list what it created in `public` and secure it.
- Diff `public` tables against the ones we authored (compare to `0001_initial_schema.sql`).
- Enable RLS on any extension table exposed via PostgREST, or install the extension in a
  non-`public` schema when it supports relocation.

**Known accepted risk — `spatial_ref_sys` (PostGIS):** `create extension postgis`
(migration 0001) creates `public.spatial_ref_sys`, owned by the managed-Supabase system
role. We cannot enable RLS on it — even the `postgres` role gets `ERROR 42501: must be
owner of table spatial_ref_sys`. It holds only the public coordinate-system reference
(no AIS/user data) and anon cannot write to it. Per Supabase's own guidance the linter
error is left in place intentionally, not silenced by a workaround.

Verified on prod 2026-07-08: all seven authored tables are correctly protected against the
anon key, and the `add_karma` RPC is not anon-executable (`42501 permission denied`).

**Next extension to watch:** `pgvector` (seen as "vector WIP" in history) would create its
own objects the same way.

## Known Draft Caveats

- `auth-telegram` uses `SUPABASE_JWT_SECRET` to mint a Supabase-compatible JWT.
- The database does not enforce "place must have a facade photo" transactionally; the client flow and QA must verify it end-to-end.
- `export-drive` returns the export payload but does not upload to Drive until Google Drive credentials are chosen.
