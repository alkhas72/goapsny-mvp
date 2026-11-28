// Помощник волонтёра и аудитора: DeepSeek Flash.
//
//   v: 1          — единый шов для GoApsny (map) и Stopgap (stopgap):
//                   см. docs/assistant-seam-v1.md и api/_lib/assistant-v1.js.
//   mode "look"   — (прежний) фото входа → черновик карточки.
//   mode "toilet" — (прежний) фото туалета → короткое описание словами.
//   mode "guide"  — (прежний) сопровождение по шагам «Новый объект».
//
// Фото идут модели как сняты (решение Арбитра 25.11). Расход здесь не
// считается и в ai_jobs не пишется: у функции нет сервисного ключа базы.

import { ApiError, authenticate, handler, jpegBase64, jsonBody, rateLimit } from './_lib/core.js';
import { CATEGORY_SLUGS, DOOR_WIDTH_RANGE, RAMP_TYPES, STEP_HEIGHT_RANGE, SUBTYPES } from './_lib/catalog.js';
import { askDeepSeek, extractJson, tryDeepSeek, userContent } from './_lib/deepseek.js';
import { createLiveToken } from './_lib/live.js';
import { PROBE_JPEG } from './_lib/probe-image.js';
import { handleAssistantV1 } from './_lib/assistant-v1.js';

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

const GUIDE_PROMPT = [
  'Ты цифровой помощник карты доступности GoApsny (Абхазия). Человек идёт по шагам «Новый объект»:',
  '1 фото входа, 2 данные, 3 доступность, 4 туалет и удобства, 5 точка на карте.',
  'Ты сопровождаешь его в этом же пути: отвечаешь на вопросы и заполняешь поля карточки с его слов.',
  'Ответь одним объектом json без пояснений: {"reply": "...", "patch": {...}}.',
  'reply: короткий ответ по-русски, одно или два предложения, обычный текст без разметки.',
  'Если заполнил поля, скажи какие. Если человек спросил, ответь по делу.',
  'patch: только те поля, которые человек назвал или попросил изменить. Остальные поля в patch не включай.',
  'Поля patch:',
  'name: название объекта, строка;',
  `category: одно из ${CATEGORY_SLUGS.join(', ')};`,
  'subtype: тип объекта из списка для категории;',
  'steps: сколько ступеней ведёт к двери, целое число, 0 если ступеней нет;',
  'step_height_cm: высота самой высокой ступени в сантиметрах, целое число;',
  'door_width_cm: ширина дверного проёма в сантиметрах, целое число;',
  `ramp: одно из ${RAMP_TYPES.join(', ')} (lift это подъёмная платформа у входа);`,
  'toilet: yes или no; toilet_accessible: yes, partial или no (доступен ли туалет на коляске);',
  'toilet_note: короткое описание туалета словами;',
  'hand_wash: yes или no (можно ли помыть руки); accessible_parking: yes или no (парковка для людей с инвалидностью);',
  'elevator: yes или no (лифт между этажами).',
  'Граница низкой ступени 5 см, дверь для коляски от 80 см. Не выдумывай: чего человек не говорил, в patch не клади.',
  'Цвет метки на шаге 3 человек ставит сам, ты только советуешь: зелёный, если вход без ступеней, с постоянным',
  'пандусом или подъёмником; жёлтый, если одна ступень до 5 см или есть приставной пандус; красный, если ступени',
  'без пандуса или дверь уже 80 см. Чего не знаешь, так и говори.',
  `Типы по категориям: ${Object.entries(SUBTYPES)
    .map(([slug, list]) => `${slug}: ${list.join(', ')}`)
    .join('; ')}.`,
  'Пример: человек сказал «две ступеньки, дверь девяносто». Ответ:',
  '{"reply":"Записал: 2 ступени, дверь 90 см. Какая высота ступени?","patch":{"steps":2,"door_width_cm":90}}',
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

const YES_NO = ['yes', 'no'];
const TOILET_ACCESS = ['yes', 'partial', 'no'];

/**
 * Поля, которые помощник просит изменить. В ответ идут только названные и
 * допустимые значения: пустое, null и всё вне справочников отбрасывается.
 * `category` — категория карточки сейчас, по ней проверяется тип объекта.
 */
export function normalizePatch(raw, category = null) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const patch = {};
  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '';
  if (name) patch.name = name;
  if (CATEGORY_SLUGS.includes(data.category)) patch.category = data.category;
  const scope = patch.category ?? (CATEGORY_SLUGS.includes(category) ? category : null);
  if (scope && SUBTYPES[scope].includes(data.subtype)) patch.subtype = data.subtype;
  const steps = wholeIn(data.steps, [0, 60]);
  if (steps != null) patch.steps = steps;
  const stepHeight = wholeIn(data.step_height_cm, STEP_HEIGHT_RANGE);
  if (stepHeight != null) patch.step_height_cm = stepHeight;
  const doorWidth = wholeIn(data.door_width_cm, DOOR_WIDTH_RANGE);
  if (doorWidth != null) patch.door_width_cm = doorWidth;
  if (RAMP_TYPES.includes(data.ramp)) patch.ramp = data.ramp;
  if (YES_NO.includes(data.toilet)) patch.toilet = data.toilet;
  if (TOILET_ACCESS.includes(data.toilet_accessible)) patch.toilet_accessible = data.toilet_accessible;
  const note = typeof data.toilet_note === 'string' ? data.toilet_note.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
  if (note) patch.toilet_note = note;
  for (const key of ['hand_wash', 'accessible_parking', 'elevator']) {
    if (YES_NO.includes(data[key])) patch[key] = data[key];
  }
  return patch;
}

