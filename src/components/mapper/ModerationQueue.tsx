import { ArrowLeft, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { categoryName, type RampType, type YesNoUnknown } from '../../shared/index';
import {
  fetchModerationQueue,
  moderatePlace,
  type ModerationCard,
  type ModerationDecision,
} from '../../services/moderation';
import type { Place } from '../../types';
import { MapLibreMap } from '../map/MapLibreMap';

interface ModerationQueueProps {
  theme: 'light' | 'dark';
  onClose: () => void;
  /** Очередь изменилась: сколько карточек осталось и была ли публикация. */
  onChanged: (left: number, published: boolean) => void;
  /** Подменяются в тестах. */
  loadQueue?: () => Promise<ModerationCard[]>;
  decide?: (placeId: string, decision: ModerationDecision) => Promise<void>;
  /** В тестах карту не рисуем: MapLibre нужен WebGL. */
  showMap?: boolean;
}

const STATUS_TITLE = {
  green: 'Доступно',
  yellow: 'Частично доступно',
  red: 'Недоступно',
  gray: 'Не оценено',
} as const;

const RAMP_TEXT: Record<RampType, string> = {
  none: 'нет',
  permanent: 'постоянный',
  portable_available: 'приставной, на месте',
  portable_on_request: 'приставной, по просьбе',
  lift: 'подъёмник у входа',
};

const ANSWER: Record<YesNoUnknown, string> = { yes: 'да', no: 'нет', unknown: 'не проверено' };

const TOILET_ACCESS: Record<string, string> = {
  yes: 'доступен на коляске',
  partial: 'доступен частично',
  no: 'на коляске не попасть',
  unknown: '',
};

function toMapPlace(card: ModerationCard): Place {
  const p = card.place;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    stepsCount: p.stepsCount,
    stepHeightCm: p.stepHeightCm,
    rampType: p.rampType,
    doorWidthCm: p.doorWidthCm,
    entranceNotes: p.entranceNotes,
    toiletExists: p.toiletExists,
    toiletAccessible: p.toiletAccessible,
    parking: p.parking,
    comment: p.comment,
    osmTags: p.osmTags,
    moderationStatus: p.moderationStatus,
    source: p.source as Place['source'],
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * Очередь проверки: одна карточка на экране — фото входа, данные картографа,
 * точка на карте и два решения. Опубликованная карточка сразу видна всем.
 */
export function ModerationQueue({
  theme,
  onClose,
  onChanged,
  loadQueue = fetchModerationQueue,
  decide = moderatePlace,
  showMap = true,
}: ModerationQueueProps) {
  const [cards, setCards] = useState<ModerationCard[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<ModerationDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadQueue()
      .then((list) => {
        if (cancelled) return;
        setCards(list);
        setIndex(0);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, loadQueue]);

  const card = cards[Math.min(index, cards.length - 1)] ?? null;
  const cardId = card?.place.id ?? null;
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Новая карточка открывается с начала, а не с места, где листали прошлую.
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [cardId]);

  const resolve = useCallback(
    async (decision: ModerationDecision) => {
      if (!card || busy) return;
      setBusy(decision);
      setError(null);
      try {
        await decide(card.place.id, decision);
        const rest = cards.filter((item) => item.place.id !== card.place.id);
        setCards(rest);
        setIndex((current) => Math.min(current, Math.max(0, rest.length - 1)));
        setNote(
          decision === 'published'
            ? `«${card.place.name}» опубликован и виден на карте.`
            : `«${card.place.name}» отклонён и на карту не попадёт.`,
        );
        onChanged(rest.length, decision === 'published');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить решение');
      } finally {
        setBusy(null);
      }
    },
    [busy, card, cards, decide, onChanged],
  );

  const category = card ? categoryName(card.place.category) : '';

  return createPortal(
    <div className="nf-screen" role="dialog" aria-modal="true" aria-label="Очередь проверки">
      <header className="nf-top is-final">
        <button type="button" aria-label="Назад" onClick={onClose}>
          <ArrowLeft size={22} />
        </button>
        <span>Проверка{cards.length > 0 ? ` · ${Math.min(index, cards.length - 1) + 1} из ${cards.length}` : ''}</span>
        {cards.length > 1 && (
          <span className="mq-nav">
            <button
              type="button"
              aria-label="Предыдущая карточка"
              disabled={index === 0 || busy !== null}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Следующая карточка"
              disabled={index >= cards.length - 1 || busy !== null}
              onClick={() => setIndex((i) => Math.min(cards.length - 1, i + 1))}
            >
              <ChevronRight size={22} />
            </button>
          </span>
        )}
      </header>

      <div className="nf-body" ref={bodyRef}>
        {note && (
          <p className="mq-note" role="status">
            {note}
          </p>
        )}
        {state === 'loading' && <p className="nf-hint">Загружаем очередь…</p>}
        {state === 'error' && (
          <div className="cab-error" role="alert">
            <p className="nf-hint">Не удалось загрузить очередь. Проверьте связь.</p>
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
        {state === 'ready' && !card && (
          <div className="nf-done">
            <span className="nf-done-mark">
              <Check size={40} aria-hidden="true" />
            </span>
            <h2>Очередь пуста</h2>
            <p className="nf-hint">Все карточки разобраны.</p>
          </div>
        )}
        {state === 'ready' && card && (
          <article className="mq-card" key={card.place.id}>
            {card.photoUrl ? (
              <img className="mq-photo" src={card.photoUrl} alt={`Фото входа: ${card.place.name}`} />
            ) : (
              <p className="mq-photo is-missing">Фото не загрузилось</p>
            )}
            <h2 className="mq-name">{card.place.name}</h2>
            <p className="mq-sub">
              {category}
              {card.facts.subtype ? ` · ${card.facts.subtype}` : ''}
            </p>
            <p className={`mq-status is-${card.place.status}`}>
              <span className={`nf-dot is-${card.place.status}`} aria-hidden="true" />
              {STATUS_TITLE[card.place.status]}
            </p>
            <dl className="mq-facts">
              <div>
                <dt>Ступени</dt>
                <dd>{card.place.stepsCount ?? 'не проверено'}</dd>
              </div>
              <div>
                <dt>Пандус</dt>
                <dd>{RAMP_TEXT[card.place.rampType]}</dd>
              </div>
              {card.place.stepHeightCm != null ? (
                <div>
                  <dt>Высота ступени</dt>
                  <dd>{card.place.stepHeightCm} см, предварительно</dd>
                </div>
              ) : (
                <div>
                  <dt>Ступень выше 5 см</dt>
                  <dd>{ANSWER[card.facts.stepHigh]}</dd>
                </div>
              )}
              {card.place.doorWidthCm != null ? (
                <div>
                  <dt>Ширина двери</dt>
                  <dd>{card.place.doorWidthCm} см, предварительно</dd>
                </div>
              ) : (
                <div>
                  <dt>Дверь шире 80 см</dt>
                  <dd>{ANSWER[card.facts.doorWide]}</dd>
                </div>
              )}
              {card.place.toiletExists !== 'unknown' && (
                <div>
                  <dt>Туалет</dt>
                  <dd>
                    {card.place.toiletExists === 'no'
                      ? 'нет'
                      : `есть${TOILET_ACCESS[card.place.toiletAccessible] ? `, ${TOILET_ACCESS[card.place.toiletAccessible]}` : ''}`}
                  </dd>
                </div>
              )}
              {card.facts.handWash !== 'unknown' && (
                <div>
                  <dt>Можно помыть руки</dt>
                  <dd>{ANSWER[card.facts.handWash]}</dd>
                </div>
              )}
              {card.facts.accessibleParking !== 'unknown' && (
                <div>
                  <dt>Парковка для людей с инвалидностью</dt>
                  <dd>{ANSWER[card.facts.accessibleParking]}</dd>
                </div>
              )}
              {card.facts.elevator !== 'unknown' && (
                <div>
                  <dt>Лифт между этажами</dt>
                  <dd>{ANSWER[card.facts.elevator]}</dd>
                </div>
              )}
            </dl>
            {card.facts.toiletNote && <p className="mq-note">Туалет: {card.facts.toiletNote}</p>}
            {card.toiletPhotoUrls.length > 0 && (
              <div className="mq-extra-photos">
                {card.toiletPhotoUrls.map((url, i) => (
                  <img key={url} src={url} alt={`Фото туалета ${i + 1}: ${card.place.name}`} />
                ))}
              </div>
            )}
            {showMap && (
              <div className="mq-map">
                <MapLibreMap
                  places={[toMapPlace(card)]}
                  selectedPlaceId={null}
                  theme={theme}
                  initialCenter={{ lat: card.place.lat, lng: card.place.lng }}
                />
              </div>
            )}
          </article>
        )}
      </div>

      {state === 'ready' && card && (
        <footer className="nf-foot mq-foot">
          {error && (
            <p className="nf-send-error" role="alert">
              {error}
            </p>
          )}
          <div className="nf-two">
            <button
              type="button"
              className="nf-btn is-ghost"
              disabled={busy !== null}
              onClick={() => void resolve('hidden')}
            >
              <X size={18} aria-hidden="true" /> {busy === 'hidden' ? 'Отклоняем…' : 'Отклонить'}
            </button>
            <button
              type="button"
              className="nf-btn is-final"
              disabled={busy !== null}
              onClick={() => void resolve('published')}
            >
              <Check size={18} aria-hidden="true" /> {busy === 'published' ? 'Публикуем…' : 'Опубликовать'}
            </button>
          </div>
        </footer>
      )}
    </div>,
    document.body,
  );
}
