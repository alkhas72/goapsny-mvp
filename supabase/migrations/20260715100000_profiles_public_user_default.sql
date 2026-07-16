-- T2-Z Block A — safe profile default + auth-user creation trigger
--
-- Owner: Z (GLM-5.2), branch feat/t2-roles-rls, brief: briefs/T2-Z-RLS.md (§A),
--   OBJECT-CONTRACT.md §5, FIELD-DELTA-ANTIGRAVITY-2026-07-14.md "Queued T2".
--
-- Purpose:
--   1. Apply the exact forward safety effect so a NEW email-OTP identity can no
--      longer inherit the baseline `tester` default (which would satisfy
--      current_user_can_collect() and escalate every new email user).
--   2. Add the narrowly-scoped auth.users -> public.profiles creation trigger
--      that baseline (0001_initial_schema.sql) is missing, so a native email
--      identity receives exactly one profile row with role='public_user'.
--
-- Non-goals (brief §A.4):
--   * No blanket role update / backfill. Legitimate existing tester/operator
--     Telegram mappings are preserved untouched. A safe backfill cannot
--     distinguish email-only identities among existing tester rows from data
--     alone, so it is deliberately omitted (recorded as a migration
--     prerequisite in T2-Z-REPORT.md).
--   * The trusted Telegram server path may still explicitly upsert an elevated
--     mapped role after auth-user creation; this trigger only fires on
--     auth.users INSERT and writes 'public_user' with ON CONFLICT DO NOTHING,
--     so it cannot overwrite an already-elevated profile and cannot block the
--     trusted upsert.
--
-- All new SECURITY DEFINER objects in this migration use SET search_path = ''
-- and schema-qualified references, per OBJECT-CONTRACT.md §6 and the brief
-- (the legacy SET search_path = public functions in 0001 are not copied).

-- ----------------------------------------------------------------------------
-- A.1 Forward safety effect (exact, immutable forward migration)
-- ----------------------------------------------------------------------------
alter table public.profiles alter column role set default 'public_user';

-- ----------------------------------------------------------------------------
-- A.2 Profile-creation trigger for native email OTP
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can write public.profiles while running as the
-- invoking (auth) role. SET search_path = '' + fully-qualified refs closes the
-- search_path hijack vector flagged by Supabase's guidance and the brief.
-- The function does NOT read raw_app_meta_data / encrypted_password / any user
-- metadata for role, telegram_id, trust_level, ai_enabled, karma, or admin
-- fields: role is hard-coded 'public_user', every other column takes the table
-- default. A client therefore cannot escalate by stuffing metadata at signup.
create or replace function public.tg_create_profile_on_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'public_user')
  on conflict (id) do nothing;
  return new;
end;
$$;

alter function public.tg_create_profile_on_auth_user() owner to postgres;
revoke execute on function public.tg_create_profile_on_auth_user() from public, anon;
-- Trigger functions are invoked by the system, not by roles, so we do not
-- grant execute to authenticated either; only the trigger may call it.

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_create_profile_on_auth_user();

comment on function public.tg_create_profile_on_auth_user() is
  'T2-Z: create a public.profiles row with role=''public_user'' for each new auth.users identity. SECURITY DEFINER, search_path=''''. Does not trust user metadata for role/telegram_id/trust/admin fields. ON CONFLICT DO NOTHING so it cannot overwrite an existing (e.g. trusted Telegram) profile.';
