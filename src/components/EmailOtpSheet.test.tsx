import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailOtpSheet } from './EmailOtpSheet';

const { requestEmailOtp, verifyEmailOtp } = vi.hoisted(() => ({
  requestEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

vi.mock('../services/publicAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/publicAuth')>();
  return {
    ...actual,
    requestEmailOtp,
    verifyEmailOtp,
  };
});

describe('EmailOtpSheet', () => {
  beforeEach(() => {
    requestEmailOtp.mockReset();
    verifyEmailOtp.mockReset();
    requestEmailOtp.mockResolvedValue({ ok: true });
    verifyEmailOtp.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } });
  });

  afterEach(() => {
    cleanup();
  });

  it('explains that viewing is free and email is only for adding', () => {
    render(<EmailOtpSheet open onClose={() => undefined} onVerified={() => undefined} />);
    expect(screen.getByText(/просмотр карты не требует регистрации/i)).toBeTruthy();
  });

  it('validates email before requesting a code', async () => {
    const user = userEvent.setup();
    render(<EmailOtpSheet open onClose={() => undefined} onVerified={() => undefined} />);
    await user.click(screen.getByRole('button', { name: /получить код/i }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(requestEmailOtp).not.toHaveBeenCalled();
  });

  it('requests OTP and moves to the six-digit step', async () => {
    const user = userEvent.setup();
    render(<EmailOtpSheet open onClose={() => undefined} onVerified={() => undefined} />);
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /получить код/i }));
    await waitFor(() => {
      expect(requestEmailOtp).toHaveBeenCalledWith('user@example.com');
      expect(screen.getByLabelText(/код из письма/i)).toBeTruthy();
    });
  });

  it('verifies a six-digit code and calls onVerified', async () => {
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<EmailOtpSheet open onClose={() => undefined} onVerified={onVerified} />);
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /получить код/i }));
    await screen.findByLabelText(/код из письма/i);
    await user.type(screen.getByLabelText(/код из письма/i), '123456');
    await user.click(screen.getByRole('button', { name: /подтвердить/i }));
    await waitFor(() => {
      expect(verifyEmailOtp).toHaveBeenCalledWith('user@example.com', '123456');
      expect(onVerified).toHaveBeenCalled();
    });
  });
});
