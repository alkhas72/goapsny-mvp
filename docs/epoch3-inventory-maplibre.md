# Инвентаризация ветки MapLibre

**Режим:** `superpowers-lite` — только чтение + doc.  
**База:** `g1-epoch3-base` = `456a0130fb2d996211e2d02af2b784a92a1fc99d`.  
**Целевой коммит:** `origin/feat/epoch3-maplibre-z` = `13c1b0facce0e0346f0130dcab60dc52ff103abf` (`feat(map): isolated MapLibre adapter with contract tests`).  
**Рабочее дерево:** не переключалось, изменения вносятся только в этот файл.

---

## 1. Добавленные/изменённые файлы

| Статус | Путь | Назначение |
|--------|------|------------|
| A | [`briefs/Z-EPOCH3-MAPLIBRE-WRITER-2026-07-17.md`](../briefs/Z-EPOCH3-MAPLIBRE-WRITER-2026-07-17.md) | Бриф изолированной MapLibre-ветки (канон: не менять shell, no merge). |
| M | [`package.json`](../package.json) | Добавлена зависимость `maplibre-gl: ^4.7.1`. |
| M | [`package-lock.json`](../package-lock.json) | Lock-записи для `maplibre-gl` и его транзитивов (`@mapbox/*`, `earcut`, `geojson-vt`, `supercluster` и др.). |
| A | [`src/components/map/MapLibreMap.tsx`](../src/components/map/MapLibreMap.tsx) | React-адаптер поверх `maplibre-gl`. |
| A | [`src/components/map/MapLibreMap.test.tsx`](../src/components/map/MapLibreMap.test.tsx) | Контрактные тесты адаптера. |
| A | [`src/components/map/pinMarkup.ts`](../src/components/map/pinMarkup.ts) | Разметка маркера, вынесена в shared-helpers. |
| A | [`src/components/map/types.ts`](../src/components/map/types.ts) | Пропс-интерфейс `MapViewProps` для drop-in замены. |
| A | [`src/components/map/vectorStyle.ts`](../src/components/map/vectorStyle.ts) | URL векторных стилей, границы Абхазии, зумы. |

> Источник: `git diff --name-status 456a013..13c1b0f`.

---

## 2. Внешний интерфейс адаптера

Компонент [`MapLibreMap.tsx`](../src/components/map/MapLibreMap.tsx) экспортирует:

```ts
export function MapLibreMap(props: MapViewProps): JSX.Element;
export type { MapViewProps } from './types';
export type { Place };
```

Интерфейс [`MapViewProps`](../src/components/map/types.ts) полностью повторяет `LeafletMapProps` из базы:

```ts
export interface MapViewProps {
  places: Place[];
  selectedPlaceId: string | null;
  theme: 'dark' | 'light';
  onSelectPlace?: (id: string) => void;
  onClearSelection?: () => void;
  dragMode?: {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
  };
  useBrowserGeolocation?: boolean;
  onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;
}
```

Пример использования (такой же, как для `LeafletMap`):

```tsx
import { MapLibreMap } from './map/MapLibreMap';

<MapLibreMap
  places={visiblePlaces}
  selectedPlaceId={selectedPlaceId}
  theme={theme}
  onSelectPlace={(id) => void openPlaceSheet(id)}
  onClearSelection={closeSheet}
  useBrowserGeolocation
  onMarkerButton={handleMarkerButton}
/>
```

---

## 3. Что проверяют заявленные контракт-тесты

Файл [`MapLibreMap.test.tsx`](../src/components/map/MapLibreMap.test.tsx) содержит **10 тест-кейсов** (`it(...)`) и **34 утверждения** (`expect(...)`). Утверждение о «73 контракт-тестах» в брифе не подтверждается кодом — видимо, это целевой/желаемый показатель или ошибка подсчёта.

