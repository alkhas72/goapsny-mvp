import { isSupabaseConfigured } from './supabase';

/**
 * Вызовы серверных функций помощника (`api/assistant.js`, `api/live-token.js`).
 *
 * Ключи моделей лежат на сервере. Браузер предъявляет только свой вход:
 * токен Supabase вошедшего человека.
 */

export class AssistantApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.name = 'AssistantApiError';
    this.code = code;
    this.status = status;
  }
}

export interface AssistantApiOptions {
  /** Токен вошедшего человека; null — никто не вошёл. Подменяется в тестах. */
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function sessionToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseClient } = await import('./supabase');
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function postAssistant<T>(
  path: '/api/assistant' | '/api/live-token',
  body: unknown,
  options: AssistantApiOptions = {},
): Promise<T> {
  const token = await (options.getToken ?? sessionToken)();
  if (!token) throw new AssistantApiError('auth_required', 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new AssistantApiError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    throw new AssistantApiError(typeof data?.error === 'string' ? data.error : 'failed', response.status);
  }
  if (!data) throw new AssistantApiError('failed', response.status);
  return data as T;
}

const ERROR_TEXT: Record<string, string> = {
  auth_required: 'Войдите по почте, чтобы говорить с помощником.',
  invalid_session: 'Вход устарел. Войдите по почте ещё раз.',
  profile_not_found: 'Профиль не найден. Войдите по почте ещё раз.',
  banned: 'Помощник для этого профиля выключен.',
  ai_not_enabled: 'Помощник для этого профиля выключен.',
  assistant_not_configured: 'Помощник ещё не подключён: на сервере нет ключа модели.',
  assistant_key_rejected: 'Сервис модели не принял ключ.',
  assistant_busy: 'Модель занята. Попробуйте через минуту.',
  too_many_requests: 'Слишком много запросов подряд. Попробуйте через несколько минут.',
  image_too_large: 'Фото слишком большое.',
  bad_image: 'Фото не прочиталось. Снимите ещё раз.',
  coordinator_required: 'Разговор с камерой доступен координаторам района.',
  live_not_configured: 'Разговор с камерой ещё не подключён: на сервере нет ключа Gemini.',
  live_key_rejected: 'Google не принял ключ Gemini.',
  network: 'Нет связи с сервером.',
  timeout: 'Помощник не успел ответить. Попробуйте ещё раз.',
};

/** Что сказать человеку; незнакомая причина даёт общий текст. */
export function assistantErrorText(error: unknown): string {
  const code = error instanceof AssistantApiError ? error.code : '';
  return ERROR_TEXT[code] ?? 'Помощник не ответил. Попробуйте ещё раз.';
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Что помощник просит изменить в карточке; ключей, которых нет, он не касался. */
export interface GuidePatch {
  name?: string;
  category?: string;
  subtype?: string;
  steps?: number;
  step_height_cm?: number;
  door_width_cm?: number;
  ramp?: string;
  toilet?: 'yes' | 'no';
  toilet_accessible?: 'yes' | 'partial' | 'no';
  toilet_note?: string;
  hand_wash?: 'yes' | 'no';
  accessible_parking?: 'yes' | 'no';
  elevator?: 'yes' | 'no';
}

export interface GuideAnswer {
  reply: string;
  patch: GuidePatch;
}

/**
 * Помощник внутри шагов «Новый объект»: отвечает и заполняет поля со слов
 * человека. `card` — что сейчас в карточке, `step` — на каком шаге человек.
 */
export async function guideAssistant(
  messages: ChatTurn[],
  step: number,
  card: Record<string, string | number>,
  options: AssistantApiOptions = {},
): Promise<GuideAnswer> {
  const data = await postAssistant<{ reply?: unknown; patch?: unknown }>(
    '/api/assistant',
    { mode: 'guide', messages, step, card },
    options,
  );
  const patch = data.patch && typeof data.patch === 'object' && !Array.isArray(data.patch) ? (data.patch as GuidePatch) : {};
  const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
  if (!reply && Object.keys(patch).length === 0) throw new AssistantApiError('failed');
  return { reply, patch };
}

export interface LiveToken {
  token: string;
  model: string;
}

/** Одноразовый короткий токен Gemini Live; выдаётся координаторам. */
export async function fetchLiveToken(options: AssistantApiOptions = {}): Promise<LiveToken> {
  const data = await postAssistant<{ token?: unknown; model?: unknown }>('/api/live-token', {}, options);
  if (typeof data.token !== 'string' || typeof data.model !== 'string') throw new AssistantApiError('failed');
  return { token: data.token, model: data.model };
}

/** Кому показывать разговор с камерой. Сервер проверяет роль сам. */
export function canUseLive(role: string | null | undefined): boolean {
  return role === 'coordinator' || role === 'admin' || role === 'owner';
}
