/**
 * Классификатор мест: группа → типы, каждый тип равен тегу OpenStreetMap.
 *
 * Решение Арбитра 25.11.2026: своё не придумываем, идём за OpenStreetMap.
 * Теги сверены с пресетами редактора iD (id-tagging-schema, версия 6).
 * Названия обиходные: у iD они технические («Территория больницы»).
 *
 * Тип хранится в карточке русским названием (`details.mapper.subtype`), так
 * его пишет путь картографа с 23.11. Серверная копия для подсказки модели —
 * `api/_lib/catalog.js`, таблица в базе — `public.place_types`
 * (миграция 20261125180000); расхождение ловят тесты.
 */
export interface PlaceType {
  /** Значение тега OSM, уникально в таблице. */
  slug: string;
  /** Группа: slug из CATEGORIES. */
  group: string;
  ru: string;
  osmKey: string;
  osmValue: string;
}

const t = (group: string, ru: string, osmKey: string, osmValue: string): PlaceType => ({
  slug: osmValue,
  group,
  ru,
  osmKey,
  osmValue,
});

export const PLACE_TYPES: PlaceType[] = [
  t('food', 'Кафе', 'amenity', 'cafe'),
  t('food', 'Ресторан', 'amenity', 'restaurant'),
  t('food', 'Быстрое питание', 'amenity', 'fast_food'),
  t('food', 'Бар', 'amenity', 'bar'),
  t('food', 'Пекарня', 'shop', 'bakery'),

  t('shops', 'Супермаркет', 'shop', 'supermarket'),
  t('shops', 'Продукты', 'shop', 'convenience'),
  t('shops', 'Одежда', 'shop', 'clothes'),
  t('shops', 'Хозяйственный', 'shop', 'hardware'),
  t('shops', 'Рынок', 'amenity', 'marketplace'),

  t('health', 'Аптека', 'amenity', 'pharmacy'),
  t('health', 'Поликлиника', 'amenity', 'clinic'),
  t('health', 'Больница', 'amenity', 'hospital'),
  t('health', 'Стоматология', 'amenity', 'dentist'),
  t('health', 'Врач', 'amenity', 'doctors'),
  t('health', 'Лаборатория', 'healthcare', 'laboratory'),
  t('health', 'Скорая помощь', 'emergency', 'ambulance_station'),

  t('education', 'Школа', 'amenity', 'school'),
  t('education', 'Детский сад', 'amenity', 'kindergarten'),
  t('education', 'Университет', 'amenity', 'university'),
  t('education', 'Колледж', 'amenity', 'college'),
  t('education', 'Библиотека', 'amenity', 'library'),

  t('government', 'Администрация', 'amenity', 'townhall'),
  t('government', 'Государственное учреждение', 'office', 'government'),
  t('government', 'Суд', 'amenity', 'courthouse'),
  t('government', 'Полиция', 'amenity', 'police'),
  t('government', 'Пожарная часть', 'amenity', 'fire_station'),
  t('government', 'Общественный туалет', 'amenity', 'toilets'),

  t('bank_post', 'Банк', 'amenity', 'bank'),
  t('bank_post', 'Банкомат', 'amenity', 'atm'),
  t('bank_post', 'Почта', 'amenity', 'post_office'),

  t('leisure', 'Театр', 'amenity', 'theatre'),
  t('leisure', 'Кинотеатр', 'amenity', 'cinema'),
  t('leisure', 'Музей', 'tourism', 'museum'),
  t('leisure', 'Дом культуры', 'amenity', 'community_centre'),
  t('leisure', 'Парк', 'leisure', 'park'),

  t('tourism', 'Памятник', 'historic', 'monument'),
  t('tourism', 'Достопримечательность', 'tourism', 'attraction'),
  t('tourism', 'Смотровая площадка', 'tourism', 'viewpoint'),
  t('tourism', 'Храм', 'amenity', 'place_of_worship'),

  t('accommodation', 'Гостиница', 'tourism', 'hotel'),
  t('accommodation', 'Гостевой дом', 'tourism', 'guest_house'),
  t('accommodation', 'Хостел', 'tourism', 'hostel'),

  t('public_transport', 'Остановка', 'highway', 'bus_stop'),
  t('public_transport', 'Автовокзал', 'amenity', 'bus_station'),
  t('public_transport', 'Вокзал', 'railway', 'station'),
  t('public_transport', 'Причал', 'amenity', 'ferry_terminal'),
  t('public_transport', 'Парковка', 'amenity', 'parking'),
  t('public_transport', 'АЗС', 'amenity', 'fuel'),
  t('public_transport', 'Зарядная станция', 'amenity', 'charging_station'),
  t('public_transport', 'Автосервис', 'shop', 'car_repair'),

  t('sport', 'Стадион', 'leisure', 'stadium'),
  t('sport', 'Спортзал', 'leisure', 'sports_centre'),
  t('sport', 'Бассейн', 'leisure', 'swimming_pool'),
];

/** Типы одной группы, в порядке показа. */
export function placeTypesOf(group: string): PlaceType[] {
  return PLACE_TYPES.filter((item) => item.group === group);
}

/** Русские названия типов по группам: так их выбирает картограф и помощник. */
export const PLACE_TYPE_NAMES: Record<string, string[]> = PLACE_TYPES.reduce<Record<string, string[]>>(
  (acc, item) => {
    (acc[item.group] ??= []).push(item.ru);
    return acc;
  },
  {},
);

/** Тип по названию, как оно записано в карточке; чужое название — null. */
export function placeTypeByName(name: string | null | undefined, group?: string): PlaceType | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  return (
    PLACE_TYPES.find((item) => item.ru.toLowerCase() === wanted && (!group || item.group === group)) ?? null
  );
}
