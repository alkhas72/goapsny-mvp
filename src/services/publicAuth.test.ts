import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isValidEmail,
  isValidOtpCode,
  normalizeEmail,
  otpResendRemainingMs,
  OTP_RESEND_COOLDOWN_MS,
  requestEmailOtp,
  verifyEmailOtp,
  signOutPublicUser,
  maskEmailDomain,
} from './publicAuth';

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const signOut = vi.fn();

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: { signInWithOtp, verifyOtp, signOut },
  }),
}));

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a trimmed valid address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects empty and malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@missing.local')).toBe(false);
  });
});

describe('isValidOtpCode', () => {
  it('requires exactly eight digits from the configured Supabase project', () => {
    expect(isValidOtpCode('12345678')).toBe(true);
    expect(isValidOtpCode('123456')).toBe(false);
    expect(isValidOtpCode('123456789')).toBe(false);
    expect(isValidOtpCode('12a45678')).toBe(false);
  });
});

describe('otpResendRemainingMs', () => {
  it('returns zero after cooldown elapsed', () => {
    const now = 100_000;
    expect(otpResendRemainingMs(now - OTP_RESEND_COOLDOWN_MS, now)).toBe(0);
  });

  it('returns remaining milliseconds during cooldown', () => {
    const now = 100_000;
    expect(otpResendRemainingMs(now - 10_000, now)).toBe(OTP_RESEND_COOLDOWN_MS - 10_000);
  });
});

describe('requestEmailOtp', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
  });

  it('calls signInWithOtp with shouldCreateUser true', async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    const result = await requestEmailOtp('user@example.com');
    expect(result.ok).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('returns validation error for invalid email without calling Supabase', async () => {
    const result = await requestEmailOtp('bad');
    expect(result.ok).toBe(false);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('surfaces Supabase errors', async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: 'rate limited' } });
    const result = await requestEmailOtp('user@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('rate limited');
  });
});

describe('verifyEmailOtp', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  it('calls verifyOtp with email type and normalized email', async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { session: { user: { id: 'u1', email: 'user@example.com' } } },
      error: null,
    });
    const session = await verifyEmailOtp(' User@Example.com ', '65432109');
    expect(session?.user.id).toBe('u1');
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '65432109',
      type: 'email',
    });
  });

  it('returns null on invalid code shape', async () => {
    const session = await verifyEmailOtp('user@example.com', 'abc');
    expect(session).toBeNull();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('signOutPublicUser', () => {
  beforeEach(() => {
    signOut.mockReset();
  });

  it('calls auth.signOut', async () => {
    signOut.mockResolvedValueOnce({ error: null });
    await signOutPublicUser();
    expect(signOut).toHaveBeenCalled();
  });
});

describe('maskEmailDomain', () => {
  it('masks local part and keeps domain', () => {
    expect(maskEmailDomain('user@example.com')).toBe('u***@example.com');
  });
});
