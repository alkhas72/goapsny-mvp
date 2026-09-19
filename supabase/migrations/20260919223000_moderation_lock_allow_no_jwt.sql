-- Repair: direct psql / SQL editor / migrations have no JWT.
-- auth.role() is empty there, so the first lock treated them as clients.
-- Empty request.jwt.claims → allow. API with anon/authenticated → admin only.
-- API service_role → auth.role() = 'service_role', still allow.

create or replace function public.tg_places_lock_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt text;
begin
  if new.moderation_status is not distinct from old.moderation_status then
    return new;
  end if;
  if public.current_user_is_admin() then
    return new;
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  jwt := current_setting('request.jwt.claims', true);
  if jwt is null or btrim(jwt) = '' then
    return new;
  end if;
  raise exception 'moderation_status can be changed only by admin'
    using errcode = '42501';
end;
$$;
