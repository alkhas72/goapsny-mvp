/**
 * Where to put a selected pin so the place card does not hide it.
 *
 * On a phone the card rises from the bottom and covers part of the map; the
 * pin goes to the middle of what stays visible above it. On a wide screen
 * the card is a side panel on the right; the pin shifts left.
 */

/** From this width the place card is a side panel, not a bottom sheet. */
export const WIDE_LAYOUT_PX = 768;

/** Pin height: the anchor is its tip, the body sits above it. */
const PIN_HEIGHT = 48;

/** Keep the pin below the map-look button in the top corner. */
const TOP_CLEARANCE = 72 + PIN_HEIGHT / 2;

/**
 * The card is found by its role, outside the map itself: a dialog docked to
 * the bottom edge of the map and spanning most of its width.
 */
export function findBottomCard(container: HTMLElement): HTMLElement | null {
  const parent = container.parentElement;
  if (!parent) return null;
  const mapRect = container.getBoundingClientRect();
  let found: HTMLElement | null = null;
  let foundTop = Infinity;
  parent.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((el) => {
    if (container.contains(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.bottom < mapRect.bottom - 4) return;
    if (r.width < mapRect.width * 0.6) return;
    if (r.top < foundTop) {
      foundTop = r.top;
      found = el;
    }
  });
  return found;
}

/** Pixels of the map hidden under a bottom card, 0 when there is none. */
export function coveredBottom(container: HTMLElement): number {
  const card = findBottomCard(container);
  if (!card) return 0;
  const mapRect = container.getBoundingClientRect();
  const top = Math.max(card.getBoundingClientRect().top, mapRect.top);
  return Math.max(0, Math.round(mapRect.bottom - top));
}

/** MapLibre camera offset for the selected pin. */
export function selectedPinOffset(width: number, height: number, covered: number): [number, number] {
  if (width <= 0 || height <= 0) return [0, 0];
  if (width >= WIDE_LAYOUT_PX) return [-Math.round(Math.min(380, width * 0.4) / 2), 0];
  // Card not measured yet: assume it takes half of the map.
  const cover = covered > 0 ? covered : Math.round(height / 2);
  const visible = Math.max(0, height - cover);
  const tipY = Math.max(TOP_CLEARANCE, Math.round(visible / 2 + PIN_HEIGHT / 2));
  return [0, Math.round(Math.min(tipY, height / 2) - height / 2)];
}
