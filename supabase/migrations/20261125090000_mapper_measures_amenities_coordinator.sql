-- Путь картографа: сантиметры, туалет, удобства, подъёмник, роль координатора.
--
-- Зачем (решения Алхаса 25.11.2026, проход по пути картографа на телефоне):
--   1) высота ступени и ширина двери идут цифрой в сантиметрах, а не ответом
--      «да / нет». У замера два состояния: «предварительно» (по фото или от
--      человека) и «окончательно» (точный замер аудитора АИС). Карточка
--      картографа всегда «предварительно»;
--   2) туалет идёт отдельным шагом: есть ли он, доступен ли, до двух фото,
--      короткое описание;
--   3) три отметки «да / нет»: можно помыть руки, парковка для людей с
--      инвалидностью, лифт между этажами;
--   4) у входа может стоять подъёмник: это не пандус и не лифт между этажами,
--      в поле «Пандус» появляется значение lift;
--   5) в каждом районе будет координатор: новая роль coordinator с правами
--      сборщика (как operator).
--
-- Что меняется:
--   • places.ramp_type допускает 'lift';
--   • profiles.role допускает 'coordinator'; current_user_can_collect() считает
--     координатора сборщиком;
--   • photos и Storage допускают второе фото туалета ({place_id}/toilet-2.jpg);
--     public_user может загрузить и убрать за собой только фото туалета своей
--     карточки (как с фасадом);
--   • submit_mapper_place получает новые параметры со значениями по умолчанию.
--     Прежний вызов из двенадцати параметров продолжает работать.
--
-- Что НЕ меняется: submit_public_place, замок moderation_status, карма,
-- политики places и photos, чтение Storage.
--
-- Откат: supabase/rollback/2026-11-25_mapper_measures_down.sql.
-- Проверка: supabase/tests/mapper_measures_amenities.sql.

-- ----------------------------------------------------------------------------
-- 1. Подъёмник у входа
-- ----------------------------------------------------------------------------
alter table public.places drop constraint places_ramp_type_check;
alter table public.places add constraint places_ramp_type_check
  check (ramp_type in ('none', 'permanent', 'portable_on_request', 'portable_available', 'lift'));

-- ----------------------------------------------------------------------------
-- 2. Роль координатора района
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'coordinator', 'operator', 'tester', 'public_user', 'banned'));

create or replace function public.current_user_can_collect()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin', 'coordinator', 'operator', 'tester');
$$;

-- ----------------------------------------------------------------------------
-- 3. Второе фото туалета
-- ----------------------------------------------------------------------------
alter table public.photos drop constraint photos_storage_path_shape_check;
alter table public.photos add constraint photos_storage_path_shape_check
  check (storage_path ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|toilet-2|interior)\.jpg$');

drop policy place_photos_storage_insert_collectors on storage.objects;
create policy place_photos_storage_insert_collectors on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and (select public.current_user_can_collect())
    and name ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|toilet-2|interior)\.jpg$'
  );

-- public_user: только фото туалета своей карточки, по тому же правилу, что фасад.
create policy place_photos_storage_insert_public_user_toilet
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'public_user'
    )
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/toilet(-2)?\.jpg$'
  );

-- public_user убирает за собой только непривязанное фото туалета (отказ RPC).
create policy place_photos_storage_delete_public_user_unreferenced_toilet
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'public_user'
    )
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/toilet(-2)?\.jpg$'
    and (select goapsny_private.claim_unreferenced_storage_path(storage.objects.name))
  );

-- ----------------------------------------------------------------------------
-- 4. Подача карточки: новые параметры
-- ----------------------------------------------------------------------------
drop function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
);

create function public.submit_mapper_place(
  p_place_id uuid,
  p_name text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_storage_path text,
  p_status text,
  p_steps_count integer default null,
  p_ramp_type text default 'none',
  p_subtype text default null,
  p_step_high text default 'unknown',
  p_door_wide text default 'unknown',
  -- Сантиметры. Откуда цифра: 'photo' (оценил помощник) или 'person'.
  p_step_height_cm integer default null,
  p_door_width_cm integer default null,
  p_step_height_source text default null,
  p_door_width_source text default null,
  -- Туалет: число загруженных фото (0–2) сервер сам переводит в пути.
  p_toilet text default 'unknown',
  p_toilet_accessible text default 'unknown',
  p_toilet_photos integer default 0,
  p_toilet_note text default null,
  -- Отметки «да / нет»; 'unknown' — человек пропустил.
  p_hand_wash text default 'unknown',
  p_accessible_parking text default 'unknown',
  p_elevator text default 'unknown'
) returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := auth.uid();
  v_expected_path  text := p_place_id::text || '/facade.jpg';
  v_toilet_paths   text[] := array[
    p_place_id::text || '/toilet.jpg',
    p_place_id::text || '/toilet-2.jpg'
  ];
  v_role           text;
  v_subtype        text := nullif(btrim(coalesce(p_subtype, '')), '');
  v_toilet_note    text := nullif(btrim(coalesce(p_toilet_note, '')), '');
  -- Цифра главнее прежнего ответа «да / нет»: границы 5 см и 80 см.
  v_step_high      text := case
    when p_step_height_cm is null then p_step_high
    when p_step_height_cm > 5 then 'yes'
    else 'no'
  end;
  v_door_wide      text := case
    when p_door_width_cm is null then p_door_wide
    when p_door_width_cm >= 80 then 'yes'
    else 'no'
  end;
  v_measure        jsonb;
  v_path           text;
  v_inserted       public.places%rowtype;