| # | Тест | Что проверяет |
|---|------|---------------|
| 1 | `renders one marker per place and does not duplicate on re-render` | Один маркер на place; при смене `selectedPlaceId` старый маркер удаляется, класс `is-selected` переключается. |
| 2 | `reflects selected pin via onSelectPlace and re-centers the map` | Клик по кнопке маркера вызывает `onSelectPlace(placeId)`. |
| 3 | `flyTo centers the selected place when selectedPlaceId changes` | При изменении `selectedPlaceId` вызывается `map.flyTo({ center: [lng, lat], zoom: 16 })`. |
| 4 | `exposes marker buttons through onMarkerButton` | `onMarkerButton(placeId, <button>)` вызывается при монтировании. |
| 5 | `fits to Abkhazia bounds on initial mount and does not prompt geolocation` | `map.fitBounds` вызывается один раз с bbox в пределах 42–44°N, 39–42°E; `getBrowserLocation` не вызывается на mount. |
| 6 | `activates and deactivates location tracking only on explicit user click` | Кнопка геолокации переключает состояние, запрашивает геолокацию ровно 1 раз, `flyTo` на точку; повторный клик убирает маркер без повторного запроса. |
| 7 | `renders a draggable draft pin and reports drag changes in drag mode` | В `dragMode` POI-маркеры скрыты, рисуется draggable draft-маркер, событие `dragend` вызывает `dragMode.onChange(lat, lng)`. |
| 8 | `switches the vector style when theme changes without recreating the map` | `map.setStyle(...)` вызывается при смене `theme`; `map.remove()` не вызывается. |
| 9 | `exposes accessible location control with explicit role, label and pressed state` | Кнопка локации — `<button>`, `aria-pressed="false"`, `data-touch-target="44"`. |
| 10 | `clears selection when the map background is clicked` | `map.on('click', onClearSelection)` регистрируется при передаче пропса. |

---

## 4. Совместимость с `LeafletMap.tsx`: совпадения и расхождения

Базовый компонент: [`src/components/LeafletMap.tsx`](../src/components/LeafletMap.tsx) @ `456a013`.

### Совпадения (прямая замена возможна на уровне пропсов)

- Идентичный набор пропсов (`places`, `selectedPlaceId`, `theme`, `onSelectPlace`, `onClearSelection`, `dragMode`, `useBrowserGeolocation`, `onMarkerButton`).
- Одинаковый DOM-скелет кнопки геолокации: классы `gps-locate-btn`, `locating`, `is-active`, `aria-pressed`, `data-touch-target="44"`.
- Одинаковая логика «нет авто-запроса геолокации при загрузке»; геолокация — только по явному клику.
- Одинаковые зумы для выбранного места и draft-пина: `SELECTED_ZOOM = 16`, `DRAFT_ZOOM = 17`.
- Одинаковая SVG-разметка пина (цвета, форма, `is-selected`, масштабирование) — см. [`pinMarkup.ts`](../src/components/map/pinMarkup.ts) vs `getPinHtml` в `LeafletMap.tsx`.
- Одинаковая обработка `dragMode`: скрытие POI-маркеров, draggable маркер, `onChange(lat, lng)`.

### Расхождения (требуют внимания при замене)

| Аспект | `LeafletMap.tsx` (база) | `MapLibreMap.tsx` (ветка) |
|--------|------------------------|---------------------------|
| **Расположение** | `src/components/LeafletMap.tsx` | `src/components/map/MapLibreMap.tsx` |
| **Тип пропсов** | `LeafletMapProps` inline | `MapViewProps` в [`types.ts`](../src/components/map/types.ts) |
| **Движок** | Leaflet + растровые тайлы CARTO | MapLibre GL JS + векторные стили CARTO (`style.json`) |
| **Начальный фрейм** | `center: SUKHUM, zoom: 15` | `center: SUKHUM, zoom: 13`, затем `fitBounds(ABKHAZIA_BOUNDS)` |
| **Смена темы** | Удаляет/добавляет растровые `L.tileLayer` | `map.setStyle(getVectorStyleUrl(theme))` |
| **Центрирование выбранного** | `map.setView([lat, lng], 16, { animate: true })` | `map.flyTo({ center: [lng, lat], zoom: 16, essential: true })` |
| **Геолокация (центрирование)** | `map.setView(...)` | `map.flyTo(...)` |
| **Класс обёртки пина** | `leaflet-pin-wrapper` | `map-pin-wrapper` |
| **Класс контейнера маркера** | `goapsny-leaflet-marker` | `goapsny-maplibre-marker` |
| **Класс user-маркера** | `user-location-marker` (обёртка) + `user-marker-pulse` | только `user-marker-pulse` |
| **Attribution** | HTML-ссылки на OSM/CARTO | Плейн-текст `© OpenStreetMap © CARTO` |
| **CSS-импорт** | Leaflet-CSS подключается вне компонента (скорее всего в `index.html`/`main.tsx`) | `import 'maplibre-gl/dist/maplibre-gl.css'` внутри компонента |
| **Класс обёртки карты** | `map-wrapper` | `map-wrapper map-wrapper--maplibre` |
| **Зависимость эффекта `onClearSelection`** | Включён в deps `useEffect` инициализации | Зарегистрирован один раз при создании карты (`map.on('click', onClearSelection)`) |

