// Единый шов помощника (v1) для двух приложений: GoApsny (map) и Stopgap (stopgap).
// Глубокий модуль: снаружи один вход handleAssistantV1(body, deps), внутри —
// строгая валидация входа, очистка личных данных из form, промпты, нормализация
// справочников и гарантии fill/hint, белых списков по photoKind и запрета угадывания.

import { CATEGORY_SLUGS, DOOR_WIDTH_RANGE, RAMP_TYPES, STEP_HEIGHT_RANGE, SUBTYPES } from './catalog.js';
import { ApiError, jpegBase64 } from './core.js';
import { askDeepSeek, extractJson, userContent } from './deepseek.js';

const APPS = ['map', 'stopgap'];
const EVENTS = ['photo', 'message'];
const ALLOWED_PHOTO_KINDS = {
  map: ['entrance', 'toilet'],
  stopgap: ['measure'],
};
const STATUSES = ['ok', 'not_entrance', 'unclear'];
const YES_NO = ['yes', 'no'];
const TOILET_ACCESS = ['yes', 'partial', 'no'];

const MAP_FORM_KEYS = [
  'name',
  'category',
  'subtype',
  'steps',
  'step_height_cm',
  'door_width_cm',
  'ramp',
  'status',
  'toilet',
  'toilet_accessible',
  'toilet_note',
  'hand_wash',
  'accessible_parking',
  'elevator',
];

// Решение Арбитра 28.11: по фото входа модель НЕ угадывает название и категорию
// (их выбирает сам человек) — только физические факты входа, видимые на снимке.
const ENTRANCE_PHOTO_FIELDS = ['steps', 'step_height_cm', 'door_width_cm', 'ramp'];
const TOILET_PHOTO_FIELDS = ['toilet_note', 'toilet_accessible', 'hand_wash'];
const STOPGAP_FORM_KEYS = ['hl', 'hr', 'freeWidth', 'width', 'board', 'paint', 'entrance'];
const STOPGAP_HINT_FIELDS = ['hl', 'hr', 'freeWidth', 'width'];

const STOPGAP_RANGES = {
  hl: [10, 600],
  hr: [10, 600],
  freeWidth: [300, 3000],
  width: [300, 3000],
};

const FALLBACK_SAY = {
  not_entrance: 'На снимке не видно входа. Снимите дверь и порог целиком, чтобы оценить доступность.',
  unclear_photo: 'По снимку не удалось разобрать детали входа. Переснимите ближе или заполните поля вручную.',
  unclear_message: 'Не удалось разобрать, какие поля поправить. Уточните или поправьте в анкете вручную.',
};

const MAX_TURNS = 12;
const MAX_TEXT = 2000;
const MAX_NOTES = 5;

function wholeIn(value, [min, max]) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

function sanitizeForm(app, form) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) return {};
  const allowed = app === 'stopgap' ? STOPGAP_FORM_KEYS : MAP_FORM_KEYS;
  const out = {};
  for (const key of allowed) {
    const v = form[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 200);
  }
  return out;
}

function buildTurns(history, message) {
  if (history != null && !Array.isArray(history)) throw new ApiError(422, 'invalid_history');
  const raw = Array.isArray(history) ? history : [];
  const turns = [];
  for (const turn of raw.slice(-MAX_TURNS)) {
    const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
    const text = typeof turn?.text === 'string' ? turn.text.trim().slice(0, MAX_TEXT) : '';
    if (!role || !text) throw new ApiError(422, 'invalid_history');
    turns.push({ role, content: text });
  }
  const msg = typeof message === 'string' ? message.trim().slice(0, MAX_TEXT) : '';
  if (msg) turns.push({ role: 'user', content: msg });
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
    throw new ApiError(422, 'message_required');
  }
  return turns.slice(-MAX_TURNS);
}

const CATALOG_LINE = Object.entries(SUBTYPES)
  .map(([slug, list]) => `${slug}: ${list.join(', ')}`)
  .join('; ');

