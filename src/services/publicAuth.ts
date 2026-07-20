import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const OTP_RESEND_COOLDOWN_MS = 60_000;
export const OTP_CODE_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
}

export function isValidOtpCode(code: string): boolean {
  return OTP_PATTERN.test(code.trim());
}

export function otpResendRemainingMs(lastSentAt: number | null, now = Date.now()): number {
  if (lastSentAt == null) return 0;
  return Math.max(0, OTP_RESEND_COOLDOWN_MS - (now - lastSentAt));
}

export function maskEmailDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export type OtpRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function requestEmailOtp(email: string): Promise<OtpRequestResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase is not configured' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Введите корректный email' };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function verifyEmailOtp(email: string, token: string): Promise<Session | null> {
  if (!isSupabaseConfigured() || !isValidEmail(email) || !isValidOtpCode(token)) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: token.trim(),
    type: 'email',
  });

  if (error || !data.session) {
    return null;
  }
  return data.session;
}

export async function getPublicSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signOutPublicUser(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export function subscribePublicSession(
  onChange: (session: Session | null) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    onChange(null);
    return () => undefined;
  }
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}
