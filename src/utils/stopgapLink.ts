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
