-- T2-Z Block B+C — public-user Storage boundary + atomic submit_public_place RPC
--
-- Owner: Z (GLM-5.2), branch feat/t2-roles-rls.
-- Brief: briefs/T2-Z-RLS.md §B/§C, OBJECT-CONTRACT.md §3/§6,
--        FIELD-DELTA-ANTIGRAVITY-2026-07-14.md "Queued T2".
--
-- Non-collision:
--   * T1 owns 20260714141000_public_read_published.sql (anon reads of published
--     places/photos/Storage) and 20260714142000_align_active_categories.sql.
--     This migration does NOT recreate/rename any T1 anon-read policy.
--   * T3 owns auditor bot tables/RPC. Untouched.
--
-- All new SECURITY DEFINER objects use SET search_path = '' and fully-qualified
-- references (public.*, auth.uid(), storage.objects). Legacy SET search_path =
-- public functions in 0001 are NOT copied.

-- ============================================================================
-- B. Public-user facade Storage boundary
-- ============================================================================
-- Baseline storage policies in 0001:
--   place_photos_storage_insert_collectors  -> requires current_user_can_collect()
--                                              (true for tester, FALSE for public_user)
--   place_photos_storage_update_owner_or_admin -> owner may UPDATE own objects
--   place_photos_storage_delete_admin        -> admin-only
-- The baseline therefore BLOCKS public_user upload and gives no self-cleanup.
-- We add two NARROW public_user policies and add a guard to the existing
-- UPDATE policy so a public_user cannot mutate their facade. We do NOT add a
-- public_user SELECT/list-all (anon read of published facades is T1's job) and
-- we do NOT add any place/photo table write for public_user.

-- Keep the cleanup helper outside the exposed public schema. It bypasses
-- public.photos RLS only to serialize a path claim and answer the cleanup
-- predicate. A direct NOT EXISTS in the Storage policy could miss a referenced
-- photo after an administrator hides its parent place.
create schema if not exists goapsny_private;
alter schema goapsny_private owner to postgres;
revoke all on schema goapsny_private from public, anon, authenticated;
grant usage on schema goapsny_private to authenticated;

create or replace function goapsny_private.claim_unreferenced_storage_path(
  p_storage_path text
) returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_storage_path, 0)
  );
  return not exists (
    select 1 from public.photos ph
    where ph.storage_path = p_storage_path
  );
end;
$$;

alter function goapsny_private.claim_unreferenced_storage_path(text) owner to postgres;
revoke execute on function goapsny_private.claim_unreferenced_storage_path(text) from public, anon;
grant execute on function goapsny_private.claim_unreferenced_storage_path(text) to authenticated;

-- B.1 INSERT: public_user may upload only their own canonical
-- {uuid}/facade.jpg. The RPC binds this path to the typed p_place_id.
create policy place_photos_storage_insert_public_user_facade
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'public_user'
    )
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/facade\.jpg$'
  );

-- B.2 DELETE: public_user may remove only their own unreferenced facade orphan
-- (e.g. after a failed RPC). A referenced object (a public.photos row already
-- indexes it) cannot be deleted by the public user.
create policy place_photos_storage_delete_public_user_unreferenced
  on storage.objects for delete to authenticated
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

-- B.3 Harden the existing owner-UPDATE policy so a public_user cannot mutate
-- their facade (brief: "No public-user Storage update"). The baseline policy
-- `place_photos_storage_update_owner_or_admin` currently allows any owner to
-- update; we drop and recreate it with a public_user exclusion, preserving
-- admin/owner and non-public_user-owner behavior. (Drop+recreate is additive
-- in effect; it does not edit 0001.)
drop policy place_photos_storage_update_owner_or_admin on storage.objects;

create policy place_photos_storage_update_owner_or_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'place-photos'
    and (
      (select public.current_user_is_admin())
      or (
        owner = (select auth.uid())
        and (select public.current_user_role()) <> 'public_user'
      )
    )
  )
  with check (
    bucket_id = 'place-photos'
    and (
      (select public.current_user_is_admin())
      or (
        owner = (select auth.uid())
        and (select public.current_user_role()) <> 'public_user'
      )
    )
  );

