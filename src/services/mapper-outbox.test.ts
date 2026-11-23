import { describe, expect, it, vi } from 'vitest';
import {
  NOT_READY_PAUSE_MS,
  canWait,
  createMapperOutbox,
  memoryOutboxStore,
  outboxReason,
} from './mapper-outbox';
import { SubmitPlaceError } from './submit-place';
import type { SubmitMapperPlaceInput } from './submit-mapper-place';

const input = (name: string): SubmitMapperPlaceInput => ({
  name,
  category: 'food',
  lat: 43,
  lng: 41,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  status: 'yellow',
  stepsCount: 1,
  rampType: 'none',
  subtype: null,
  stepHigh: 'unknown',
  doorWide: 'unknown',
});

const OK = { placeId: 'x', storagePath: 'x/facade.jpg', place: {} } as never;

function setup(submit: ReturnType<typeof vi.fn>, start = '2026-11-23T06:00:00Z') {
  let n = 0;
  const clock = { at: new Date(start).getTime() };
  const outbox = createMapperOutbox({
    store: memoryOutboxStore(),
    submit: submit as never,
    generateId: () => `id-${(n += 1)}`,
    now: () => new Date((clock.at += 1000)),
  });
  return { outbox, clock };
}

describe('отложенная отправка: что можно придержать', () => {
  it('сбой связи, вход и «сервер ещё не принимает» ждут; отказ по существу — нет', () => {
    expect(canWait(new SubmitPlaceError('unknown', 'network'))).toBe(true);
    expect(canWait(new SubmitPlaceError('missing_photo', 'upload'))).toBe(true);
    expect(canWait(new SubmitPlaceError('server_not_ready', 'no rpc'))).toBe(true);
    expect(canWait(new SubmitPlaceError('auth_required', 'no session'))).toBe(true);
    expect(canWait(new SubmitPlaceError('card_invalid', 'bad'))).toBe(false);
    expect(canWait(new SubmitPlaceError('role_required', 'banned'))).toBe(false);
    expect(canWait(new Error('photo is broken'))).toBe(false);
    expect(outboxReason(new Error('anything'))).toBe('unknown');
  });
});

describe('отложенная отправка: очередь', () => {
  it('держит объекты по людям: чужие не видны и под чужим входом не уходят', async () => {
    const submit = vi.fn().mockResolvedValue(OK);
    const { outbox } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'offline');
    await outbox.add('u2', input('Кафе'), 'offline');

    expect((await outbox.list('u1')).map((i) => i.input.name)).toEqual(['Аптека']);
    const result = await outbox.flush('u1');

    expect(result).toMatchObject({ sent: 1, left: [] });
    expect(submit).toHaveBeenCalledTimes(1);
    expect((await outbox.list('u2')).length).toBe(1);
  });

  it('повтор идёт с тем же идентификатором места и отметкой «повтор»', async () => {
    const submit = vi.fn().mockResolvedValue(OK);
    const { outbox } = setup(submit);
    const item = await outbox.add('u1', input('Аптека'), 'unknown');

    await outbox.flush('u1');

    const options = submit.mock.calls[0][1] as { generateId: () => string; resume: boolean };
    expect(options.generateId()).toBe(item.id);
    expect(options.resume).toBe(true);
  });

  it('нет связи: объект остаётся, следующие не пробуются', async () => {
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('unknown', 'Failed to fetch'));
    const { outbox } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'offline');
    await outbox.add('u1', input('Кафе'), 'offline');

    const result = await outbox.flush('u1');

    expect(result.sent).toBe(0);
    expect(result.left.map((i) => [i.input.name, i.attempts, i.blocked])).toEqual([
      ['Аптека', 1, false],
      ['Кафе', 0, false],
    ]);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('сервер уже знает место (ответ потерялся в прошлый раз) — объект считается ушедшим', async () => {
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('place_id_reused', 'place_id already used', '23505'));
    const { outbox } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'unknown');

    expect(await outbox.flush('u1')).toMatchObject({ sent: 1, left: [] });
  });

  it('отказ по существу помечает объект и не мешает остальным', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new SubmitPlaceError('card_invalid', 'invalid card', '22P02'))
      .mockResolvedValueOnce(OK);
    const { outbox } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'offline');
    await outbox.add('u1', input('Кафе'), 'offline');

    const result = await outbox.flush('u1');

    expect(result.sent).toBe(1);
    expect(result.left.map((i) => [i.input.name, i.reason, i.blocked])).toEqual([['Аптека', 'card_invalid', true]]);

    // Помеченный объект больше не отправляется сам: его судьбу решает человек.
    await outbox.flush('u1');
    expect(submit).toHaveBeenCalledTimes(2);
    await outbox.remove(result.left[0].id);
    expect(await outbox.list('u1')).toEqual([]);
  });

  it('фоновая попытка не дёргает сервер, который только что ответил «ещё не принимаю»', async () => {
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('server_not_ready', 'no rpc', 'PGRST202'));
    const { outbox, clock } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'server_not_ready');

    await outbox.flush('u1', { auto: true });
    expect(submit).not.toHaveBeenCalled();

    // Кнопка «Отправить сейчас» пробует всегда.
    await outbox.flush('u1');
    expect(submit).toHaveBeenCalledTimes(1);

    clock.at += NOT_READY_PAUSE_MS;
    await outbox.flush('u1', { auto: true });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('две отправки разом не дают двух попыток по одному объекту', async () => {
    let release: (value: unknown) => void = () => undefined;
    const submit = vi.fn(() => new Promise((resolve) => (release = resolve)));
    const { outbox } = setup(submit);
    await outbox.add('u1', input('Аптека'), 'offline');

    const first = outbox.flush('u1');
    const second = outbox.flush('u1');
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    release(OK);

    expect(await first).toMatchObject({ sent: 1 });
    expect(await second).toMatchObject({ sent: 1 });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
