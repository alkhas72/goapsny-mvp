-- T2 follow-up — minimum SELECT visibility required by the Storage remove API.
--
-- The existing DELETE policy already restricts cleanup to the caller's own
-- canonical, unreferenced facade. Supabase Storage also requires SELECT access
-- to the target row during removal, so expose exactly that same orphan shape.
-- The private helper sees references hidden by public.photos RLS and takes the
-- same advisory lock as submit_public_place and the DELETE policy.

create policy place_photos_storage_read_public_user_unreferenced_facade
  on storage.objects for select to authenticated
  using (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'public_user'
    )
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/facade\.jpg$'
    and (select goapsny_private.claim_unreferenced_storage_path(storage.objects.name))
  );
