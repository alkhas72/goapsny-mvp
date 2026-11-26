import { useEffect, useRef, type RefObject } from 'react';
import { ChevronRight, MapPinPlus, Ruler, X } from 'lucide-react';
import { trapFocus } from '../utils/focusTrap';
import { currentSkin } from '../utils/skin';
import { MOOD_META, useMood } from '../utils/useMood';
import { MoodPicker } from './MoodPicker';
import { InstagramIcon, TelegramIcon } from './projectLinks';
import { PROJECT_LINKS } from '../utils/projectLinks';
import { stopgapAppUrl } from '../utils/stopgapLink';

interface MenuOverlayProps {
  open: boolean;
  onClose: () => void;
  onAddLocation: () => void;
  /** Ссылка на Stopgap включена флагом; выключенная карточка в меню не показана. */
  rampsAvailable?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Куда Stopgap возвращает человека: на карту, без случайных параметров адреса. */
function returnHome(): string {
  return new URL('/', window.location.href).toString();
}

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
  rampsAvailable = true,
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
          <li>
            <button type="button" className="menu-link menu-link--primary menu-layer menu-layer--access" onClick={onAddLocation}>
              <MapPinPlus size={22} aria-hidden="true" />
              <span className="menu-layer-text">Добавить локацию</span>
            </button>
          </li>
          {/* Stopgap — отдельное приложение: карточка открывает его своей страницей (решение Арбитра 26.11). */}
          {rampsAvailable && (
            <li>
              <a className="menu-link menu-layer menu-layer--ramps" href={stopgapAppUrl(returnHome())}>
                <Ruler size={22} aria-hidden="true" />
                <span className="menu-layer-text">
                  Приставные пандусы
                  <span className="menu-layer-note">Замер входа и заявка. Отдельное приложение</span>
                </span>
                <ChevronRight size={20} aria-hidden="true" className="menu-layer-go" />
              </a>
            </li>
          )}
          {currentSkin() === 'living' && (
            <li>
              <MenuMoodRow />
            </li>
          )}
          {/* Внешние ссылки проекта: с карты они убраны сюда (решение Арбитра 25.11). */}
          <li>
            <div className="menu-links-row" role="group" aria-label="GoApsny в сети">
              <a
                className="menu-ext-link"
                href={PROJECT_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram GoApsny"
              >
                <InstagramIcon />
                <span>Instagram</span>
              </a>
              <a
                className="menu-ext-link"
                href={PROJECT_LINKS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram GoApsny"
              >
                <TelegramIcon />
                <span>Telegram</span>
              </a>
              <a className="menu-ext-link" href={PROJECT_LINKS.site} target="_blank" rel="noopener noreferrer">
                <span>Сайт</span>
              </a>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}
