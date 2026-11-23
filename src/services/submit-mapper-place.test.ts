import { describe, expect, it, vi } from 'vitest';
import { SubmitPlaceError } from './submit-place';
import {
  SUBMIT_MAPPER_PLACE_RPC,
  submitMapperPlace,
  type SubmitMapperPlaceInput,
  type SubmitMapperPlaceOptions,
} from './submit-mapper-place';

const UUID_A = '11111111-1111-4111-8111-111111111111';

const ROW = {
  id: UUID_A,
  name: 'Кафе «Пингвин»',
  category: 'food',
  lat: 43.0033,
  lng: 41.0237,
  status: 'yellow',
  steps_count: 2,
  step_height_cm: null,
  ramp_type: 'portable_on_request',
  door_width_cm: null,
  entrance_notes: null,
  toilet_exists: 'unknown',
  toilet_accessible: 'unknown',
  parking: 'unknown',
  comment: null,
  osm_tags: {},
  details: { schema_version: 1, mapper: { subtype: 'Кафе', step_high: 'yes', door_wide: 'unknown' } },
  moderation_status: 'pending',
  source: 'public',
  created_by: UUID_A,
  created_at: '2026-11-23T00:00:00Z',
  updated_at: '2026-11-23T00:00:00Z',
};

const INPUT: SubmitMapperPlaceInput = {
  name: 'Кафе «Пингвин»',
  category: 'food',
  lat: 43.0033,
  lng: 41.0237,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  status: 'yellow',
  stepsCount: 2,
  rampType: 'portable_on_request',
  subtype: 'Кафе',
  stepHigh: 'yes',
  doorWide: 'unknown',
};

function fakeClient(over: { upload?: unknown; rpc?: unknown } = {}) {
  const upload = vi.fn().mockResolvedValue(over.upload ?? { data: {}, error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const rpc = vi.fn().mockResolvedValue(over.rpc ?? { data: ROW, error: null });
  const client = { storage: { from: vi.fn(() => ({ upload, remove })) }, rpc };
  const options = {
    supabase: client,
    generateId: () => UUID_A,
  } as unknown as SubmitMapperPlaceOptions;
  return { options, upload, remove, rpc };
}

describe('submitMapperPlace', () => {
  it('кладёт фото фасада и подаёт карточку с точным набором полей', async () => {
    const { options, upload, rpc, remove } = fakeClient();

    const result = await submitMapperPlace(INPUT, options);

    expect(upload).toHaveBeenCalledWith(`${UUID_A}/facade.jpg`, INPUT.photo, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(rpc).toHaveBeenCalledWith(SUBMIT_MAPPER_PLACE_RPC, {
      p_place_id: UUID_A,
      p_name: 'Кафе «Пингвин»',
      p_category: 'food',
      p_lat: 43.0033,
      p_lng: 41.0237,
      p_storage_path: `${UUID_A}/facade.jpg`,
      p_status: 'yellow',
      p_steps_count: 2,
      p_ramp_type: 'portable_on_request',
      p_subtype: 'Кафе',
      p_step_high: 'yes',
      p_door_wide: 'unknown',
    });
    expect(remove).not.toHaveBeenCalled();
    expect(result.placeId).toBe(UUID_A);
    expect(result.place.moderationStatus).toBe('pending');
    expect(result.place.status).toBe('yellow');
  });

  it('неизвестный пандус уходит как «нет», пустой тип — как null', async () => {
    const { options, rpc } = fakeClient();
    await submitMapperPlace({ ...INPUT, rampType: null, subtype: null, stepsCount: null }, options);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_ramp_type: 'none',
      p_subtype: null,
      p_steps_count: null,
    });
  });

  it('сбой загрузки фото — отказ до вызова сервера', async () => {
    const { options, rpc } = fakeClient({ upload: { data: null, error: { message: 'boom' } } });
    await expect(submitMapperPlace(INPUT, options)).rejects.toMatchObject({ kind: 'missing_photo' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('повтор отложенной отправки: фото уже на сервере — идём дальше к подаче', async () => {
    const duplicate = { data: null, error: { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' } };
    const resumed = fakeClient({ upload: duplicate });
    const result = await submitMapperPlace(INPUT, { ...resumed.options, resume: true });
    expect(resumed.rpc).toHaveBeenCalledTimes(1);
    expect(result.placeId).toBe(UUID_A);

    // Первая отправка такого ответа не прощает: путь должен быть свободен.
    const fresh = fakeClient({ upload: duplicate });
    await expect(submitMapperPlace(INPUT, fresh.options)).rejects.toMatchObject({ kind: 'missing_photo' });
    expect(fresh.rpc).not.toHaveBeenCalled();
  });

  it('отказ сервера: фото убирается, причина названа', async () => {
    const { options, remove } = fakeClient({
      rpc: {
        data: null,
        error: { code: '22P02', message: 'submit_mapper_place: invalid card: unknown ramp_type' },
      },
    });
    const error = await submitMapperPlace(INPUT, options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SubmitPlaceError);
    expect((error as SubmitPlaceError).kind).toBe('card_invalid');
    expect(remove).toHaveBeenCalledWith([`${UUID_A}/facade.jpg`]);
  });

  it('сервер ещё не знает функцию — отдельная причина, а не «неизвестная ошибка»', async () => {
    const { options, remove } = fakeClient({
      rpc: {
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.submit_mapper_place' },
      },
    });
    await expect(submitMapperPlace(INPUT, options)).rejects.toMatchObject({ kind: 'server_not_ready' });
    expect(remove).toHaveBeenCalled();
  });

  it('заблокированный профиль получает отказ по правам', async () => {
    const { options } = fakeClient({
      rpc: {
        data: null,
        error: { code: '42501', message: 'submit_mapper_place: caller is not allowed to submit' },
      },
    });
    await expect(submitMapperPlace(INPUT, options)).rejects.toMatchObject({ kind: 'role_required' });
  });

  it('успех без строки места не рисуется', async () => {
    const { options, remove } = fakeClient({ rpc: { data: null, error: null } });
    await expect(submitMapperPlace(INPUT, options)).rejects.toMatchObject({ kind: 'unknown' });
    expect(remove).toHaveBeenCalled();
  });
});
