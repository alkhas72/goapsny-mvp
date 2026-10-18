/** Lab wins over mapper and Telegram. No fuzzy/truthy flag matching. */
export function isLabMode(search: string): boolean {
  return new URLSearchParams(search).get('lab') === '1';
}
