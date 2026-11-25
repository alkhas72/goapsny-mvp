import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isFullShell, setFullShell } from '../utils/skin';
import { MoodPicker } from './MoodPicker';

function clock(): string {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Обвязка оболочки «живой интерфейс»: на широком экране — живой фон, панель с
 * настроениями и кнопкой «Во весь экран», строка состояния корпуса телефона.
 * На телефоне всё это скрыто стилями: приложение занимает экран целиком.
 */
export function SkinChrome() {
  const [full, setFull] = useState(() => isFullShell());
  const [time, setTime] = useState(() => clock());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(clock()), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleShell = () => {
    setFullShell(!full);
    setFull(!full);
  };

  return (
    <>
      {createPortal(
        <>
          <div className="lv-stage" aria-hidden="true">
            <span className="lv-blob lv-blob-1" />
            <span className="lv-blob lv-blob-2" />
            <span className="lv-blob lv-blob-3" />
          </div>
          <div className="lv-dock">
            <div className="lv-brand">
              GoApsny <span className="lv-tag">Карта доступности</span>
            </div>
            <div className="lv-dock-right">
              <MoodPicker className="lv-moods" itemClassName="lv-mood" />
              <button type="button" className="lv-shell-btn" onClick={toggleShell}>
                {full ? 'В корпус телефона' : 'Во весь экран'}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
      <div className="lv-chrome" aria-hidden="true">
        <span>{time}</span>
        <span className="lv-island" />
        <span className="lv-chrome-icons">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
            <rect x="0" y="8" width="3" height="4" rx="1" />
            <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
            <rect x="9" y="3" width="3" height="9" rx="1" />
            <rect x="13.5" y="0" width="3" height="12" rx="1" />
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
            <rect x="2.2" y="2.2" width="15" height="7.6" rx="1.8" fill="currentColor" />
            <rect x="23" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" fillOpacity="0.5" />
          </svg>
        </span>
      </div>
      <div className="lv-home" aria-hidden="true" />
      <div className="lv-edge" aria-hidden="true" />
    </>
  );
}
