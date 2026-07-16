import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, X } from 'lucide-react';
import { CATEGORIES } from '../shared/index';
import { createPlaceId, submitPublicPlaceWithPhoto } from '../services/publicSubmit';
import { getBrowserLocation } from '../utils/location';
import { trapFocus } from '../utils/focusTrap';
import { LeafletMap } from './LeafletMap';

interface PublicAddSheetProps {
  open: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSubmitted: (placeId: string) => void;
}

type Step = 1 | 2 | 3 | 4;

const DEFAULT_LAT = 43.0033;
const DEFAULT_LNG = 41.0237;

export function PublicAddSheet({ open, theme, onClose, onSubmitted }: PublicAddSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]?.slug ?? 'food');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || lat != null) return;
    void getBrowserLocation()
      .then((position) => {
        setLat(position.lat);
        setLng(position.lng);
      })
      .catch(() => {
        setLat(DEFAULT_LAT);
        setLng(DEFAULT_LNG);
      });
  }, [open, lat]);

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

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    setError(null);
  };

  const canAdvance = () => {
    if (step === 1) return Boolean(photoFile);
    if (step === 2) return name.trim().length > 0 && Boolean(category);
    if (step === 3) return lat != null && lng != null;
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      setError(
        step === 1
          ? 'Добавьте фото входа'
          : step === 2
            ? 'Укажите название и категорию'
            : 'Укажите местоположение на карте',
      );
      return;
    }
    setError(null);
    if (step < 4) setStep((current) => (current + 1) as Step);
  };

  const handleSubmit = async () => {
    if (submitting || !photoFile || lat == null || lng == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const placeId = createPlaceId();
      const result = await submitPublicPlaceWithPhoto({
        placeId,
        name: name.trim(),
        category,
        lat,
        lng,
        photoFile,
      });
      setSuccessMessage('Серая метка уже на карте. Её проверят аудиторы сообщества.');
      onSubmitted(result.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось опубликовать место');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="overlay-scrim add-scrim" onClick={handleClose}>
      <article
        ref={sheetRef}
        className="bottom-sheet public-add-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить место"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-close-row">
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Закрыть добавление"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="progress-indicator" aria-hidden="true">
          {[1, 2, 3, 4].map((segment) => (
            <div key={segment} className={`progress-bar-segment ${segment <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="wizard-title">Шаг 1: Фото входа</h2>
            <p className="wizard-sub">Без фото объект не публикуется.</p>
            <label className={`photo-uploader ${photoUrl ? 'has-photo' : ''}`}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                aria-label="Фото входа"
                onChange={handlePhotoChange}
              />
              {photoUrl ? (
                <img src={photoUrl} alt="Предпросмотр фасада" className="photo-preview" />
              ) : (
                <div className="photo-upload-placeholder">
                  <Camera className="photo-upload-icon" />
                  <strong>Сделать фото входа</strong>
                  <span>или выбрать из галереи</span>
                </div>
              )}
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="wizard-title">Шаг 2: Название и категория</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="public-add-name">
                Название
              </label>
              <input
                id="public-add-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="public-add-category">
                Категория
              </label>
              <select
                id="public-add-category"
                className="form-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.ru}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="wizard-title">Шаг 3: Местоположение</h2>
            <p className="wizard-sub">Перетащите маркер к входу в здание.</p>
            <div className="drag-map-container">
              {lat != null && lng != null && (
                <LeafletMap
                  places={[]}
                  selectedPlaceId={null}
                  theme={theme}
                  dragMode={{
                    lat,
                    lng,
                    onChange: (nextLat, nextLng) => {
                      setLat(nextLat);
                      setLng(nextLng);
                    },
                  }}
                />
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="wizard-title">Шаг 4: Публикация</h2>
            <p className="wizard-sub">Проверьте данные перед публикацией серой метки.</p>
            <dl className="public-add-summary">
              <div>
                <dt>Название</dt>
                <dd>{name.trim()}</dd>
              </div>
              <div>
                <dt>Категория</dt>
                <dd>{CATEGORIES.find((item) => item.slug === category)?.ru ?? category}</dd>
              </div>
              <div>
                <dt>Координаты</dt>
                <dd>
                  {lat?.toFixed(5)}, {lng?.toFixed(5)}
                </dd>
              </div>
            </dl>
            {successMessage ? (
              <p className="public-add-success" role="status">
                {successMessage}
              </p>
            ) : (
              <button
                type="button"
                className="primary-btn"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? 'Публикация…' : 'Опубликовать серую метку'}
              </button>
            )}
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {step < 4 && !successMessage && (
          <div className="wizard-footer">
            {step > 1 && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setStep((current) => (current - 1) as Step)}
              >
                Назад
              </button>
            )}
            <button type="button" className="primary-btn" onClick={handleNext}>
              Далее
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
