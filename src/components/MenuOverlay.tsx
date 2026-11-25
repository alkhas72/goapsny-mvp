import { useEffect, useRef, type RefObject } from 'react';
import { MapPinPlus, Ruler, X } from 'lucide-react';
import { trapFocus } from '../utils/focusTrap';
import type { MapLayer } from '../utils/mapLayer';
import { currentSkin } from '../utils/skin';
import { MOOD_META, useMood } from '../utils/useMood';
import { MoodPicker } from './MoodPicker';

interface MenuOverlayProps {
  open: boolean;
  onClose: () => void;
  onAddLocation: () => void;
  /** Вход в слой замеров: та же карта, но с замером входа и заявкой на пандус. */
  onOrderRamp: () => void;
  /** Какой слой карты сейчас открыт. */
  layer?: MapLayer;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const MENU_ITEMS = [
  { id: 'community', label: 'Сообщество' },
  { id: 'news', label: 'Новости' },
] as const;

/** Строка меню «Фон»: выбор цвета оболочки прямо в приложении (только в новом виде). */
function MenuMoodRow() {
  const [mood] = useMood();
  return (
    <div className="menu-mood-row">
      <span className="menu-mood-label">
        Фон <span className="menu-mood-name">{MOOD_META[mood].label}</span>
      </span>
      <MoodPicker className="menu-moods" itemClassName="menu-mood" />
    </div>
  );
}

export function MenuOverlay({
  open,
  onClose,
  onAddLocation,
  onOrderRamp,
  layer = 'access',
  returnFocusRef,
}: MenuOverlayProps) {
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
          {/* Два главных входа: карта одна, слои разные. */}
          <li>
            <button
              type="button"
              className="menu-link menu-link--primary menu-layer menu-layer--access"
              aria-current={layer === 'access' ? 'true' : undefined}
              onClick={onAddLocation}
            >
              <MapPinPlus size={22} aria-hidden="true" />
              <span className="menu-layer-text">Добавить локацию</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="menu-link menu-layer menu-layer--ramps"
              aria-current={layer === 'ramps' ? 'true' : undefined}
              onClick={onOrderRamp}
            >
              <Ruler size={22} aria-hidden="true" />
              <span className="menu-layer-text">Заказать пандус</span>
            </button>
          </li>
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button type="button" className="menu-link menu-link--disabled" disabled aria-disabled="true">
                {item.label} <span className="menu-soon">(скоро)</span>
              </button>
            </li>
          ))}
          {currentSkin() === 'living' && (
            <li>
              <MenuMoodRow />
            </li>
          )}
          <li>
            <span className="menu-muted">Вход для волонтёров — Telegram</span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
