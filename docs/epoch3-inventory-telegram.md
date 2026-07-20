# Epoch 3 — Инвентаризация контура Telegram (только чтение)

**Дата анализа:** 2026-07-19
**Рабочий корень:** `/Users/alkhas.abaza/repo/goapsny-mvp--epoch3-integrate`
**Входная точка браузера:** `index.html:13` → `src/main.tsx:5,9` → `src/TelegramApp.tsx:33`
**Режим:** read-only, код не изменялся.

---

## 1. Дерево компонентов

### 1.1 Реально подключённое дерево (Telegram-контур)

`TelegramApp` — единственный корень, монтируемый в DOM:

- `src/main.tsx:5` импортирует `TelegramApp`
- `src/main.tsx:9` рендерит `<TelegramApp />` (внутри `<StrictMode>`)
- `src/index.html:13` подключает `/src/main.tsx`
- `src/index.html:9` подключает внешний скрипт `https://telegram.org/js/telegram-web-app.js` (глобал `window.Telegram.WebApp`)

```
TelegramApp  (src/TelegramApp.tsx:33)
├── AccessibleIconLogo              локальный SVG-лого (src/TelegramApp.tsx:12)
├── TriangleRampIcon                локальный SVG пандуса (src/TelegramApp.tsx:25)
├── [splash: loading]               inline JSX (src/TelegramApp.tsx:130-141)
├── [splash: GPS primer]            inline JSX (src/TelegramApp.tsx:144-181)
├── Header (inline)                 inline JSX (src/TelegramApp.tsx:186-206)
│   └── AccessibleIconLogo
├── [tab=map]
│   ├── LeafletMap                  src/components/LeafletMap.tsx (через src/TelegramApp.tsx:5,213)
│   ├── map-controls-overlay
│   │   ├── filter-chip ×4 (Все/Доступно/Частично/Недоступно)  (inline, src/TelegramApp.tsx:224-268)
│   │   └── legend-overlay «пурпурный центр = приставной пандус» (inline, src/TelegramApp.tsx:271-294)
│   └── bottom-sheet (inline карточка POI)                      (inline, src/TelegramApp.tsx:298-391)
├── [tab=add]    AddWizard          src/components/AddWizard.tsx (src/TelegramApp.tsx:6,396-401)
│   └── LeafletMap (dragMode)       src/components/LeafletMap.tsx (src/components/AddWizard.tsx:5,450)
├── [tab=profile] Profile           src/components/Profile.tsx   (src/TelegramApp.tsx:7,405-412)
└── [tab=admin]  AdminPanel         src/components/AdminPanel.tsx (src/TelegramApp.tsx:8,416-420)
```

Навигация — `bottom-nav` с 4 вкладками, рендерится всегда (`src/TelegramApp.tsx:425-475`). Админ-вкладка появляется условно (`src/TelegramApp.tsx:462`, см. §3).

### 1.2 Компоненты из задания, НЕ входящие в дерево `TelegramApp`

Следующие 6 файлов **принадлежат другому (Public) контуру** и не монтируются из `TelegramApp`. Их потребители — `PublicApp` / `PublicMap`:

| Файл | Импортёр (не `TelegramApp`) |
|---|---|
| `src/components/MapHeader.tsx` | `src/components/PublicMap.tsx:3` |
| `src/components/MapFooter.tsx` | `src/components/PublicMap.tsx:4` |
| `src/components/MapFilters.tsx` | `src/components/PublicMap.tsx:5` (+ тест `src/components/MapFilters.test.tsx:4`) |
| `src/components/MenuOverlay.tsx` | `src/components/PublicMap.tsx:6` |
| `src/components/PlaceSheet.tsx` | `src/components/PublicMap.tsx:7` |
| `src/components/WelcomeLegend.tsx` | `src/PublicApp.tsx:3,17` |

Подтверждено поиском по коду: в `src/TelegramApp.tsx` нет ни одного `import` от этих компонентов, в `src/main.tsx:5` импортируется только `TelegramApp`, а `PublicApp` в `src/main.tsx` не упоминается. Это означает, что в текущей сборке **public-контур (`PublicApp`/`PublicMap`) не активен**, но его компоненты присутствуют в репозитории и используют другой сервисный слой (`src/services/places.ts`, `src/shared/index.ts`, `src/utils/focusTrap.ts`, `src/utils/status.ts`).

