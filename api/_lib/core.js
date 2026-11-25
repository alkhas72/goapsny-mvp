// Общее для серверных функций помощника: кто вызвал, что прислал, как ответить.
//
// Ключи моделей живут только в переменных окружения проекта Vercel и в
// браузер не попадают. Вошедшего человека проверяет сам Supabase: функция
// спрашивает у него, чей это токен, и читает профиль от имени человека,
// сервисный ключ базы ей не нужен.

import { readFileSync } from 'node:fs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let devFile = null;

/** Публичные настройки Supabase из .env.development (они же лежат в бандле карты). */
function readDevFile() {
  if (devFile) return devFile;
  devFile = {};
  try {
    const text = readFileSync(new URL('../../.env.development', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) devFile[match[1]] = match[2].trim();
    }
  } catch {
    // Файла рядом с функцией нет: остаются только переменные окружения.
  }
  return devFile;
}

/** Адрес и публичный ключ Supabase. Превью-сборки берут их из .env.development. */
export function publicSupabase(env = process.env) {
  const file = env.SUPABASE_URL || env.VITE_SUPABASE_URL ? {} : readDevFile();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || file.VITE_SUPABASE_URL || '';
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || file.VITE_SUPABASE_ANON_KEY || '';
  return { url: url.replace(/\/+$/, ''), key };
}

export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/**
 * Кто вызвал функцию: id, роль и разрешение на помощника из профиля.
 * Отказы: 401 без входа, 403 без профиля, заблокированным и с выключенным ИИ.
 */
export async function authenticate(req, { fetchImpl = fetch, env = process.env } = {}) {
  const header = String(req.headers?.authorization ?? '');
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/.exec(header);
  if (!match) throw new ApiError(401, 'auth_required');
  const { url, key } = publicSupabase(env);
  if (!url || !key) throw new ApiError(503, 'not_configured');
  const headers = { apikey: key, Authorization: `Bearer ${match[1]}`, Accept: 'application/json' };

  const userResponse = await fetchImpl(`${url}/auth/v1/user`, { headers });
  if (!userResponse.ok) throw new ApiError(401, 'invalid_session');
  const user = await userResponse.json().catch(() => null);
  const id = typeof user?.id === 'string' ? user.id : '';
  if (!UUID.test(id)) throw new ApiError(401, 'invalid_session');

  const profileResponse = await fetchImpl(`${url}/rest/v1/profiles?id=eq.${id}&select=role,ai_enabled`, { headers });
  if (!profileResponse.ok) throw new ApiError(403, 'profile_not_found');
  const rows = await profileResponse.json().catch(() => null);
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile || typeof profile.role !== 'string') throw new ApiError(403, 'profile_not_found');
  if (profile.role === 'banned') throw new ApiError(403, 'banned');
  if (profile.ai_enabled === false) throw new ApiError(403, 'ai_not_enabled');
  return { id, role: profile.role };
}

/** Кому положен помощник с камерой и голосом (Gemini Live). */
export const LIVE_ROLES = ['coordinator', 'admin', 'owner'];

// Мягкий предел на человека. Память у каждой копии функции своя, поэтому это
// защита от зацикленного клиента, а не учёт расхода.
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

export function rateLimit(userId, limit, now = Date.now()) {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(userId, recent);
    throw new ApiError(429, 'too_many_requests');
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
}

export function resetRateLimit() {
  hits.clear();
}

/** Тело запроса: Vercel отдаёт уже разобранный JSON, но строку тоже принимаем. */
export function jsonBody(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      const parsed = JSON.parse(String(body));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Ниже общий отказ.
    }
  }
  throw new ApiError(400, 'bad_request');
}

/** Не больше ~3,4 МБ base64: предел тела функции Vercel 4,5 МБ. */
const IMAGE_MAX_CHARS = 3_400_000;

/** JPEG в base64, с префиксом data: или без него. null — картинки нет. */
export function jpegBase64(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, 'bad_image');
  const b64 = value.replace(/^data:image\/jpeg;base64,/, '');
  if (b64.length > IMAGE_MAX_CHARS) throw new ApiError(413, 'image_too_large');
  if (b64.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new ApiError(400, 'bad_image');
  return b64;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Обёртка функции: работа идёт по POST, отказы одним видом, чужие ошибки без
 * подробностей. GET отдаёт состояние подключения, если функция его объявила.
 */
export function handler(work, status = null) {
  return async function vercelHandler(req, res) {
    if (req.method === 'GET' && status) {
      try {
        return send(res, 200, await status(req));
      } catch (error) {
        if (error instanceof ApiError) return send(res, error.status, { error: error.code });
        console.error('[assistant]', error instanceof Error ? error.message : 'unknown error');
        return send(res, 500, { error: 'internal' });
      }
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'method_not_allowed' });
    }
    try {
      const { status = 200, body } = await work(req);
      return send(res, status, body);
    } catch (error) {
      if (error instanceof ApiError) return send(res, error.status, { error: error.code });
      console.error('[assistant]', error instanceof Error ? error.message : 'unknown error');
      return send(res, 500, { error: 'internal' });
    }
  };
}
