-- Проверка: сантиметры, туалет, отметки, подъёмник и роль координатора.
-- Запуск на чистой базе после всех миграций:
--   psql -v ON_ERROR_STOP=1 -d <база> -f supabase/tests/mapper_measures_amenities.sql
-- Скрипт ничего не оставляет: всё в одной транзакции с откатом в конце.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'volunteer@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'coordinator@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'neighbour2@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'public_user'),
  ('00000000-0000-4000-8000-0000000000a2', 'coordinator'),
  ('00000000-0000-4000-8000-0000000000a3', 'public_user')
on conflict (id) do update set role = excluded.role;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- 1. Волонтёр: фасад, два фото туалета, сантиметры по фото, отметки.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
insert into storage.objects (bucket_id, name, owner) values
  ('place-photos', 'aaaaaaaa-1111-4111-8111-111111111111/facade.jpg',   '00000000-0000-4000-8000-0000000000a1'),
  ('place-photos', 'aaaaaaaa-1111-4111-8111-111111111111/toilet.jpg',   '00000000-0000-4000-8000-0000000000a1'),
  ('place-photos', 'aaaaaaaa-1111-4111-8111-111111111111/toilet-2.jpg', '00000000-0000-4000-8000-0000000000a1');

do $$
declare r public.places;
begin
  r := public.submit_mapper_place(
    p_place_id            => 'aaaaaaaa-1111-4111-8111-111111111111',
    p_name                => 'Поликлиника',
    p_category            => 'health',
    p_lat                 => 43.0033,
    p_lng                 => 41.0237,
    p_storage_path        => 'aaaaaaaa-1111-4111-8111-111111111111/facade.jpg',
    p_status              => 'red',
    p_steps_count         => 1,
    p_ramp_type           => 'none',
    p_step_height_cm      => 12,
    p_door_width_cm       => 76,
    p_step_height_source  => 'photo',
    p_toilet              => 'yes',
    p_toilet_accessible   => 'partial',
    p_toilet_photos       => 2,
    p_toilet_note         => '  Узкая дверь, поручня нет  ',
    p_hand_wash           => 'yes',
    p_accessible_parking  => 'no',
    p_elevator            => 'unknown'
  );
  assert r.step_height_cm = 12 and r.door_width_cm = 76, 'сантиметры в своих колонках';
  assert r.details -> 'mapper' ->> 'step_high' = 'yes', '12 см выше границы 5 см';
  assert r.details -> 'mapper' ->> 'door_wide' = 'no', '76 см уже 80 см';
  assert r.details -> 'mapper' -> 'measure' ->> 'state' = 'preliminary', 'замер картографа предварительный';
  assert r.details -> 'mapper' -> 'measure' ->> 'step_height_source' = 'photo', 'источник высоты';
  assert r.details -> 'mapper' -> 'measure' ->> 'door_width_source' = 'person', 'источник ширины по умолчанию';
  assert r.toilet_exists = 'yes' and r.toilet_accessible = 'partial', 'туалет в своих колонках';
  assert r.details -> 'mapper' ->> 'toilet_note' = 'Узкая дверь, поручня нет', 'описание туалета обрезано по краям';
  assert r.details -> 'mapper' ->> 'hand_wash' = 'yes', 'можно помыть руки';
  assert r.details -> 'mapper' ->> 'accessible_parking' = 'no', 'парковки для людей с инвалидностью нет';
  assert not (r.details -> 'mapper' ? 'elevator'), 'пропущенная отметка не пишется';
  assert r.moderation_status = 'pending', 'карточка на проверке';
  assert (select count(*) from public.photos
          where place_id = r.id and kind = 'toilet') = 2, 'два фото туалета привязаны';
end $$;

-- 2. Граница 5 см: ровно 5 это низкая ступень.
insert into storage.objects (bucket_id, name, owner) values
  ('place-photos', 'aaaaaaaa-2222-4222-8222-222222222222/facade.jpg', '00000000-0000-4000-8000-0000000000a1');
do $$
declare r public.places;
begin
  r := public.submit_mapper_place(
    'aaaaaaaa-2222-4222-8222-222222222222', 'Кафе', 'food', 43, 41,
    'aaaaaaaa-2222-4222-8222-222222222222/facade.jpg', 'yellow',
    p_steps_count => 1, p_step_height_cm => 5, p_door_width_cm => 80);
  assert r.details -> 'mapper' ->> 'step_high' = 'no', '5 см не выше границы';
  assert r.details -> 'mapper' ->> 'door_wide' = 'yes', '80 см проходит';
  assert r.toilet_exists = 'unknown', 'туалет пропущен';
end $$;

