import { X } from 'lucide-react';
import { karmaLevelFor, karmaNext, STATUS_META } from '../../shared/index';
import { dayKarma, DEMO_START_KARMA, type DayEntry } from './dayLog';

interface MapperDayProps {
  entries: DayEntry[];
  onClose: () => void;
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * The mapper's cabinet for today: title on the karma ladder, progress to the
 * next one, and one line per place added today.
 */
export function MapperDay({ entries, onClose }: MapperDayProps) {
  const karma = DEMO_START_KARMA + dayKarma(entries);
  const level = karmaLevelFor(karma);
  const { next, remaining } = karmaNext(karma);
  const progress = next ? Math.round(((karma - level.threshold) / (next.threshold - level.threshold)) * 100) : 100;

  return (
    <section className="mapper-card mapper-day" aria-label="Мой день">
      <button type="button" className="mapper-close" aria-label="Закрыть" onClick={onClose}>
        <X size={20} />
      </button>
      <h2 className="mapper-day-title">Мой день</h2>

      <div className="mapper-rank">
        <span className="mapper-rank-badge">{level.ru}</span>
        <span className="mapper-rank-karma">{karma} кармы</span>
        <div className="mapper-rank-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        {next && (
          <p className="mapper-hint">
            До звания «{next.ru}» — {remaining} кармы
          </p>
        )}
      </div>

      <p className="mapper-day-count">
        Сегодня: <b>{entries.length}</b>
      </p>
      {entries.length === 0 ? (
        <p className="mapper-hint">Пока пусто — первый объект ждёт.</p>
      ) : (
        <ol className="mapper-day-list">
          {[...entries].reverse().map((e) => (
            <li key={e.id}>
              <span className={`mapper-status-dot is-${e.status}`} aria-label={STATUS_META[e.status].ru} />
              <span className="mapper-day-name">
                {e.name}
                <small>{e.reason}</small>
              </span>
              <span className="mapper-day-meta">
                {time(e.at)}
                <small>на проверке</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
