export const AUDITOR_ROLES = ["tester", "operator", "admin", "owner"] as const;
export const FINAL_STATUSES = ["green", "yellow", "red"] as const;
export const GRAY_PAGE_SIZE = 5;
export const PHOTO_BUCKET = "place-photos";
export const FACADE_KIND = "facade";

export const CATEGORY_LABELS: Record<string, string> = {
  shops: "Магазины",
  food: "Еда и напитки",
  public_transport: "Транспорт",
  tourism: "Достопримечательности",
  leisure: "Культура",
  accommodation: "Гостиницы",
  education: "Обучение",
  government: "Госучреждения",
  health: "Здоровье",
  bank_post: "Финансы",
  sport: "Спорт",
  toilets: "Туалеты",
};

export const STATUS_LABELS: Record<string, string> = {
  green: "Доступно",
  yellow: "Частично",
  red: "Недоступно",
  gray: "Ещё не оценено",
};

export const RAMP_LABELS: Record<string, string> = {
  none: "Нет",
  permanent: "Стационарный",
  portable_on_request: "Приставной по запросу",
  portable_available: "Приставной есть",
};

export const ACTIVE_CATEGORY_SLUGS = Object.keys(CATEGORY_LABELS);
