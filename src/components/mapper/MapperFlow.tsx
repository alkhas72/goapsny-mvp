import { Accessibility, Camera, Check, Minus, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RampType } from '../../shared/index';
import { CATEGORIES, STATUS_META } from '../../shared/index';
import {
  EMPTY_FACTS,
  factsFromDraft,
  nextStep,
  SUBTYPES,
  suggestStatus,
  type EntranceDraft,
  type EntranceFacts,
  type FlowStep,
  type YesNoUnknown,
} from './assistant';
import { appendDay, type DayEntry } from './dayLog';
import { demoEyes, type AssistantEyes } from './eyes';

interface MapperFlowProps {
  /** Map centre under the crosshair — the entrance point. */
  getCenter: () => { lat: number; lng: number } | null;
  eyes?: AssistantEyes;
  onClose: () => void;
  onSaved: (entries: DayEntry[]) => void;
  onOpenDay: () => void;
}

const RAMP_OPTIONS: { value: RampType; label: string }[] = [
  { value: 'none', label: 'Нет пандуса' },
  { value: 'permanent', label: 'Постоянный' },
  { value: 'portable_available', label: 'Приставной, на месте' },
  { value: 'portable_on_request', label: 'Приставной, по просьбе' },
];

const RAMP_SAID: Record<RampType, string> = {
  none: 'пандуса не вижу',
  permanent: 'вижу постоянный пандус',
  portable_available: 'вижу приставной пандус',
  portable_on_request: 'пандус, похоже, по просьбе',
};

function NutsaSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="nutsa-says" role="status" aria-live="polite">
      <span className="nutsa-avatar" aria-hidden="true">
        <Accessibility size={22} strokeWidth={2.2} />
      </span>
      <p>
        <b>Нуца</b>
        {children}
      </p>
    </div>
  );
}

function YesNo({
  onAnswer,
  yes = 'Да',
  no = 'Нет',
}: {
  onAnswer: (v: YesNoUnknown) => void;
  yes?: string;
  no?: string;
}) {
  return (
    <div className="mapper-choice-row">
      <button type="button" className="mapper-choice" onClick={() => onAnswer('yes')}>
        {yes}
      </button>
      <button type="button" className="mapper-choice" onClick={() => onAnswer('no')}>
        {no}
      </button>
      <button type="button" className="mapper-choice is-quiet" onClick={() => onAnswer('unknown')}>
        Не знаю
      </button>
    </div>
  );
}

/**
 * Guided add flow for the mapper: point → photo → Нуца looks → category and
 * type → name → entrance questions → traffic light → saved. One screen, one
 * action; Нуца pre-fills what the photo shows and asks only the rest.
 */
