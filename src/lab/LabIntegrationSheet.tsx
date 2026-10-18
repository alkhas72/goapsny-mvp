import { useEffect, useRef, useState } from 'react';
import type { LabPlaceSheetProps } from './contract';
import { STATUS_META } from '../shared';

/** Temporary integration adapter; Claude's LabPlaceSheet replaces this via props. */
export function LabIntegrationSheet({ place, onClose, onSubmit }: LabPlaceSheetProps) {
  const panel = useRef<HTMLElement>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  const submit: LabPlaceSheetProps['onSubmit'] = draft => {
    const result = onSubmit(draft);
    setMessage(result.ok ? result.duplicate ? 'Эта отметка уже сохранена.' : 'Сохранено на устройстве. Не отправлено.' : result.error);
    return result;
  };
  return <section ref={panel} tabIndex={-1} aria-label={`Карточка: ${place.name}`} onKeyDown={event => {
    if (event.key === 'Escape') onClose();
  }}>
    <button onClick={onClose}>Закрыть карточку</button>
    <h2>{place.name}</h2><p>Проверенный статус: {STATUS_META[place.status].ru}</p>
    <p>Предложить оценку (проверенный статус останется прежним)</p>
    {(['green', 'yellow', 'red'] as const).map(proposedStatus => <button key={proposedStatus} onClick={() => submit({ kind: 'rating', placeId: place.id, placeName: place.name, proposedStatus })}>{STATUS_META[proposedStatus].ru}</button>)}
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const raw = String(data.get('width') ?? '').trim();
      submit({ kind: 'fact', placeId: place.id, placeName: place.name, fact: { field: 'door_width_cm', value: raw === '' ? null : Number(raw) } });
    }}><label>Ширина двери, см (пусто — неизвестно)<input name="width" type="number" min="0" step="any" /></label><button>Сохранить один факт</button></form>
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      submit({ kind: 'problem', placeId: place.id, placeName: place.name, problem: 'information', comment: String(data.get('comment') ?? '').trim() });
    }}><label>Проблема с информацией<textarea name="comment" required maxLength={1000} /></label><button>Сообщить о проблеме локально</button></form>
    <p role="status">{message}</p>
  </section>;
}