### 1.3 Сопутствующие модули, используемые деревом `TelegramApp`

| Модуль | Назначение | Точка подключения |
|---|---|---|
| `src/utils/telegram.ts` | Обёртка над `window.Telegram.WebApp` (haptics, MainButton, BackButton, LocationManager, initData, alert, theme) | `src/TelegramApp.tsx:3`; `src/components/AddWizard.tsx:4`; `src/components/AdminPanel.tsx:5`; `src/components/Profile.tsx:2` |
| `src/services/api.ts` | Mock/Supabase-фасад: `loginTelegram`, `getPlaces`, `createPlace`, `getAiAutofill` + `categoriesList` | `src/TelegramApp.tsx:4`; `src/components/AddWizard.tsx:3`; `src/components/AdminPanel.tsx:3` |
| `src/types.ts` | Типы `Place`, `Profile`, `Tab`, `AccessibilityStatus`, `Role`, `AddDraft` | везде |
| `src/shared/index.ts` | Контракт `CATEGORIES`, `KARMA_LEVELS`, `karmaLevelFor`, `karmaNext` | `src/services/api.ts:2`; `src/components/Profile.tsx:4` |
| `src/components/LeafletMap.tsx` | Leaflet-карта (просмотр + dragMode) | `src/TelegramApp.tsx:5,213`; `src/components/AddWizard.tsx:5,450` |

---

## 2. Состояния и где они живут

### 2.1 `TelegramApp` (`src/TelegramApp.tsx:34-45`)

Все верхнеуровневые состояния — локальные `useState` в корневом компоненте, **никакого Redux/Context/Zustand нет**. Прокидываются вниз через props.

| State | Тип | Где живёт | Назначение |
|---|---|---|---|
| `activeTab` | `Tab` (`"map"\|"add"\|"profile"\|"admin"`) | `src/TelegramApp.tsx:34` | Текущий экран |
| `places` | `Place[]` | `src/TelegramApp.tsx:35` | Список POI. Заполняется из `api.getPlaces()` (`src/TelegramApp.tsx:62-63`). Мутируется локально через `handleCreatePlace` (`:95`), `handleDeletePlace` (`:113`), `handleUpdateStatus` (`:120`). |
| `selectedPlaceId` | `string \| null` | `src/TelegramApp.tsx:36` | Выбранный POI для inline-карточки (`:127`, `:298`) |
| `profile` | `Profile \| null` | `src/TelegramApp.tsx:37` | Авторизованный пользователь. Заполняется из `api.loginTelegram(initData)` (`:58-59`). Ре-синхронизируется после создания POI (`:99-106`). |
| `theme` | `"dark" \| "light"` | `src/TelegramApp.tsx:38` | Инициализируется из `telegram.getTelegramTheme` (`:38`), ре-синхронизируется в `useEffect` (`:52-54`, `:77-79`). |
| `filter` | `AccessibilityStatus \| "all"` | `src/TelegramApp.tsx:39` | Фильтр светофора на карте |
| `loading` | `boolean` | `src/TelegramApp.tsx:40` | Флаг первичной загрузки |
| `showPrimer` | `boolean` | `src/TelegramApp.tsx:43-45` | splash онбординга GPS. Стартовое значение читается из `localStorage["goapsny_gps_primed"]` (флаг `goapsny_gps_primed`). |

Производные значения (не state):
- `selectedPlace` — `places.find(...)` (`src/TelegramApp.tsx:127`)
- `visiblePlaces` — фильтрация по `filter` (`src/TelegramApp.tsx:128`)

Побочные эффекты (`useEffect`):
- `src/TelegramApp.tsx:48-74` — первичная инициализация: theme → login → getPlaces → `telegram.ready()` + `telegram.expand()`.
- `src/TelegramApp.tsx:77-79` — применение темы к `document.documentElement.className`.

Сайд-эффекты на стороне UI:
- `localStorage["goapsny_gps_primed"]` — пишется в `handleGrantGps` (`:84`) и в обработчике «Продолжить без GPS» (`:171`).

### 2.2 `AddWizard` (`src/components/AddWizard.tsx:34-40`)