-- B.4 Baseline authenticated Storage SELECT was bucket-wide. Preserve broad
-- reads only for trusted collector/admin roles; a public_user or identity with
-- no profile may read only objects indexed to published places.
drop policy place_photos_storage_read_authenticated on storage.objects;

create policy place_photos_storage_read_authenticated on storage.objects
  for select to authenticated
  using (
    bucket_id = 'place-photos'
    and (
      (select public.current_user_can_collect())
      or exists (
        select 1
        from public.photos ph
        join public.places pl on pl.id = ph.place_id
        where ph.storage_path = storage.objects.name
          and pl.moderation_status = 'published'
      )
    )
  );

-- B.5 Baseline table UPDATE policies allowed any author/owner to mutate rows.
-- Exclude public_user while preserving admin and trusted collector behavior.
drop policy places_update_admin_or_author on public.places;

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
    )
  );

drop policy photos_update_admin_or_owner on public.photos;

create policy photos_update_admin_or_owner on public.photos
  for update to authenticated
  using (
    (select public.current_user_is_admin())
    or (
      uploaded_by = (select auth.uid())
      and (select public.current_user_can_collect())
    )
  )
  with check (
    (select public.current_user_is_admin())
    or (
      uploaded_by = (select auth.uid())
      and (select public.current_user_can_collect())
    )
  );

-- ============================================================================
-- C. Atomic submission RPC public.submit_public_place
-- ============================================================================
-- Minimum typed client inputs only: caller-generated place_id (fresh per-place
-- UUID, OBJECT-CONTRACT §2), trimmed name, active category, finite lat/lng,
-- and the exact facade path. The server hardcodes status='gray',
-- moderation_status='published', source='public', created_by=auth.uid(),
-- details={"schema_version":1}, and photo kind='facade'/uploaded_by=auth.uid().
-- The client cannot pass role, creator, status, moderation, source, details,
-- audit fields, or an arbitrary photo kind/path.

-- Enforce the approved one-contribution lifecycle at the database boundary,
-- including concurrent calls. The RPC also emits a clear preflight error;
-- this partial unique index remains the race-safe final guard.
create unique index places_one_public_submission_per_creator_idx
  on public.places (created_by)
  where source = 'public' and created_by is not null;

create or replace function public.submit_public_place(
  p_place_id uuid,
  p_name text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_storage_path text
) returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := auth.uid();
  v_expected_path  text := p_place_id::text || '/facade.jpg';
  v_role           text;
  v_inserted       public.places%rowtype;
