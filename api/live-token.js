// Помощник координатора: Gemini Live, голос и камера.
//
// Браузер не получает ключ Google. Функция проверяет, что вошёл координатор
// района, администратор или владелец, и выпускает одноразовый короткий
// токен; с ним браузер сам открывает разговор с моделью.
//
// Проверено по документации Gemini Live API 25.11.2026: токен выдаёт
// POST /v1beta/auth_tokens с ключом в x-goog-api-key, сам токен приходит в
// поле name; по умолчанию минута на начало разговора.

import { ApiError, LIVE_ROLES, authenticate, handler, rateLimit } from './_lib/core.js';

export const TOKEN_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
export const DEFAULT_LIVE_MODEL = 'gemini-3.8-live';

/** Минута, чтобы начать разговор; полчаса на сам разговор. */
const START_WINDOW_MS = 60 * 1000;
const SESSION_WINDOW_MS = 30 * 60 * 1000;

export async function liveToken(req, { fetchImpl = fetch, env = process.env, now = () => Date.now() } = {}) {
  const who = await authenticate(req, { fetchImpl, env });
  if (!LIVE_ROLES.includes(who.role)) throw new ApiError(403, 'coordinator_required');
  if (!env.GEMINI_API_KEY) throw new ApiError(503, 'live_not_configured');
  rateLimit(`live:${who.id}`, 20, now());

  const model = env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now() + SESSION_WINDOW_MS).toISOString(),
      newSessionExpireTime: new Date(now() + START_WINDOW_MS).toISOString(),
      liveConnectConstraints: { model: `models/${model}` },
    }),
  });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new ApiError(503, 'live_key_rejected');
  }
  if (!response.ok) throw new ApiError(502, 'live_failed');
  const data = await response.json().catch(() => null);
  const token = typeof data?.name === 'string' ? data.name : '';
  if (!token) throw new ApiError(502, 'live_failed');
  return { body: { token, model, expiresAt: new Date(now() + START_WINDOW_MS).toISOString() } };
}

export default handler((req) => liveToken(req));