| State | Тип | Назначение |
|---|---|---|
| `step` | `number` (1..4) | Шаг визарда |
| `draft` | `AddDraft` (`src/components/AddWizard.tsx:15-31`, тип — `src/types.ts:53-69`) | Черновик POI |
| `locating` | `boolean` | индикатор захвата GPS |
| `locationError` | `string \| null` | текст ошибки GPS |
| `aiLoading` | `boolean` | индикатор ИИ-распознавания |
| `aiFilled` | `boolean` | признак того, что поля были заполнены ИИ |
| `isSaving` | `boolean` | блокировка повторного сохранения |

Эффекты:
- `src/components/AddWizard.tsx:43-47` — автозахват геопозиции на шаге 1.
- `src/components/AddWizard.tsx:166-192` — привязка нативных `BackButton`/`MainButton` Telegram (см. §5). Зависимости: `[step, draft, isSaving]`. При размонтировании — `telegram.hideMainButton()` + `telegram.hideBackButton()`.

### 2.3 `AdminPanel` (`src/components/AdminPanel.tsx:13-15`)

| State | Тип | Назначение |
|---|---|---|
| `filterStatus` | `AccessibilityStatus \| "all"` | локальный фильтр списка |
| `editingPlaceId` | `string \| null` | какая карточка раскрыта для смены статуса |

ВАЖНО: `AdminPanel` работает **только с props** (`places`, `onDeletePlace`, `onUpdateStatus`). Он не ходит в `api` напрямую и не модифицирует `places` — все мутации возвращаются в `TelegramApp` через колбэки, где и применяются к state (`src/TelegramApp.tsx:113-124`). То есть удаление и смена статуса в текущей версии **не персистятся ни в Supabase, ни в localStorage** — это расходится с mock-режимом `createPlace`, который пишет в localStorage (см. §4).

### 2.4 `Profile` (`src/components/Profile.tsx:12-43`)

Внутреннего state нет. Все данные приходят из props (`profile`, `theme`, `onChangeTheme`). Расчёты прогресса кармы — на основе `karmaNext(profile.karma)` (`:14`) и локальной таблицы порогов `getPrevLimit` (`:18-29`).

---

## 3. Роли «картограф» / «админ» и проверки

### 3.1 Источник ролей

| Слой | Где | Что определяет |
|---|---|---|
| Тип | `src/types.ts:1` | `Role = "owner" \| "admin" \| "operator" \| "tester" \| "public_user" \| "banned"` |
| Mock-профиль | `src/services/api.ts:124-135` | Жёстко зашит `role: "owner"` для `id: "u-operator"`, `telegramId: 215263723`, `username: "alkhas_abaza"`, `displayName: "Алхас Тхагушев"`, `karma: 125`, `karmaStatus: "Картограф"`. |
| Live-режим | `src/services/api.ts:204-206` | `role` берётся из ответа Edge-функции `auth-telegram` (поле `data.profile.role`). |
| БД-контракт | `supabase/migrations/0001_initial_schema.sql:14-27` | `profiles.role` с `check (...)` и `default 'tester'`. Допустимые значения — те же 6 строк. |

### 3.2 Проверки роли во фронтенде

**Единственная проверка в `TelegramApp`-контуре:**

`src/TelegramApp.tsx:462`:
```tsx
{profile && ["owner", "admin", "operator", "tester"].includes(profile.role) && (
  <button ...>...<ShieldAlert/> Админ</button>
)}
```

- Определяет только видимость вкладки «Админ» в `bottom-nav`.
- **Не** защищает сам экран `AdminPanel`: если `activeTab === "admin"` уже выставлен программно, компонент рендерится без повторной проверки роли (`src/TelegramApp.tsx:415-421`).
- `public_user` и `banned` — не видят вкладку.
- Настройка `profile.aiEnabled` управляет видимостью кнопки «Распознать» в визарде (`src/components/AddWizard.tsx:259`), но это не роль.

### 3.3 «Картограф» — это НЕ роль, это карма-статус

В коде нет проверки «роль == картограф». «Картограф» — это **karmaStatus** (уровень по очкам), а не роль:

- `src/services/api.ts:133` — mock-профиль инициализирован `karmaStatus: "Картограмм"` (в коде именно русское название).
- `src/services/api.ts:149-162` — `translateKarmaStatus` и `getKarmaStatusAndNextLimit` берут статус из shared `KARMA_LEVELS`/`karmaLevelFor` (`src/shared/index.ts`).
- `src/components/Profile.tsx:18-29` — пороги: Пешеход (0) / Исследователь (30) / Картограф (100) / Проводник (250) / Знаток города (500) / Хранитель (1000) / Легенда (1800).
- `supabase/migrations/0001_initial_schema.sql:119-133` — серверная `karma_status_for()` определяет те же 7 порогов, но slug’ами (`cartographer` наступает при ≥100).

Таким образом, в коде присутствуют два **независимых** понятия:
- `role` (`owner/admin/operator/tester/public_user/banned`) — про права.
- `karmaStatus` (`Пешеход/.../Легенда`) — про геймификацию.

### 3.4 Серверная защита (на будущее, когда `isLiveMode = true`)

В схеме БД уже заложены RLS-политики, которые реально защищают действия независимо от фронтенда:

| Действие | Кто может (БД) | SQL |
|---|---|---|
| Чтение `places` | published или автор или admin | `supabase/migrations/0001_initial_schema.sql:371-373` |
| Создание `places` | `current_user_can_collect()` ∈ {owner, admin, operator, tester} | `:374-381`, функция `:303-311` |
| Update `places` | admin или автор | `:382-385` |
| Delete `places` | **только admin/owner** | `:386-388`, функция `current_user_is_admin()` `:313-321` |
| Insert `photos` | `current_user_can_collect()` + владелец place | `:400-410` |
| Управление `categories` | только admin | `:362-365` |

То есть на фронтенде `AdminPanel` «админ» — это термин UI; реальная защита удаления — серверная.

⚠️ Важно: при `isLiveMode = false` (текущее состояние, `src/services/api.ts:8`) **RLS не работает**, потому что клиент даже не обращается к Supabase.

---

## 4. Supabase и функции `api.ts`

### 4.1 Файл `src/services/api.ts` (493 строки)

