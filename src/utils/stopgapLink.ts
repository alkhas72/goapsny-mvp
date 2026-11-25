/**
 * Ссылка «Замерить вход»: открывает мастер замера Stopgap с уже заполненным
 * местом. Формат согласован с Stopgap (goapsny-stopgap, data/README.md):
 * ?measure=1&place_id=<uuid>&name=…&address=…&lat=…&lng=…&return=<адрес>.
 * Stopgap принимает return только по https и только на свои и наши узлы.
 */
export const STOPGAP_URL: string =
  (import.meta.env.VITE_STOPGAP_URL as string | undefined) || 'https://goapsny-stopgap.vercel.app/';

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