begin
  -- C.1 Authentication required (rejects anon / unauthenticated).
  if v_uid is null then
    raise exception 'submit_public_place: authentication required'
      using errcode = '42501';
  end if;

  -- C.2 Caller must be an active, non-banned public_user profile matching
  -- auth.uid(). (Rejects missing profile, banned, and elevated/collector
  -- roles; rejects a forged creator because created_by is never read from
  -- input.)
  select p.role into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is null then
    raise exception 'submit_public_place: profile not found'
      using errcode = '42501';
  end if;
  if v_role <> 'public_user' then
    raise exception 'submit_public_place: caller must be public_user'
      using errcode = '42501';
  end if;

  -- C.3 The basic contributor lifecycle ends after one public submission.
  -- The partial unique index above makes this race-safe across concurrent
  -- calls; this explicit guard provides a stable error before other work.
  if exists (
    select 1 from public.places pl
    where pl.created_by = v_uid and pl.source = 'public'
  ) then
    raise exception 'submit_public_place: public submission already used'
      using errcode = '23505';
  end if;

  -- C.4 Trimmed, non-empty name.
  if p_name is null or btrim(p_name) = '' then
    raise exception 'submit_public_place: name is required'
      using errcode = '23502';
  end if;

  -- C.5 Active category (rejects inactive 'other' / unknown slug).
  if not exists (
    select 1 from public.categories c
    where c.slug = p_category and c.is_active = true
  ) then
    raise exception 'submit_public_place: inactive or unknown category'
      using errcode = '23503';
  end if;

  -- C.6 Finite coordinates within table CHECK bounds. Postgres double
  -- precision NaN returns true for `is null`-style checks only via cast, so
  -- we normalize via cast to numeric (NaN -> 'NaN' text) and reject it, then
  -- apply the same bounds as the places table CHECK constraints.
  if p_lat is null or p_lng is null
     or p_lat::text = 'NaN' or p_lng::text = 'NaN'
     or p_lat::text = 'Infinity' or p_lng::text = '-Infinity'
     or p_lng::text = 'Infinity' or p_lng::text = '-Infinity'
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'submit_public_place: invalid coordinates'
      using errcode = '22P02';
  end if;

  -- C.7 Exact facade path derived from place_id; client cannot forge an
  -- arbitrary path or kind.
  if coalesce(p_storage_path, '') <> v_expected_path then
    raise exception 'submit_public_place: storage_path must equal {place_id}/facade.jpg'
      using errcode = '22P02';
  end if;

  -- Serialize against orphan cleanup for this exact facade path. If cleanup
  -- owns the lock first, this call waits and then observes the object missing;
  -- if submit owns it first, cleanup waits and then observes the photo row.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_expected_path, 0)
  );

  -- C.8 place_id not already used.
  if exists (select 1 from public.places pl where pl.id = p_place_id) then
    raise exception 'submit_public_place: place_id already used'
      using errcode = '23505';
  end if;

  -- C.9 Facade path not already indexed by another photo.
  if exists (select 1 from public.photos ph where ph.storage_path = v_expected_path) then
    raise exception 'submit_public_place: facade already indexed'
      using errcode = '23505';
  end if;

  -- C.10 The private Storage object must EXIST at exactly {place_id}/facade.jpg
  -- and be owned by the caller. This is the server-side revalidation that
  -- prevents a half-object when the upload was missing/failed/cross-owner.
  -- Use the same typed comparison as the accepted baseline Storage policies.
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'place-photos'
      and so.name = v_expected_path
      and so.owner = v_uid
  ) then
    raise exception 'submit_public_place: owned facade object not found'
      using errcode = '23503';
  end if;

  -- C.11 Atomic insert: place + facade photo in one function/transaction. Any
  -- exception above (or a constraint violation here) rolls back BOTH rows, so
  -- a failed submission leaves no visible half-object (places and photos are
  -- both RLS-protected; no published place, no indexed photo).
  insert into public.places (
    id, name, category, lat, lng,
    status, moderation_status, source, created_by, details
  )
  values (
    p_place_id,
    btrim(p_name),
    p_category,
    p_lat,
    p_lng,
    'gray',
    'published',
    'public',
    v_uid,
    jsonb_build_object('schema_version', 1)
  );

  insert into public.photos (place_id, storage_path, kind, uploaded_by)
  values (p_place_id, v_expected_path, 'facade', v_uid);

  select * into v_inserted from public.places where id = p_place_id;
  return v_inserted;
end;
$$;

-- C.12 Minimum execute grant: revoke default PUBLIC/anon, grant authenticated only.
alter function public.submit_public_place(
  uuid, text, text, double precision, double precision, text
) owner to postgres;
revoke execute on function public.submit_public_place(
  uuid, text, text, double precision, double precision, text
) from public, anon;
grant execute on function public.submit_public_place(
  uuid, text, text, double precision, double precision, text
) to authenticated;

comment on function public.submit_public_place(
  uuid, text, text, double precision, double precision, text
) is
  'T2-Z: atomic facade-backed gray submission for an authenticated public_user. Server hardcodes status=gray, moderation_status=published, source=public, created_by=auth.uid(), details={"schema_version":1}, photo kind=facade. Validates active category, finite coords, exact {place_id}/facade.jpg path, caller-owned private Storage object, no reuse of id/path. SECURITY DEFINER, search_path=''''. Execute granted only to authenticated.';
