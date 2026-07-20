-- T1: sprint category mapping (OBJECT-CONTRACT §4)

insert into public.categories (
  slug,
  name_ru,
  wheelmap_group,
  osm_tags,
  icon,
  sort_order,
  is_active
)
values
  ('toilets', 'Туалеты', 'toilets', '{"amenity":"toilets"}'::jsonb, 'toilet', 115, true)
on conflict (slug) do update
set
  name_ru = excluded.name_ru,
  wheelmap_group = excluded.wheelmap_group,
  osm_tags = excluded.osm_tags,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

update public.categories
set
  name_ru = case slug
    when 'shops' then 'Магазины'
    when 'food' then 'Еда и напитки'
    when 'public_transport' then 'Транспорт'
    when 'tourism' then 'Достопримечательности'
    when 'leisure' then 'Культура'
    when 'accommodation' then 'Гостиницы'
    when 'education' then 'Обучение'
    when 'government' then 'Госучреждения'
    when 'health' then 'Здоровье'
    when 'bank_post' then 'Финансы'
    when 'sport' then 'Спорт'
    when 'toilets' then 'Туалеты'
    else name_ru
  end,
  is_active = case when slug = 'other' then false else is_active end
where slug in (
  'shops', 'food', 'public_transport', 'tourism', 'leisure',
  'accommodation', 'education', 'government', 'health', 'bank_post',
  'sport', 'toilets', 'other'
);