### CSS-риски

В [`src/styles.css`](../src/styles.css) @ `456a013` (строки 376–393) стили пинов привязаны к Leaflet-классам:

```css
.goapsny-leaflet-marker { ... }
.leaflet-pin-wrapper { ... }
.leaflet-pin-wrapper svg { ... }
.leaflet-pin-wrapper.is-selected svg { ... }
```

После замены на MapLibre эти селекторы перестанут работать, т.к. новые классы — `goapsny-maplibre-marker` / `map-pin-wrapper`. Визуальный гейт (по [`AGENTS.md`](../AGENTS.md)) не пройдёт без обновления стилей.

### Потребители `LeafletMap` в базе

- `src/components/PublicMap.tsx:2,319`
- `src/components/PublicAddSheet.tsx:11,241`
- `src/components/AddWizard.tsx:5,450`
- `src/TelegramApp.tsx:5,213`
- Тестовые моки: `src/components/PublicMap.test.tsx:118`, `src/components/PublicAddSheet.test.tsx:7`

Ветка `feat/epoch3-maplibre-z` не трогает ни потребителей, ни их тесты, ни стили.

---

## 5. Шаги замены Leaflet → MapLibre (без выполнения)

1. **Перенос/переименование компонента** — решить, оставить `MapLibreMap` в `src/components/map/` или перенести в `src/components/MapLibreMap.tsx`, чтобы импорты совпадали с `LeafletMap`.
2. **Обновление импортов** — во всех потребителях (`PublicMap`, `PublicAddSheet`, `AddWizard`, `TelegramApp`) заменить `import { LeafletMap } from './LeafletMap'` на `import { MapLibreMap } from './map/MapLibreMap'` (или новый путь).
3. **Обновление тестовых моков** — в `PublicMap.test.tsx` и `PublicAddSheet.test.tsx` заменить `vi.mock('./LeafletMap', ...)` на мок `MapLibreMap`.
4. **CSS** — добавить/адаптировать селекторы:
   - `.goapsny-maplibre-marker`
   - `.map-pin-wrapper` (вместо `.leaflet-pin-wrapper`)
   - убедиться, что `.map-wrapper` заполняет canvas MapLibre (`canvas { display: block; }` и т.п.).
5. **Визуальный гейт** — проверить пины, тени, selected-стейт, кнопку геолокации, тёмную/светлую тему на реальном устройстве/скриншоте.
6. **Удаление Leaflet** — после стабилизации убрать `leaflet` и `@types/leaflet` из `package.json` и связанные CSS/моки.
7. **Smoke** — запустить `npm run smoke` с `.env` worktree (см. [`AGENTS.md`](../AGENTS.md)).

---

## Неразрешённые вопросы

1. **«73 контракт-теста»** — в коде ветки 10 тест-кейсов / 34 `expect`. Откуда взялась цифра 73? Требуется уточнение (возможно, планируемое количество после расширения).
2. **Куда физически поместить `MapLibreMap.tsx`** — в `src/components/map/` (как сейчас) или на уровень `src/components/`? От выбора зависят относительные импорты потребителей.
3. **Стили MapLibre** — в ветке нет изменений `src/styles.css`. Кто и когда адаптирует селекторы `.leaflet-pin-wrapper` → `.map-pin-wrapper`?
4. **Attribution** — MapLibre-адаптер теряет гиперссылки на OSM/CARTO; соответствует ли это требованиям лицензии/продукта?
5. **Начальный фрейм** — `MapLibreMap` делает `fitBounds(ABKHAZIA_BOUNDS)` после `load`, в то время как Leaflet просто центрируется на Сухум с зумом 15. Будет ли это заметно для пользователя и нужен ли визуальный гейт?
6. **Константа `DEFAULT_MAP_ZOOM = 15`** объявлена в [`vectorStyle.ts`](../src/components/map/vectorStyle.ts), но в `MapLibreMap.tsx` используется `zoom: 13`. Это намеренно или недосмотр?

---

## Ключевые выводы

