import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { STATUS_META } from '../shared';
import { trapFocus } from '../utils/focusTrap';
import type { LabDraft, LabFact, LabPayload, LabPlace, LabPlaceSheetProps, LabSaveResult } from './contract';
import {
  ACCESSIBLE_OPTIONS,
  FACT_LABEL,
  LAB_TEXT,
  NUMBER_UNIT,
  PROBLEM_OPTIONS,
  RAMP_OPTIONS,
  RATING_LABEL,
  RATING_ORDER,
  YES_NO_OPTIONS,
  optionLabel,
  stepsText,
  type FactField,
  type RatedStatus,
} from './labText';
import './labPlaceSheet.css';

type Feedback = { tone: 'ok'; text: string } | { tone: 'error'; text: string } | null;
type NumberField = 'steps_count' | 'step_height_cm' | 'door_width_cm';
type ProblemKind = (typeof PROBLEM_OPTIONS)[number]['value'];

const NUMBER_FIELDS: NumberField[] = ['steps_count', 'step_height_cm', 'door_width_cm'];

function isNumberField(field: FactField): field is NumberField {
  return (NUMBER_FIELDS as FactField[]).includes(field);
}

function feedbackFor(result: LabSaveResult): Feedback {
  if (!result.ok) return { tone: 'error', text: `${LAB_TEXT.saveFailed}: ${result.error}` };
  return { tone: 'ok', text: result.duplicate ? LAB_TEXT.duplicate : LAB_TEXT.saved };
}

function enumOptions(field: FactField): { value: string; label: string }[] {
  if (field === 'ramp_type') return RAMP_OPTIONS;
  if (field === 'parking' || field === 'toilet_exists') return YES_NO_OPTIONS;
  return ACCESSIBLE_OPTIONS;
}

/** Text for a known value, or null when the fact is unknown. Null never reads as 0. */
function knownValue(place: LabPlace, field: FactField): string | null {
  const value = place[field];
  if (value === null || value === 'unknown') return null;
  if (field === 'steps_count') return stepsText(value as number);
  if (isNumberField(field)) return `${value} ${NUMBER_UNIT[field] ?? ''}`.trim();
  return optionLabel(enumOptions(field), value as string);
}

function visibleRows(place: LabPlace): { group: keyof typeof LAB_TEXT.groups; fields: FactField[] }[] {
  const entrance: FactField[] = ['steps_count'];
  if (place.steps_count !== 0) entrance.push('step_height_cm');
  entrance.push('door_width_cm', 'ramp_type');
  const toilet: FactField[] = ['toilet_exists'];
  if (place.toilet_exists !== 'no') toilet.push('toilet_accessible');
  const parking: FactField[] = ['parking'];
  if (place.parking !== 'no') parking.push('parking_accessible');
  return [
    { group: 'entrance', fields: entrance },
    { group: 'toilet', fields: toilet },
    { group: 'parking', fields: parking },
  ];
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return feedback.tone === 'ok' ? (
    <p className="lab-sheet-feedback" role="status">{feedback.text}</p>
  ) : (
    <p className="lab-sheet-feedback lab-sheet-feedback-error" role="alert">{feedback.text}</p>
  );
}

interface FactFormProps {
  field: FactField;
  onSave: (fact: LabFact) => LabSaveResult;
  onDone: (feedback: Feedback) => void;
}

