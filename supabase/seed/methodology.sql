insert into public.accessibility_statuses (
  slug,
  name_ru,
  description_ru,
  wheelchair_tag,
  operator_selectable,
  sort_order
)
values
  ('green', 'Доступно', 'Вход, зал и туалет, если он есть, доступны для человека на коляске.', 'yes', true, 10),
  ('yellow', 'Частично', 'Въезд возможен, но есть ограничения внутри, недоступный туалет, приставной пандус или нужна минимальная помощь.', 'limited', true, 20),
  ('red', 'Недоступно', 'Входная группа недоступна.', 'no', true, 30),
  ('gray', 'Не обследовано', 'Зарезервировано для импортов и будущих публичных точек. Оператору в v1 не предлагается.', 'unknown', false, 99)
on conflict (slug) do update
set
  name_ru = excluded.name_ru,
  description_ru = excluded.description_ru,
  wheelchair_tag = excluded.wheelchair_tag,
  operator_selectable = excluded.operator_selectable,
  sort_order = excluded.sort_order;
