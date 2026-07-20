import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FakeCall {
  method: string;
  args: unknown[];
}

export interface FakeSupabaseOptions {
  session?: FakeSession | null;
  tables?: Record<string, Record<string, unknown>[]>;
  rpcHandlers?: Record<string, (args: unknown) => unknown>;
  storage?: Record<string, Blob>;
}

export interface FakeSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; role?: string };
}

export function makeFakeSupabaseClient(
  options: FakeSupabaseOptions = {},
): SupabaseClient & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  let currentSession = options.session ?? null;
  const tables = new Map<string, Record<string, unknown>[]>(
    Object.entries(options.tables ?? {}),
  );
  const storageObjects = new Map<string, Blob>(
    Object.entries(options.storage ?? {}),
  );

  function record(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  const auth = {
    signInWithOtp: vi.fn(
      async (credentials: { email: string; options?: Record<string, unknown> }) => {
        record('auth.signInWithOtp', [credentials]);
        return { data: {}, error: null };
      },
    ),
    verifyOtp: vi.fn(
      async (credentials: { email: string; token: string; type: string }) => {
        record('auth.verifyOtp', [credentials]);
        const session: FakeSession =
          currentSession ?? {
            access_token: 'fake-access-token',
            refresh_token: 'fake-refresh-token',
            expires_at: 9999999999,
            user: { id: 'public-user-id', role: 'public_user' },
          };
        currentSession = session;
        return { data: { session, user: session.user }, error: null };
      },
    ),
    setSession: vi.fn(async (session: FakeSession | null) => {
      record('auth.setSession', [session]);
      currentSession = session;
      return { data: { session }, error: null };
    }),
    getSession: vi.fn(async () => {
      record('auth.getSession', []);
      return { data: { session: currentSession }, error: null };
    }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };

  function query(table: string) {
    const filters: Array<{ column: string; op: 'eq' | 'in'; value: unknown }> =
      [];

    const builder = {
      select: vi.fn(() => builder),
      eq(column: string, value: unknown) {
        filters.push({ column, op: 'eq', value });
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push({ column, op: 'in', value: values });
        return builder;
      },
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        const rows = evaluate();
        return { data: rows[0] ?? null, error: null };
      }),
      single: vi.fn(async () => {
        const rows = evaluate();
        return { data: rows[0] ?? null, error: null };
      }),
    };

    function evaluate() {
      const rows = tables.get(table) ?? [];
      return rows.filter((row) =>
        filters.every((filter) => {
          if (filter.op === 'eq') {
            return row[filter.column] === filter.value;
          }
          return (filter.value as unknown[]).includes(row[filter.column]);
        }),
      );
    }

    return builder;
  }

  function storageFrom(bucket: string) {
    return {
      upload: vi.fn(
        async (path: string, file: unknown, options?: Record<string, unknown>) => {
          record('storage.upload', [bucket, path, file, options]);
          storageObjects.set(path, file as Blob);
          return { data: { path }, error: null };
        },
      ),
      download: vi.fn(async (path: string) => {
        record('storage.download', [bucket, path]);
        const data = storageObjects.get(path) ?? null;
        return { data, error: data ? null : { message: 'Object not found' } };
      }),
      list: vi.fn(async (prefix: string) => {
        record('storage.list', [bucket, prefix]);
        const prefixWithSlash = prefix ? `${prefix}/` : '';
        const entries = Array.from(storageObjects.keys())
          .filter(
            (key) =>
              key.startsWith(prefixWithSlash) ||
              (!prefix && key.includes('/')) ||
              key === prefix,
          )
          .map((key) => ({
            name: key.slice(prefixWithSlash.length).split('/')[0] ?? key,
          }));
        return { data: entries, error: null };
      }),
      createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
        record('storage.createSignedUrl', [bucket, path, expiresIn]);
        if (!storageObjects.has(path)) {
          return { data: null, error: { message: 'Not found' } };
        }
        return {
          data: {
            signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=fake`,
          },
          error: null,
        };
      }),
    };
  }

  const rpc = vi.fn(async (name: string, args?: unknown) => {
    record('rpc', [name, args]);
    const handler = options.rpcHandlers?.[name];
    const result = handler
      ? handler(args)
      : { place_id: 'a1111111-1111-4111-8111-111111111111' };
    return { data: result, error: null };
  });

  const from = vi.fn((table: string) => query(table));

  return {
    auth,
    from,
    rpc,
    storage: { from: storageFrom },
    calls,
  } as unknown as SupabaseClient & { calls: FakeCall[] };
}