function FactForm({ field, onSave, onDone }: FactFormProps) {
  const inputId = useId();
  const [raw, setRaw] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<Feedback>(null);
  const label = FACT_LABEL[field];

  const numberValue = raw.trim() === '' ? NaN : Number(raw);
  const valid = isNumberField(field)
    ? Number.isFinite(numberValue) && numberValue >= 0 && (field !== 'steps_count' || Number.isInteger(numberValue))
    : choice !== null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const fact = (isNumberField(field)
      ? { field, value: numberValue }
      : { field, value: choice }) as LabFact;
    const result = onSave(fact);
    if (result.ok) onDone(feedbackFor(result));
    else setError(feedbackFor(result));
  };

  return (
    <form className="lab-sheet-fact-form" onSubmit={submit}>
      {isNumberField(field) ? (
        <label htmlFor={inputId} className="lab-sheet-field">
          <span>{label}{NUMBER_UNIT[field] ? `, ${NUMBER_UNIT[field]}` : ''}</span>
          <input
            id={inputId}
            type="number"
            inputMode={field === 'steps_count' ? 'numeric' : 'decimal'}
            min={0}
            step={field === 'steps_count' ? 1 : 'any'}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            autoFocus
          />
        </label>
      ) : (
        <fieldset className="lab-sheet-choices">
          <legend>{label}</legend>
          {enumOptions(field).map((option) => (
            <label key={option.value} className="lab-sheet-choice">
              <input
                type="radio"
                name={`${inputId}-${field}`}
                value={option.value}
                checked={choice === option.value}
                onChange={() => setChoice(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="lab-sheet-form-actions">
        <button type="submit" className="lab-sheet-primary" disabled={!valid}>{LAB_TEXT.save}</button>
        <button type="button" className="lab-sheet-secondary" onClick={() => onDone(null)}>{LAB_TEXT.cancel}</button>
      </div>
      <FeedbackLine feedback={error} />
    </form>
  );
}

function ReportForm({ onSave, onDone }: { onSave: (payload: LabPayload) => LabSaveResult; onDone: (feedback: Feedback) => void }) {
  const commentId = useId();
  const [problem, setProblem] = useState<ProblemKind | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<Feedback>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!problem) return;
    const result = onSave({ kind: 'problem', problem, comment: comment.trim() });
    if (result.ok) onDone(feedbackFor(result));
    else setError(feedbackFor(result));
  };

  return (
    <form className="lab-sheet-report-form" onSubmit={submit}>
      <fieldset className="lab-sheet-choices">
        <legend>{LAB_TEXT.reportTitle}</legend>
        {PROBLEM_OPTIONS.map((option) => (
          <label key={option.value} className="lab-sheet-choice">
            <input
              type="radio"
              name={`${commentId}-problem`}
              value={option.value}
              checked={problem === option.value}
              onChange={() => setProblem(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={commentId} className="lab-sheet-field">
        <span>{LAB_TEXT.reportComment}</span>
        <textarea id={commentId} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="lab-sheet-form-actions">
        <button type="submit" className="lab-sheet-primary" disabled={!problem}>{LAB_TEXT.reportSend}</button>
        <button type="button" className="lab-sheet-secondary" onClick={() => onDone(null)}>{LAB_TEXT.cancel}</button>
      </div>
      <FeedbackLine feedback={error} />
    </form>
  );
}

export function LabPlaceSheet({ place, onClose, onSubmit }: LabPlaceSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rateId = useId();
  const [rated, setRated] = useState<RatedStatus | null>(null);
  const [rateFeedback, setRateFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState<FactField | null>(null);
  const [rowFeedback, setRowFeedback] = useState<{ field: FactField; feedback: Feedback } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<Feedback>(null);

  // The parent may re-create onClose on every save; keep the trap (and focus) stable.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!sheetRef.current) return;
    return trapFocus(sheetRef.current, { initialFocus: closeRef.current, onEscape: () => onCloseRef.current() });
  }, []);

  const save = (payload: LabPayload): LabSaveResult => {
    const draft = { ...payload, placeId: place.id, placeName: place.name } as LabDraft;
    return onSubmit(draft);
  };

  const rate = (status: RatedStatus) => {
    const result = save({ kind: 'rating', proposedStatus: status });
    setRateFeedback(feedbackFor(result));
    if (result.ok) setRated(status);
  };

  const verified = STATUS_META[place.status];

  return (
    <article ref={sheetRef} className="bottom-sheet lab-sheet" role="dialog" aria-modal="true" aria-label={place.name}>
      <div className="lab-sheet-head">
        <h3 className="lab-sheet-title">{place.name}</h3>
        <button ref={closeRef} type="button" className="lab-sheet-close" aria-label={LAB_TEXT.close} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <p className="lab-sheet-status">
        <span className="lab-sheet-dot" style={{ backgroundColor: verified.color }} aria-hidden="true" />
        <span>{verified.ru}</span>
      </p>
      {place.status === 'gray' && <p className="lab-sheet-muted">{LAB_TEXT.grayNote}</p>}

      <section className="lab-sheet-section" aria-labelledby={`${rateId}-q`}>
        <div role="group" aria-labelledby={`${rateId}-q`}>
          <h4 id={`${rateId}-q`} className="lab-sheet-subtitle">{LAB_TEXT.rateQuestion}</h4>
          <div className="lab-sheet-rate">
            {RATING_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                className={`lab-sheet-rate-btn lab-sheet-rate-${status}`}
                aria-pressed={rated === status}
                onClick={() => rate(status)}
              >
                {RATING_LABEL[status]}
              </button>
            ))}
          </div>
        </div>
        <p className="lab-sheet-muted">{LAB_TEXT.rateHint}</p>
        <FeedbackLine feedback={rateFeedback} />
      </section>

      <section className="lab-sheet-section" aria-labelledby={`${rateId}-passport`}>
        <h4 id={`${rateId}-passport`} className="lab-sheet-subtitle">{LAB_TEXT.passportTitle}</h4>
        {visibleRows(place).map(({ group, fields }) => (
          <div key={group} className="lab-sheet-group">
            <h5 className="lab-sheet-group-title">{LAB_TEXT.groups[group]}</h5>
            <dl className="lab-sheet-rows">
              {fields.map((field) => {
                const value = knownValue(place, field);
                return (
                  <div key={field} className="lab-sheet-row">
                    <dt>{FACT_LABEL[field]}</dt>
                    <dd>
                      {value ?? <span className="lab-sheet-unknown">{LAB_TEXT.unknown}</span>}
                      {value === null && editing !== field && (
                        <button
                          type="button"
                          className="lab-sheet-add"
                          aria-label={`${LAB_TEXT.add}: ${FACT_LABEL[field]}`}
                          onClick={() => {
                            setEditing(field);
                            setRowFeedback(null);
                          }}
                        >
                          {LAB_TEXT.add}
                        </button>
                      )}
                      {editing === field && (
                        <FactForm
                          field={field}
                          onSave={(fact) => save({ kind: 'fact', fact })}
                          onDone={(feedback) => {
                            setEditing(null);
                            setRowFeedback(feedback ? { field, feedback } : null);
                          }}
                        />
                      )}
                      {rowFeedback?.field === field && <FeedbackLine feedback={rowFeedback.feedback} />}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </section>

      <section className="lab-sheet-section">
        {reporting ? (
          <ReportForm
            onSave={save}
            onDone={(feedback) => {
              setReporting(false);
              setReportFeedback(feedback);
            }}
          />
        ) : (
          <button
            type="button"
            className="lab-sheet-secondary"
            onClick={() => {
              setReporting(true);
              setReportFeedback(null);
            }}
          >
            {LAB_TEXT.reportOpen}
          </button>
        )}
        <FeedbackLine feedback={reportFeedback} />
      </section>

      <p className="lab-sheet-muted lab-sheet-note">{LAB_TEXT.labNote}</p>
    </article>
  );
}
