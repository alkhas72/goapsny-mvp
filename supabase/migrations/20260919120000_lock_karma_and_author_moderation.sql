-- Security batch: add_karma is server-only; authors cannot flip moderation.
-- Do not lock moderation_status with WITH CHECK that reads public.places:
-- that re-enters RLS and raises 42P17 (infinite recursion). Use a trigger.

revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from public;
revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from anon;
revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from authenticated;

comment on function public.add_karma(uuid, uuid, uuid, text, integer) is
  'Karma award. Called only from SECURITY DEFINER triggers. EXECUTE revoked from anon/authenticated.';

create or replace function public.tg_places_lock_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation_status is not distinct from old.moderation_status then
    return new;
  end if;
  if public.current_user_is_admin() then
    return new;
  end if;
  if coalesce(auth.role(), '') in ('service_role', 'postgres') then
    return new;
  end if;
  raise exception 'moderation_status can be changed only by admin'
    using errcode = '42501';
end;
$$;

drop trigger if exists places_lock_moderation_status on public.places;
create trigger places_lock_moderation_status
  before update on public.places
  for each row
  execute function public.tg_places_lock_moderation_status();
