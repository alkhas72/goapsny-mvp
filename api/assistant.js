// Помощник волонтёра и аудитора: DeepSeek Flash.
//
//   mode "look"   — фото входа → черновик карточки (название, тип, ступени,
//                   примерные сантиметры, пандус). Цифры предварительные.
//   mode "toilet" — фото туалета → короткое описание словами.
//   mode "chat"   — разговор: текст, по желанию с фото.
//
// Фото идут модели как сняты (решение Арбитра 25.11). Расход здесь не
// считается и в ai_jobs не пишется: у функции нет сервисного ключа базы.

import { ApiError, authenticate, handler, jpegBase64, jsonBody, rateLimit } from './_lib/core.js';
import { CATEGORY_SLUGS, DOOR_WIDTH_RANGE, RAMP_TYPES, STEP_HEIGHT_RANGE, SUBTYPES } from './_lib/catalog.js';
import { askDeepSeek, extractJson, userContent } from './_lib/deepseek.js';

const LOOK_PROMPT = [
  'Ты помощник карты доступности GoApsny (Абхазия). На фото вход в здание.',
  'Опиши, что видно, и ответь одним объектом json без пояснений. Поля:',
  'name: название с вывески, строка или null;',
  `category: одно из ${CATEGORY_SLUGS.join(', ')} или null;`,
  'subtype: тип объекта из списка для выбранной категории или null;',
  'steps: сколько ступеней ведёт к двери, целое число, 0 если ступеней нет, null если не видно;',
  'step_height_cm: примерная высота самой высокой ступени в сантиметрах, целое число или null;',
  'door_width_cm: примерная ширина дверного проёма в сантиметрах, целое число или null;',
  `ramp: одно из ${RAMP_TYPES.join(', ')} или null (lift это подъёмная платформа у входа).`,
  'Сантиметры оценивай по знакомым предметам в кадре: дверная ручка, кирпич, плитка, человек.',
  'Не выдумывай: чего не видно, ставь null.',
  `Типы по категориям: ${Object.entries(SUBTYPES)
    .map(([slug, list]) => `${slug}: ${list.join(', ')}`)
    .join('; ')}.`,
  'Пример: {"name":"Аптека «Здоровье»","category":"health","subtype":"Аптека","steps":2,"step_height_cm":15,"door_width_cm":90,"ramp":"none"}',
].join('\n');

const TOILET_PROMPT = [
  'Ты помощник карты доступности GoApsny. На фото туалет в общественном месте.',
  'Опиши одним-двумя короткими предложениями по-русски то, что важно человеку на коляске:',
  'ширина двери, порог, место для разворота, поручни, высота раковины.',
  'Пиши только то, что видно на фото. Без вступлений и без оценок.',
].join('\n');

const CHAT_PROMPT = [
  'Ты цифровой помощник карты доступности GoApsny (Абхазия, Ассоциация «Инва-Содействие»).',
  'Ты помогаешь волонтёрам и аудиторам описывать входы в здания: считать ступени, оценивать высоту ступени',
  'и ширину двери, выбирать тип пандуса, описывать туалет. Граница низкой ступени 5 см, дверь для коляски от 80 см.',
  'Цвет метки: зелёный, если вход без ступеней, с постоянным пандусом или подъёмником; жёлтый, если одна ступень',
  'до 5 см или есть приставной пандус; красный, если ступени без пандуса или дверь уже 80 см.',
  'Сантиметры по фото называй как примерные и советуй проверить рулеткой.',
  'Отвечай по-русски, коротко и по делу, обычным текстом без разметки. Чего не знаешь, так и говори.',
].join('\n');

function wholeIn(value, [min, max]) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

/** Ответ модели → черновик: всё, что вне справочников и пределов, становится null. */
export function normalizeDraft(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '';
  const category = CATEGORY_SLUGS.includes(data.category) ? data.category : null;
  const subtype = category && SUBTYPES[category].includes(data.subtype) ? data.subtype : null;
  const steps = wholeIn(data.steps, [0, 60]);
  return {
    name: name || null,
    category,
    subtype,
    steps,
    step_height_cm: steps === 0 ? null : wholeIn(data.step_height_cm, STEP_HEIGHT_RANGE),
    door_width_cm: wholeIn(data.door_width_cm, DOOR_WIDTH_RANGE),
    ramp: RAMP_TYPES.includes(data.ramp) ? data.ramp : null,
  };
}

const MAX_TURNS = 12;
const MAX_TEXT = 2000;

/** История разговора от клиента: только роли user/assistant и короткий текст. */
export function chatMessages(history, imageB64) {
  if (!Array.isArray(history) || history.length === 0) throw new ApiError(400, 'bad_request');
  const turns = history.slice(-MAX_TURNS).map((turn) => {
    const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
    const text = typeof turn?.text === 'string' ? turn.text.trim().slice(0, MAX_TEXT) : '';
    if (!role || !text) throw new ApiError(400, 'bad_request');
    return { role, content: text };
  });
  const last = turns[turns.length - 1];
  if (last.role !== 'user') throw new ApiError(400, 'bad_request');
  if (imageB64) last.content = userContent(last.content, imageB64);
  return [{ role: 'system', content: CHAT_PROMPT }, ...turns];
}

export async function assistant(req, deps = {}) {
  const who = await authenticate(req, deps);
  const body = jsonBody(req);
  rateLimit(who.id, 40);
  const image = jpegBase64(body.image);

  if (body.mode === 'look') {
    if (!image) throw new ApiError(400, 'image_required');
    const text = await askDeepSeek({
      messages: [
        { role: 'system', content: LOOK_PROMPT },
        { role: 'user', content: userContent('Опиши вход по фото. Ответ: объект json.', image) },
      ],
      json: true,
      maxTokens: 400,
      ...deps,
    });
    return { body: { draft: normalizeDraft(extractJson(text)) } };
  }

  if (body.mode === 'toilet') {
    if (!image) throw new ApiError(400, 'image_required');
    const text = await askDeepSeek({
      messages: [
        { role: 'system', content: TOILET_PROMPT },
        { role: 'user', content: userContent('Опиши туалет на фото.', image) },
      ],
      maxTokens: 200,
      ...deps,
    });
    return { body: { note: text.replace(/\s+/g, ' ').trim().slice(0, 500) } };
  }

  if (body.mode === 'chat') {
    const text = await askDeepSeek({ messages: chatMessages(body.messages, image), maxTokens: 600, ...deps });
    return { body: { reply: text.slice(0, 4000) } };
  }

  throw new ApiError(400, 'unknown_mode');
}

/** Подключены ли модели. Только «да» или «нет»: сами ключи наружу не выходят. */
export function connection(env = process.env) {
  return { deepseek: Boolean(env.DEEPSEEK_API_KEY), gemini: Boolean(env.GEMINI_API_KEY) };
}

export default handler(
  (req) => assistant(req),
  () => connection(),
);