-- 3. Прежний вызов из двенадцати параметров работает как раньше.
insert into storage.objects (bucket_id, name, owner) values
  ('place-photos', 'aaaaaaaa-3333-4333-8333-333333333333/facade.jpg', '00000000-0000-4000-8000-0000000000a1');
do $$
declare r public.places;
begin
  r := public.submit_mapper_place(
    p_place_id => 'aaaaaaaa-3333-4333-8333-333333333333', p_name => 'Аптека',
    p_category => 'health', p_lat => 43, p_lng => 41,
    p_storage_path => 'aaaaaaaa-3333-4333-8333-333333333333/facade.jpg',
    p_status => 'green', p_steps_count => 0, p_ramp_type => 'none',
    p_subtype => 'Аптека', p_step_high => 'unknown', p_door_wide => 'yes');
  assert r.step_height_cm is null and r.door_width_cm is null, 'без цифр колонки пустые';
  assert r.details -> 'mapper' ->> 'door_wide' = 'yes', 'прежний ответ сохранён';
  assert not (r.details -> 'mapper' ? 'measure'), 'без цифр нет записи о замере';
end $$;

-- 4. Отказы.
do $$
begin
  perform public.submit_mapper_place(
    'aaaaaaaa-4444-4444-8444-444444444444', 'X', 'food', 43, 41,
    'aaaaaaaa-4444-4444-8444-444444444444/facade.jpg', 'green', p_step_height_cm => 101);
  raise exception 'высота больше 100 см должна быть отклонена';
exception when invalid_text_representation then null;
end $$;
do $$
begin
  perform public.submit_mapper_place(
    'aaaaaaaa-4444-4444-8444-444444444444', 'X', 'food', 43, 41,
    'aaaaaaaa-4444-4444-8444-444444444444/facade.jpg', 'green', p_door_width_cm => 20);
  raise exception 'ширина меньше 30 см должна быть отклонена';
exception when invalid_text_representation then null;
end $$;
do $$
begin
  perform public.submit_mapper_place(
    'aaaaaaaa-4444-4444-8444-444444444444', 'X', 'food', 43, 41,
    'aaaaaaaa-4444-4444-8444-444444444444/facade.jpg', 'green',
    p_toilet => 'no', p_toilet_photos => 1);
  raise exception 'фото туалета без туалета должно быть отклонено';
exception when invalid_text_representation then null;
end $$;
insert into storage.objects (bucket_id, name, owner) values
  ('place-photos', 'aaaaaaaa-5555-4555-8555-555555555555/facade.jpg', '00000000-0000-4000-8000-0000000000a1');
do $$
begin
  perform public.submit_mapper_place(
    'aaaaaaaa-5555-4555-8555-555555555555', 'X', 'food', 43, 41,
    'aaaaaaaa-5555-4555-8555-555555555555/facade.jpg', 'green',
    p_toilet => 'yes', p_toilet_photos => 1);
  raise exception 'заявленное, но не загруженное фото туалета должно быть отклонено';
exception when foreign_key_violation then null;
end $$;

-- 5. Волонтёр не может положить чужое или лишнее.
do $$
begin
  insert into storage.objects (bucket_id, name, owner) values
    ('place-photos', 'aaaaaaaa-6666-4666-8666-666666666666/interior.jpg', '00000000-0000-4000-8000-0000000000a1');
  raise exception 'public_user не должен загружать interior.jpg';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into storage.objects (bucket_id, name, owner) values
    ('place-photos', 'aaaaaaaa-6666-4666-8666-666666666666/toilet.jpg', '00000000-0000-4000-8000-0000000000a3');
  raise exception 'нельзя загрузить фото от чужого имени';
exception when insufficient_privilege then null;
end $$;

-- 6. Координатор: сборщик, источник operator, вход с подъёмником.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
insert into storage.objects (bucket_id, name, owner) values
  ('place-photos', 'aaaaaaaa-7777-4777-8777-777777777777/facade.jpg', '00000000-0000-4000-8000-0000000000a2');
do $$
declare r public.places;
begin
  assert public.current_user_can_collect(), 'координатор считается сборщиком';
  r := public.submit_mapper_place(
    'aaaaaaaa-7777-4777-8777-777777777777', 'Офис АИС', 'government', 43, 41,
    'aaaaaaaa-7777-4777-8777-777777777777/facade.jpg', 'green',
    p_steps_count => 14, p_ramp_type => 'lift', p_elevator => 'no');
  assert r.ramp_type = 'lift', 'подъёмник у входа сохранён';
  assert r.source = 'operator', 'источник для координатора — operator';
  assert r.details -> 'mapper' ->> 'elevator' = 'no', 'лифта между этажами нет';
end $$;

rollback;
