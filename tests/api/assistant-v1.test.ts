// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assistant } from '../../api/assistant.js';
import { ApiError, resetRateLimit } from '../../api/_lib/core.js';
import { DEEPSEEK_URL } from '../../api/_lib/deepseek.js';

const UID = '11111111-1111-4111-8111-111111111111';
const IMAGE = 'A'.repeat(400);
const ENV = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  DEEPSEEK_API_KEY: 'ds-key',
};

type Route = { ok?: boolean; status?: number; json?: unknown };

function fakeFetch({ role = 'public_user', aiEnabled = true, model = [] as Route[] } = {}) {
  const queue = [...model];
  const calls: { url: string; init: RequestInit }[] = [];
  const reply = (route: Route) => ({
    ok: route.ok ?? true,
    status: route.status ?? 200,
    json: async () => route.json,
  });
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return reply({ json: { id: UID } });
    if (url.includes('/rest/v1/profiles')) return reply({ json: [{ role, ai_enabled: aiEnabled }] });
    return reply(queue.shift() ?? { ok: false, status: 500 });
  });
  return { fetchImpl, calls };
}

const answer = (content: string): Route => ({ json: { choices: [{ message: { content } }] } });

const req = (body: unknown) => ({
  method: 'POST',
  headers: { authorization: 'Bearer user.jwt.token' },
  body,
});

const errCode = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof ApiError ? `${e.status}:${e.code}` : 'other'),
  );

beforeEach(() => resetRateLimit());

describe('POST /api/assistant (v1) — валидация шва', () => {
  it('отклоняет неверные app, event, photoKind, несочетаемые пары и пустые photo/message с 422 до вызова модели', async () => {
    const { fetchImpl, calls } = fakeFetch();
    const deps = { fetchImpl, env: ENV };

    expect(await errCode(assistant(req({ v: 1, app: 'unknown', event: 'photo', photo: IMAGE }), deps))).toBe(
      '422:invalid_app',
    );
    expect(await errCode(assistant(req({ v: 1, app: 'map', event: 'field' }), deps))).toBe('422:invalid_event');
    expect(
      await errCode(assistant(req({ v: 1, app: 'map', event: 'photo', photoKind: 'selfie', photo: IMAGE }), deps)),
    ).toBe('422:invalid_photo_kind');
    expect(
      await errCode(assistant(req({ v: 1, app: 'stopgap', event: 'photo', photoKind: 'toilet', photo: IMAGE }), deps)),
    ).toBe('422:invalid_photo_kind');
    expect(
      await errCode(assistant(req({ v: 1, app: 'map', event: 'photo', photoKind: 'measure', photo: IMAGE }), deps)),
    ).toBe('422:invalid_photo_kind');
    expect(await errCode(assistant(req({ v: 1, app: 'map', event: 'photo' }), deps))).toBe('422:photo_required');
    expect(await errCode(assistant(req({ v: 1, app: 'map', event: 'message' }), deps))).toBe('422:message_required');
    expect(
      await errCode(
        assistant(req({ v: 1, app: 'map', event: 'message', history: [{ role: 'system', text: 'x' }] }), deps),
      ),
    ).toBe('422:invalid_history');
    expect(calls.filter((c) => c.url === DEEPSEEK_URL)).toHaveLength(0);
  });
});

