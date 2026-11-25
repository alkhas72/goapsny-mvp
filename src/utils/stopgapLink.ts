/**
 * Ссылка «Замерить вход»: открывает мастер замера с уже заполненным местом.
 * Формат прежний, от отдельного Stopgap (data/README.md):
 * ?measure=1&place_id=<uuid>&name=…&address=…&lat=…&lng=…&return=<адрес>.
 * Мастер принимает return только по https и только на свои и наши узлы.
 *
 * С 25.11 (решение Арбитра: одно приложение) мастер замера живёт внутри карты,
 * в папке `public/zamer/`, по адресу `/zamer/` того же сайта. Отдельный
 * Stopgap (goapsny-stopgap.vercel.app) остаётся как прежняя версия и точка
 * отката: вернуть ссылку на него можно переменной VITE_STOPGAP_URL.
 */
export const ZAMER_PATH = '/zamer/';

function defaultBase(): string {
  const fromEnv = import.meta.env.VITE_STOPGAP_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://map.goapsny.org';
  return new URL(ZAMER_PATH, origin).toString();
}

export const STOPGAP_URL: string = defaultBase();

export interface MeasureTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}

export function stopgapMeasureUrl(
  place: MeasureTarget,
  returnUrl: string | null,
  base: string = STOPGAP_URL,
): string {
  const url = new URL(base);
  url.searchParams.set('measure', '1');
  url.searchParams.set('place_id', place.id);
  url.searchParams.set('name', place.name);
  const address = place.address?.trim();
  if (address) url.searchParams.set('address', address);
  url.searchParams.set('lat', place.lat.toFixed(6));
  url.searchParams.set('lng', place.lng.toFixed(6));
  if (returnUrl && returnUrl.startsWith('https://')) url.searchParams.set('return', returnUrl);
  return url.toString();
}

/**
 * Слой замеров: замер входа в точке карты, когда места в базе ещё нет.
 * Stopgap открывает мастер и без place_id, по одним координатам.
 */
export function stopgapMeasurePointUrl(
  point: { lat: number; lng: number } | null,
  returnUrl: string | null,
  base: string = STOPGAP_URL,
): string {
  const url = new URL(base);
  url.searchParams.set('measure', '1');
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    url.searchParams.set('lat', point.lat.toFixed(6));
    url.searchParams.set('lng', point.lng.toFixed(6));
  }
  if (returnUrl && returnUrl.startsWith('https://')) url.searchParams.set('return', returnUrl);
  return url.toString();
}
