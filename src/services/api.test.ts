import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * DG-3: в Telegram-контуре не осталось mock-фолбэков. Эти тесты фиксируют,
 * что отказ сервера — это исключение, а не тихий вход под локальным owner
 * и не запись в localStorage.
 */

const PROFILE_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  telegram_id: 123456,
  username: 'tester',
  display_name: 'Test User',
  role: 'tester',
  ai_enabled: true,
  karma: 120,
  karma_status: 'cartographer',
};

function stubConfig() {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
}

async function importApi() {
  vi.resetModules();
  return await import('./api');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('api.loginTelegram', () => {
  it('throws when Supabase is not configured', async () => {
    const { api } = await importApi();
    await expect(api.loginTelegram('initData')).rejects.toThrow(/не настроен/i);
  });

  it('surfaces server rejection instead of falling back to a local profile', async () => {
    stubConfig();
    const { api } = await importApi();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'bad_signature' }), { status: 401 })),
    );
    await expect(api.loginTelegram('forged-init-data')).rejects.toThrow(/bad_signature/);
  });

  it('fails closed on network errors', async () => {
    stubConfig();
    const { api } = await importApi();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );
    await expect(api.loginTelegram('initData')).rejects.toThrow(/недоступен|connection refused/);
  });

  it('stores the session and maps the server profile', async () => {
    stubConfig();
    const { api } = await importApi();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'jwt-token',
              token_type: 'bearer',
              expires_at: 0,
              profile: PROFILE_ROW,
            }),
            { status: 200 },
          ),
      ),
    );
    const { token, profile } = await api.loginTelegram('valid-init-data');
    expect(token).toBe('jwt-token');
    expect(profile.id).toBe(PROFILE_ROW.id);
    expect(profile.role).toBe('tester');
    expect(profile.karmaStatus).toBe('Картограф');
    expect(profile.displayName).toBe('Test User');
  });
});

describe('api.createPlace', () => {
  it('rejects without a Telegram session instead of writing anywhere', async () => {
    stubConfig();
    const { api } = await importApi();
    await expect(api.createPlace({ name: 'Объект' })).rejects.toThrow(/сессии/i);
  });
});
