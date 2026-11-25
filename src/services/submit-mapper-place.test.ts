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

  it('пустое фото на сервер не идёт: отказ сразу, без загрузки и без карточки', async () => {
    const { options, upload, rpc } = fakeClient();
    const empty = new Blob([], { type: 'image/jpeg' });

    await expect(submitMapperPlace({ ...INPUT, photo: empty }, options)).rejects.toMatchObject({
      kind: 'photo_unreadable',
    });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
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

  describe('сантиметры, туалет и отметки (миграция 25.11)', () => {
    const TOILET_A = new Blob(['a'], { type: 'image/jpeg' });
    const TOILET_B = new Blob(['b'], { type: 'image/jpeg' });
    const FULL: SubmitMapperPlaceInput = {
      ...INPUT,
      stepHigh: 'yes',
      doorWide: 'yes',
      stepHeightCm: 12,
      doorWidthCm: 85,
      stepHeightSource: 'photo',
      doorWidthSource: 'person',
      toilet: 'yes',
      toiletAccessible: 'partial',
      toiletPhotos: [TOILET_A, TOILET_B],
      toiletNote: '  Узкая дверь, поручней нет  ',
      handWash: 'yes',
      accessibleParking: 'no',
      elevator: 'unknown',
    };

    it('шлёт сантиметры с источником, фото туалета по своим путям и отметки', async () => {
      const { options, upload, rpc, remove } = fakeClient();
      const result = await submitMapperPlace(FULL, options);

      expect(upload.mock.calls.map((c) => c[0])).toEqual([
        `${UUID_A}/facade.jpg`,
        `${UUID_A}/toilet.jpg`,
        `${UUID_A}/toilet-2.jpg`,
      ]);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][1]).toMatchObject({
        p_step_high: 'yes',
        p_door_wide: 'yes',
        p_step_height_cm: 12,
        p_door_width_cm: 85,
        p_step_height_source: 'photo',
        p_door_width_source: 'person',
        p_toilet: 'yes',
        p_toilet_accessible: 'partial',
        p_toilet_photos: 2,
        p_toilet_note: 'Узкая дверь, поручней нет',
        p_hand_wash: 'yes',
        p_accessible_parking: 'no',
        p_elevator: 'unknown',
      });
      expect(remove).not.toHaveBeenCalled();
      expect(result.toiletPhotosSaved).toBe(2);
    });

    it('без туалета фото и описание не уходят', async () => {
      const { options, upload, rpc } = fakeClient();
      await submitMapperPlace({ ...FULL, toilet: 'no' }, options);
      expect(upload).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][1]).toMatchObject({
        p_toilet: 'no',
        p_toilet_accessible: 'unknown',
        p_toilet_photos: 0,
        p_toilet_note: null,
      });
    });

    it('фото туалета не легло — карточка уходит без него', async () => {
      const { options, upload, rpc } = fakeClient();
      upload
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: { statusCode: '403', message: 'new row violates row-level security policy' } });
      const result = await submitMapperPlace(FULL, options);
      // Второе фото после отказа первого уже не шлём.
      expect(upload).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][1]).toMatchObject({ p_toilet: 'yes', p_toilet_photos: 0 });
      expect(result.toiletPhotosSaved).toBe(0);
    });

    it('база ещё без миграции: карточка уходит прежним набором, фото туалета снимаются', async () => {
      const { options, rpc, remove } = fakeClient();
      rpc
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
        .mockResolvedValueOnce({ data: ROW, error: null });
      const result = await submitMapperPlace(FULL, options);

      expect(rpc).toHaveBeenCalledTimes(2);
      const second = rpc.mock.calls[1][1] as Record<string, unknown>;
      expect(Object.keys(second).sort()).toEqual(
        [
          'p_category',
          'p_door_wide',
          'p_lat',
          'p_lng',
          'p_name',
          'p_place_id',
          'p_ramp_type',
          'p_status',
          'p_step_high',
          'p_steps_count',
          'p_storage_path',
          'p_subtype',
        ].sort(),
      );
      expect(second).toMatchObject({ p_step_high: 'yes', p_door_wide: 'yes' });
      expect(remove).toHaveBeenCalledWith([`${UUID_A}/toilet.jpg`, `${UUID_A}/toilet-2.jpg`]);
      expect(result.toiletPhotosSaved).toBe(0);
      expect(result.placeId).toBe(UUID_A);
    });

    it('отказ сервера убирает и фасад, и фото туалета', async () => {
      const { options, remove } = fakeClient({
        rpc: { data: null, error: { code: '22P02', message: 'submit_mapper_place: invalid card: step height' } },
      });
      await expect(submitMapperPlace(FULL, options)).rejects.toMatchObject({ kind: 'card_invalid' });
      expect(remove).toHaveBeenCalledWith([`${UUID_A}/facade.jpg`, `${UUID_A}/toilet.jpg`, `${UUID_A}/toilet-2.jpg`]);
    });
  });
});