describe('POST /api/assistant (v1) — GoApsny (app: "map")', () => {
  it('фото входа: возвращает fill-предложения, отбрасывает выдумки и высоту при 0 ступенях', async () => {
    const { fetchImpl } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'ok',
            say: 'Вижу вход в аптеку, 1 ступенька ~12 см, пандуса нет.',
            proposals: [
              { field: 'name', value: 'Аптека «Здоровье»' },
              { field: 'category', value: 'health' },
              { field: 'subtype', value: 'Аптека' },
              { field: 'steps', value: 1 },
              { field: 'step_height_cm', value: 12.4 },
              { field: 'ramp', value: 'none' },
              { field: 'category', value: 'casino' },
              { field: 'door_width_cm', value: 5 },
              { field: 'hacker_field', value: 'x' },
            ],
            notes: ['Узкий тротуар перед входом'],
            next: 'door_width_cm',
          }),
        ),
      ],
    });

    const res = await assistant(
      req({ v: 1, app: 'map', event: 'photo', photoKind: 'entrance', photo: `data:image/jpeg;base64,${IMAGE}` }),
      { fetchImpl, env: ENV },
    );

    expect(res.body).toEqual({
      v: 1,
      status: 'ok',
      say: 'Вижу вход в аптеку, 1 ступенька ~12 см, пандуса нет.',
      proposals: [
        { field: 'name', value: 'Аптека «Здоровье»', kind: 'fill', source: 'photo' },
        { field: 'category', value: 'health', kind: 'fill', source: 'photo' },
        { field: 'subtype', value: 'Аптека', kind: 'fill', source: 'photo' },
        { field: 'steps', value: 1, kind: 'fill', source: 'photo' },
        { field: 'step_height_cm', value: 12, kind: 'fill', source: 'photo' },
        { field: 'ramp', value: 'none', kind: 'fill', source: 'photo' },
      ],
      notes: ['Узкий тротуар перед входом'],
      next: 'door_width_cm',
    });
  });

  it('если на фото вывеска без входа (not_entrance): оставляет name/category/subtype, стирает факты входа и гарантирует непустой say', async () => {
    const { fetchImpl } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'not_entrance',
            say: '',
            proposals: [
              { field: 'name', value: 'Аптека «Здоровье»' },
              { field: 'category', value: 'health' },
              { field: 'subtype', value: 'Аптека' },
              { field: 'steps', value: 3 },
              { field: 'step_height_cm', value: 15 },
              { field: 'door_width_cm', value: 90 },
              { field: 'ramp', value: 'none' },
            ],
            notes: [],
            next: null,
          }),
        ),
      ],
    });

    const res = await assistant(req({ v: 1, app: 'map', event: 'photo', photo: IMAGE }), { fetchImpl, env: ENV });
    expect(res.body.status).toBe('not_entrance');
    expect(res.body.proposals).toEqual([
      { field: 'name', value: 'Аптека «Здоровье»', kind: 'fill', source: 'photo' },
      { field: 'category', value: 'health', kind: 'fill', source: 'photo' },
      { field: 'subtype', value: 'Аптека', kind: 'fill', source: 'photo' },
    ]);
    expect(res.body.say.length).toBeGreaterThan(10);
  });

  it('пустые proposals при status ok приводятся к unclear с непустой запасной фразой (пункт 3)', async () => {
    const { fetchImpl } = fakeFetch({
      model: [answer(JSON.stringify({ status: 'ok', say: '', proposals: [] }))],
    });

    const res = await assistant(req({ v: 1, app: 'map', event: 'photo', photo: IMAGE }), { fetchImpl, env: ENV });
    expect(res.body.status).toBe('unclear');
    expect(res.body.proposals).toEqual([]);
    expect(res.body.say.length).toBeGreaterThan(10);
  });

  it('фото туалета (photoKind: "toilet"): пропускает только toilet_note, toilet_accessible, hand_wash (пункт 1)', async () => {
    const { fetchImpl } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'ok',
            say: 'Дверь около 85 см, порога нет, есть раковина.',
            proposals: [
              { field: 'name', value: 'Чужое название' },
              { field: 'steps', value: 4 },
              { field: 'toilet_note', value: 'Дверь около 85 см, порога нет.' },
              { field: 'toilet_accessible', value: 'partial' },
              { field: 'hand_wash', value: 'yes' },
            ],
            notes: [],
            next: null,
          }),
        ),
      ],
    });

    const res = await assistant(
      req({ v: 1, app: 'map', event: 'photo', photoKind: 'toilet', photo: IMAGE }),
      { fetchImpl, env: ENV },
    );

    expect(res.body).toMatchObject({
      v: 1,
      status: 'ok',
      proposals: [
        { field: 'toilet_note', value: 'Дверь около 85 см, порога нет.', kind: 'fill', source: 'photo' },
        { field: 'toilet_accessible', value: 'partial', kind: 'fill', source: 'photo' },
        { field: 'hand_wash', value: 'yes', kind: 'fill', source: 'photo' },
      ],
    });
  });

  it('реплика человека (event: "message"): not_entrance не стирает proposals, а form уходит ролью user без PII (пункт 2)', async () => {
    const { fetchImpl, calls } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'not_entrance',
            say: 'Записал: 2 ступени, дверь 90 см.',
            proposals: [
              { field: 'steps', value: 2 },
              { field: 'door_width_cm', value: 90 },
            ],
            notes: ['Звонок для персонала справа'],
            next: null,
          }),
        ),
      ],
    });

    const res = await assistant(
      req({
        v: 1,
        app: 'map',
        event: 'message',
        message: 'две ступени, дверь девяносто',
        form: {
          name: 'Кафе Нартаа',
          category: 'food',
          email: 'secret@example.com',
          phone: '+79401234567',
        },
        history: [
          { role: 'user', text: 'тут кафе' },
          { role: 'assistant', text: 'Понял.' },
        ],
      }),
      { fetchImpl, env: ENV },
    );

    expect(res.body).toEqual({
      v: 1,
      status: 'ok',
      say: 'Записал: 2 ступени, дверь 90 см.',
      proposals: [
        { field: 'steps', value: 2, kind: 'fill', source: 'message' },
        { field: 'door_width_cm', value: 90, kind: 'fill', source: 'message' },
      ],
      notes: ['Звонок для персонала справа'],
      next: null,
    });

    const sent = JSON.parse(String(calls.find((c) => c.url === DEEPSEEK_URL)!.init.body));
    const dumped = JSON.stringify(sent.messages);
    expect(dumped).not.toContain('secret@example.com');
    expect(dumped).not.toContain('+79401234567');
    expect(sent.messages.filter((m: { role: string }) => m.role === 'system')).toHaveLength(1);
    expect(sent.messages[1].role).toBe('user');
    expect(sent.messages[1].content).toContain('Кафе Нартаа');
  });

  it('если в form уже steps = 0, предложенная step_height_cm отбрасывается', async () => {
    const { fetchImpl } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'ok',
            say: 'Дверь 90 см.',
            proposals: [
              { field: 'step_height_cm', value: 14 },
              { field: 'door_width_cm', value: 90 },
            ],
          }),
        ),
      ],
    });

    const res = await assistant(
      req({ v: 1, app: 'map', event: 'message', message: 'дверь 90', form: { steps: 0 } }),
      { fetchImpl, env: ENV },
    );
    expect(res.body.proposals).toEqual([{ field: 'door_width_cm', value: 90, kind: 'fill', source: 'message' }]);
  });
});