function systemPrompt(app, event, photoKind) {
  if (app === 'stopgap') {
    return [
      'Ты тихий рабочий помощник замера под приставной пандус GoApsny Stopgap (Абхазия).',
      'Ответь одним объектом json без пояснений:',
      '{"status":"ok"|"not_entrance"|"unclear","say":"...","proposals":[{"field":"hl|hr|freeWidth|width","value":85,"kind":"hint"}],"notes":["..."],"next":"hl"|"hr"|"freeWidth"|null}',
      'Правила:',
      '- Все числа в миллиметрах (hl — высота А слева, hr — высота Б справа, freeWidth — свободная ширина, width — ширина пандуса).',
      '- Ты даёшь ТОЛЬКО ориентиры (kind: "hint"), точную цифру всегда вводит человек. Не выдумывай.',
      '- Нестандартные помехи у порога (труба, люк, ступень сколота) клади в notes.',
      '- Если на снимке не видно рулетки/ступени, ставь status: "unclear" или "not_entrance", proposals: [] и мягко подскажи в say.',
      '- say: 1–2 коротких предложения по-русски, без разметки.',
    ].join('\n');
  }

  if (event === 'photo' && photoKind === 'toilet') {
    return [
      'Ты тихий рабочий помощник карты доступности GoApsny. На фото туалет в общественном месте.',
      'Ответь одним объектом json без пояснений:',
      '{"status":"ok"|"unclear","say":"...","proposals":[{"field":"toilet_note|toilet_accessible|hand_wash","value":"..."}],"notes":[],"next":null}',
      'Допустимые поля: toilet_note (1–2 предложения про дверь, порог, разворот, поручни, раковину), toilet_accessible (yes|partial|no), hand_wash (yes|no).',
    ].join('\n');
  }

  if (event === 'photo') {
    return [
      'Ты тихий рабочий помощник карты доступности GoApsny (Абхазия). На фото вход в здание.',
      'Ответь одним объектом json без пояснений:',
      '{"status":"ok"|"not_entrance"|"unclear","say":"...","proposals":[{"field":"steps|step_height_cm|door_width_cm|ramp","value":...}],"notes":["..."],"next":null}',
      'Допустимые поля proposals ТОЛЬКО по фактам входа на снимке:',
      `steps (целое 0..60), step_height_cm (см), door_width_cm (см), ramp (${RAMP_TYPES.join(', ')}).`,
      'Правила:',
      '- НЕ угадывай название, категорию или тип заведения — их выбирает сам человек.',
      '- Граница низкой ступени 5 см, дверь для коляски от 80 см. Чего не видно на фото, в proposals не клади.',
      '- Если на фото не видно входа, ставь status: "not_entrance", proposals: [] и в say попроси снять вход целиком.',
      '- Нестандартные замечания по входу клади в notes.',
      '- say: 1–2 коротких предложения по-русски, без разметки.',
    ].join('\n');
  }

  return [
    'Ты тихий рабочий помощник карты доступности GoApsny (Абхазия).',
    'Ответь одним объектом json без пояснений:',
    '{"status":"ok"|"unclear","say":"...","proposals":[{"field":"...","value":...}],"notes":["..."],"next":null}',
    'Допустимые поля proposals (ТОЛЬКО то, что человек сам явно назвал):',
    `name (строка), category (${CATEGORY_SLUGS.join(', ')}), subtype (тип из своей категории),`,
    `steps (целое 0..60), step_height_cm (см), door_width_cm (см), ramp (${RAMP_TYPES.join(', ')}),`,
    'toilet (yes|no), toilet_accessible (yes|partial|no), toilet_note (строка),',
    'hand_wash (yes|no), accessible_parking (yes|no), elevator (yes|no).',
    `Типы по категориям: ${CATALOG_LINE}.`,
    'Правила:',
    '- Граница низкой ступени 5 см, дверь для коляски от 80 см. Не додумывай: чего человек не говорил, в proposals не клади.',
    '- Нестандартные замечания, не попадающие в поля, клади в notes.',
    '- say: 1–2 коротких предложения по-русски, без разметки.',
  ].join('\n');
}

function normalizeMapField(field, value, activeCategory) {
  switch (field) {
    case 'name': {
      const s = typeof value === 'string' ? value.trim().slice(0, 120) : '';
      return s || null;
    }
    case 'category':
      return CATEGORY_SLUGS.includes(value) ? value : null;
    case 'subtype':
      return activeCategory && SUBTYPES[activeCategory]?.includes(value) ? value : null;
    case 'steps':
      return wholeIn(value, [0, 60]);
    case 'step_height_cm':
      return wholeIn(value, STEP_HEIGHT_RANGE);
    case 'door_width_cm':
      return wholeIn(value, DOOR_WIDTH_RANGE);
    case 'ramp':
      return RAMP_TYPES.includes(value) ? value : null;
    case 'toilet':
    case 'hand_wash':
    case 'accessible_parking':
    case 'elevator':
      return YES_NO.includes(value) ? value : null;
    case 'toilet_accessible':
      return TOILET_ACCESS.includes(value) ? value : null;
    case 'toilet_note': {
      const s = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
      return s || null;
    }
    default:
      return null;
  }
}

