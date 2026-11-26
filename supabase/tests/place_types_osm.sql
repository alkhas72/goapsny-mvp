-- Проверка: классификатор по OpenStreetMap (миграция 20261125180000).
-- Запуск на чистой базе после всех миграций:
--   psql -v ON_ERROR_STOP=1 -d <база> -f supabase/tests/place_types_osm.sql
-- Скрипт ничего не оставляет: всё в одной транзакции с откатом в конце.

begin;

do $$
declare
  v_tags jsonb;
  v_id uuid;
begin
  -- 1. Групп одиннадцать, «Туалеты» выключены, типы есть у каждой группы.
  if (select count(*) from public.categories where is_active) <> 11 then
    raise exception 'ожидалось 11 включённых групп, есть %', (select count(*) from public.categories where is_active);
  end if;
  if (select is_active from public.categories where slug = 'toilets') then
    raise exception 'группа toilets должна быть выключена';
  end if;
  if exists (
    select 1 from public.categories c
    where c.is_active and not exists (select 1 from public.place_types t where t.category = c.slug)
  ) then
    raise exception 'есть включённая группа без типов';
  end if;
  if (select category || ':' || osm_key || '=' || osm_value from public.place_types where name_ru = 'Аптека')
     <> 'health:amenity=pharmacy' then
    raise exception 'Аптека должна быть health:amenity=pharmacy';
  end if;
  if (select osm_key || '=' || osm_value from public.place_types where name_ru = 'Общественный туалет')
     <> 'amenity=toilets' then
    raise exception 'Общественный туалет должен быть amenity=toilets';
  end if;

  -- 2. Карточка с типом получает тег типа, а не общий тег группы.
  insert into public.places (name, category, lat, lng, status, details)
  values ('Проверка: аптека', 'health', 43.0, 41.0, 'gray',
          '{"schema_version":1,"mapper":{"subtype":"Аптека"}}'::jsonb)
  returning id, osm_tags into v_id, v_tags;
  if v_tags ->> 'amenity' <> 'pharmacy' then
    raise exception 'ожидался amenity=pharmacy, есть %', v_tags;
  end if;

  -- 3. Карточка без типа получает тег группы, как раньше.
  insert into public.places (name, category, lat, lng, status)
  values ('Проверка: без типа', 'health', 43.0, 41.0, 'gray')
  returning osm_tags into v_tags;
  if v_tags = '{}'::jsonb or v_tags ->> 'wheelchair' <> 'unknown' then
    raise exception 'карточка без типа потеряла теги: %', v_tags;
  end if;

  -- 4. Тип чужой группы не подставляется.
  insert into public.places (name, category, lat, lng, status, details)
  values ('Проверка: чужой тип', 'food', 43.0, 41.0, 'gray',
          '{"schema_version":1,"mapper":{"subtype":"Аптека"}}'::jsonb)
  returning osm_tags into v_tags;
  if v_tags ->> 'amenity' = 'pharmacy' then
    raise exception 'тип чужой группы попал в теги: %', v_tags;
  end if;
end $$;

rollback;
