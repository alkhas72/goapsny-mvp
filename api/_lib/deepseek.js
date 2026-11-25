// Вызов DeepSeek. Проверено по api-docs.deepseek.com 25.11.2026:
// POST https://api.deepseek.com/chat/completions, ключ в Authorization;
// картинки читает модель deepseek-flash (блок image_url с data:image/jpeg);
// JSON-режим требует слово «json» и пример в подсказке и может вернуть
// пустой ответ, тогда запрос повторяют; размышление выключается полем
// thinking. Вместе ли работают JSON-режим и картинка, в документации не
// сказано: при отказе запрос уходит ещё раз без JSON-режима, а JSON
// достаётся из текста.

import { ApiError } from './core.js';

export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_MODEL = 'deepseek-flash';

export function userContent(text, imageB64) {
  if (!imageB64) return text;
  return [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}`, detail: 'high' } },
    { type: 'text', text },
  ];
}

/** Первый JSON-объект из текста модели; null — его там нет. */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function once({ messages, json, maxTokens, fetchImpl, env }) {
  const response = await fetchImpl(DEEPSEEK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!response.ok) return { ok: false, status: response.status, text: '' };
  const data = await response.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  return { ok: true, status: response.status, text: typeof text === 'string' ? text.trim() : '' };
}

/**
 * Ответ модели текстом. С `json: true` сначала идёт JSON-режим; если сервис
 * его с картинкой не принял или вернул пустоту, второй заход без него.
 */
export async function askDeepSeek({ messages, json = false, maxTokens = 500, fetchImpl = fetch, env = process.env }) {
  if (!env.DEEPSEEK_API_KEY) throw new ApiError(503, 'assistant_not_configured');
  let result = await once({ messages, json, maxTokens, fetchImpl, env });
  if (result.ok && result.text) return result.text;
  if (result.status === 401 || result.status === 402 || result.status === 403) {
    throw new ApiError(503, 'assistant_key_rejected');
  }
  if (result.status === 429) throw new ApiError(429, 'assistant_busy');
  result = await once({ messages, json: false, maxTokens, fetchImpl, env });
  if (result.ok && result.text) return result.text;
  throw new ApiError(502, 'assistant_failed');
}