**Глобальный флаг режима — `src/services/api.ts:8`:**
```ts
const isLiveMode = false;
```
Константа прибита к `false` гвоздями. Даже при наличии `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`:5-6`) **все вызовы идут в mock-ветку**. Лог-сообщение в консоли (`:10`) это подтверждает: `[GoApsny API] Mode: MOCK (Local Storage)`.

Env-переменные читаются через `import.meta.env`, но **`src/.env*` в рамках этой инвентаризации не открывались** (запрещено).

**Конфигурация Supabase:**
- `SUPABASE_URL` (`:5`), `SUPABASE_ANON_KEY` (`:6`).
- `supabaseRequest()` (`:165-184`) — общий POST-хелпер к Edge Functions с заголовками `Authorization: Bearer ...` и `apikey`.
- REST-вызовы идут напрямую через `fetch` к `${SUPABASE_URL}/rest/v1/...` (`:227`, `:402`) или к `${SUPABASE_URL}/storage/v1/object/...` (`:351`, `:362`).
- Используется `@supabase/supabase-js` v2.99.1 (`package.json:19`), но **в `api.ts` самом объект `createClient` не создаётся** — только `fetch` + `apikey`/`Authorization`. SDK может использоваться в других модулях (за пределами списка файлов задачи).

**Экспорты:**
- `categoriesList` (`:28-32`) — производная от shared `CATEGORIES` + emoji-маппинг (`:12-25`). Используется в `TelegramApp.tsx:306-307`, `AddWizard.tsx:297`, `AdminPanel.tsx:22`.
- `translateKarmaStatus(slug)` (`:149-152`).
- `getKarmaStatusAndNextLimit(points)` (`:155-162`).
- `api` (`:186-492`) — объект с 4 методами.

### 4.2 Методы `api`

| Метод | Сигнатура | Mock-поведение | Live-поведение |
|---|---|---|---|
| `loginTelegram(initData)` `src/services/api.ts:188-217` | `Promise<{token, profile}>` | Задержка 800 мс (`:191`), читает `localStorage["goapsny_profile"]` через `getStorageProfile()` (`:124-142`, дефолт — owner/Алхас). Возвращает `token: "mock_jwt_token"`. | POST `${SUPABASE_URL}/functions/v1/auth-telegram` (`:197`) с `{ initData }`. Мапит поля snake_case → camelCase (`:200-210`). **При ошибке молча падает в mock** (`:212-216`) — это не безопасно: сбой сети авторизации пропускает пользователя как owner в localStorage. |
| `getPlaces()` `:220-263` | `Promise<Place[]>` | Задержка 300 мс, `localStorage["goapsny_places"]` (через `getStoragePlaces()`, `:111-118`). | GET `${SUPABASE_URL}/rest/v1/places?select=*&moderation_status=eq.published` (`:227`). Маппинг snake→camel (`:235-258`). При ошибке — fallback в localStorage (`:259-262`). |
| `createPlace(placeData, photoFile?)` `:266-450` | `Promise<Place>` | Задержка 1000 мс, генерация id `p-${Date.now()}`, фото в `URL.createObjectURL` или дефолтный Unsplash URL, OSM-маппинг (`:280-290`), сохранение в localStorage, **начисление кармы прямо на клиенте** (`:322-335`). Бонусы: +10 за POI, +5 за фото, +10 за «полную карточку». | Сначала upload фото в Storage `place-photos/${placeId}/facade.${ext}` (`:347-364`), затем POST `/rest/v1/places` (`:402-411`). Карма на клиенте **не начисляется** — делегировано триггерам БД (`:420`, см. `award_place_karma` в `supabase/migrations/0001_initial_schema.sql:189-202,288-289`). ⚠️ **При ошибке live-режима метод рекурсивно вызывает `this.createPlace(placeData, photoFile)` (`:448`) — это бесконечная рекурсия, если ошибка постоянная.** |
| `getAiAutofill(photoPath)` `:453-492` | `Promise<{name, category, stepsCount, rampType, status}>` | Задержка 1500 мс, возвращает захардкоженные «правдоподобные» значения (`:464-470`). | POST `/functions/v1/ai-autofill` (`:474`). При ошибке — fallback на другие захардкоженные значения (`:482-491`). |

### 4.3 Соответствие схеме БД

- Поля `Profile` (`src/types.ts:6-16`) ↔ `profiles` (`supabase/migrations/0001_initial_schema.sql:14-27`). ⚠️ `Profile.karmaStatus` (`:13`) хранит **русское** название (например, `"Картограф"`), а БД `profiles.karma_status` (`:24`) — slug (`'cartographer'`). Маппинг делается в `translateKarmaStatus` (`src/services/api.ts:149-152,208`).
- Поля `Place` ↔ `places` — имена полей конвертируются snake↔camel построчно (`src/services/api.ts:235-258, 422-444`).
- Storage bucket `place-photos` (`:427-433`) — приватный, только JPEG, лимит 10 МБ (`:428`).

### 4.4 Триггеры БД (для контекста, не из `api.ts`)

- `places_award_karma` после insert в `places` вызывает `award_place_karma` (`supabase/migrations/0001_initial_schema.sql:288-289, 189-202`) → `add_karma(...)` (`:135-168`).
- `photos_award_karma` после insert в `photos` (`:290-291, 204-214`).
- `place_has_full_card()` (`:170-187`) — критерий бонуса +10.
- `places_set_osm_tags` (`:286-287, 271-280`) — серверный OSM-маппинг, дублирующий клиентский в `api.ts:280-290`. **В mock-режиме эти два маппинга могут расходиться.**

---

## 5. Что зависит от Telegram и не работает в обычном браузере

Обёртка `src/utils/telegram.ts` построена с fallback’ами, поэтому приложение **запускается** в обычном браузере, но функциональность **частично деградирует**. Признак Telegram-окружения — `src/utils/telegram.ts:11`:
```ts
const isTelegram = () => typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;
```

### 5.1 Жёсткие зависимости (не работают вне Telegram, fallback есть, но поведение иное)

| Возможность | Где | Поведение вне Telegram |
|---|---|---|
| **Аутентификация** через `initData` | `src/utils/telegram.ts:18-24` (`getInitData`) | Возвращает захардкоженный mock-initData с `telegramId:215263723`, `username:alkhas_abaza`, `hash=mocked_hash`. В live-режиме Edge-функция `auth-telegram` такой подпись **должна отклонить** (невалидный `hash`), но т.к. `isLiveMode=false` (`src/services/api.ts:8`), mock-вход проходит и пользователь становится `owner`. |
| **Нативный MainButton** (кнопка «Далее / Сохранить» внизу) | `src/utils/telegram.ts:83-101` (`setupMainButton`); используется только в `AddWizard` — `src/components/AddWizard.tsx:166-192` | Вне Telegram MainButton не отображается. Компенсация: рендерится HTML-футер `wizard-footer` (`src/components/AddWizard.tsx:466-493`), который в Telegram скрывается. **Условие:** `!telegram.isTelegram()` (`:466`). |
| **Нативный BackButton** | `src/utils/telegram.ts:110-122`; вызов в `src/components/AddWizard.tsx:168` | Вне Telegram не виден; тот же `wizard-footer` даёт кнопку «Назад». |
| **LocationManager** (Telegram Mini Apps 2.0+) | `src/utils/telegram.ts:131-176` | При отсутствии `wa.LocationManager` срабатывает `fallbackHtml5Location` (`:178-199`) — HTML5 Geolocation. В браузере работает, но требует разрешения `geolocation` и часто блокируется на `http://` без HTTPS. |
| **HapticFeedback** | `src/utils/telegram.ts:61-80` (`hapticNotify`, `hapticSelection`) | `hapticNotify` пишет в консоль `[Haptic Mock]` (`:68`); `hapticSelection` молча no-op. |
| **colorScheme / themeParams** | `src/utils/telegram.ts:27-44` | В браузере берётся `window.matchMedia("(prefers-color-scheme: dark)")` (`:40`). |
| **showAlert** | `src/utils/telegram.ts:202-209` | Деградирует до `window.alert` (`:206`). |
| **ready() / expand()** | `src/utils/telegram.ts:47-58` | No-op вне Telegram. Вызываются на init (`src/TelegramApp.tsx:65-66`). |