begin
  -- M.1 Только вошедший пользователь.
  if v_uid is null then
    raise exception 'submit_mapper_place: authentication required'
      using errcode = '42501';
  end if;

  -- M.2 Профиль есть и не заблокирован.
  select p.role into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is null then
    raise exception 'submit_mapper_place: profile not found'
      using errcode = '42501';
  end if;
  if v_role not in ('public_user', 'tester', 'operator', 'coordinator', 'admin', 'owner') then
    raise exception 'submit_mapper_place: caller is not allowed to submit'
      using errcode = '42501';
  end if;

  -- M.3 Название.
  if p_name is null or btrim(p_name) = '' then
    raise exception 'submit_mapper_place: name is required'
      using errcode = '23502';
  end if;

  -- M.4 Действующая категория.
  if not exists (
    select 1 from public.categories c
    where c.slug = p_category and c.is_active = true
  ) then
    raise exception 'submit_mapper_place: inactive or unknown category'
      using errcode = '23503';
  end if;

  -- M.5 Конечные координаты в допустимых границах.
  if p_lat is null or p_lng is null
     or p_lat::text in ('NaN', 'Infinity', '-Infinity')
     or p_lng::text in ('NaN', 'Infinity', '-Infinity')
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'submit_mapper_place: invalid coordinates'
      using errcode = '22P02';
  end if;

  -- M.6 Путь фасада выводится из place_id.
  if coalesce(p_storage_path, '') <> v_expected_path then
    raise exception 'submit_mapper_place: storage_path must equal {place_id}/facade.jpg'
      using errcode = '22P02';
  end if;

  -- M.7 Данные карточки: оценку ставит человек у входа, серой она не бывает.
  if p_status is null or p_status not in ('green', 'yellow', 'red') then
    raise exception 'submit_mapper_place: invalid card: status must be green, yellow or red'
      using errcode = '22P02';
  end if;
  if p_steps_count is not null and (p_steps_count < 0 or p_steps_count > 99) then
    raise exception 'submit_mapper_place: invalid card: steps_count out of range'
      using errcode = '22P02';
  end if;
  if p_ramp_type is null
     or p_ramp_type not in ('none', 'permanent', 'portable_on_request', 'portable_available', 'lift') then
    raise exception 'submit_mapper_place: invalid card: unknown ramp_type'
      using errcode = '22P02';
  end if;
  if p_step_high is null or p_step_high not in ('yes', 'no', 'unknown')
     or p_door_wide is null or p_door_wide not in ('yes', 'no', 'unknown') then
    raise exception 'submit_mapper_place: invalid card: answers must be yes, no or unknown'
      using errcode = '22P02';
  end if;
  if v_subtype is not null and char_length(v_subtype) > 80 then
    raise exception 'submit_mapper_place: invalid card: subtype is too long'
      using errcode = '22P02';
  end if;

  -- M.7a Сантиметры: высота одной ступени и ширина дверного проёма.
  if p_step_height_cm is not null and (p_step_height_cm < 0 or p_step_height_cm > 100) then
    raise exception 'submit_mapper_place: invalid card: step_height_cm out of range'
      using errcode = '22P02';
  end if;
  if p_door_width_cm is not null and (p_door_width_cm < 30 or p_door_width_cm > 500) then
    raise exception 'submit_mapper_place: invalid card: door_width_cm out of range'
      using errcode = '22P02';
  end if;
  if (p_step_height_source is not null and p_step_height_source not in ('photo', 'person'))
     or (p_door_width_source is not null and p_door_width_source not in ('photo', 'person')) then
    raise exception 'submit_mapper_place: invalid card: measure source must be photo or person'
      using errcode = '22P02';
  end if;

  -- M.7b Туалет и отметки.
  if p_toilet is null or p_toilet not in ('yes', 'no', 'unknown')
     or p_toilet_accessible is null
     or p_toilet_accessible not in ('yes', 'no', 'partial', 'unknown') then
    raise exception 'submit_mapper_place: invalid card: unknown toilet answer'
      using errcode = '22P02';
  end if;
  if p_toilet_photos is null or p_toilet_photos < 0 or p_toilet_photos > 2 then
    raise exception 'submit_mapper_place: invalid card: toilet_photos must be 0, 1 or 2'
      using errcode = '22P02';
  end if;
  if p_toilet_photos > 0 and p_toilet <> 'yes' then
    raise exception 'submit_mapper_place: invalid card: toilet photos need toilet = yes'
      using errcode = '22P02';
  end if;
  if v_toilet_note is not null and char_length(v_toilet_note) > 500 then
    raise exception 'submit_mapper_place: invalid card: toilet_note is too long'
      using errcode = '22P02';
  end if;
  if p_hand_wash is null or p_hand_wash not in ('yes', 'no', 'unknown')
     or p_accessible_parking is null or p_accessible_parking not in ('yes', 'no', 'unknown')
     or p_elevator is null or p_elevator not in ('yes', 'no', 'unknown') then
    raise exception 'submit_mapper_place: invalid card: answers must be yes, no or unknown'
      using errcode = '22P02';
  end if;

  -- Та же блокировка, что в submit_public_place: уборка осиротевших фасадов
  -- не должна пересечься с подачей по этому же пути.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_expected_path, 0)
  );

  -- M.8 Идентификатор места свободен.
  if exists (select 1 from public.places pl where pl.id = p_place_id) then
    raise exception 'submit_mapper_place: place_id already used'
      using errcode = '23505';
  end if;

  -- M.9 Путь фасада ещё не привязан к другому фото.
  if exists (select 1 from public.photos ph where ph.storage_path = v_expected_path) then
    raise exception 'submit_mapper_place: facade already indexed'
      using errcode = '23505';
  end if;

  -- M.10 Файл фасада существует и принадлежит вызвавшему.
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'place-photos'
      and so.name = v_expected_path
      and so.owner = v_uid
  ) then
    raise exception 'submit_mapper_place: owned facade object not found'
      using errcode = '23503';
  end if;

  -- M.10a Заявленные фото туалета существуют и принадлежат вызвавшему.
  for i in 1..p_toilet_photos loop
    v_path := v_toilet_paths[i];
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_path, 0));
    if not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'place-photos'
        and so.name = v_path
        and so.owner = v_uid
    ) then
      raise exception 'submit_mapper_place: owned toilet object not found'
        using errcode = '23503';
    end if;
  end loop;

  -- Замер картографа всегда предварительный; окончательным его делает аудитор.
  if p_step_height_cm is not null or p_door_width_cm is not null then
    v_measure := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'state', 'preliminary',
      'step_height_source', case when p_step_height_cm is null then null
                                 else coalesce(p_step_height_source, 'person') end,
      'door_width_source', case when p_door_width_cm is null then null
                                else coalesce(p_door_width_source, 'person') end
    ));
  end if;

  -- M.11 Место и фото одной транзакцией.
  insert into public.places (
    id, name, category, lat, lng,
    status, steps_count, step_height_cm, ramp_type, door_width_cm,
    toilet_exists, toilet_accessible,
    moderation_status, source, created_by, inspected_at, details
  )
  values (
    p_place_id,
    btrim(p_name),
    p_category,
    p_lat,
    p_lng,
    p_status,
    p_steps_count,
    p_step_height_cm,
    p_ramp_type,
    p_door_width_cm,
    p_toilet,
    case when p_toilet = 'yes' then p_toilet_accessible else 'unknown' end,
    'pending',
    case when v_role = 'public_user' then 'public' else 'operator' end,
    v_uid,
    current_date,
    pg_catalog.jsonb_build_object(
      'schema_version', 1,
      'mapper', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'subtype', v_subtype,
        'step_high', v_step_high,
        'door_wide', v_door_wide,
        'measure', v_measure,
        'toilet_note', v_toilet_note,
        'hand_wash', nullif(p_hand_wash, 'unknown'),
        'accessible_parking', nullif(p_accessible_parking, 'unknown'),
        'elevator', nullif(p_elevator, 'unknown')
      ))
    )
  );

  insert into public.photos (place_id, storage_path, kind, uploaded_by)
  values (p_place_id, v_expected_path, 'facade', v_uid);

  for i in 1..p_toilet_photos loop
    insert into public.photos (place_id, storage_path, kind, uploaded_by)
    values (p_place_id, v_toilet_paths[i], 'toilet', v_uid);
  end loop;

  select * into v_inserted from public.places where id = p_place_id;
  return v_inserted;
end;
$$;

alter function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text,
  integer, integer, text, text,
  text, text, integer, text,
  text, text, text
) owner to postgres;
revoke execute on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text,
  integer, integer, text, text,
  text, text, integer, text,
  text, text, text
) from public, anon;
grant execute on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text,
  integer, integer, text, text,
  text, text, integer, text,
  text, text, text
) to authenticated;

comment on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text,
  integer, integer, text, text,
  text, text, integer, text,
  text, text, text
) is
  'Путь картографа: атомарная подача полной карточки на проверку. Кроме оценки, ступеней и пандуса принимает высоту ступени и ширину двери в сантиметрах (замер предварительный, источник photo или person), ответы о туалете с числом загруженных фото (0–2) и отметки: можно помыть руки, парковка для людей с инвалидностью, лифт между этажами. Сервер сам ставит moderation_status=pending, source, created_by, inspected_at и собирает details. SECURITY DEFINER, search_path=''''. Execute только authenticated.';

notify pgrst, 'reload schema';
