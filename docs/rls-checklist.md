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

## Known Draft Caveats

- `auth-telegram` uses `SUPABASE_JWT_SECRET` to mint a Supabase-compatible JWT.
- The database does not enforce "place must have a facade photo" transactionally; the client flow and QA must verify it end-to-end.
- `export-drive` returns the export payload but does not upload to Drive until Google Drive credentials are chosen.
