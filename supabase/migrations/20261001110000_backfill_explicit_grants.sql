-- AISP-347: explicit grants for the seven tables of 0001_initial_schema.sql.
-- Supabase stops granting new public tables to the API roles by default, so a clean
-- `supabase db reset` must not depend on defaults. Access stays decided by RLS:
-- anon reads only what 20260714141000_public_read_published.sql already opened.
-- Idempotent: safe to run on a database that already has these grants.

grant usage on schema public to anon, authenticated, service_role;

-- Public reference data and the published map: read for everyone.
grant select on public.categories, public.accessibility_statuses, public.places, public.photos to anon;

-- Signed-in users: CRUD, narrowed by the RLS policies on each table.
grant select, insert, update, delete on
  public.profiles, public.categories, public.accessibility_statuses,
  public.places, public.photos, public.ai_jobs, public.karma_events
  to authenticated;

-- Server side (Edge Functions, migrations, moderation tools).
grant all on
  public.profiles, public.categories, public.accessibility_statuses,
  public.places, public.photos, public.ai_jobs, public.karma_events
  to service_role;
