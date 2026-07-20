-- Снятие лимита «одна публичная подача на человека».
--
-- Решение Арбитра 20.07 после прохождения G1 на боевой площадке:
--   «Если человек захотел добавить через минуту ещё один объект, а потом ещё —
--    в чём смысл ограничивать? Он должен ждать следующего дня, чтобы снять
--    соседний магазин? Такие приложения так не работают.»
--
-- Происхождение прежнего правила: партия T2 записала его как «approved
-- one-contribution lifecycle», но явного решения Арбитра в каноне нет —
-- поиск по базе знаний не нашёл ни одной decision-записи. Случай из пункта 12
-- hot.md: запрет без атрибуции подлежит пересмотру.
--
-- Что снимается:
--   1) partial unique index places_one_public_submission_per_creator_idx;
--   2) проверка C.3 внутри submit_public_place.
--
-- Что СОХРАНЯЕТСЯ без изменений: аутентификация, роль public_user,
-- активная категория, конечные координаты, точный путь фасада, владение
-- Storage-объектом, запрет повторного использования id и пути, серверная
-- простановка status/moderation/source/created_by. Снимается ровно одно
-- ограничение — количество подач.

drop index if exists public.places_one_public_submission_per_creator_idx;

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
  -- auth.uid().
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

  -- C.3 СНЯТО 20.07: лимит одной подачи на автора отменён решением Арбитра.
  -- Человек может добавлять места подряд — соседнее кафе, соседний магазин.

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

  -- C.6 Finite coordinates within table CHECK bounds.
  if p_lat is null or p_lng is null
     or p_lat::text = 'NaN' or p_lng::text = 'NaN'
     or p_lat::text = 'Infinity' or p_lng::text = '-Infinity'
     or p_lng::text = 'Infinity' or p_lng::text = '-Infinity'
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'submit_public_place: invalid coordinates'
      using errcode = '22P02';
  end if;

  -- C.7 Exact facade path derived from place_id.
  if coalesce(p_storage_path, '') <> v_expected_path then
    raise exception 'submit_public_place: storage_path must equal {place_id}/facade.jpg'
      using errcode = '22P02';
  end if;

  -- Serialize against orphan cleanup for this exact facade path.
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
  -- and be owned by the caller.
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'place-photos'
      and so.name = v_expected_path
      and so.owner = v_uid
  ) then
    raise exception 'submit_public_place: owned facade object not found'
      using errcode = '23503';
  end if;

  -- C.11 Atomic insert: place + facade photo in one function/transaction.
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
  'Атомарная подача серой метки с фасадом для authenticated public_user. Сервер сам проставляет status=gray, moderation_status=published, source=public, created_by=auth.uid(), details={"schema_version":1}, photo kind=facade. Проверяет активную категорию, конечные координаты, точный путь {place_id}/facade.jpg, владение Storage-объектом, отсутствие повторного использования id и пути. Лимит одной подачи снят 20.07 решением Арбитра. SECURITY DEFINER, search_path=''''. Execute только authenticated.';
