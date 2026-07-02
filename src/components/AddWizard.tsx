import { useState, useEffect } from "react";
import type { AddDraft, Place, AccessibilityStatus } from "../types";
import { categoriesList, api } from "../services/api";
import { telegram } from "../utils/telegram";
import { LeafletMap } from "./LeafletMap";
import { MapPin, AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";

interface AddWizardProps {
  theme: "dark" | "light";
  onSave: (place: Place) => void;
  onCancel: () => void;
}

const initialDraft: AddDraft = {
  photoFile: null,
  photoUrl: null,
  name: "",
  category: "food",
  lat: null,
  lng: null,
  status: "",
  stepsCount: "",
  stepHeightCm: "",
  rampType: "none",
  doorWidthCm: "",
  entranceNotes: "",
  toiletExists: "unknown",
  toiletAccessible: "unknown",
  parking: "unknown",
  comment: ""
};

export function AddWizard({ theme, onSave, onCancel }: AddWizardProps) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AddDraft>(initialDraft);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fetch location on Mount or when photo is added
  useEffect(() => {
    if (step === 1 && !draft.lat && !draft.lng) {
      captureLocation();
    }
  }, [step]);

  const captureLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await telegram.getUserLocation();
      setDraft(prev => ({ ...prev, lat: pos.lat, lng: pos.lng }));
    } catch (e: any) {
      console.error(e);
      // Seed Sukhum centre so the user can still advance and fine-tune the
      // marker on step 4 (canGoNext on step 1 requires a coordinate).
      setDraft(prev => ({ ...prev, lat: prev.lat ?? 43.0033, lng: prev.lng ?? 41.0237 }));
      setLocationError("Не удалось определить геопозицию автоматически. Координаты установлены на центр Сухума — уточните вручную на шаге 4.");
    } finally {
      setLocating(false);
    }
  };

  // Переход на следующий шаг мастера, если текущий шаг заполнен (canGoNext).
  const handleNextStep = () => {
    if (canGoNext()) {
      setStep(prev => prev + 1);
      telegram.hapticSelection();
    }
  };

  // Назад по шагам; на первом шаге — выход из мастера (onCancel).
  const handlePrevStep = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
      telegram.hapticSelection();
    } else {
      onCancel();
    }
  };

  // Минимальные условия для кнопки «Далее» / MainButton на каждом шаге:
  // шаг 1 — координата (lat), шаг 2 — название и категория, шаг 3 — статус доступности.
  const canGoNext = () => {
    if (step === 1) return !!draft.lat;
    if (step === 2) return !!draft.name && !!draft.category;
    if (step === 3) return !!draft.status;
    return true;
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const placeData: Partial<Place> = {
        name: draft.name,
        category: draft.category,
        lat: draft.lat || 43.0033,
        lng: draft.lng || 41.0237,
        status: draft.status as AccessibilityStatus,
        stepsCount: draft.stepsCount ? parseInt(draft.stepsCount) : null,
        stepHeightCm: draft.stepHeightCm ? parseInt(draft.stepHeightCm) : null,
        rampType: draft.rampType,
        doorWidthCm: draft.doorWidthCm ? parseInt(draft.doorWidthCm) : null,
        entranceNotes: draft.entranceNotes,
        toiletExists: draft.toiletExists,
        toiletAccessible: draft.toiletAccessible,
        parking: draft.parking,
        comment: draft.comment,
        source: "operator"
      };

      const created = await api.createPlace(placeData);
      telegram.hapticNotify("success");
      telegram.alert("Объект сохранён!");
      onSave(created);
    } catch (e) {
      console.error(e);
      telegram.alert("Не удалось сохранить объект.");
    } finally {
      setIsSaving(false);
    }
  };

  // Bind Telegram native BackButton and MainButton
  useEffect(() => {
    // 1. BackButton
    telegram.setupBackButton(true, handlePrevStep);

    // 2. MainButton
    const nextText = `Далее (Шаг ${step + 1} из 4) →`;
    const saveText = "Сохранить объект";
    
    // MainButton style color is blue-theme or orange-final
    const btnColor = step === 4 ? "#E2741C" : "#4BA4DD"; 
    
    telegram.setupMainButton(
      {
        text: step === 4 ? saveText : nextText,
        color: btnColor,
        textColor: "#FFFFFF",
        isVisible: canGoNext(),
        isActive: !isSaving
      },
      step === 4 ? handleSave : handleNextStep
    );

    return () => {
      telegram.hideMainButton();
      telegram.hideBackButton();
    };
  }, [step, draft, isSaving]);

  return (
    <div className="wizard-container">
      {/* Segmented Progress bar */}
      <div className="progress-indicator">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`progress-bar-segment ${s <= step ? "active" : ""}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <h2 className="wizard-title">Шаг 1: Геопозиция</h2>
          <p className="wizard-sub">Укажите геопозицию объекта. Координаты можно уточнить вручную на шаге 4.</p>

          <div className="gps-status-card">
            <div className="gps-status-info">
              <MapPin className="gps-icon" />
              <div className="gps-text-wrap">
                <span className="gps-title">
                  {locating ? "Определение позиции..." : draft.lat ? "Геопозиция зафиксирована" : "Позиция не определена"}
                </span>
                <span className="gps-subtitle">
                  {draft.lat && draft.lng ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}` : "Ожидание GPS координат"}
                </span>
              </div>
            </div>
            <button type="button" className="secondary-btn" style={{ minHeight: 36, width: "auto" }} onClick={captureLocation} disabled={locating}>
              Обновить
            </button>
          </div>

          {locationError && (
            <div style={{ color: "var(--status-red)", display: "flex", gap: 6, fontSize: 13, alignItems: "center" }}>
              <AlertCircle size={16} />
              <span>{locationError}</span>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="wizard-title">Шаг 2: Информация о месте</h2>
          <p className="wizard-sub">Заполните поля об объекте и его доступности.</p>

          <div className="form-group">
            <label className="form-label">
              Название
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Например, Магазин 'Колос'" 
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Категория
            </label>
            <select 
              className="form-select" 
              value={draft.category}
              onChange={e => setDraft(prev => ({ ...prev, category: e.target.value }))}
            >
              {categoriesList.map(cat => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="dimension-row">
            <div className="form-group">
              <label className="form-label">Ступени</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0"
                value={draft.stepsCount}
                onChange={e => setDraft(prev => ({ ...prev, stepsCount: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Высота (см)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="-"
                value={draft.stepHeightCm}
                onChange={e => setDraft(prev => ({ ...prev, stepHeightCm: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Дверь (см)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="-"
                value={draft.doorWidthCm}
                onChange={e => setDraft(prev => ({ ...prev, doorWidthCm: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Пандус</label>
            <select 
              className="form-select"
              value={draft.rampType}
              onChange={e => setDraft(prev => ({ ...prev, rampType: e.target.value as any }))}
            >
              <option value="none">Нет пандуса</option>
              <option value="permanent">Стационарный пандус</option>
              <option value="portable_available">Приставной пандус (в наличии)</option>
              <option value="portable_on_request">Приставной пандус (по запросу)</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Туалет есть?</label>
              <div className="segmented-picker">
                {(["yes", "no", "unknown"] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`segmented-picker-btn ${draft.toiletExists === opt ? "active" : ""}`}
                    onClick={() => setDraft(prev => ({ ...prev, toiletExists: opt }))}
                  >
                    {opt === "yes" ? "Да" : opt === "no" ? "Нет" : "?"}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Туалет доступен?</label>
              <div className="segmented-picker">
                {(["yes", "partial", "no"] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    disabled={draft.toiletExists !== "yes"}
                    className={`segmented-picker-btn ${draft.toiletAccessible === opt ? "active" : ""}`}
                    onClick={() => setDraft(prev => ({ ...prev, toiletAccessible: opt }))}
                  >
                    {opt === "yes" ? "Да" : opt === "partial" ? "Част." : "Нет"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Парковка</label>
            <div className="segmented-picker">
              {(["yes", "no", "unknown"] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`segmented-picker-btn ${draft.parking === opt ? "active" : ""}`}
                  onClick={() => setDraft(prev => ({ ...prev, parking: opt }))}
                >
                  {opt === "yes" ? "Да" : opt === "no" ? "Нет" : "?"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Заметки / Комментарий</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Дополнительные ориентиры или особенности" 
              value={draft.comment}
              onChange={e => setDraft(prev => ({ ...prev, comment: e.target.value }))}
            />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="wizard-title">Шаг 3: Светофор доступности</h2>
          <p className="wizard-sub">Выберите статус доступности объекта (серого статуса нет в обследованиях).</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div 
              className={`status-option-card green ${draft.status === "green" ? "selected" : ""}`}
              onClick={() => setDraft(prev => ({ ...prev, status: "green" }))}
            >
              <div className="status-indicator-circle" />
              <div className="status-option-details">
                <span className="status-option-title" style={{ color: "var(--status-green)" }}>Доступно</span>
                <span className="status-option-desc">Вход, внутренние зоны и туалет (при наличии) полностью доступны.</span>
              </div>
            </div>

            <div 
              className={`status-option-card yellow ${draft.status === "yellow" ? "selected" : ""}`}
              onClick={() => setDraft(prev => ({ ...prev, status: "yellow" }))}
            >
              <div className="status-indicator-circle" />
              <div className="status-option-details">
                <span className="status-option-title" style={{ color: "var(--status-yellow)" }}>Частично доступно</span>
                <span className="status-option-desc">Въезд есть, но есть препятствия внутри, приставной пандус или нужен ассистент.</span>
              </div>
            </div>

            <div 
              className={`status-option-card red ${draft.status === "red" ? "selected" : ""}`}
              onClick={() => setDraft(prev => ({ ...prev, status: "red" }))}
            >
              <div className="status-indicator-circle" />
              <div className="status-option-details">
                <span className="status-option-title" style={{ color: "var(--status-red)" }}>Недоступно</span>
                <span className="status-option-desc">Входная группа недоступна для проезда на коляске (высокие ступени, нет пандуса).</span>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="wizard-title">Шаг 4: Подстройка геопозиции</h2>
          <p className="wizard-sub">Перетащите маркер на карте, чтобы точно указать вход в здание.</p>

          <div className="drag-map-container">
            <div className="drag-map-instruction">Перетащите маркер к точке входа</div>
            {draft.lat && draft.lng && (
              <LeafletMap
                places={[]}
                selectedPlaceId={null}
                theme={theme}
                dragMode={{
                  lat: draft.lat,
                  lng: draft.lng,
                  onChange: (lat, lng) => setDraft(prev => ({ ...prev, lat, lng }))
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Fallback navigation for dev mode / browser */}
      {!telegram.isTelegram() && (
        <div className="wizard-footer">
          <button type="button" className="secondary-btn" onClick={handlePrevStep} style={{ width: "auto" }}>
            <ArrowLeft size={16} /> Назад
          </button>
          {step < 4 ? (
            <button 
              type="button" 
              className="primary-btn" 
              style={{ flex: 1 }} 
              onClick={handleNextStep} 
              disabled={!canGoNext()}
            >
              Далее <ArrowRight size={16} />
            </button>
          ) : (
            <button 
              type="button" 
              className="primary-btn" 
              style={{ flex: 1, backgroundColor: "var(--accent)" }} 
              onClick={handleSave} 
              disabled={isSaving}
            >
              <Check size={16} /> {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
