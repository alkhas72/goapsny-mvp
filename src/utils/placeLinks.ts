import type { PlaceDetailsV1 } from '../services/places';

export interface RouteLink {
  id: 'yandex' | 'google' | 'apple';
  label: string;
  href: string;
}

/** Walking directions to the point in the three map apps people use here; Yandex first. */
export function routeLinks(lat: number, lng: number): RouteLink[] {
  const point = `${lat},${lng}`;
  return [
    { id: 'yandex', label: 'Яндекс Карты', href: `https://yandex.ru/maps/?rtext=~${point}&rtt=pd` },
    {
      id: 'google',
      label: 'Google Maps',
      href: `https://www.google.com/maps/dir/?api=1&destination=${point}&travelmode=walking`,
    },
    { id: 'apple', label: 'Apple Maps', href: `https://maps.apple.com/?daddr=${point}&dirflg=w` },
  ];
}

export interface ExternalLink {
  id: 'yandex' | 'google' | 'apple' | 'osm';
  short: string;
  label: string;
  href: string;
}

const EXTERNAL_ORDER: Omit<ExternalLink, 'href'>[] = [
  { id: 'yandex', short: 'Яндекс', label: 'Яндекс Карты' },
  { id: 'google', short: 'Google', label: 'Google Maps' },
  { id: 'apple', short: 'Apple', label: 'Apple Maps' },
  { id: 'osm', short: 'OSM', label: 'OpenStreetMap' },
];

/** Only the links the place really has, Yandex first; anything but http(s) is dropped. */
export function externalLinks(links: PlaceDetailsV1['external_links']): ExternalLink[] {
  if (!links) return [];
  return EXTERNAL_ORDER.flatMap((item) => {
    const href = links[item.id]?.trim();
    return href && /^https?:\/\//i.test(href) ? [{ ...item, href }] : [];
  });
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** System share sheet when the browser has one, otherwise the link goes to the clipboard. */
export async function sharePlace(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Any other refusal (no permission, unsupported data): fall back to copying.
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(data.url);
      return 'copied';
    } catch {
      // Clipboard API blocked (insecure context, permissions): try the legacy path.
    }
  }
  return copyWithTextarea(data.url) ? 'copied' : 'failed';
}

export type PlaceCardVariant = 'a' | 'b';

/** `?card=b` switches the place card to the photo-first layout. */
export function cardVariantFromSearch(search: string): PlaceCardVariant {
  return new URLSearchParams(search).get('card')?.toLowerCase() === 'b' ? 'b' : 'a';
}
