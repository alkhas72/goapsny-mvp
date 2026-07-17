import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  OTP_CODE_LENGTH,
  isValidEmail,
  isValidOtpCode,
  otpResendRemainingMs,
  requestEmailOtp,
  verifyEmailOtp,
} from '../services/publicAuth';
import { trapFocus } from '../utils/focusTrap';

interface EmailOtpSheetProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

type Step = 'email' | 'code';

export function EmailOtpSheet({ open, onClose, onVerified }: EmailOtpSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);

  useEffect(() => {
    if (!open || lastSentAt == null) return;
    const tick = () => setCooldownMs(otpResendRemainingMs(lastSentAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, lastSentAt]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    return trapFocus(sheetRef.current, {
      initialFocus: closeButtonRef.current,
      onEscape: handleClose,
    });
  }, [open, handleClose]);

  const handleRequestCode = async () => {
    if (pending) return;
    if (!isValidEmail(email)) {
      setError('Введите корректный email');
      return;
    }
    setPending(true);
    setError(null);
    const result = await requestEmailOtp(email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLastSentAt(Date.now());
    setStep('code');
  };

  const handleVerify = async () => {
    if (pending) return;
    if (!isValidOtpCode(code)) {
      setError('Введите восьмизначный код из письма');
      return;
    }
    setPending(true);
    setError(null);
    const session = await verifyEmailOtp(email, code);
    setPending(false);
    if (!session) {
      setError('Неверный или просроченный код. Проверьте email и попробуйте снова.');
      return;
    }
    onVerified();
  };

  if (!open) return null;

  const resendDisabled = pending || cooldownMs > 0;

  return (
    <div className="overlay-scrim auth-scrim" onClick={handleClose}>
      <article
        ref={sheetRef}
        className="bottom-sheet public-auth-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Вход для добавления места"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-close-row">
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Закрыть вход"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        <h2 className="wizard-title">Добавить объект</h2>
        <p className="wizard-sub">
          Просмотр карты не требует регистрации. Email и код нужны только чтобы добавить место.
        </p>

        {step === 'email' ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="public-auth-email">
                Email
              </label>
              <input
                id="public-auth-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="form-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              disabled={pending}
              onClick={() => void handleRequestCode()}
            >
              {pending ? 'Отправка…' : 'Получить код'}
            </button>
          </>
        ) : (
          <>
            <p className="wizard-sub">Код отправлен на {email}</p>
            <div className="form-group">
              <label className="form-label" htmlFor="public-auth-code">
                Код из письма
              </label>
              <input
                id="public-auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_CODE_LENGTH}
                pattern="[0-9]*"
                className="form-input otp-input"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH))
                }
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              disabled={pending}
              onClick={() => void handleVerify()}
            >
              {pending ? 'Проверка…' : 'Подтвердить'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={resendDisabled}
              onClick={() => void handleRequestCode()}
            >
              {cooldownMs > 0
                ? `Отправить снова (${Math.ceil(cooldownMs / 1000)} с)`
                : 'Отправить код снова'}
            </button>
            <button type="button" className="text-btn" onClick={() => setStep('email')}>
              Изменить email
            </button>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </article>
    </div>
  );
}
