import { PublicApp } from './PublicApp.tsx';
import { TelegramApp } from './TelegramApp.tsx';
import { telegram } from './utils/telegram';

/**
 * П-15: единая точка входа обоих режимов (DG-1, контракт №3 от 17.07 —
 * «два входа в одну сессионную модель»). Два входа в одну оболочку:
 * - Telegram Mini App (`window.Telegram.WebApp.initData` непустой) → `TelegramApp`
 *   (июньское лицо продукта);
 * - публичный PWA/браузер → `PublicApp` (сохранённая публичная оболочка; её
 *   shell-логика вливается в общее лицо партиями П-16…П-19, отдельным
 *   финальным лицом не является).
 * Детект безопасный: любая ошибка чтения Telegram-глобала → публичный fallback.
 */
function isTelegramEnvironment(): boolean {
  try {
    return telegram.isTelegram();
  } catch {
    return false;
  }
}

export function App() {
  return isTelegramEnvironment() ? <TelegramApp /> : <PublicApp />;
}
