import type { AccessibilityStatus } from '../shared/index';
import { CATEGORIES, STATUS_META } from '../shared/index';
import { distanceMeters } from '../utils/geo';
import { stepsText } from '../utils/accessText';
import { rampLabel, type PlaceFilters, type PublicPlace } from '../services/places';
import type { MapBounds } from './map/types';

/** Order of the quick status chips under the search bar. */
export const STATUS_ORDER: AccessibilityStatus[] = ['green', 'yellow', 'red', 'gray'];

/** Short chip labels: the chip row has to fit a 360 px phone. */
export const STATUS_CHIP_LABEL: Record<AccessibilityStatus, string> = {
  green: 'Доступно',
  yellow: 'Частично',
  red: 'Недоступно',
  gray: 'Не оценено',
};

/** Full status wording for list rows and the legend. */
export const STATUS_WORD: Record<AccessibilityStatus, string> = {
  green: STATUS_META.green.ru,
  yellow: 'Частично доступно',
  red: STATUS_META.red.ru,
  gray: STATUS_META.gray.ru,
};

export function categoryName(slug: string): string | null {
  return CATEGORIES.find((item) => item.slug === slug)?.ru ?? null;
}

export function isInBounds(point: { lat: number; lng: number }, bounds: MapBounds): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/** Places inside the visible map area. Before the map reports its area, every place counts. */
export function placesInView<T extends { lat: number; lng: number }>(places: T[], bounds: MapBounds | null): T[] {
  if (!bounds) return places;
  return places.filter((place) => isInBounds(place, bounds));
}

/** Visible area taller than this (degrees of latitude) is not a close-up of one place. */
export const CLOSE_UP_MAX_SPAN = 0.05;

/** True when the camera does not show the place up close. */
export function cameraNeedsPlace(place: { lat: number; lng: number }, bounds: MapBounds): boolean {
  return !isInBounds(place, bounds) || bounds.north - bounds.south > CLOSE_UP_MAX_SPAN;
}

export function boundsCenter(bounds: MapBounds): { lat: number; lng: number } {
  return { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
}

/** Nearest to the given point first; equal distances keep the name order. */
export function sortByDistance<T extends { lat: number; lng: number; name: string }>(
  places: T[],
  center: { lat: number; lng: number } | null,
): T[] {
  if (!center) return [...places].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return places
    .map((place) => ({ place, distance: distanceMeters(center, place) }))
    .sort((a, b) => a.distance - b.distance || a.place.name.localeCompare(b.place.name, 'ru'))
    .map((item) => item.place);
}

export type StatusCounts = Record<AccessibilityStatus | 'all', number>;

export function countByStatus(places: { status: AccessibilityStatus }[]): StatusCounts {
  const counts: StatusCounts = { all: places.length, green: 0, yellow: 0, red: 0, gray: 0 };
  for (const place of places) counts[place.status] += 1;
  return counts;
}

/** Category and text filters only: the status chips count against this set. */
export function withoutStatus(filters: PlaceFilters): PlaceFilters {
  return { ...filters, status: 'all' };
}

export function hasActiveFilter(filters: PlaceFilters): boolean {
  return filters.status !== 'all' || filters.categories.length > 0 || filters.query.trim() !== '';
}

export const EMPTY_FILTERS: PlaceFilters = { categories: [], status: 'all', query: '' };

export type EmptyStateKind = 'none' | 'filtered' | 'blank';

/** Which notice the map shows when the visible area has no places. */
export function emptyStateKind(input: {
  loadState: 'loading' | 'ready' | 'error';
  boundsKnown: boolean;
  inViewCount: number;
  filters: PlaceFilters;
}): EmptyStateKind {
  if (input.loadState !== 'ready' || !input.boundsKnown || input.inViewCount > 0) return 'none';
  return hasActiveFilter(input.filters) ? 'filtered' : 'blank';
}

/**
 * One line about the entrance, only from measured data:
 * steps first (with the ramp when there are steps), then door width, then ramp.
 */
export function entranceDetail(
  place: Pick<PublicPlace, 'stepsCount' | 'doorWidthCm' | 'rampType'>,
): string | null {
  const ramp = place.rampType && place.rampType !== 'none' ? rampLabel(place.rampType) : null;
  if (place.stepsCount != null) {
    const steps = stepsText(place.stepsCount);
    if (place.stepsCount > 0 && ramp) return `${steps} · ${ramp.toLowerCase()}`;
    return steps;
  }
  if (place.doorWidthCm != null) return `Дверь ${place.doorWidthCm} см`;
  return ramp;
}

export const PLACE_PARAM = 'place';

export function readPlaceParam(search: string): string | null {
  const value = new URLSearchParams(search).get(PLACE_PARAM);
  return value && value.trim() ? value.trim() : null;
}

/** Same address with `?place=<id>` set or removed; other parameters stay. */
export function withPlaceParam(href: string, placeId: string | null): string {
  const url = new URL(href);
  if (placeId) url.searchParams.set(PLACE_PARAM, placeId);
  else url.searchParams.delete(PLACE_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function syncPlaceParam(placeId: string | null): void {
  if (typeof window === 'undefined') return;
  const next = withPlaceParam(window.location.href, placeId);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  try {
    window.history.replaceState(window.history.state, '', next);
  } catch {
    // Some embedded webviews forbid history changes; the card still opens.
  }
}

/** «1 место», «3 места», «7 мест». */
export function placesWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'место';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места';
  return 'мест';
}
