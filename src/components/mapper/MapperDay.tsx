import { ArrowLeft, Award, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
import { karmaLevelFor, karmaNext } from '../../shared/index';
import { dayKarma, DEMO_START_KARMA, type DayEntry } from './dayLog';

interface MapperDayProps {
  entries: DayEntry[];
  onClose: () => void;
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Кабинет after the GoApsny canon profile: karma and title on the ladder,
 * today's numbers, and one line per place added today.
 */
export function MapperDay({ entries, onClose }: MapperDayProps) {
  const karma = DEMO_START_KARMA + dayKarma(entries);
  const level = karmaLevelFor(karma);
  const { next, remaining } = karmaNext(karma);
  const progress = next ? Math.round(((karma - level.threshold) / (next.threshold - level.threshold)) * 100) : 100;
  const photos = entries.reduce((n, e) => n + e.photos, 0);

  return createPortal(
    <div className="nf-screen" role="dialog" aria-modal="true" aria-label="Кабинет">
      <header className="nf-top is-final">
        <button type="button" aria-label="Назад" onClick={onClose}>
          <ArrowLeft size={22} />
        </button>
        <span>Кабинет</span>
      </header>
      <div className="nf-body">
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

        <div className="cab-stats">
          <div>
            <b>{entries.length}</b>
            <span>объектов сегодня</span>
          </div>
          <div>
            <b>{photos}</b>
            <span>фото</span>
          </div>
          <div>
            <b>+{dayKarma(entries)}</b>
            <span>кармы за день</span>
          </div>
        </div>

        <p className="nf-label">Сегодня</p>
        {entries.length === 0 ? (
          <p className="nf-hint">Пока пусто.</p>
        ) : (
          <ol className="cab-list">
            {[...entries].reverse().map((e) => (
              <li key={e.id}>
                <span className={`nf-dot is-${e.status}`} aria-hidden="true" />
                <span className="cab-name">
                  {e.name}
                  <small>
                    {time(e.at)} · {e.reason}
                  </small>
                </span>
                <span className="cab-meta">
                  <b>+{e.karma}</b>
                  <small>на проверке</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