1. Ветка добавляет изолированный MapLibre-адаптер и **не интегрирует** его в shell.
2. Пропс-контракт полностью совпадает с `LeafletMap`, что позволяет drop-in замену.
3. Основные риски замены — **CSS-классы пинов**, **пути импортов** и **тестовые моки** потребителей.
4. Количество тестов (10) не совпадает с заявленными 73; это требует уточнения.
5. MapLibre-адаптер меняет начальный фрейм (fitBounds Абхазии) и способ смены темы (`setStyle`), что может повлиять на UX и требует визуального гейта.
6. Ветка не затрагивает backend-контракт, auth, RLS, миграции — scope соблюдён.

---

*Сгенерировано из diff `456a013..13c1b0f` без изменения рабочего дерева.*

---

## Валидация C2 (GLM-5.2), 2026-07-19

Независимая проверка 3 конкретных утверждений по `git show`/`git diff` целевого коммита `origin/feat/epoch3-maplibre-z` = `13c1b0facce0e0346f0130dcab60dc52ff103abf` от базы `456a0130fb2d996211e2d02af2b784a92a1fc99d`. Checkout не выполнялся.

### Утверждение 1 (число тестов: 10 `it` / 34 `expect`) — **confirmed**
**Утверждение (строки 76, 167, 181).** В `MapLibreMap.test.tsx` ровно 10 `it(...)` и 34 `expect(...)`; список тест-кейсов совпадает с таблицей в разделе 3.

**Evidence:**
- `git show 13c1b0f:src/components/map/MapLibreMap.test.tsx` — 342 строки.
- `grep -cE "^\s*it\(|^\s*test\("` → **10**.
- `grep -oE "expect\(" | wc -l` → **34**.
- Все 10 названий тестов (строки 167, 183, 199, 215, 232, 249, 277, 306, 321, 330) дословно совпадают с таблицей раздела 3 (от `renders one marker per place...` до `clears selection when the map background is clicked`).
- «73 контракт-теста» в коде действительно не наблюдаются — замечание документа обосновано.

### Утверждение 2 (props `MapViewProps`) — **confirmed**
**Утверждение (строки 31–53, 99).** Интерфейс `MapViewProps` в `src/components/map/types.ts` содержит ровно 8 полей: `places`, `selectedPlaceId`, `theme`, `onSelectPlace?`, `onClearSelection?`, `dragMode?`, `useBrowserGeolocation?`, `onMarkerButton?`.

**Evidence:**
- `git show 13c1b0f:src/components/map/types.ts` — 24 строки, `import type { Place } from '../../types';` и `export interface MapViewProps { ... }` с **ровно** 8 полями в указанном порядке и формах:
  1. `places: Place[];`
  2. `selectedPlaceId: string | null;`
  3. `theme: 'dark' | 'light';`
  4. `onSelectPlace?: (id: string) => void;`
  5. `onClearSelection?: () => void;`
  6. `dragMode?: { lat: number; lng: number; onChange: (lat: number, lng: number) => void; };`
  7. `useBrowserGeolocation?: boolean;`
  8. `onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;`
- Optional-маркеры и типы совпадают с описанием в документе.

### Утверждение 3 (CSS: Leaflet-селекторы в `src/styles.css` и отсутствие правок ветки) — **confirmed**
**Утверждение (строки 127–136, 168–169).** `src/styles.css` @ `456a013` в строках 376–393 содержит селекторы, привязанные к Leaflet (`.goapsny-leaflet-marker`, `.leaflet-pin-wrapper`, `.leaflet-pin-wrapper svg`, `.leaflet-pin-wrapper.is-selected svg`); ветка `feat/epoch3-maplibre-z` не модифицирует `src/styles.css`.

**Evidence:**
- `git show 456a013:src/styles.css` — 1669 строк. В строках **точно 376–393**:
  - line 376: `.goapsny-leaflet-marker {`
  - line 381: `.leaflet-pin-wrapper {`
  - line 387: `.leaflet-pin-wrapper svg {`
  - line 393: `.leaflet-pin-wrapper.is-selected svg {`
- `git diff --name-only 456a013..13c1b0f` — изменены только: `briefs/Z-EPOCH3-MAPLIBRE-WRITER-2026-07-17.md`, `package-lock.json`, `package.json`, `src/components/map/MapLibreMap.test.tsx`, `src/components/map/MapLibreMap.tsx`, `src/components/map/pinMarkup.ts`, `src/components/map/types.ts`, `src/components/map/vectorStyle.ts`. `src/styles.css` **отсутствует** в diff — ветка стили не трогает, что подтверждает поднятый в документе CSS-риск.

**Итого по документу `epoch3-inventory-maplibre.md`: 3 confirmed / 0 refuted.**
