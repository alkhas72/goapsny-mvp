// Единый шов помощника (v1) для двух приложений: GoApsny (map) и Stopgap (stopgap).
// Глубокий модуль: снаружи один вход handleAssistantV1(body, deps), внутри —
// строгая валидация входа, очистка личных данных из form, промпты, нормализация
// справочников и гарантии fill/hint и not_entrance.

import { CATEGORY_SLUGS, DOOR_WIDTH_RANGE, RAMP_TYPES, STEP_HEIGHT_RANGE, SUBTYPES } from './catalog.js';
import { ApiError, jpegBase64 } from './core.js';
import { askDeepSeek, extractJson, userContent } from './deepseek.js';

const APPS = ['map', 'stopgap'];
const EVENTS = ['photo', 'message'];
const PHOTO_KINDS = ['entrance', 'toilet', 'measure'];
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

const STOPGAP_FORM_KEYS = ['hl', 'hr', 'freeWidth', 'width', 'board', 'paint', 'entrance'];
const STOPGAP_HINT_FIELDS = ['hl', 'hr', 'freeWidth', 'width'];

const STOPGAP_RANGES = {
  hl: [10, 600],
  hr: [10, 600],
  freeWidth: [300, 3000],
  width: [300, 3000],
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
  const raw = Array.isArray(history) ? history : [];
  const turns = [];
  for (const turn of raw.slice(-MAX_TURNS)) {
    const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
    const text = typeof turn?.text === 'string' ? turn.text.trim().slice(0, MAX_TEXT) : '';
    if (!role || !text) throw new ApiError(422, 'message_required');
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
      '{"status":"ok"|"unclear","say":"...","proposals":[{"field":"toilet_note","value":"..."}],"notes":[],"next":null}',
      'Опиши в toilet_note 1–2 короткими предложениями по-русски только то, что видно: ширина двери, порог, место для разворота, поручни, высота раковины.',
    ].join('\n');
  }

  return [
    'Ты тихий рабочий помощник карты доступности GoApsny (Абхазия).',
    'Ответь одним объектом json без пояснений:',
    '{"status":"ok"|"not_entrance"|"unclear","say":"...","proposals":[{"field":"...","value":...}],"notes":["..."],"next":"name"|null}',
    'Допустимые поля proposals:',
    `name (строка), category (${CATEGORY_SLUGS.join(', ')}), subtype (тип из своей категории),`,
    `steps (целое 0..60), step_height_cm (см), door_width_cm (см), ramp (${RAMP_TYPES.join(', ')}),`,
    'toilet (yes|no), toilet_accessible (yes|partial|no), toilet_note (строка),',
    'hand_wash (yes|no), accessible_parking (yes|no), elevator (yes|no).',
    `Типы по категориям: ${CATALOG_LINE}.`,
    'Правила:',
    '- Граница низкой ступени 5 см, дверь для коляски от 80 см. Не выдумывай: чего не видно и не названо, в proposals не клади.',
    '- Если на фото не видно входа, ставь status: "not_entrance", proposals: [] и в say мягко предложи переснять (без жёсткого отказа).',
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

function normalizeProposals(app, source, rawProposals, formCategory) {
  if (!Array.isArray(rawProposals)) return [];

  // Сначала узнаём предложенную валидную категорию (для проверки subtype).
  let activeCategory = CATEGORY_SLUGS.includes(formCategory) ? formCategory : null;
  if (app === 'map') {
    for (const item of rawProposals) {
      if (item?.field === 'category' && CATEGORY_SLUGS.includes(item.value)) {
        activeCategory = item.value;
        break;
      }
    }
  }

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
      // Инвариант Stopgap: числовые замеры всегда только ориентир (hint).
      out.push({ field, value: val, kind: 'hint', source });
      continue;
    }

    const val = normalizeMapField(field, item.value, activeCategory);
    if (val == null) continue;
    seen.add(field);
    out.push({ field, value: val, kind: 'fill', source });
  }

  // При steps === 0 высота ступени не имеет смысла.
  const hasZeroSteps = out.some((p) => p.field === 'steps' && p.value === 0);
  return hasZeroSteps ? out.filter((p) => p.field !== 'step_height_cm') : out;
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

  const defaultKind = app === 'stopgap' ? 'measure' : 'entrance';
  const photoKind = body.photoKind == null ? defaultKind : PHOTO_KINDS.includes(body.photoKind) ? body.photoKind : null;
  if (!photoKind) throw new ApiError(422, 'invalid_photo_kind');

  const form = sanitizeForm(app, body.form);
  const messages = [{ role: 'system', content: systemPrompt(app, event, photoKind) }];
  if (Object.keys(form).length > 0) {
    messages.push({ role: 'system', content: `Текущая анкета: ${JSON.stringify(form)}` });
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
          : 'Опиши вход по фото. Ответ: объект json.';
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
    return {
      body: {
        v: 1,
        status: 'unclear',
        say: text.replace(/\s+/g, ' ').trim().slice(0, 1000),
        proposals: [],
        notes: [],
        next: null,
      },
    };
  }

  const status = STATUSES.includes(parsed.status) ? parsed.status : 'ok';
  const say = typeof parsed.say === 'string' ? parsed.say.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';
  const proposals =
    status === 'not_entrance'
      ? []
      : normalizeProposals(app, source, parsed.proposals, typeof form.category === 'string' ? form.category : null);
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
