import { Ruler, X } from 'lucide-react';

export interface RampsModuleProps {
  /** Прицел виден, пока на карте не выбрано место. */
  showCross: boolean;
  onMeasureHere: () => void;
  onLeave: () => void;
}

/**
 * Модуль «пандусы»: слой замеров поверх той же карты. Метка слоя, прицел и вход
 * в мастер замера. Грузится отдельным куском кода и стоит в границе модуля.
 */
export default function RampsModule({ showCross, onMeasureHere, onLeave }: RampsModuleProps) {
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
        <button type="button" className="mapper-fab ramps-fab" onClick={onMeasureHere}>
          <Ruler size={18} aria-hidden="true" />
          Замерить вход здесь
        </button>
      </div>
    </>
  );
}
