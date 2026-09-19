-- Security batch: add_karma is server-only; authors cannot flip moderation.

revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from public;
revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from anon;
revoke execute on function public.add_karma(uuid, uuid, uuid, text, integer) from authenticated;

comment on function public.add_karma(uuid, uuid, uuid, text, integer) is
  'Karma award. Called only from SECURITY DEFINER triggers. EXECUTE revoked from anon/authenticated.';

drop policy if exists places_update_admin_or_author on public.places;

create policy places_update_admin_or_author on public.places
  for update to authenticated
  using (
    (select public.current_user_is_admin())
    or (
      created_by = (select auth.uid())
      and (select public.current_user_can_collect())
    )
  )
  with check (
    (select public.current_user_is_admin())
    or (
      created_by = (select auth.uid())
      and (select public.current_user_can_collect())
      and moderation_status = (
        select p.moderation_status from public.places p where p.id = places.id
      )
    )
  );
