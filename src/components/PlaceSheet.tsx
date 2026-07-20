import { useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../shared/index';
import type { PublicPlace } from '../services/places';
import { hasPortableRamp, isPartialPlace, rampLabel } from '../services/places';
import { RAMP_COLOR, statusColor, statusLabel } from '../utils/status';
import { trapFocus } from '../utils/focusTrap';

export type PlaceSheetState = 'idle' | 'loading' | 'error' | 'partial';

interface PlaceSheetProps {
  open: boolean;
  place: PublicPlace | null;
  state: PlaceSheetState;
  errorMessage?: string;
  onClose: () => void;
  onRetry?: () => void;
}

function categoryLabel(slug: string): string {
  return CATEGORIES.find((item) => item.slug === slug)?.ru ?? slug;
}

function formatVerifiedAt(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU');
}

export function PlaceSheet({
  open,
  place,
  state,
  errorMessage,
  onClose,
  onRetry,
}: PlaceSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  if (!open) return null;

  const partial = place ? isPartialPlace(place) || state === 'partial' : false;

  return (
    <article
      ref={sheetRef}
      className="bottom-sheet public-place-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={place?.name ?? 'Карточка места'}
    >
      <div className="sheet-grabber" aria-hidden="true" />

      <div className="sheet-close-row">
        <button
          ref={closeButtonRef}
          type="button"
          className="icon-btn"
          aria-label="Закрыть карточку"
          onClick={handleClose}
        >
          <X size={20} />
        </button>
      </div>

      {state === 'loading' && (
        <div className="sheet-state" role="status" aria-live="polite">
          <div className="sheet-skeleton sheet-skeleton-title" />
          <div className="sheet-skeleton sheet-skeleton-line" />
          <div className="sheet-skeleton sheet-skeleton-photo" />
          <p>Загрузка места…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="sheet-state sheet-error" role="alert">
          <p>{errorMessage ?? 'Не удалось загрузить место'}</p>
          {onRetry && (
            <button type="button" className="secondary-btn" onClick={onRetry}>
              Повторить
            </button>
          )}
        </div>
      )}

      {place && state !== 'loading' && state !== 'error' && (
        <>
          <div className="sheet-header">
            <div className="sheet-header-main">
              <span
                className="sheet-status-icon"
                style={{ backgroundColor: statusColor(place.status) }}
                aria-hidden="true"
              />
              <div>
                <h3 className="sheet-title">{place.name}</h3>
                <div className="sheet-meta">{categoryLabel(place.category)}</div>
              </div>
            </div>
          </div>

          <p className="sheet-status-line">
            <span className="sheet-status-dot" style={{ backgroundColor: statusColor(place.status) }} aria-hidden="true" />
            <span>{statusLabel(place.status)}</span>
          </p>

          {place.status === 'gray' && (
            <p className="sheet-gray-note">Предварительно, ожидает проверки сообщества</p>
          )}

          {place.facadePhotoUrl ? (
            <img src={place.facadePhotoUrl} alt={`Фасад: ${place.name}`} className="sheet-photo" />
          ) : (
            <div className="sheet-photo sheet-photo-missing" role="note">
              Фото недоступно
            </div>
          )}

          {partial && (
            <p className="sheet-partial-note" role="status">
              Часть данных временно недоступна — показано то, что удалось загрузить.
            </p>
          )}

          {place.details.address && <p className="sheet-address">{place.details.address}</p>}

          {hasPortableRamp(place.rampType) && (
            <p className="sheet-ramp-line">
              <span className="sheet-ramp-dot" style={{ backgroundColor: RAMP_COLOR }} aria-hidden="true" />
              <span>{rampLabel(place.rampType)}</span>
            </p>
          )}

          {place.details.verification?.verified_at && (
            <p className="sheet-verified">
              Проверено: {place.details.verification.verified_by_role ?? 'аудитор'} ·{' '}
              {formatVerifiedAt(place.details.verification.verified_at)}
            </p>
          )}

          {place.details.external_links && Object.keys(place.details.external_links).length > 0 && (
            <details className="sheet-external-links">
              <summary>
                <ChevronRight size={16} className="sheet-link-chevron-closed" aria-hidden="true" />
                <ChevronDown size={16} className="sheet-link-chevron-open" aria-hidden="true" />
                Есть на: Яндекс · Google · Apple · OSM
              </summary>
              <div className="sheet-link-list">
                {place.details.external_links.yandex && (
                  <a href={place.details.external_links.yandex} target="_blank" rel="noreferrer">
                    Яндекс
                  </a>
                )}
                {place.details.external_links.google && (
                  <a href={place.details.external_links.google} target="_blank" rel="noreferrer">
                    Google
                  </a>
                )}
                {place.details.external_links.apple && (
                  <a href={place.details.external_links.apple} target="_blank" rel="noreferrer">
                    Apple
                  </a>
                )}
                {place.details.external_links.osm && (
                  <a href={place.details.external_links.osm} target="_blank" rel="noreferrer">
                    OSM
                  </a>
                )}
              </div>
            </details>
          )}

          {place.comment && <p className="sheet-comment">{place.comment}</p>}
        </>
      )}
    </article>
  );
}
