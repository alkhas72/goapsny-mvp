import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ruler, X } from 'lucide-react';

export interface RampsModuleProps {
  /** Прицел виден, пока на карте не выбрано место. */
  showCross: boolean;
  /**
   * Адрес мастера замера для показа внутри карты (точка под прицелом уже в нём).
   * null — мастер живёт на другом сайте (откат на прежний Stopgap): тогда вход обычным переходом.
   */
  wizardUrl: () => string | null;
  /** Обычный переход в мастер, когда встроенного показа нет. */
  onMeasureOutside: () => void;
  onLeave: () => void;
}

/**
 * Модуль «пандусы»: слой замеров поверх той же карты. Метка слоя, прицел и мастер
 * замера, который открывается здесь же, в рамке, в режиме мастера (без конструктора).
 * Грузится отдельным куском кода и стоит в границе модуля: его сбой карту не задевает.
 */
export default function RampsModule({ showCross, wizardUrl, onMeasureOutside, onLeave }: RampsModuleProps) {
  const [wizard, setWizard] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  // Мастер сообщает о закрытии. Слушаем только свой адрес и только свою рамку.
  useEffect(() => {
    if (!wizard) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { stopgap?: unknown } | null;
      if (data && data.stopgap === 'close') setWizard(null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [wizard]);

  useEffect(() => {
    if (!wizard) openerRef.current?.focus({ preventScroll: true });
  }, [wizard]);

  const handleMeasure = () => {
    const url = wizardUrl();
    if (url) setWizard(url);
    else onMeasureOutside();
  };

  return (
    <>
      <div className="ramps-bar">
        <span className="ramps-bar-label" role="status">
          <Ruler size={16} aria-hidden="true" />
          Слой замеров
        </span>
        <button
          type="button"
          className="ramps-bar-close"
          aria-label="Вернуться к карте доступности"
          onClick={onLeave}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {showCross && <div className="ramps-cross" aria-hidden="true" />}
      <div className="mapper-fab-row ramps-fab-row">
        <button ref={openerRef} type="button" className="mapper-fab ramps-fab" onClick={handleMeasure}>
          <Ruler size={18} aria-hidden="true" />
          Замерить вход здесь
        </button>
      </div>
      {wizard &&
        // Мастер закрывает приложение целиком (и шапку карты): у него своя строка «На карту».
        createPortal(
          <div className="zamer-frame" role="dialog" aria-modal="true" aria-label="Замер входа">
            <iframe
              ref={frameRef}
              className="zamer-frame-view"
              title="Мастер замера входа"
              src={wizard}
              allow="camera; microphone; geolocation; xr-spatial-tracking; fullscreen"
            />
          </div>,
          document.querySelector('.app-shell') ?? document.body,
        )}
    </>
  );
}
