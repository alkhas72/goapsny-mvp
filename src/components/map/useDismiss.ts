import { useEffect, type RefObject } from 'react';

/**
 * Closes a map popover on Escape and on a tap outside it. Escape returns
 * focus to the trigger; an outside tap does too when focus was inside the
 * popover and the tap did not move it elsewhere (a tapped pin keeps it).
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  popoverRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The popover is on top: Escape is for it, not for a sheet beneath.
      event.stopPropagation();
      close();
      triggerRef.current?.focus({ preventScroll: true });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      const focusInside = popoverRef.current?.contains(document.activeElement) ?? false;
      close();
      if (!focusInside) return;
      // After the tap settles: if nothing else took focus, give it back to
      // the trigger instead of losing it to the page.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body || popoverRef.current?.contains(active)) {
          triggerRef.current?.focus({ preventScroll: true });
        }
      }, 0);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, close, popoverRef, triggerRef]);
}
