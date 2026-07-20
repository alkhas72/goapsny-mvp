// Загрузка Telegram Web App SDK по требованию.
//
// Раньше SDK подключался синхронным <script> в <head>, то есть КАЖДЫЙ
// посетитель публичной карты ждал ответа telegram.org до первой отрисовки.
// Там, где домен недоступен или медленный, это давало белый экран — при том
// что публичному входу SDK не нужен вовсе.
//
// Telegram при запуске Mini App всегда передаёт параметры tgWebApp* в hash
// или query. По ним и решаем, нужен ли SDK.

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
const SDK_TIMEOUT_MS = 5000;

/** Похоже ли, что страница открыта как Telegram Mini App. */
export function looksLikeTelegramLaunch(location: { hash: string; search: string }): boolean {
  return location.hash.includes('tgWebApp') || location.search.includes('tgWebApp');
}

/**
 * Подключает SDK и ждёт его не дольше SDK_TIMEOUT_MS. Таймаут важен:
 * зависший запрос к telegram.org не должен держать приложение — лучше
 * отрисовать публичный вид, чем не отрисовать ничего.
 */
export function loadTelegramSdk(timeoutMs = SDK_TIMEOUT_MS): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (window.Telegram?.WebApp) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);

    window.setTimeout(() => finish(false), timeoutMs);
  });
}

/** Грузит SDK только если запуск действительно телеграмный. */
export async function ensureTelegramSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!looksLikeTelegramLaunch(window.location)) return false;
  return await loadTelegramSdk();
}
