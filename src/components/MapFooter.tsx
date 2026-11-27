import { CircleUserRound } from 'lucide-react';

interface MapFooterProps {
  onCabinet: () => void;
  /** Сколько объектов ждут в кабинете: кружок с числом у входа в него. */
  waiting?: number;
}

/**
 * Низ экрана карты. Решение Арбитра 25.11: Instagram, Telegram и «Сайт» живут
 * в меню, на карте остаётся один вход в кабинет круглой кнопкой с числом ждущих.
 */
export function MapFooter({ onCabinet, waiting = 0 }: MapFooterProps) {
  return (
    <footer className="public-bottom-rail">
      <button
        type="button"
        className="footer-cabinet-btn"
        aria-label={waiting > 0 ? `Кабинет, ждут: ${waiting}` : 'Кабинет'}
        title="Кабинет"
        onClick={onCabinet}
      >
        <CircleUserRound size={24} aria-hidden="true" />
        <span className="footer-cabinet-text">Кабинет</span>
        {waiting > 0 && (
          <span className="footer-badge" aria-hidden="true">
            {waiting > 99 ? '99+' : waiting}
          </span>
        )}
      </button>
    </footer>
  );
}
