interface MapFooterProps {
  onCabinet: () => void;
  onDisabledLink: (label: string) => void;
}

export function MapFooter({ onCabinet, onDisabledLink }: MapFooterProps) {
  return (
    <footer className="public-bottom-rail" aria-label="Внешние ссылки">
      <button
        type="button"
        className="footer-link footer-link--disabled"
        disabled
        aria-disabled="true"
        onClick={() => onDisabledLink('Instagram')}
      >
        Instagram
      </button>
      <button
        type="button"
        className="footer-link footer-link--disabled"
        disabled
        aria-disabled="true"
        onClick={() => onDisabledLink('Telegram')}
      >
        Telegram
      </button>
      <button type="button" className="footer-cabinet-btn" onClick={onCabinet}>
        Кабинет
      </button>
      <button
        type="button"
        className="footer-link footer-link--disabled"
        disabled
        aria-disabled="true"
        onClick={() => onDisabledLink('Сайт')}
      >
        Сайт
      </button>
    </footer>
  );
}
