/**
 * Включаемая оболочка «живой интерфейс» (эталон — «Суфлёр АИС», тот же стиль
 * у Stopgap). Вид по умолчанию не меняется: оболочка включается адресом
 * `?skin=living` и выключается `?skin=classic`; выбор помнится в браузере.
 *
 * Имена настроений и переменных общие со Stopgap
 * (goapsny-stopgap, `src/skin-living.css`).
 */
export type Skin = 'classic' | 'living';
export type Mood = 'sage' | 'orchid' | 'lime' | 'night';

export const MOODS: readonly Mood[] = ['sage', 'orchid', 'lime', 'night'];

/** Событие окна: настроение сменилось (карта подстраивает светлую или тёмную подложку). */
export const MOOD_EVENT = 'goapsny:mood';

const SKIN_KEY = 'goapsny:skin';
const MOOD_KEY = 'goapsny:mood';
const SHELL_KEY = 'goapsny:shell';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Хранилище недоступно (приватное окно): оболочка живёт до перезагрузки.
  }
}

export function isMood(value: string | null): value is Mood {
  return value !== null && (MOODS as readonly string[]).includes(value);
}

export function resolveSkin(search: string, stored: string | null): Skin {
  const fromUrl = new URLSearchParams(search).get('skin');
  if (fromUrl === 'living' || fromUrl === 'classic') return fromUrl;
  return stored === 'living' ? 'living' : 'classic';
}

export function resolveMood(search: string, stored: string | null): Mood {
  const fromUrl = new URLSearchParams(search).get('mood');
  if (isMood(fromUrl)) return fromUrl;
  return isMood(stored) ? stored : 'sage';
}

export function currentSkin(): Skin {
  return document.documentElement.dataset.skin === 'living' ? 'living' : 'classic';
}

export function currentMood(): Mood {
  const mood = document.documentElement.dataset.mood ?? null;
  return isMood(mood) ? mood : 'sage';
}

/** Цвет верха приложения по настроениям (как `--stage-top` в skin-living.css). */
const MOOD_TOP_COLOR: Record<Mood, string> = {
  sage: '#bedec9',
  orchid: '#f7cbe7',
  lime: '#f5f9ad',
  night: '#182620',
};

/**
 * На телефоне строка браузера берёт цвет из `theme-color`: ставим цвет верха
 * приложения. На широком экране за приложением сцена, там метку не трогаем.
 */
function syncThemeColor(mood: Mood): void {
  if (!window.matchMedia?.('(max-width: 540px)').matches) return;
  const onMap = document.documentElement.dataset.screen === 'map';
  const color = onMap ? MAP_EDGE_COLOR[mood === 'night' ? 'night' : 'day'] : MOOD_TOP_COLOR[mood];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

/**
 * Цвет полос браузера на экране карты (как `--map-edge` в skin-living.css):
 * нейтральный цвет суши. Карта занимает весь экран, цветного фона вокруг неё нет.
 */
const MAP_EDGE_COLOR = { day: '#e7e6e9', night: '#2a2a2c' } as const;

/**
 * Экран карты открыт или закрыт. На карте полосы браузера берут цвет карты,
 * на остальных экранах (приветствие, «Новый объект») цвет оболочки.
 */
export function setMapScreen(on: boolean): void {
  if (on) document.documentElement.dataset.screen = 'map';
  else delete document.documentElement.dataset.screen;
  syncThemeColor(currentMood());
}

export function setMood(mood: Mood): void {
  document.documentElement.dataset.mood = mood;
  write(MOOD_KEY, mood);
  syncThemeColor(mood);
  window.dispatchEvent(new Event(MOOD_EVENT));
}

export function isFullShell(): boolean {
  return document.documentElement.dataset.shell === 'full';
}

export function setFullShell(full: boolean): void {
  if (full) {
    document.documentElement.dataset.shell = 'full';
  } else {
    delete document.documentElement.dataset.shell;
  }
  write(SHELL_KEY, full ? 'full' : 'frame');
}

/** Вызывается один раз до первой отрисовки. */
export function initSkin(): Skin {
  const skin = resolveSkin(window.location.search, read(SKIN_KEY));
  write(SKIN_KEY, skin);
  if (skin !== 'living') {
    delete document.documentElement.dataset.skin;
    return skin;
  }
  document.documentElement.dataset.skin = 'living';
  const mood = resolveMood(window.location.search, read(MOOD_KEY));
  document.documentElement.dataset.mood = mood;
  syncThemeColor(mood);
  if (read(SHELL_KEY) === 'full') document.documentElement.dataset.shell = 'full';
  // Проба 27.11: кнопки поверх карты в цветах настроения. Включается адресом
  // (?tint=mood одним цветом, ?tint=mix тремя), без адреса кнопки белые.
  const tint = new URLSearchParams(window.location.search).get('tint');
  if (tint === 'mood' || tint === 'mix') document.documentElement.dataset.tint = tint;
  return skin;
}