### 5.2 Что в браузере сломается частично или незаметно

1. **`AddWizard.handleSave`** (`src/components/AddWizard.tsx:132-163`) использует `telegram.alert` для подтверждения сохранения. В браузере это `window.alert` — блокирующий, не модальный в смысле UI. Контент «+25 кармы начислено» (`:155`) всё ещё покажется.
2. **Кнопка «Имитировать фото (для разработки)»** в `AddWizard` видна **только** при `!telegram.isTelegram()` (`src/components/AddWizard.tsx:222-226`). Это намеренный dev-режим.
3. **Mock-камера** (`triggerMockPhoto`, `src/components/AddWizard.tsx:77-84`) подставляет Unsplash-фото — срабатывает только в дев-режиме.
4. **`getAiAutofill`** (`src/services/api.ts:453-492`) в mock-режиме возвращает одни и те же захардкоженные значения независимо от реального фото — в браузере это выглядит «работающим», но это не реальное распознавание.
5. **`AdminPanel.handleDelete`** (`src/components/AdminPanel.tsx:26-31`) использует `telegram.alert(msg, callback)` для confirm-диалога. В браузере колбэк вызывается немедленно после `window.alert` (`src/utils/telegram.ts:206-208`) — **диалог не даёт пользователю выбора «отмена»**, как это делает нативный `showAlert` с колббэком. Это **поведенческое расхождение** между браузером и Telegram.
6. **Карма.** В mock-режиме карма начисляется локально в localStorage (`src/services/api.ts:332-335`), но при live-режиме — сервером через триггеры (`supabase/migrations/0001_initial_schema.sql:189-202`). В браузере без Telegram live-режим всё равно не активен (`isLiveMode=false`), поэтому реально карма существует только в localStorage конкретного устройства.

### 5.3 Карта зависимостей от окружения

```
Telegram-окружение (window.Telegram.WebApp.initData существует)
├── 🟢 Обязательно для реальной аутентификации (initData → auth-telegram) — но сейчас отключено isLiveMode
├── 🟢 MainButton / BackButton — UI AddWizard (есть HTML fallback)
├── 🟢 LocationManager — первичный источник GPS (есть HTML5 fallback)
├── 🟡 HapticFeedback — приятное, не критично
├── 🟡 showAlert → confirm dialogs (AdminPanel delete) — поведенческое расхождение
└── 🟡 theme colorScheme — есть prefers-color-scheme fallback

Браузер без Telegram
└── Приложение работает полностью в mock-режиме: mock-user owner, localStorage places/profiles, mock-ИИ, mock-GPS (HTML5), HTML-кнопки визарда.
```

