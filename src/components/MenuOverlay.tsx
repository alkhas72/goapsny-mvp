import { useEffect, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { trapFocus } from '../utils/focusTrap';

interface MenuOverlayProps {
  open: boolean;
  onClose: () => void;
  onAddLocation: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const MENU_ITEMS = [
  { id: 'community', label: 'Сообщество' },
  { id: 'news', label: 'Новости' },
  { id: 'ramp', label: 'Заказать пандус' },
] as const;

export function MenuOverlay({ open, onClose, onAddLocation, returnFocusRef }: MenuOverlayProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    return trapFocus(panelRef.current, {
      initialFocus: closeButtonRef.current,
      onEscape: () => {
        onClose();
        returnFocusRef?.current?.focus();
      },
    });
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="overlay-scrim menu-scrim" onClick={onClose}>
      <nav
        ref={panelRef}
        className="menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="menu-panel-header">
          <span>Меню</span>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Закрыть меню"
            onClick={() => {
              onClose();
              returnFocusRef?.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <ul className="menu-list">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button type="button" className="menu-link menu-link--disabled" disabled aria-disabled="true">
                {item.label} <span className="menu-soon">(скоро)</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="menu-link menu-link--primary" onClick={onAddLocation}>
              Добавить локацию
            </button>
          </li>
          <li>
            <span className="menu-muted">Вход для волонтёров — Telegram</span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
