const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
  );
}

export function trapFocus(
  container: HTMLElement,
  options?: { onEscape?: () => void; initialFocus?: HTMLElement | null },
): () => void {
  const focusable = getFocusableElements(container);
  const first = options?.initialFocus ?? focusable[0] ?? null;
  first?.focus();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options?.onEscape?.();
      return;
    }
    if (event.key !== 'Tab' || focusable.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      focusable[focusable.length - 1]?.focus();
    } else if (!event.shiftKey && active === focusable[focusable.length - 1]) {
      event.preventDefault();
      first?.focus();
    }
  };

  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}
