import { ArrowLeft, Award, ChevronRight, ClipboardCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { karmaLevelFor, karmaNext } from '../../shared/index';
import {
  canModerate,
  fetchMySubmissions,
  type MapperAccount,
  type ModerationStatus,
  type MySubmission,
} from '../../services/moderation';

interface MapperDayProps {
  /** Кто вошёл; null — никто. */
  account: MapperAccount | null;
  /** Почта вошедшего, уже скрытая (м***@example.org). */
  accountLabel: string | null;
  /** Сколько карточек ждёт проверки; null — человек не модератор. */
  queueCount: number | null;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenQueue: () => void;
  /** Подменяется в тестах. */
  loadSubmissions?: (userId: string) => Promise<MySubmission[]>;
}

const MODERATION_LABEL: Record<ModerationStatus, string> = {
  pending: 'на проверке',
  published: 'на карте',
  hidden: 'отклонён',
};

function when(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/**
 * Кабинет картографа: карма и звание, свои объекты с состоянием проверки и,
 * для модератора, вход в очередь. Всё читается с сервера — список на
 * устройстве больше не считается источником.
 */
export function MapperDay({
  account,
  accountLabel,
  queueCount,
  onClose,
  onSignIn,
  onSignOut,
  onOpenQueue,
  loadSubmissions = fetchMySubmissions,
}: MapperDayProps) {
  const [items, setItems] = useState<MySubmission[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    loadSubmissions(accountId)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, attempt, loadSubmissions]);

  const karma = account?.karma ?? 0;
  const level = karmaLevelFor(karma);
  const { next, remaining } = karmaNext(karma);
  const progress = next ? Math.round(((karma - level.threshold) / (next.threshold - level.threshold)) * 100) : 100;
  const today = items.filter((item) => isToday(item.createdAt)).length;
  const onMap = items.filter((item) => item.moderationStatus === 'published').length;
  const waiting = items.filter((item) => item.moderationStatus === 'pending').length;

  return createPortal(
    <div className="nf-screen" role="dialog" aria-modal="true" aria-label="Кабинет">
      <header className="nf-top is-final">
        <button type="button" aria-label="Назад" onClick={onClose}>
          <ArrowLeft size={22} />
        </button>
        <span>Кабинет</span>
      </header>
      <div className="nf-body">
        {!account ? (
          <section className="cab-signin">
            <h2>Войдите, чтобы добавлять объекты</h2>
            <p className="nf-hint">
              Код придёт на почту. После входа ваши объекты уходят на проверку и появляются здесь.
            </p>
            <button type="button" className="nf-btn is-work" onClick={onSignIn}>
              Войти по почте
            </button>
          </section>
        ) : (
          <>
            <section className="cab-karma">
              <div className="cab-karma-top">
                <span>
                  <Sparkles size={16} aria-hidden="true" /> Ваша карма
                </span>
                <b>{karma}</b>
              </div>
              <span className="cab-status">
                <Award size={14} aria-hidden="true" /> Статус: {level.ru}
              </span>
              <div className="cab-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${progress}%` }} />
              </div>
              {next && (
                <p className="nf-hint">
                  До статуса «{next.ru}» — ещё {remaining} кармы
                </p>
              )}
            </section>

            {canModerate(account.role) && (
              <button type="button" className="cab-queue" onClick={onOpenQueue}>
                <ClipboardCheck size={20} aria-hidden="true" />
                <span>
                  <b>Очередь проверки</b>
                  <small>
                    {queueCount == null
                      ? 'Загружаем…'
                      : queueCount === 0
                        ? 'Новых карточек нет'
                        : `Ждут решения: ${queueCount}`}
                  </small>
                </span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            )}

            <div className="cab-stats">
              <div>
                <b>{today}</b>
                <span>сегодня</span>
              </div>
              <div>
                <b>{waiting}</b>
                <span>на проверке</span>
              </div>
              <div>
                <b>{onMap}</b>
                <span>на карте</span>
              </div>
            </div>

            <p className="nf-label">Мои объекты</p>
            {state === 'loading' && <p className="nf-hint">Загружаем…</p>}
            {state === 'error' && (
              <div className="cab-error" role="alert">
                <p className="nf-hint">Не удалось загрузить список. Проверьте связь.</p>
                <button
                  type="button"
                  className="nf-btn is-ghost"
                  onClick={() => {
                    setState('loading');
                    setAttempt((n) => n + 1);
                  }}
                >
                  Повторить
                </button>
              </div>
            )}
            {state === 'ready' && items.length === 0 && (
              <p className="nf-hint">Пока пусто. Добавьте первый объект с карты.</p>
            )}
            {state === 'ready' && items.length > 0 && (
              <ol className="cab-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <span className={`nf-dot is-${item.status}`} aria-hidden="true" />
                    <span className="cab-name">
                      {item.name}
                      <small>{when(item.createdAt)}</small>
                    </span>
                    <span className={`cab-meta is-${item.moderationStatus}`}>
                      <small>{MODERATION_LABEL[item.moderationStatus]}</small>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <button type="button" className="cab-signout" onClick={onSignOut}>
              Выйти{accountLabel ? ` · ${accountLabel}` : ''}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
