-- T1: narrow anonymous read for published public map (OBJECT-CONTRACT §7)
-- FIELD-DELTA-ANTIGRAVITY-2026-07-14 (binding):
--   • anon SELECT on public.photos only when parent place is published
--   • anon SELECT on storage.objects in private place-photos only via matching
--     published photo rows (enables createSignedUrl; bucket stays private)
--   • no anon writes, no list-all, no public bucket

grant select on public.categories to anon;
grant select on public.accessibility_statuses to anon;
grant select on public.places to anon;
grant select on public.photos to anon;

create policy categories_read_active_anon on public.categories
  for select to anon
  using (is_active = true);

create policy accessibility_statuses_read_anon on public.accessibility_statuses
  for select to anon
  using (true);

create policy places_read_published_anon on public.places
  for select to anon
  using (moderation_status = 'published');

-- Narrow photo metadata: published parents only (gray + colored).
create policy photos_read_published_anon on public.photos
  for select to anon
  using (
    exists (
      select 1
      from public.places p
      where p.id = photos.place_id
        and p.moderation_status = 'published'
    )
  );

-- Private bucket; anon may read object bytes only for published-backed paths (signed URL).
create policy place_photos_storage_read_anon_published on storage.objects
  for select to anon
  using (
    bucket_id = 'place-photos'
    and exists (
      select 1
      from public.photos ph
      join public.places p on p.id = ph.place_id
      where ph.storage_path = storage.objects.name
        and p.moderation_status = 'published'
    )
  );
