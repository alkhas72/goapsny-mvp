-- Проверка пути картографа: подача на проверку и публикация модератором.
-- Запуск на чистой базе после всех миграций:
--   psql -v ON_ERROR_STOP=1 -d <база> -f supabase/tests/mapper_pending_submission.sql
-- Скрипт ничего не оставляет: всё в одной транзакции с откатом в конце.
-- Каждая проверка либо молчит, либо роняет скрипт с понятным текстом.

begin;

-- Действующие лица.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'mapper@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'neighbour@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'moderator@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'banned@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-000000000001', 'public_user'),
  ('00000000-0000-4000-8000-000000000002', 'public_user'),
  ('00000000-0000-4000-8000-000000000003', 'admin'),
  ('00000000-0000-4000-8000-000000000004', 'banned')
on conflict (id) do update set role = excluded.role;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  end if;
end $$;

create function pg_temp.back_to_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- 1. Картограф загружает фото фасада и подаёт карточку.
select pg_temp.act_as('00000000-0000-4000-8000-000000000001');
insert into storage.objects (bucket_id, name, owner)
values ('place-photos', '11111111-1111-4111-8111-111111111111/facade.jpg',
        '00000000-0000-4000-8000-000000000001');

do $$
declare r public.places;
begin
  r := public.submit_mapper_place(
    p_place_id     => '11111111-1111-4111-8111-111111111111',
    p_name         => '  Кафе «Пингвин»  ',
    p_category     => 'food',
    p_lat          => 43.0033,
    p_lng          => 41.0237,
    p_storage_path => '11111111-1111-4111-8111-111111111111/facade.jpg',
    p_status       => 'yellow',
    p_steps_count  => 2,
    p_ramp_type    => 'portable_on_request',
    p_subtype      => 'Кафе',
    p_step_high    => 'yes',
    p_door_wide    => 'unknown'
  );
  assert r.moderation_status = 'pending', 'карточка должна уйти на проверку';
  assert r.status = 'yellow', 'оценку ставит картограф';
  assert r.name = 'Кафе «Пингвин»', 'название обрезается по краям';
  assert r.source = 'public', 'источник для public_user — public';
  assert r.created_by = '00000000-0000-4000-8000-000000000001', 'автор — вызвавший';
  assert r.steps_count = 2 and r.ramp_type = 'portable_on_request', 'данные входа сохранены';
  assert r.inspected_at = current_date, 'дата осмотра — сегодня';
  assert r.details -> 'mapper' ->> 'subtype' = 'Кафе', 'тип объекта в details';
  assert r.details -> 'mapper' ->> 'step_high' = 'yes', 'высокая ступень в details';
  assert r.details -> 'mapper' ->> 'door_wide' = 'unknown', 'дверь в details';
  assert (r.details ->> 'schema_version')::int = 1, 'версия схемы details';
end $$;

-- 2. Автор видит свою карточку, её фото и сам файл.
do $$
begin
  assert (select count(*) from public.places
          where id = '11111111-1111-4111-8111-111111111111') = 1, 'автор видит карточку';
  assert (select count(*) from public.photos
          where place_id = '11111111-1111-4111-8111-111111111111' and kind = 'facade') = 1,
         'автор видит запись о фото';
  assert (select count(*) from storage.objects
          where name = '11111111-1111-4111-8111-111111111111/facade.jpg') = 1,
         'автор видит свой файл, пока карточка на проверке';
end $$;

-- 3. Автор не может опубликовать сам.
do $$
declare n integer;
begin
  update public.places set moderation_status = 'published'
  where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'автор не должен менять статус проверки';
exception when insufficient_privilege then
  null; -- отказ замка — тоже верный исход
end $$;

-- 4. Посторонние карточку не видят.
select pg_temp.act_as('00000000-0000-4000-8000-000000000002');
do $$
begin
  assert (select count(*) from public.places
          where id = '11111111-1111-4111-8111-111111111111') = 0, 'сосед не видит чужую карточку на проверке';
  assert (select count(*) from storage.objects
          where name = '11111111-1111-4111-8111-111111111111/facade.jpg') = 0,
         'сосед не видит чужой файл';
end $$;

select pg_temp.act_as(null);
do $$
begin
  assert (select count(*) from public.places
          where id = '11111111-1111-4111-8111-111111111111') = 0, 'без входа карточка на проверке не видна';
end $$;

-- 5. Отказы: без входа, заблокированный, плохие данные.
do $$
begin
  perform public.submit_mapper_place(
    '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
    '22222222-2222-4222-8222-222222222222/facade.jpg', 'green');
  raise exception 'без входа подача должна быть отклонена';
exception when insufficient_privilege then null;
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-000000000004');
do $$
begin
  perform public.submit_mapper_place(
    '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
    '22222222-2222-4222-8222-222222222222/facade.jpg', 'green');
  raise exception 'заблокированный не должен подавать';
exception when insufficient_privilege then null;
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-000000000002');
insert into storage.objects (bucket_id, name, owner)
values ('place-photos', '22222222-2222-4222-8222-222222222222/facade.jpg',
        '00000000-0000-4000-8000-000000000002');
do $$
begin
  begin
    perform public.submit_mapper_place(
      '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
      '22222222-2222-4222-8222-222222222222/facade.jpg', 'gray');
    raise exception 'серая оценка от картографа недопустима';
  exception when invalid_text_representation then null;
  end;
  begin
    perform public.submit_mapper_place(
      '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
      '22222222-2222-4222-8222-222222222222/facade.jpg', 'green', -1);
    raise exception 'отрицательное число ступеней недопустимо';
  exception when invalid_text_representation then null;
  end;
  begin
    perform public.submit_mapper_place(
      '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
      '22222222-2222-4222-8222-222222222222/facade.jpg', 'green', 0, 'escalator');
    raise exception 'неизвестный тип пандуса недопустим';
  exception when invalid_text_representation then null;
  end;
  begin
    perform public.submit_mapper_place(
      '22222222-2222-4222-8222-222222222222', 'X', 'food', 43, 41,
      '22222222-2222-4222-8222-222222222222/facade.jpg', 'green', 0, 'none', null, 'maybe');
    raise exception 'ответ вне да/нет/не знаю недопустим';
  exception when invalid_text_representation then null;
  end;
  begin
    -- Чужой файл: фото загрузил первый картограф.
    perform public.submit_mapper_place(
      '11111111-1111-4111-8111-111111111111', 'X', 'food', 43, 41,
      '11111111-1111-4111-8111-111111111111/facade.jpg', 'green');
    raise exception 'занятый идентификатор должен быть отклонён';
  exception when unique_violation then null;
  end;
end $$;

-- 6. Модератор видит очередь, фото и публикует.
select pg_temp.act_as('00000000-0000-4000-8000-000000000003');
do $$
declare n integer;
begin
  assert (select count(*) from public.places
          where moderation_status = 'pending'
            and id = '11111111-1111-4111-8111-111111111111') = 1, 'модератор видит очередь';
  assert (select count(*) from storage.objects
          where name = '11111111-1111-4111-8111-111111111111/facade.jpg') = 1, 'модератор видит фото';
  update public.places set moderation_status = 'published'
  where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  assert n = 1, 'модератор публикует карточку';
end $$;

-- 7. После публикации карточка видна всем.
select pg_temp.act_as(null);
do $$
begin
  assert (select count(*) from public.places
          where id = '11111111-1111-4111-8111-111111111111'
            and status = 'yellow') = 1, 'опубликованная карточка видна без входа';
end $$;

select pg_temp.back_to_owner();
rollback;
\echo 'mapper_pending_submission: все проверки пройдены'
