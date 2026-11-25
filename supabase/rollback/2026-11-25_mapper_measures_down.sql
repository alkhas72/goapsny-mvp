-- Откат миграции 20261125090000_mapper_measures_amenities_coordinator.sql.
--
-- Запускать только по слову Алхаса. Перед запуском проверить, что нет строк,
-- которым нужен новый вид данных: вход с подъёмником, профиль координатора,
-- второе фото туалета. Запросы ниже остановят откат, если такие строки есть,
-- и ничего не изменят: всё идёт одной транзакцией.
--
-- Что возвращается: прежняя функция submit_mapper_place из двенадцати
-- параметров (как в 20261123120000), прежние ограничения ramp_type, role и
-- пути фото, прежняя политика загрузки сборщиков. Колонки не трогаются:
-- step_height_cm, door_width_cm, toilet_exists и toilet_accessible были в
-- схеме с 0001, записанные в них значения остаются.

begin;

do $$
begin
  if exists (select 1 from public.places where ramp_type = 'lift') then
    raise exception 'откат остановлен: есть места с ramp_type = lift';
  end if;
  if exists (select 1 from public.profiles where role = 'coordinator') then
    raise exception 'откат остановлен: есть профили с ролью coordinator';
  end if;
  if exists (select 1 from public.photos where storage_path ~ '/toilet-2\.jpg$') then
    raise exception 'откат остановлен: есть вторые фото туалета';
  end if;
end $$;

drop function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text,
  integer, integer, text, text,
  text, text, integer, text,
  text, text, text
);

drop policy place_photos_storage_delete_public_user_unreferenced_toilet on storage.objects;
drop policy place_photos_storage_insert_public_user_toilet on storage.objects;

drop policy place_photos_storage_insert_collectors on storage.objects;
create policy place_photos_storage_insert_collectors on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and (select public.current_user_can_collect())
    and name ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$'
  );

alter table public.photos drop constraint photos_storage_path_shape_check;
alter table public.photos add constraint photos_storage_path_shape_check
  check (storage_path ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$');

create or replace function public.current_user_can_collect()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin', 'operator', 'tester');
$$;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'operator', 'tester', 'public_user', 'banned'));

alter table public.places drop constraint places_ramp_type_check;
alter table public.places add constraint places_ramp_type_check
  check (ramp_type in ('none', 'permanent', 'portable_on_request', 'portable_available'));

-- Прежняя функция, слово в слово из 20261123120000_mapper_pending_submission.sql.
create or replace function public.submit_mapper_place(
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
  p_door_wide text default 'unknown'
) returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := auth.uid();
  v_expected_path  text := p_place_id::text || '/facade.jpg';
  v_role           text;
  v_subtype        text := nullif(btrim(coalesce(p_subtype, '')), '');
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
  if v_role not in ('public_user', 'tester', 'operator', 'admin', 'owner') then
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
     or p_ramp_type not in ('none', 'permanent', 'portable_on_request', 'portable_available') then
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

  -- M.11 Место и фото фасада одной транзакцией.
  insert into public.places (
    id, name, category, lat, lng,
    status, steps_count, ramp_type,
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
    p_ramp_type,
    'pending',
    case when v_role = 'public_user' then 'public' else 'operator' end,
    v_uid,
    current_date,
    jsonb_build_object(
      'schema_version', 1,
      'mapper', jsonb_strip_nulls(jsonb_build_object(
        'subtype', v_subtype,
        'step_high', p_step_high,
        'door_wide', p_door_wide
      ))
    )
  );

  insert into public.photos (place_id, storage_path, kind, uploaded_by)
  values (p_place_id, v_expected_path, 'facade', v_uid);

  select * into v_inserted from public.places where id = p_place_id;
  return v_inserted;
end;
$$;

alter function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
) owner to postgres;
revoke execute on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
) from public, anon;
grant execute on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
) to authenticated;

comment on function public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
) is
  'Путь картографа: атомарная подача полной карточки с фото фасада на проверку. Клиент передаёт оценку (green/yellow/red), число ступеней, тип пандуса и ответы о ступени и двери. Сервер сам ставит moderation_status=pending, source (public для public_user, иначе operator), created_by=auth.uid(), inspected_at=сегодня и собирает details. Публикует admin/owner обычным UPDATE moderation_status. SECURITY DEFINER, search_path=''''. Execute только authenticated.';

delete from supabase_migrations.schema_migrations where version = '20261125090000';

notify pgrst, 'reload schema';

commit;
