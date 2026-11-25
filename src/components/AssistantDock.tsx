import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './BrandMark';

/** Имя ассистента в интерфейсе. Вопрос «Нуца или без имени» у Алхаса открыт. */
export const ASSISTANT_NAME = 'Нуца';

/**
 * Место цифрового ассистента: кнопка-купол внизу экрана и шторка разговора.
 * Сам ассистент (профиль Гермеса) ещё не подключён — шторка честно говорит об
 * этом и показывает, с чем он будет помогать. Виден только в оболочке
 * «живой интерфейс» (стили в src/skin-living.css).
 */
export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const domeRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dome = domeRef.current;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      dome?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={domeRef}
        type="button"
        className="lv-dome"
        aria-label={`Ассистент ${ASSISTANT_NAME}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BrandMark size={34} />
      </button>
      {open && (
        <div className="lv-assistant-scrim" onClick={() => setOpen(false)}>
          <div
            className="lv-assistant-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lv-assistant-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lv-assistant-grabber" aria-hidden="true" />
            <div className="lv-assistant-head">
              <span className="lv-assistant-face">
                <BrandMark size={25} />
              </span>
              <div>
                <p className="lv-assistant-kicker">Цифровой ассистент</p>
                <h2 id="lv-assistant-title" className="lv-assistant-title">
                  {ASSISTANT_NAME}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="lv-assistant-close"
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="lv-assistant-text">
              Здесь будет разговор с ассистентом, голосом и текстом. Сейчас он подключается и пока не отвечает.
            </p>
            <ul className="lv-assistant-list">
              <li>Найти доступное место рядом и объяснить цвет метки</li>
              <li>По фото входа заполнить карточку и предложить оценку</li>
              <li>Провести через замер для приставного пандуса</li>
            </ul>
            <p className="lv-assistant-note">Метки на карте и добавление объектов работают без ассистента.</p>
          </div>
        </div>
      )}
    </>
  );
}
