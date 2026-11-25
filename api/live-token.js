// Помощник координатора: Gemini Live, голос и камера.
//
// Браузер не получает ключ Google. Функция проверяет, что вошёл координатор
// района, администратор или владелец, и выпускает одноразовый короткий
// токен; с ним браузер сам открывает разговор с моделью. Настройка разговора
// (модель, указание, функция замера) зашита в токен, см. _lib/live.js.

import { ApiError, LIVE_ROLES, authenticate, handler, rateLimit } from './_lib/core.js';
import { START_WINDOW_MS, createLiveToken } from './_lib/live.js';

export { DEFAULT_LIVE_MODEL, TOKEN_URL } from './_lib/live.js';

export async function liveToken(req, { fetchImpl = fetch, env = process.env, now = () => Date.now() } = {}) {
  const who = await authenticate(req, { fetchImpl, env });
  if (!LIVE_ROLES.includes(who.role)) throw new ApiError(403, 'coordinator_required');
  if (!env.GEMINI_API_KEY) throw new ApiError(503, 'live_not_configured');
  rateLimit(`live:${who.id}`, 20, now());

  const issued = await createLiveToken({ fetchImpl, env, now });
  if (!issued.ok) {
    // В тексте отказа ключа нет: это ответ Google о запросе или о правах ключа.
    console.error('[live-token]', issued.status, issued.detail);
    if (issued.status === 401 || issued.status === 403) throw new ApiError(503, 'live_key_rejected');
    throw new ApiError(502, 'live_failed');
  }
  return {
    body: { token: issued.token, model: issued.model, expiresAt: new Date(now() + START_WINDOW_MS).toISOString() },
  };
}

export default handler((req) => liveToken(req));