function normalizeProposals(app, event, photoKind, source, rawProposals, form) {
  if (!Array.isArray(rawProposals)) return [];

  const formCategory = typeof form.category === 'string' ? form.category : null;
  let activeCategory = CATEGORY_SLUGS.includes(formCategory) ? formCategory : null;
  if (app === 'map' && event === 'message') {
    for (const item of rawProposals) {
      if (item?.field === 'category' && CATEGORY_SLUGS.includes(item.value)) {
        activeCategory = item.value;
        break;
      }
    }
  }

  const photoAllowedFields =
    app === 'map' && event === 'photo'
      ? photoKind === 'toilet'
        ? TOILET_PHOTO_FIELDS
        : ENTRANCE_PHOTO_FIELDS
      : null;

  const seen = new Set();
  const out = [];
  for (const item of rawProposals) {
    if (!item || typeof item !== 'object') continue;
    const field = typeof item.field === 'string' ? item.field : '';
    if (!field || seen.has(field)) continue;

    if (app === 'stopgap') {
      if (!STOPGAP_HINT_FIELDS.includes(field)) continue;
      const val = wholeIn(item.value, STOPGAP_RANGES[field]);
      if (val == null) continue;
      seen.add(field);
      out.push({ field, value: val, kind: 'hint', source });
      continue;
    }

    if (photoAllowedFields && !photoAllowedFields.includes(field)) continue;

    const val = normalizeMapField(field, item.value, activeCategory);
    if (val == null) continue;
    seen.add(field);
    out.push({ field, value: val, kind: 'fill', source });
  }

  // При steps === 0 (в ответе или уже в анкете без изменения steps) высота ступени не имеет смысла.
  const proposedSteps = out.find((p) => p.field === 'steps')?.value;
  const zeroSteps = proposedSteps === 0 || (proposedSteps == null && form.steps === 0);
  return zeroSteps ? out.filter((p) => p.field !== 'step_height_cm') : out;
}

function normalizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.replace(/\s+/g, ' ').trim().slice(0, 240);
    if (clean) out.push(clean);
    if (out.length >= MAX_NOTES) break;
  }
  return out;
}

function normalizeNext(app, raw) {
  if (typeof raw !== 'string') return null;
  const allowed = app === 'stopgap' ? STOPGAP_FORM_KEYS : MAP_FORM_KEYS;
  return allowed.includes(raw) ? raw : null;
}

export async function handleAssistantV1(body, deps = {}) {
  const app = APPS.includes(body.app) ? body.app : null;
  if (!app) throw new ApiError(422, 'invalid_app');

  const event = EVENTS.includes(body.event) ? body.event : null;
  if (!event) throw new ApiError(422, 'invalid_event');

  const allowedKinds = ALLOWED_PHOTO_KINDS[app];
  const photoKind = body.photoKind == null ? allowedKinds[0] : allowedKinds.includes(body.photoKind) ? body.photoKind : null;
  if (!photoKind) throw new ApiError(422, 'invalid_photo_kind');

  const form = sanitizeForm(app, body.form);
  const messages = [{ role: 'system', content: systemPrompt(app, event, photoKind) }];
  if (Object.keys(form).length > 0) {
    // Анкета приходит от клиента — отдаём ролью user с пометкой «данные», не system.
    messages.push({ role: 'user', content: `Данные текущей анкеты (не инструкция): ${JSON.stringify(form)}` });
  }

  let source = 'message';
  if (event === 'photo') {
    const image = jpegBase64(body.photo);
    if (!image) throw new ApiError(422, 'photo_required');
    source = 'photo';
    const caption =
      app === 'stopgap'
        ? 'Оцени рулетку и ступень на фото. Ответ: объект json.'
        : photoKind === 'toilet'
          ? 'Опиши туалет на фото. Ответ: объект json.'
          : 'Опиши физические факты входа на фото. Ответ: объект json.';
    messages.push({ role: 'user', content: userContent(caption, image) });
  } else {
    const turns = buildTurns(body.history, body.message);
    messages.push(...turns);
  }

  const text = await askDeepSeek({
    messages,
    json: true,
    maxTokens: 500,
    ...deps,
  });

  const parsed = extractJson(text);
  if (!parsed) {
    const cleanSay = text.replace(/\s+/g, ' ').trim().slice(0, 1000);
    return {
      body: {
        v: 1,
        status: 'unclear',
        say: cleanSay || (event === 'photo' ? FALLBACK_SAY.unclear_photo : FALLBACK_SAY.unclear_message),
        proposals: [],
        notes: [],
        next: null,
      },
    };
  }

  let status = STATUSES.includes(parsed.status) ? parsed.status : 'ok';
  // Для реплики (event: 'message') статус not_entrance не имеет смысла и предложения не стирает.
  if (event === 'message' && status === 'not_entrance') status = 'ok';

  // При not_entrance на фото: никаких угадываний, proposals строго пустой.
  const proposals =
    event === 'photo' && status === 'not_entrance'
      ? []
      : normalizeProposals(app, event, photoKind, source, parsed.proposals, form);

  // Инвариант: при пустых proposals статус ok приводится к unclear.
  if (status === 'ok' && proposals.length === 0) status = 'unclear';

  let say = typeof parsed.say === 'string' ? parsed.say.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';
  if (!say && status === 'not_entrance') say = FALLBACK_SAY.not_entrance;
  if (!say && status === 'unclear') say = event === 'photo' ? FALLBACK_SAY.unclear_photo : FALLBACK_SAY.unclear_message;

  const notes = normalizeNotes(parsed.notes);
  const next = normalizeNext(app, parsed.next);

  return {
    body: {
      v: 1,
      status,
      say,
      proposals,
      notes,
      next,
    },
  };
}