export function MapperFlow({ getCenter, eyes = demoEyes, onClose, onSaved, onOpenDay }: MapperFlowProps) {
  const [step, setStep] = useState<FlowStep>('point');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntranceDraft | null>(null);
  const [facts, setFacts] = useState<EntranceFacts>(EMPTY_FACTS);
  const [editingName, setEditingName] = useState(false);
  const [savedEntries, setSavedEntries] = useState<DayEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const suggestion = useMemo(() => suggestStatus(facts), [facts]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const go = (patch: Partial<EntranceFacts> = {}) => {
    const next = { ...facts, ...patch };
    setFacts(next);
    setStep(nextStep(step, next));
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
    setStep('looking');
    try {
      const seen = await eyes.look(file);
      setDraft(seen);
      setFacts(factsFromDraft(seen));
    } catch {
      setDraft(null);
    }
    setStep('category');
  };

  const save = (status: 'green' | 'yellow' | 'red') => {
    const fullCard = facts.steps != null && facts.doorWide !== 'unknown' && facts.ramp != null;
    const entries = appendDay(
      {
        name: facts.name || facts.subtype || 'Без названия',
        subtype: facts.subtype,
        status,
        reason: status === suggestion.status ? suggestion.reason : 'светофор поставил картограф',
      },
      fullCard,
    );
    setSavedEntries(entries);
    onSaved(entries);
    setStep('done');
  };

  const restart = () => {
    setPoint(null);
    setPhotoUrl(null);
    setDraft(null);
    setFacts(EMPTY_FACTS);
    setSavedEntries(null);
    setStep('point');
  };

  // Point: crosshair over the map, a small card at the bottom.
  if (step === 'point') {
    return (
      <>
        <div className="mapper-crosshair" aria-hidden="true">
          <span />
        </div>
        <section className="mapper-card mapper-card--compact" aria-label="Новый объект">
          <button type="button" className="mapper-close" aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </button>
          <NutsaSays>Наведите крестик на вход в здание и нажмите «Вход здесь». Я помогу с остальным.</NutsaSays>
          <button
            type="button"
            className="mapper-primary"
            onClick={() => {
              setPoint(getCenter());
              setStep('photo');
            }}
          >
            Вход здесь
          </button>
        </section>
      </>
    );
  }

  const category = CATEGORIES.find((c) => c.slug === facts.category) ?? null;

  return (
    <section className="mapper-card" aria-label="Новый объект">
      <button type="button" className="mapper-close" aria-label="Закрыть" onClick={onClose}>
        <X size={20} />
      </button>

      {photoUrl && step !== 'done' && (
        <div className="mapper-photo-strip">
          <img src={photoUrl} alt="Фото входа" />
          <span>{facts.name || (category ? category.ru : 'Новый объект')}</span>
        </div>
      )}

      {step === 'photo' && (
        <>
          <NutsaSays>
            Точка стоит. Теперь сфотографируйте вход целиком — со ступенями и дверью, если они есть.
          </NutsaSays>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
          <button type="button" className="mapper-primary" onClick={() => fileRef.current?.click()}>
            <Camera size={20} aria-hidden="true" /> Сфотографировать вход
          </button>
          {point && (
            <p className="mapper-hint">
              Точка: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </p>
          )}
        </>
      )}

      {step === 'looking' && (
        <NutsaSays>
          Смотрю на фото… Лица и номера машин скрываю ещё на телефоне.
          <span className="nutsa-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </NutsaSays>
      )}

      {step === 'category' && (
        <>
          <NutsaSays>
            {draft?.subtype
              ? `Похоже, это ${draft.subtype.toLowerCase()}. Проверьте тип объекта.`
              : 'Какой это объект? Выберите раздел и тип.'}
          </NutsaSays>
          <div className="mapper-chip-grid" role="group" aria-label="Раздел">
            {CATEGORIES.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`mapper-chip${c.slug === facts.category ? ' is-active' : ''}`}
                aria-pressed={c.slug === facts.category}
                onClick={() => setFacts({ ...facts, category: c.slug, subtype: null })}
              >
                {c.ru}
              </button>
            ))}
          </div>
          {facts.category && (
            <div className="mapper-chip-grid" role="group" aria-label="Тип объекта">
              {(SUBTYPES[facts.category] ?? []).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`mapper-chip is-sub${t === facts.subtype ? ' is-active' : ''}`}
                  aria-pressed={t === facts.subtype}
                  onClick={() => go({ subtype: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 'name' && (
        <>
          <NutsaSays>
            {draft?.name && !editingName
              ? `На вывеске читаю: «${draft.name}». Верно?`
              : 'Как называется это место? Как на вывеске.'}
          </NutsaSays>
          {draft?.name && !editingName ? (
            <div className="mapper-choice-row">
              <button type="button" className="mapper-choice is-yes" onClick={() => go({ name: draft.name ?? '' })}>
                <Check size={18} aria-hidden="true" /> Верно
              </button>
              <button type="button" className="mapper-choice" onClick={() => setEditingName(true)}>
                <Pencil size={18} aria-hidden="true" /> Исправить
              </button>
            </div>
          ) : (
            <form
              className="mapper-name-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (facts.name.trim()) go();
              }}
            >
              <input
                className="mapper-input"
                value={facts.name}
                placeholder="Название"
                autoFocus
                onChange={(e) => setFacts({ ...facts, name: e.target.value })}
              />
              <button type="submit" className="mapper-primary" disabled={!facts.name.trim()}>
                Дальше
              </button>
            </form>
          )}
        </>
      )}

      {step === 'steps' && (
        <>
          <NutsaSays>
            {draft?.stepsVisible != null
              ? `На фото вижу ${draft.stepsVisible === 0 ? 'вход без ступеней' : `ступеней: ${draft.stepsVisible}`}. Посчитайте на месте и поправьте, если нужно.`
              : 'Сколько ступеней у входа?'}
          </NutsaSays>
          <div className="mapper-stepper" role="group" aria-label="Ступени">
            <button
              type="button"
              aria-label="Меньше"
              onClick={() => setFacts({ ...facts, steps: Math.max(0, (facts.steps ?? 0) - 1) })}
            >
              <Minus size={22} />
            </button>
            <output aria-live="polite">{facts.steps ?? 0}</output>
            <button type="button" aria-label="Больше" onClick={() => setFacts({ ...facts, steps: (facts.steps ?? 0) + 1 })}>
              <Plus size={22} />
            </button>
          </div>
          <button type="button" className="mapper-primary" onClick={() => go({ steps: facts.steps ?? 0 })}>
            {(facts.steps ?? 0) === 0 ? 'Ступеней нет' : 'Верно'}
          </button>
        </>
      )}

      {step === 'stepHigh' && (
        <>
          <NutsaSays>Хотя бы одна ступень выше 7 сантиметров — примерно в ладонь?</NutsaSays>
          <YesNo onAnswer={(v) => go({ stepHigh: v })} />
        </>
      )}

      {step === 'ramp' && (
        <>
          <NutsaSays>
            {draft?.ramp ? `На фото ${RAMP_SAID[draft.ramp]}. Как на самом деле?` : 'Есть ли пандус?'}
          </NutsaSays>
          <div className="mapper-choice-col">
            {RAMP_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`mapper-choice${o.value === facts.ramp ? ' is-yes' : ''}`}
                onClick={() => go({ ramp: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'door' && (
        <>
          <NutsaSays>Дверь шире 80 сантиметров? Это примерно длина руки от плеча до кончиков пальцев.</NutsaSays>
          <YesNo onAnswer={(v) => go({ doorWide: v })} />
        </>
      )}

      {step === 'status' && (
        <>
          <NutsaSays>
            Предлагаю светофор: <b className={`status-word is-${suggestion.status}`}>{STATUS_META[suggestion.status].ru.toLowerCase()}</b>{' '}
            — {suggestion.reason}.
            {suggestion.unchecked.length > 0 && ` Не проверено: ${suggestion.unchecked.join(', ')}.`}
          </NutsaSays>
          <div className="mapper-status-row" role="group" aria-label="Светофор">
            {(['green', 'yellow', 'red'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`mapper-status is-${s}${s === suggestion.status ? ' is-suggested' : ''}`}
                onClick={() => save(s)}
              >
                <span className="mapper-status-dot" aria-hidden="true" />
                {STATUS_META[s].ru}
              </button>
            ))}
          </div>
          <p className="mapper-hint">Нажмите цвет — объект уйдёт на проверку.</p>
        </>
      )}

      {step === 'done' && savedEntries && (
        <>
          <NutsaSays>
            Готово, объект на проверке. Сегодня у вас {savedEntries.length}{' '}
            {savedEntries.length === 1 ? 'объект' : savedEntries.length < 5 ? 'объекта' : 'объектов'} — отличный темп!
          </NutsaSays>
          <p className="mapper-karma">+{savedEntries[savedEntries.length - 1].karma} кармы</p>
          <button type="button" className="mapper-primary" onClick={restart}>
            Следующий объект
          </button>
          <button type="button" className="mapper-secondary" onClick={onOpenDay}>
            Мой день
          </button>
        </>
      )}

      <p className="mapper-ai-note">ИИ может ошибаться — важное проверяйте</p>
    </section>
  );
}
