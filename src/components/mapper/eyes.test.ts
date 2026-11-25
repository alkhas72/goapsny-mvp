import { describe, expect, it, vi } from 'vitest';
import { cloudEyes, draftFromServer } from './eyes';

vi.mock('../../utils/photo', () => ({
  shrinkToBase64: vi.fn(async () => 'BASE64'),
}));

const photo = new File(['jpeg'], 'entrance.jpg', { type: 'image/jpeg' });

function server(body: unknown, status = 200) {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

describe('глаза помощника', () => {
  it('шлёт уменьшенное фото со входом человека и отдаёт черновик', async () => {
    const fetchImpl = server({
      draft: { name: ' Кафе ', category: 'food', subtype: 'Кафе', steps: 1, step_height_cm: 12, door_width_cm: 85, ramp: 'lift' },
    });
    const eyes = cloudEyes({ getToken: async () => 'jwt', fetchImpl });
    expect(await eyes.look(photo)).toEqual({
      name: 'Кафе',
      category: 'food',
      subtype: 'Кафе',
      stepsVisible: 1,
      ramp: 'lift',
      stepHeightCm: 12,
      doorWidthCm: 85,
    });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/assistant');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt' });
    expect(JSON.parse(init.body)).toEqual({ mode: 'look', image: 'BASE64' });
  });

  it('без входа на сервер не ходит', async () => {
    const fetchImpl = server({});
    await expect(cloudEyes({ getToken: async () => null, fetchImpl }).look(photo)).rejects.toMatchObject({
      code: 'auth_required',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('помощник не подключён: отказ с причиной, а не выдуманные поля', async () => {
    const fetchImpl = server({ error: 'assistant_not_configured' }, 503);
    await expect(cloudEyes({ getToken: async () => 'jwt', fetchImpl }).look(photo)).rejects.toMatchObject({
      code: 'assistant_not_configured',
    });
  });

  it('описание туалета: пустое превращается в null', async () => {
    const eyes = cloudEyes({ getToken: async () => 'jwt', fetchImpl: server({ note: '  Поручней нет.  ' }) });
    expect(await eyes.describeToilet!(photo)).toBe('Поручней нет.');
    const silent = cloudEyes({ getToken: async () => 'jwt', fetchImpl: server({ note: ' ' }) });
    expect(await silent.describeToilet!(photo)).toBeNull();
  });

  it('черновик сервера проверяется ещё раз', () => {
    expect(
      draftFromServer({ name: 7, category: 'casino', subtype: 'Кафе', steps: 2.5, step_height_cm: 300, door_width_cm: 5, ramp: 'x' }),
    ).toEqual({
      name: null,
      category: null,
      subtype: null,
      stepsVisible: null,
      ramp: null,
      stepHeightCm: null,
      doorWidthCm: null,
    });
    expect(draftFromServer(null).name).toBeNull();
  });
});
