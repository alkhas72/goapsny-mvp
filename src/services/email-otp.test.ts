import { describe, expect, it } from 'vitest';
import { makeFakeSupabaseClient } from '../test/fake-supabase';
import {
  loadPersistedPublicUserSession,
  PUBLIC_SESSION_KEY,
  PUBLIC_USER_ROLE,
  requestEmailOtp,
  restorePublicUserSession,
  verifyEmailOtp,
} from '../test/g1-contract-harness';

describe('email OTP contract', () => {
  it('requests OTP via Supabase signInWithOtp with shouldCreateUser', async () => {
    const client = makeFakeSupabaseClient();
    await requestEmailOtp(client, 'test@example.com');

    const call = client.calls.find((c) => c.method === 'auth.signInWithOtp');
    expect(call).toBeDefined();
    expect(call?.args[0]).toEqual({
      email: 'test@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('verifies OTP and persists a public_user session', async () => {
    const client = makeFakeSupabaseClient();
    const result = await verifyEmailOtp(client, 'test@example.com', '123456');

    expect(result.user.role).toBe(PUBLIC_USER_ROLE);
    expect(client.calls.some((c) => c.method === 'auth.verifyOtp')).toBe(true);

    const persisted = loadPersistedPublicUserSession();
    expect(persisted).not.toBeNull();
    expect(persisted?.access_token).toBe('fake-access-token');
    expect(persisted?.user.role).toBe(PUBLIC_USER_ROLE);
  });

  it('restores a persisted session by calling setSession', async () => {
    localStorage.setItem(
      PUBLIC_SESSION_KEY,
      JSON.stringify({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: 1234567890,
        user: { id: 'u1', role: PUBLIC_USER_ROLE },
      }),
    );

    const client = makeFakeSupabaseClient();
    const session = await restorePublicUserSession(client);

    expect(session).not.toBeNull();
    expect(client.calls.some((c) => c.method === 'auth.setSession')).toBe(true);
  });
});