/** Карточка, как её видит человек сейчас: короткий текст для подсказки модели. */
export function cardNote(step, card) {
  const safe = card && typeof card === 'object' && !Array.isArray(card) ? card : {};
  const shown = {};
  for (const [key, value] of Object.entries(safe).slice(0, 20)) {
    if (typeof value === 'number' && Number.isFinite(value)) shown[key] = value;
    else if (typeof value === 'string' && value.trim()) shown[key] = value.trim().slice(0, 200);
  }
  const at = Number.isInteger(step) && step >= 1 && step <= 5 ? step : null;
  return `${at ? `Человек на шаге ${at}. ` : ''}Карточка сейчас: ${JSON.stringify(shown)}`;
}

const MAX_TURNS = 12;
const MAX_TEXT = 2000;

/** История разговора от клиента: только роли user/assistant и короткий текст. */
export function chatTurns(history) {
  if (!Array.isArray(history) || history.length === 0) throw new ApiError(400, 'bad_request');
  const turns = history.slice(-MAX_TURNS).map((turn) => {
    const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
    const text = typeof turn?.text === 'string' ? turn.text.trim().slice(0, MAX_TEXT) : '';
    if (!role || !text) throw new ApiError(400, 'bad_request');
    return { role, content: text };
  });
  if (turns[turns.length - 1].role !== 'user') throw new ApiError(400, 'bad_request');
  return turns;
}

/** Разговор внутри шагов: подсказка пути, карточка как она есть, затем реплики. */
export function guideMessages(history, step, card) {
  return [
    { role: 'system', content: GUIDE_PROMPT },
    { role: 'system', content: cardNote(step, card) },
    ...chatTurns(history),
  ];
}

export async function assistant(req, deps = {}) {
  const who = await authenticate(req, deps);
  const body = jsonBody(req);
  rateLimit(who.id, 40);

  if (body.v === 1) {
    return handleAssistantV1(body, deps);
  }

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

  if (body.mode === 'guide') {
    const text = await askDeepSeek({
      messages: guideMessages(body.messages, body.step, body.card),
      json: true,
      maxTokens: 500,
      ...deps,
    });
    const parsed = extractJson(text);
    // Модель ответила не объектом: её слова всё равно доходят до человека.
    const reply = typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : parsed ? '' : text;
    const category = typeof body.card?.category === 'string' ? body.card.category : null;
    return { body: { reply: reply.slice(0, 1000), patch: normalizePatch(parsed?.patch, category) } };
  }

  throw new ApiError(400, 'unknown_mode');
}

/** Подключены ли модели. Только «да» или «нет»: сами ключи наружу не выходят. */
export function connection(env = process.env) {
  return { deepseek: Boolean(env.DEEPSEEK_API_KEY), gemini: Boolean(env.GEMINI_API_KEY) };
}

/**
 * Самопроверка на превью-сборке: GET /api/assistant?check=1. Шлёт модели
 * учебную картинку входа тем же запросом, что и шаг «Данные», и просит у
 * Google короткий токен (он тут же выбрасывается). В ответе только итог и
 * текст отказа сервиса. На боевой сборке не работает: вызов без входа не
 * должен тратить деньги.
 */
export async function selfCheck({ fetchImpl = fetch, env = process.env, now = () => Date.now() } = {}) {
  const result = connection(env);
  if (env.DEEPSEEK_API_KEY) {
    const messages = [
      { role: 'system', content: LOOK_PROMPT },
      { role: 'user', content: userContent('Опиши вход по фото. Ответ: объект json.', PROBE_JPEG) },
    ];
    const strict = await tryDeepSeek({ messages, json: true, maxTokens: 400, fetchImpl, env });
    const plain = strict.ok && strict.text ? null : await tryDeepSeek({ messages, json: false, maxTokens: 400, fetchImpl, env });
    const answer = plain ?? strict;
    result.look = {
      jsonMode: { ok: strict.ok, status: strict.status, empty: strict.ok && !strict.text, detail: strict.detail },
      ...(plain ? { plain: { ok: plain.ok, status: plain.status, empty: plain.ok && !plain.text, detail: plain.detail } } : {}),
      draft: answer.ok && answer.text ? normalizeDraft(extractJson(answer.text)) : null,
    };
  }
  if (env.DEEPSEEK_API_KEY) {
    // Помощник в шагах: учебная фраза, в ответ должны прийти названные поля.
    const said = [{ role: 'user', text: 'Тут две ступеньки по двенадцать сантиметров, дверь девяносто. Туалета нет.' }];
    const guide = await tryDeepSeek({
      messages: guideMessages(said, 2, { name: 'Аптека', category: 'health' }),
      json: true,
      maxTokens: 500,
      fetchImpl,
      env,
    });
    const parsed = guide.ok && guide.text ? extractJson(guide.text) : null;
    result.guide = {
      ok: guide.ok,
      status: guide.status,
      empty: guide.ok && !guide.text,
      detail: guide.detail,
      reply: typeof parsed?.reply === 'string' ? parsed.reply.slice(0, 300) : null,
      patch: parsed ? normalizePatch(parsed.patch, 'health') : null,
    };
  }
  if (env.GEMINI_API_KEY) {
    const issued = await createLiveToken({ fetchImpl, env, now });
    result.live = { ok: issued.ok, status: issued.status, model: issued.model, detail: issued.detail };
  }
  return result;
}

function wantsCheck(req) {
  try {
    return new URL(req.url ?? '', 'http://local').searchParams.get('check') === '1';
  } catch {
    return false;
  }
}

export default handler(
  (req) => assistant(req),
  (req) => {
    if (process.env.VERCEL_ENV !== 'preview' || !wantsCheck(req)) return connection();
    rateLimit('self-check', 6);
    return selfCheck();
  },
);
