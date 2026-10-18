import { getFocusableElements } from '../utils/focusTrap';

/** Lab-only trap: forms change their focusable controls while the card is open. */
export function trapLabFocus(container: HTMLElement, options: { initialFocus?: HTMLElement | null; onEscape: () => void }) {
  const previous = document.activeElement as HTMLElement | null;
  const controls = () => getFocusableElements(container);
  const first = () => controls()[0] ?? container;
  (options.initialFocus ?? first()).focus();
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); options.onEscape(); return; }
    if (event.key !== 'Tab') return;
    if (!container.contains(document.activeElement)) { event.preventDefault(); first().focus(); return; }
    const elements = controls();
    if (!elements.length) { event.preventDefault(); container.focus(); return; }
    const active = document.activeElement;
    if (event.shiftKey && active === elements[0]) {
      event.preventDefault(); elements[elements.length - 1].focus();
    } else if (!event.shiftKey && active === elements[elements.length - 1]) {
      event.preventDefault(); elements[0].focus();
    }
  };
  const focusin = (event: FocusEvent) => {
    if (!container.contains(event.target as Node)) first().focus();
  };
  document.addEventListener('keydown', keydown);
  document.addEventListener('focusin', focusin);
  return () => {
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('focusin', focusin);
    if (previous?.isConnected) previous.focus();
  };
}
