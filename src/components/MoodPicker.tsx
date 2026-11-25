import type { CSSProperties } from 'react';
import { MOODS } from '../utils/skin';
import { MOOD_META, useMood } from '../utils/useMood';

interface MoodPickerProps {
  /** Класс группы: у панели сцены и у меню своя раскладка. */
  className: string;
  /** Класс одной кнопки цвета. */
  itemClassName: string;
}

/** Выбор фона оболочки «живой интерфейс»: четыре цвета, один выбран. */
export function MoodPicker({ className, itemClassName }: MoodPickerProps) {
  const [mood, chooseMood] = useMood();

  return (
    <div className={className} role="radiogroup" aria-label="Фон оформления">
      {MOODS.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={item === mood}
          aria-label={MOOD_META[item].label}
          title={MOOD_META[item].label}
          className={itemClassName}
          style={{ '--mood-color': MOOD_META[item].color, background: MOOD_META[item].color } as CSSProperties}
          onClick={() => chooseMood(item)}
        />
      ))}
    </div>
  );
}
