/**
 * Ссылки в Stopgap: отдельное приложение замера входа и заявки на приставной пандус.
 *
 * С 26.11 (решение Арбитра) карта и Stopgap снова два отдельных приложения:
 * карта остаётся картой, в меню стоит карточка «Приставные пандусы», она
 * открывает Stopgap отдельной страницей. Копии мастера внутри карты нет.
 *
 * Формат ссылки (goapsny-stopgap, data/README.md):
 * ?measure=1&mode=wizard&place_id=<uuid>&name=…&address=…&lat=…&lng=…&return=<адрес>.
 * `mode=wizard` открывает сразу мастер, без конструктора. Адрес возврата Stopgap
 * принимает только по https и только на свои и наши узлы.
 */
const DEFAULT_STOPGAP_URL = 'https://goapsny-stopgap.vercel.app/';

export const STOPGAP_URL: string = (import.meta.env.VITE_STOPGAP_URL as string | undefined) || DEFAULT_STOPGAP_URL;

export interface MeasureTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}

function wizardUrl(returnUrl: string | null, base: string): URL {
  const url = new URL(base);
  url.searchParams.set('measure', '1');
  url.searchParams.set('mode', 'wizard');
  if (returnUrl && returnUrl.startsWith('https://')) url.searchParams.set('return', returnUrl);
  return url;
}

/** Карточка меню «Приставные пандусы»: Stopgap сразу в мастере, с кнопкой возврата на карту. */
export function stopgapAppUrl(returnUrl: string | null, base: string = STOPGAP_URL): string {
  return wizardUrl(returnUrl, base).toString();
}

/** «Замерить вход» из карточки места: мастер с уже заполненным местом. */
export function stopgapMeasureUrl(
  place: MeasureTarget,
  returnUrl: string | null,
  base: string = STOPGAP_URL,
): string {
  const url = wizardUrl(returnUrl, base);
  url.searchParams.set('place_id', place.id);
  url.searchParams.set('name', place.name);
  const address = place.address?.trim();
  if (address) url.searchParams.set('address', address);
  url.searchParams.set('lat', place.lat.toFixed(6));
  url.searchParams.set('lng', place.lng.toFixed(6));
  return url.toString();
}