describe('POST /api/assistant (v1) — Stopgap (app: "stopgap")', () => {
  it('числовые замеры в stopgap ПРИНУДИТЕЛЬНО выходят с kind: "hint" (ориентир, не запись в поле)', async () => {
    const { fetchImpl } = fakeFetch({
      model: [
        answer(
          JSON.stringify({
            status: 'ok',
            say: 'Ориентир по рулетке: слева ~85 мм, справа ~70 мм. Введите точные цифры сами.',
            proposals: [
              { field: 'hl', value: 85, kind: 'fill' },
              { field: 'hr', value: 70, kind: 'fill' },
              { field: 'freeWidth', value: 950 },
              { field: 'hl', value: 9999 },
            ],
            notes: ['Справа водосточная труба'],
            next: 'hl',
          }),
        ),
      ],
    });

    const res = await assistant(
      req({ v: 1, app: 'stopgap', event: 'photo', photoKind: 'measure', photo: IMAGE }),
      { fetchImpl, env: ENV },
    );

    expect(res.body).toEqual({
      v: 1,
      status: 'ok',
      say: 'Ориентир по рулетке: слева ~85 мм, справа ~70 мм. Введите точные цифры сами.',
      proposals: [
        { field: 'hl', value: 85, kind: 'hint', source: 'photo' },
        { field: 'hr', value: 70, kind: 'hint', source: 'photo' },
        { field: 'freeWidth', value: 950, kind: 'hint', source: 'photo' },
      ],
      notes: ['Справа водосточная труба'],
      next: 'hl',
    });
  });

  it('если модель ответила обычным текстом без JSON: отдаёт 200 status=unclear без падения', async () => {
    const { fetchImpl } = fakeFetch({ model: [answer('Снимок тёмный, рулетку не видно.')] });
    const res = await assistant(
      req({ v: 1, app: 'stopgap', event: 'photo', photo: IMAGE }),
      { fetchImpl, env: ENV },
    );
    expect(res.body).toEqual({
      v: 1,
      status: 'unclear',
      say: 'Снимок тёмный, рулетку не видно.',
      proposals: [],
      notes: [],
      next: null,
    });
  });
});
