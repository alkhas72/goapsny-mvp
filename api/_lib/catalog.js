// Категории и типы объектов для подсказки модели. Копия src/shared/index.ts
// (CATEGORIES) и src/components/mapper/assistant.ts (SUBTYPES): серверная
// функция Vercel не собирается вместе с приложением и взять их оттуда не
// может. Расхождение ловит тест tests/api/catalog.test.ts.

export const CATEGORY_SLUGS = [
  'health',
  'food',
  'shops',
  'government',
  'bank_post',
  'education',
  'leisure',
  'tourism',
  'accommodation',
  'public_transport',
  'sport',
  'toilets',
];

export const SUBTYPES = {
  health: ['Аптека', 'Поликлиника', 'Больница', 'Стоматология', 'Лаборатория', 'Скорая помощь'],
  food: ['Кафе', 'Ресторан', 'Столовая', 'Кофейня', 'Пекарня'],
  shops: ['Продукты', 'Супермаркет', 'Одежда', 'Хозяйственный', 'Рынок'],
  government: ['Администрация', 'МФЦ', 'Суд', 'Паспортный стол', 'Пенсионный фонд', 'Полиция', 'Пожарная часть'],
  bank_post: ['Банк', 'Банкомат', 'Почта'],
  education: ['Школа', 'Детский сад', 'Университет', 'Колледж', 'Библиотека'],
  leisure: ['Театр', 'Музей', 'Кинотеатр', 'Дом культуры', 'Парк'],
  tourism: ['Памятник', 'Набережная', 'Смотровая площадка', 'Храм'],
  accommodation: ['Гостиница', 'Гостевой дом', 'Хостел'],
  public_transport: ['Остановка', 'Автовокзал', 'Вокзал', 'Причал', 'Парковка', 'АЗС', 'Зарядная станция', 'Автосервис'],
  sport: ['Стадион', 'Спортзал', 'Бассейн'],
  toilets: ['Общественный туалет'],
};

export const RAMP_TYPES = ['none', 'permanent', 'portable_on_request', 'portable_available', 'lift'];

/** Что принимает база (миграция 20261125090000). */
export const STEP_HEIGHT_RANGE = [0, 100];
export const DOOR_WIDTH_RANGE = [30, 500];
