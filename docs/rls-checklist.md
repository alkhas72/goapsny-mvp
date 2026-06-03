# GoApsny RLS Checklist

Status: draft
Date: 2026-06-01
Related migrations: supabase/migrations/0001_initial_schema.sql, supabase/migrations/0002_lock_karma_rpc.sql

## Before Applying Migration

- Confirm the first owner bootstrap path after the first Telegram login.
- Confirm the initial tester/operator list and promote those profiles after first login.
- Confirm whether authors may delete their own places; current policy allows update, not delete.

## Security Rules To Verify

- `auth-telegram` returns a real Supabase session: `{ access_token, refresh_token, expires_at, profile }`.
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
- A normal client cannot insert into `karma_events`.
- A normal client cannot call `rpc('add_karma', ...)`; direct execute is revoked so karma remains trigger-only.
- H0 place creation sends no `main_photo`, no photo upload, and no `photos` insert.

## Known Draft Caveats

- The database does not enforce "place must have a facade photo" transactionally; photo upload is intentionally out of H0 and moves to H1 QA.
- `export-drive` returns the export payload but does not upload to Drive until Google Drive credentials are chosen.
- Author update policy is broad for H0: an author can update their own place after insert. Tighten column/role constraints before opening broader public collection or moderation workflows.
