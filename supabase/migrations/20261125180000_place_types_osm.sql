-- Классификатор мест по OpenStreetMap: группа → типы, «Туалеты» больше не группа.
--
-- Зачем (решение Алхаса 25.11.2026, проход по «Поиск и фильтр» на телефоне):
--   своё не придумываем, берём за основу OpenStreetMap. Список из 12 групп
--   Wheelmap стоял одним уровнем; «Туалеты» встали на место «Прочее»
--   миграцией 20260714142000. Теперь групп 11, каждая раскрывается в типы,
--   и каждый тип равен тегу OSM (amenity=pharmacy, amenity=hospital, …).
--   Общественный туалет — тип amenity=toilets; туалет в заведении остаётся
--   признаком карточки (toilet_exists, toilet_accessible).
--
-- Что меняется:
--   • новая таблица public.place_types (тип, группа, название, тег OSM);
--     читать могут все, писать только admin/owner, как у categories;
--   • categories: 'toilets' выключена (is_active = false), 'bank_post'
--     называется «Финансы и почта»;
--   • карточки с группой 'toilets' переходят в 'government' с типом
--     «Общественный туалет»;
--   • build_place_osm_tags(): если у карточки указан тип
--     (details.mapper.subtype, как пишет submit_mapper_place), в osm_tags
--     идёт тег типа вместо общего тега группы.
--
-- Что НЕ меняется: places, photos, submit_public_place, submit_mapper_place
-- (тип по-прежнему приходит названием в p_subtype), политики, карма.
--
-- Проверка: supabase/tests/place_types_osm.sql.
-- Откат: supabase/rollback/2026-11-25_place_types_down.sql.

