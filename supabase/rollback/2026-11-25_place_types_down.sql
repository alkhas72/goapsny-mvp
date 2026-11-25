-- Откат миграции 20261125180000_place_types_osm.sql.
--
-- Запускать только по слову Алхаса. Всё идёт одной транзакцией.
--
-- Что возвращается: группа «Туалеты» снова включена, «Финансы и почта» снова
-- «Финансы», build_place_osm_tags() берёт только тег группы (как в 0001),
-- таблица place_types удаляется.
-- Что НЕ возвращается: карточки общественных туалетов остаются в группе
-- «Госучреждения» с типом «Общественный туалет» — вернуть их в 'toilets'
-- можно запросом в конце файла, он закомментирован.

begin;

update public.categories set is_active = true where slug = 'toilets';
update public.categories set name_ru = 'Финансы' where slug = 'bank_post';

create or replace function public.build_place_osm_tags(place_row public.places)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  category_tags jsonb := '{}'::jsonb;
  tags jsonb := '{}'::jsonb;
begin
  select c.osm_tags into category_tags from public.categories c where c.slug = place_row.category;
  tags := coalesce(category_tags, '{}'::jsonb);

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

drop table if exists public.place_types;

-- Пересчитать osm_tags по прежнему правилу.
update public.places set updated_at = updated_at;

-- update public.places set category = 'toilets'
-- where category = 'government' and details -> 'mapper' ->> 'subtype' = 'Общественный туалет';

commit;
