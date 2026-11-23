import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  canModerate,
  fetchMapperAccount,
  fetchModerationQueue,
  fetchMySubmissions,
  mapperFactsFromDetails,
  moderatePlace,
} from './moderation';

type Call = [method: string, ...args: unknown[]];

/** Цепочка запроса supabase-js: любой метод возвращает её же, await отдаёт результат. */
function chain(result: unknown, calls: Call[]) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push([prop, ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function client(tables: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const calls: Record<string, Call[]> = {};
  const supabase = {
    from: vi.fn((table: string) => {
      calls[table] = calls[table] ?? [];
      return chain(tables[table], calls[table]);
    }),
    ...extra,
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const PENDING_ROW = {
  id: 'p1',
  name: 'Аптека',
  category: 'health',
  lat: 43,
  lng: 41,
  status: 'red',
  steps_count: 3,
  step_height_cm: null,
  ramp_type: 'none',
  door_width_cm: null,
  entrance_notes: null,
  toilet_exists: 'unknown',
  toilet_accessible: 'unknown',
  parking: 'unknown',
  comment: null,
  osm_tags: {},
  details: { schema_version: 1, mapper: { subtype: 'Аптека', step_high: 'yes', door_wide: 'no' } },
  moderation_status: 'pending',
  source: 'public',
  created_by: 'u1',
  created_at: '2026-11-23T08:00:00Z',
  updated_at: '2026-11-23T08:00:00Z',
};

describe('canModerate', () => {
  it('проверяют только admin и owner', () => {
    expect(canModerate('admin')).toBe(true);
    expect(canModerate('owner')).toBe(true);
    expect(canModerate('operator')).toBe(false);
    expect(canModerate('public_user')).toBe(false);
    expect(canModerate(null)).toBe(false);
  });
});

describe('mapperFactsFromDetails', () => {
  it('читает ответы картографа', () => {
    expect(mapperFactsFromDetails(PENDING_ROW.details)).toEqual({
      subtype: 'Аптека',
      stepHigh: 'yes',
      doorWide: 'no',
    });
  });

  it('пустое и мусор превращаются в «не знаю»', () => {
    expect(mapperFactsFromDetails({ schema_version: 1 })).toEqual({
      subtype: null,
      stepHigh: 'unknown',
      doorWide: 'unknown',
    });
    expect(mapperFactsFromDetails({ mapper: { step_high: 'maybe', subtype: 7 } })).toEqual({
      subtype: null,
      stepHigh: 'unknown',
      doorWide: 'unknown',
    });
    expect(mapperFactsFromDetails(null).doorWide).toBe('unknown');
  });
});

describe('fetchMapperAccount', () => {
  it('без входа профиль не запрашивается', async () => {
    const { supabase } = client(
      {},
      { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
    );
    expect(await fetchMapperAccount(supabase)).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('отдаёт роль и карму вошедшего', async () => {
    const { supabase, calls } = client(
      { profiles: { data: { id: 'u1', role: 'admin', karma: 40, karma_status: 'explorer' }, error: null } },
      { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) } },
    );
    expect(await fetchMapperAccount(supabase)).toEqual({
      id: 'u1',
      role: 'admin',
      karma: 40,
      karmaStatus: 'explorer',
    });
    expect(calls.profiles).toContainEqual(['eq', 'id', 'u1']);
  });
});

describe('fetchMySubmissions', () => {
  it('берёт только свои объекты, новые сверху', async () => {
    const { supabase, calls } = client({
      places: {
        data: [
          { id: 'p1', name: ' Аптека ', category: 'health', status: 'red', moderation_status: 'pending', created_at: 't' },
        ],
        error: null,
      },
    });
    const list = await fetchMySubmissions('u1', supabase);
    expect(list).toEqual([
      { id: 'p1', name: 'Аптека', category: 'health', status: 'red', moderationStatus: 'pending', createdAt: 't' },
    ]);
    expect(calls.places).toContainEqual(['eq', 'created_by', 'u1']);
    expect(calls.places).toContainEqual(['order', 'created_at', { ascending: false }]);
  });

  it('отказ сервера не выдаётся за пустой список', async () => {
    const { supabase } = client({ places: { data: null, error: { message: 'denied' } } });
    await expect(fetchMySubmissions('u1', supabase)).rejects.toThrow('denied');
  });
});

describe('fetchModerationQueue', () => {
  it('отдаёт карточки на проверке с фото и ответами, старые сверху', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed/p1' } });
    const { supabase, calls } = client(
      {
        places: { data: [PENDING_ROW], error: null },
        photos: { data: [{ place_id: 'p1', storage_path: 'p1/facade.jpg' }], error: null },
      },
      { storage: { from: vi.fn(() => ({ createSignedUrl })) } },
    );

    const queue = await fetchModerationQueue(supabase);

    expect(queue).toHaveLength(1);
    expect(queue[0].place.name).toBe('Аптека');
    expect(queue[0].place.moderationStatus).toBe('pending');
    expect(queue[0].facts).toEqual({ subtype: 'Аптека', stepHigh: 'yes', doorWide: 'no' });
    expect(queue[0].photoUrl).toBe('https://signed/p1');
    expect(createSignedUrl).toHaveBeenCalledWith('p1/facade.jpg', 600);
    expect(calls.places).toContainEqual(['eq', 'moderation_status', 'pending']);
    expect(calls.places).toContainEqual(['order', 'created_at', { ascending: true }]);
  });

  it('пустая очередь не тянет фото', async () => {
    const { supabase } = client({ places: { data: [], error: null } });
    expect(await fetchModerationQueue(supabase)).toEqual([]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('moderatePlace', () => {
  it('публикует только карточку, которая ещё на проверке', async () => {
    const { supabase, calls } = client({ places: { data: [{ id: 'p1' }], error: null } });
    await moderatePlace('p1', 'published', supabase);
    expect(calls.places).toContainEqual(['update', { moderation_status: 'published' }]);
    expect(calls.places).toContainEqual(['eq', 'id', 'p1']);
    expect(calls.places).toContainEqual(['eq', 'moderation_status', 'pending']);
  });

  it('ноль затронутых строк — отказ, а не тихий успех', async () => {
    const { supabase } = client({ places: { data: [], error: null } });
    await expect(moderatePlace('p1', 'hidden', supabase)).rejects.toThrow('уже обработана');
  });

  it('ошибка сервера пробрасывается', async () => {
    const { supabase } = client({ places: { data: null, error: { message: 'moderation_status can be changed only by admin' } } });
    await expect(moderatePlace('p1', 'published', supabase)).rejects.toThrow('only by admin');
  });
});
