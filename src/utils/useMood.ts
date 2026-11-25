import { useEffect, useState } from 'react';
import { MOOD_EVENT, currentMood, setMood, type Mood } from './skin';

export const MOOD_META: Record<Mood, { label: string; color: string }> = {
  sage: { label: 'Мята', color: '#8ec0a1' },
  orchid: { label: 'Орхидея', color: '#e88cc8' },
  lime: { label: 'Лайм', color: '#eaf372' },
  night: { label: 'Ночь', color: '#182620' },
};

/** Текущий фон оболочки; следит за сменой из любого места (панель сцены, меню). */
export function useMood(): [Mood, (next: Mood) => void] {
  const [mood, setMoodState] = useState<Mood>(() => currentMood());

  useEffect(() => {
    const onMood = () => setMoodState(currentMood());
    window.addEventListener(MOOD_EVENT, onMood);
    return () => window.removeEventListener(MOOD_EVENT, onMood);
  }, []);

  return [mood, setMood];
}
