/** Значок Instagram: контур, цвет от текста. */
export function InstagramIcon() {
  return (
    <svg
      className="footer-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Значок Telegram: бумажный самолётик, цвет от текста. */
export function TelegramIcon() {
  return (
    <svg className="footer-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        d="M20.9 3.6 3 10.6c-.9.36-.88 1.12.02 1.4l4.5 1.42 1.75 5.4c.2.62.74.78 1.2.34l2.5-2.4 4.5 3.3c.75.55 1.6.22 1.8-.7l3.1-14.3c.24-1.1-.5-1.82-1.47-1.46ZM9.1 13.2l8.5-5.6c.4-.26.62.1.3.4l-6.9 6.5-.6 3.2-1.3-4.5Z"
      />
    </svg>
  );
}
