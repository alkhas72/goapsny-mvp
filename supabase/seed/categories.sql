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
  ('public_transport', 'Общественный транспорт', 'public_transport', '{"public_transport":"station"}'::jsonb, 'bus', 10, true),
  ('food', 'Питание', 'food', '{"amenity":"restaurant"}'::jsonb, 'utensils', 20, true),
  ('leisure', 'Досуг', 'leisure', '{"leisure":"yes"}'::jsonb, 'ticket', 30, true),
  ('bank_post', 'Банки и почта', 'bank_post', '{"amenity":"bank"}'::jsonb, 'landmark', 40, true),
  ('shops', 'Магазины', 'shops', '{"shop":"yes"}'::jsonb, 'shopping-bag', 50, true),
  ('education', 'Образование', 'education', '{"amenity":"school"}'::jsonb, 'graduation-cap', 60, true),
  ('sport', 'Спорт', 'sport', '{"leisure":"sports_centre"}'::jsonb, 'dumbbell', 70, true),
  ('tourism', 'Туризм', 'tourism', '{"tourism":"attraction"}'::jsonb, 'map', 80, true),
  ('accommodation', 'Гостиницы', 'accommodation', '{"tourism":"hotel"}'::jsonb, 'hotel', 90, true),
  ('government', 'Госучреждения', 'government', '{"office":"government"}'::jsonb, 'building-2', 100, true),
  ('health', 'Здравоохранение', 'health', '{"amenity":"clinic"}'::jsonb, 'hospital', 110, true),
  ('other', 'Прочее', 'other', '{}'::jsonb, 'map-pin', 999, true)
on conflict (slug) do update
set
  name_ru = excluded.name_ru,
  wheelmap_group = excluded.wheelmap_group,
  osm_tags = excluded.osm_tags,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