---

## RESULT=PASS

**Выходной файл:** `/Users/alkhas.abaza/repo/goapsny-mvp--epoch3-integrate/docs/epoch3-inventory-telegram.md`
**Изменения:** создан только этот docs-файл. Код, тесты, конфиги, `.env`, git — не тронуты.

### Ключевые выводы (7)

1. **Telegram-контур = `TelegramApp` + 4 дочерних компонента** (`AddWizard`, `Profile`, `AdminPanel`, `LeafletMap`). Шесть файлов из задания (`MapHeader`, `MapFooter`, `MenuOverlay`, `PlaceSheet`, `MapFilters`, `WelcomeLegend`) **не принадлежат этому контуру** — они используются только в `PublicApp`/`PublicMap` (другая ветка UI, в текущем `main.tsx` не монтируется).
2. **Карточка POI в TelegramApp инлайнится прямо в `TelegramApp.tsx:298-391`**, отдельный `PlaceSheet.tsx` не переиспользуется — это дубль логики.
3. **Единственная проверка роли — фронтенд-проверка видимости вкладки «Админ»** (`TelegramApp.tsx:462`, `["owner","admin","operator","tester"]`). Сам экран `AdminPanel` после переключения не защищён повторной проверкой. «Картограф» — это **karmaStatus** (≥100 кармы), не роль; проверок «роль == картограф» в коде нет.
4. **`isLiveMode = false` прибит в `api.ts:8`** — всё ходит в localStorage независимо от наличия Supabase env. Серверная авторизация и RLS фактически не активны в текущей сборке.
5. **`createPlace` имеет опасный path** — при ошибке live-режима вызывает `this.createPlace(placeData, photoFile)` рекурсивно (`api.ts:448`), что при постоянной ошибке даст бесконечную рекурсию. Также `loginTelegram` при ошибке live-режима молча возвращает mock-owner (`api.ts:212-216`).
6. **`AdminPanel` не персистит изменения**: `handleDeletePlace`/`handleUpdateStatus` в `TelegramApp.tsx:113-124` мутируют только локальный state. В mock-режиме `getPlaces()` читает localStorage → после рестарта удалённые/изменённые через админку объекты **вернутся**. Это несоответствие с `createPlace`, который localStorage обновляет.
7. **Telegram-зависимости имеют fallback** (MainButton/BackButton → HTML-футер, LocationManager → HTML5 geolocation, haptics → no-op/console, showAlert → `window.alert`), но есть **поведенческое расхождение** в `AdminPanel.handleDelete` (`AdminPanel.tsx:26-31`): нативный `showAlert` даёт confirm-диалог, а браузерный `window.alert` — мгновенный колбэк без опции отмены.

### Неразрешённые вопросы

1. Должен ли `AdminPanel` идти через `api` (как `createPlace`), чтобы удаления/смены статусов персистились в mock- и live-режимах? Текущая реализация — только локальный state.
2. Планируется ли включение `isLiveMode = true` в этой Epoch’е? Если да, нужно исправить рекурсию в `createPlace` (`api.ts:448`) и silent-owner-fallback в `loginTelegram` (`api.ts:212-216`).
3. `PublicApp` и весь public-контур (`MapHeader`/`MapFooter`/`MenuOverlay`/`PlaceSheet`/`MapFilters`/`WelcomeLegend`) присутствуют в репо, но не монтируются в `main.tsx`. Это намеренно для этой Epoch’и (и их нужно ревьюить отдельно), или это забытая ветка?
4. Защита экрана `AdminPanel` строится на UI-флажке вкладки (`TelegramApp.tsx:462`). Считать ли это приемлемым, учитывая что серверная RLS уже реализована в `0001_initial_schema.sql`? Нужно ли добавить guard внутри `AdminPanel` на случай программного `setActiveTab("admin")`?
5. В коде остались две независимые OSM-маппинг-реализации — клиентская (`api.ts:280-290`) и серверная (`build_place_osm_tags`, `0001_initial_schema.sql:216-269`). Синхронизированы ли они намеренно? В mock-режиме работает только клиентская.