create table if not exists public.place_types (
  slug text primary key,
  category text not null references public.categories(slug),
  name_ru text not null unique,
  osm_key text not null,
  osm_value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists place_types_category_idx on public.place_types (category, sort_order);

alter table public.place_types enable row level security;

drop policy if exists place_types_read_active on public.place_types;
create policy place_types_read_active on public.place_types
  for select to anon, authenticated
  using (is_active = true or (select public.current_user_is_admin()));

drop policy if exists place_types_admin_write on public.place_types;
create policy place_types_admin_write on public.place_types
  for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

grant select on public.place_types to anon, authenticated;
grant insert, update, delete on public.place_types to authenticated;
grant all on public.place_types to service_role;

insert into public.place_types (slug, category, name_ru, osm_key, osm_value, sort_order)
values
  ('cafe', 'food', 'Кафе', 'amenity', 'cafe', 10),
  ('restaurant', 'food', 'Ресторан', 'amenity', 'restaurant', 20),
  ('fast_food', 'food', 'Быстрое питание', 'amenity', 'fast_food', 30),
  ('bar', 'food', 'Бар', 'amenity', 'bar', 40),
  ('bakery', 'food', 'Пекарня', 'shop', 'bakery', 50),
  ('supermarket', 'shops', 'Супермаркет', 'shop', 'supermarket', 60),
  ('convenience', 'shops', 'Продукты', 'shop', 'convenience', 70),
  ('clothes', 'shops', 'Одежда', 'shop', 'clothes', 80),
  ('hardware', 'shops', 'Хозяйственный', 'shop', 'hardware', 90),
  ('marketplace', 'shops', 'Рынок', 'amenity', 'marketplace', 100),
  ('pharmacy', 'health', 'Аптека', 'amenity', 'pharmacy', 110),
  ('clinic', 'health', 'Поликлиника', 'amenity', 'clinic', 120),
  ('hospital', 'health', 'Больница', 'amenity', 'hospital', 130),
  ('dentist', 'health', 'Стоматология', 'amenity', 'dentist', 140),
  ('doctors', 'health', 'Врач', 'amenity', 'doctors', 150),
  ('laboratory', 'health', 'Лаборатория', 'healthcare', 'laboratory', 160),
  ('ambulance_station', 'health', 'Скорая помощь', 'emergency', 'ambulance_station', 170),
  ('school', 'education', 'Школа', 'amenity', 'school', 180),
  ('kindergarten', 'education', 'Детский сад', 'amenity', 'kindergarten', 190),
  ('university', 'education', 'Университет', 'amenity', 'university', 200),
  ('college', 'education', 'Колледж', 'amenity', 'college', 210),
  ('library', 'education', 'Библиотека', 'amenity', 'library', 220),
  ('townhall', 'government', 'Администрация', 'amenity', 'townhall', 230),
  ('government', 'government', 'Государственное учреждение', 'office', 'government', 240),
  ('courthouse', 'government', 'Суд', 'amenity', 'courthouse', 250),
  ('police', 'government', 'Полиция', 'amenity', 'police', 260),
  ('fire_station', 'government', 'Пожарная часть', 'amenity', 'fire_station', 270),
  ('toilets', 'government', 'Общественный туалет', 'amenity', 'toilets', 280),
  ('bank', 'bank_post', 'Банк', 'amenity', 'bank', 290),
  ('atm', 'bank_post', 'Банкомат', 'amenity', 'atm', 300),
  ('post_office', 'bank_post', 'Почта', 'amenity', 'post_office', 310),
  ('theatre', 'leisure', 'Театр', 'amenity', 'theatre', 320),
  ('cinema', 'leisure', 'Кинотеатр', 'amenity', 'cinema', 330),
  ('museum', 'leisure', 'Музей', 'tourism', 'museum', 340),
  ('community_centre', 'leisure', 'Дом культуры', 'amenity', 'community_centre', 350),
  ('park', 'leisure', 'Парк', 'leisure', 'park', 360),
  ('monument', 'tourism', 'Памятник', 'historic', 'monument', 370),
  ('attraction', 'tourism', 'Достопримечательность', 'tourism', 'attraction', 380),
  ('viewpoint', 'tourism', 'Смотровая площадка', 'tourism', 'viewpoint', 390),
  ('place_of_worship', 'tourism', 'Храм', 'amenity', 'place_of_worship', 400),
  ('hotel', 'accommodation', 'Гостиница', 'tourism', 'hotel', 410),
  ('guest_house', 'accommodation', 'Гостевой дом', 'tourism', 'guest_house', 420),
  ('hostel', 'accommodation', 'Хостел', 'tourism', 'hostel', 430),
  ('bus_stop', 'public_transport', 'Остановка', 'highway', 'bus_stop', 440),
  ('bus_station', 'public_transport', 'Автовокзал', 'amenity', 'bus_station', 450),
  ('station', 'public_transport', 'Вокзал', 'railway', 'station', 460),
  ('ferry_terminal', 'public_transport', 'Причал', 'amenity', 'ferry_terminal', 470),
  ('parking', 'public_transport', 'Парковка', 'amenity', 'parking', 480),
  ('fuel', 'public_transport', 'АЗС', 'amenity', 'fuel', 490),
  ('charging_station', 'public_transport', 'Зарядная станция', 'amenity', 'charging_station', 500),
  ('car_repair', 'public_transport', 'Автосервис', 'shop', 'car_repair', 510),
  ('stadium', 'sport', 'Стадион', 'leisure', 'stadium', 520),
  ('sports_centre', 'sport', 'Спортзал', 'leisure', 'sports_centre', 530),
  ('swimming_pool', 'sport', 'Бассейн', 'leisure', 'swimming_pool', 540)
on conflict (slug) do update
set
  category = excluded.category,
  name_ru = excluded.name_ru,
  osm_key = excluded.osm_key,
  osm_value = excluded.osm_value,
  sort_order = excluded.sort_order,
  is_active = true;

update public.categories set name_ru = 'Финансы и почта' where slug = 'bank_post';

-- Тег типа вместо общего тега группы. Остальное тело функции прежнее (0001).
create or replace function public.build_place_osm_tags(place_row public.places)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  category_tags jsonb := '{}'::jsonb;
  type_tags jsonb;
  tags jsonb := '{}'::jsonb;
begin
  select c.osm_tags into category_tags from public.categories c where c.slug = place_row.category;

  select jsonb_build_object(t.osm_key, t.osm_value) into type_tags
  from public.place_types t
  where t.category = place_row.category
    and lower(t.name_ru) = lower(btrim(place_row.details -> 'mapper' ->> 'subtype'));

  tags := coalesce(type_tags, category_tags, '{}'::jsonb);

  if place_row.status = 'green' then
    tags := tags || jsonb_build_object('wheelchair', 'yes');
  elsif place_row.status = 'yellow' then
    tags := tags || jsonb_build_object('wheelchair', 'limited');
  elsif place_row.status = 'red' then
    tags := tags || jsonb_build_object('wheelchair', 'no');
  elsif place_row.status = 'gray' then
    tags := tags || jsonb_build_object('wheelchair', 'unknown');
  end if;

  if coalesce(place_row.entrance_notes, place_row.comment) is not null then
    tags := tags || jsonb_build_object('wheelchair:description', coalesce(place_row.entrance_notes, place_row.comment));
  end if;
  if place_row.steps_count is not null then
    tags := tags || jsonb_build_object('step_count', place_row.steps_count::text);
    if place_row.steps_count = 0 then
      tags := tags || jsonb_build_object('entrance', 'yes');
    end if;
  end if;
  if place_row.ramp_type = 'permanent' then
    tags := tags || jsonb_build_object('ramp', 'yes', 'ramp:wheelchair', 'yes');
  elsif place_row.ramp_type in ('portable_on_request', 'portable_available') then
    tags := tags || jsonb_build_object('ramp:portable', 'yes');
  end if;
  if place_row.door_width_cm is not null then
    tags := tags || jsonb_build_object('door:width', trim(to_char(place_row.door_width_cm::numeric / 100, 'FM999999990.00')));
  end if;
  if place_row.toilet_exists = 'yes' then
    tags := tags || jsonb_build_object('toilets', 'yes');
  end if;
  if place_row.toilet_accessible = 'yes' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'yes');
  elsif place_row.toilet_accessible = 'partial' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'limited');
  elsif place_row.toilet_accessible = 'no' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'no');
  end if;

  return tags;
end;
$$;

-- Карточки старой группы «Туалеты»: общественный туалет как тип. Обновление
-- проходит через триггер и пересчитывает osm_tags.
update public.places
set
  category = 'government',
  details = jsonb_set(
    jsonb_set(coalesce(details, '{}'::jsonb), '{mapper}', coalesce(details -> 'mapper', '{}'::jsonb), true),
    '{mapper,subtype}', '"Общественный туалет"'::jsonb, true)
where category = 'toilets';

update public.categories set is_active = false where slug = 'toilets';
