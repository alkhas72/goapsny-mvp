# Контракт единого приложения — Эпоха 3, партия 1.1

Инвентаризация двух контуров перед слиянием в одно приложение. Режим: `superpowers-lite` (docs-only, поведение не меняется). Документ только фиксирует факты кода; каждое утверждение имеет ссылку `файл:строка`. Всё, что не подтверждено чтением перечисленных файлов, помечено «требует уточнения».

**Контур A (Telegram Mini App, операторский):** `src/TelegramApp.tsx`, `src/components/AddWizard.tsx`, `src/components/AdminPanel.tsx`, `src/components/Profile.tsx`, `src/services/api.ts`.
**Контур B (публичный PWA):** `src/PublicApp.tsx`, `src/components/PublicMap.tsx`, `src/components/EmailOtpSheet.tsx`, `src/components/PublicAddSheet.tsx`, `src/services/publicAuth.ts`, `src/services/submit-place.ts`.

Файлы вне контуров (`src/services/places.ts`, `src/services/supabase.ts`, `src/components/LeafletMap.tsx`, `src/components/PlaceSheet.tsx`, `src/main.tsx`, `src/public-main.tsx`, миграции) не читались — их внутренности здесь не утверждаются, только точки использования.

---

## 1. Общее / различающееся

### 1.1. Оболочка и роутинг

| Аспект | Контур A | Контур B |
|---|---|---|
| Каркас | `.app-shell` + header + `.screen-content` + нижняя навигация (`src/TelegramApp.tsx:183-206`, `src/TelegramApp.tsx:425-475`) | `.app-shell.public-app-shell` (`src/PublicApp.tsx:16`, `src/PublicApp.tsx:23`) с `.public-map-shell` + header/footer (`src/components/PublicMap.tsx:300-377`) |
| Роутинг | Вкладки-состояние `useState<Tab>("map")`, значения `map/add/profile/admin` (`src/TelegramApp.tsx:34`, рендер `src/TelegramApp.tsx:209-421`); URL-роутера нет | Вкладок нет; один экран карты + оверлеи (меню, фильтры, листы) (`src/components/PublicMap.tsx:328-371`); URL-роутера нет |
| Стартовый гейт | Сплэш загрузки (`src/TelegramApp.tsx:130-141`), затем GPS-праймер, гейтится флагом `goapsny_gps_primed` в localStorage (`src/TelegramApp.tsx:43-45`, `src/TelegramApp.tsx:144-181`) | Приветственный экран `WelcomeLegend`, гейтится `hasSeenWelcome()` (`src/PublicApp.tsx:7-20`); затем `loadState` loading/error/ready (`src/components/PublicMap.tsx:60`, `src/components/PublicMap.tsx:281-298`) |
| Точка входа | `TelegramApp` (экспорт `src/TelegramApp.tsx:33`) | `PublicApp` (экспорт `src/PublicApp.tsx:6`); какой вход куда монтируется (`src/main.tsx` vs `src/public-main.tsx`) — **требует уточнения** (вне контура) |

### 1.2. Карта

| Аспект | Общее | Различия |
|---|---|---|
| Компонент | Оба контура рендерят один и тот же `LeafletMap` (`src/TelegramApp.tsx:5`, `src/TelegramApp.tsx:213-219`; `src/components/PublicMap.tsx:2`, `src/components/PublicMap.tsx:319-327`) | B передаёт `useBrowserGeolocation` и `onMarkerButton` (`src/components/PublicMap.tsx:325-326`); A — нет (`src/TelegramApp.tsx:213-219`) |
| Выбор точки (drag) | Оба используют `dragMode` того же `LeafletMap` (`src/components/AddWizard.tsx:449-460`; `src/components/PublicAddSheet.tsx:240-254`) | — |
| Фильтрация мест | Фильтр по статусу есть в обоих | A: локальный `filter` all/green/yellow/red (`src/TelegramApp.tsx:39`, `src/TelegramApp.tsx:128`, чипы `src/TelegramApp.tsx:224-268`). B: `PlaceFilters` = категории + статус + текстовый запрос через `applyPlaceFilters` (`src/components/PublicMap.tsx:69-73`, `src/components/PublicMap.tsx:148-151`; внутренности `src/services/places.ts` — **требует уточнения**) |
| Легенда | — | A имеет оверлей-легенду «пурпурный центр = приставной пандус» (`src/TelegramApp.tsx:270-294`); в B в контуре легенды нет (есть отдельный `WelcomeLegend`, `src/PublicApp.tsx:3` — внутренности **требует уточнения**) |

### 1.3. Supabase

| Аспект | Контур A | Контур B |
|---|---|---|
| Конфигурация | Те же env `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`src/services/api.ts:5-6`) | Те же env (упоминаются в ошибке `src/services/submit-place.ts:215` и в сообщении `src/components/PublicMap.tsx:121`); проверка `isSupabaseConfigured()` (`src/components/PublicMap.tsx:25`, `src/components/PublicMap.tsx:118`) |
| Клиент | Сырой `fetch` к REST и Edge Functions с anon-ключом в заголовках (`src/services/api.ts:165-184`, `src/services/api.ts:227-232`, `src/services/api.ts:351-359`, `src/services/api.ts:402-411`) | Официальный `@supabase/supabase-js` клиент через `getSupabaseClient()` (`src/services/publicAuth.ts:1-2`, `src/services/publicAuth.ts:48`; `src/services/submit-place.ts:1-2`, `src/services/submit-place.ts:220-221`) |
| Режим | Жёстко `isLiveMode = false` — все вызовы идут в mock/localStorage даже при наличии env (`src/services/api.ts:7-8`, `src/services/api.ts:189-194`, `src/services/api.ts:221-224`, `src/services/api.ts:269-338`) | Live-only: без конфигурации — экран ошибки (`src/components/PublicMap.tsx:118-124`), без сессии — `auth_required` от RPC (`src/services/submit-place.ts:75-76`, `src/services/submit-place.ts:147-149`) |
| Фолбэки | Тихий откат на mock при любой ошибке live-вызова (`src/services/api.ts:212-216`, `src/services/api.ts:259-262`, `src/services/api.ts:446-449`) | Без тихих фолбэков: ошибки классифицируются и показываются (`src/services/submit-place.ts:141-196`; `src/components/PublicAddSheet.tsx:133-138`) |

### 1.4. Авторизация

| Аспект | Контур A | Контур B |
|---|---|---|
| Метод | Telegram `initData` → `api.loginTelegram` → Edge Function `auth-telegram` (live-ветка) (`src/TelegramApp.tsx:57-59`; `src/services/api.ts:188-217`) | Email OTP, 8 цифр, `supabase.auth.signInWithOtp` + `verifyOtp(type:'email')` (`src/services/publicAuth.ts:5`, `src/services/publicAuth.ts:49-52`, `src/services/publicAuth.ts:66-70`) |
| Сессия | Токен не хранится и не используется дальше: `loginTelegram` возвращает `{token, profile}`, токен игнорируется, профиль кладётся в state (`src/TelegramApp.tsx:58-59`; mock-токен `src/services/api.ts:193`) | Сессия Supabase Auth: чтение и подписка на изменения (`src/services/publicAuth.ts:78-105`), sign-out (`src/services/publicAuth.ts:85-89`), email в state `authEmail` (`src/components/PublicMap.tsx:91-105`) |
| Профиль | `Profile` с `role`, `karma`, `aiEnabled`; mock-профиль `u-operator`/`owner` из localStorage (`src/services/api.ts:124-142`) | Профиля как сущности на клиенте нет — только `session.user.email` (`src/components/PublicMap.tsx:95`, `src/components/PublicMap.tsx:99`); принадлежность к роли проверяет сервер (`src/services/submit-place.ts:79-80`, `src/services/submit-place.ts:153-155`) |
| UX входа | Невидим для пользователя (автологин при старте, `src/TelegramApp.tsx:48-74`) | Явный лист `EmailOtpSheet`: email → код, кулдаун повторной отправки 60 с (`src/components/EmailOtpSheet.tsx:24`, `src/components/EmailOtpSheet.tsx:52-85`; `src/services/publicAuth.ts:4`, `src/services/publicAuth.ts:23-26`) |

### 1.5. Роли и права

| Аспект | Контур A | Контур B |
|---|---|---|
| Модель ролей | `profile.role`; таб «Админ» виден ролям `owner/admin/operator/tester` (`src/TelegramApp.tsx:462-474`) | Серверная роль `public_user`; иначе RPC ошибка `role_required` (`src/services/submit-place.ts:79-80`, `src/services/submit-place.ts:153-155`) |
| Модерация | `AdminPanel`: смена статуса и удаление — только локальный state, без серверных вызовов в контуре (`src/components/AdminPanel.tsx:26-42`; колбэки `src/TelegramApp.tsx:113-124`) | Модерации на клиенте нет: публичное место уходит «серой меткой» на проверку аудиторам (`src/components/PublicAddSheet.tsx:131`) |
| Лимиты | Без лимитов на добавление (`src/components/AddWizard.tsx:132-163`) | Одно место на пользователя: `already_submitted` (`src/services/submit-place.ts:87-88`, `src/services/submit-place.ts:165-167`) |
| Публикация | Мгновенная: `moderationStatus: "published"` при создании (`src/services/api.ts:309`, `src/services/api.ts:396`) | Отложенная: статус gray + модерация сообществом (`src/components/PublicAddSheet.tsx:131`; поля status/moderation/source жёстко задаёт сервер — комментарий `src/services/submit-place.ts:247-248`) |

### 1.6. Добавление места

| Аспект | Общее | Различия |
|---|---|---|
| Шаги | 4 шага в обоих; шаг 1 — обязательное фото (`src/components/AddWizard.tsx:126`, `src/components/AddWizard.tsx:203-252`; `src/components/PublicAddSheet.tsx:94`, `src/components/PublicAddSheet.tsx:175-198`); индикатор прогресса из 4 сегментов (`src/components/AddWizard.tsx:197-201`; `src/components/PublicAddSheet.tsx:169-173`) | A: шаги = фото+GPS / инфо / статус / геоточка (`src/components/AddWizard.tsx:203-463`). B: фото / название+категория / геоточка / публикация (`src/components/PublicAddSheet.tsx:175-294`) |
| Категории | Единый источник `CATEGORIES` из `src/shared` (импорт `src/services/api.ts:2`; импорт `src/components/PublicAddSheet.tsx:3`) | A оборачивает в `categoriesList` с эмодзи (`src/services/api.ts:12-32`); B использует `CATEGORIES` напрямую (`src/components/PublicAddSheet.tsx:53`, `src/components/PublicAddSheet.tsx:225-230`) |
| Данные карточки | — | A собирает полную карточку: ступени, высота, пандус (4 значения), ширина двери, туалет, комментарий (`src/components/AddWizard.tsx:305-396`, сборка `src/components/AddWizard.tsx:136-151`). B собирает только `name/category/lat/lng/photo` (`src/components/PublicAddSheet.tsx:124-130`; интерфейс `src/services/submit-place.ts:40-51`) |
| Статус | — | A требует выбор green/yellow/red, серого нет (`src/components/AddWizard.tsx:128`, `src/components/AddWizard.tsx:400-440`, текст `src/components/AddWizard.tsx:403`). B всегда создаёт серую метку (`src/components/PublicAddSheet.tsx:131`, `src/components/PublicAddSheet.tsx:290`) |
| Канал отправки | — | A: `api.createPlace` → mock localStorage (live-ветка: POST в `/rest/v1/places` + загрузка фото в Storage) (`src/services/api.ts:266-450`). B: `submitPublicPlace` → загрузка `{place_id}/facade.jpg` → RPC `submit_public_place` с 6 параметрами (`src/services/submit-place.ts:206-264`, сигнатура `src/services/submit-place.ts:13-20`) |
| Фото | Превью через `URL.createObjectURL` в обоих (`src/components/AddWizard.tsx:66-71`; `src/components/PublicAddSheet.tsx:89`) | A live-ветка грузит `place-photos/{id}/facade.{ext}` произвольного типа, без `upsert:false` (`src/services/api.ts:346-364`). B — строго `{uuid}/facade.jpg`, только `image/jpeg`, `upsert:false` (`src/services/submit-place.ts:28-34`, `src/services/submit-place.ts:229-245`) |
| Геолокация | Дефолтные координаты Сухума `43.0033, 41.0237` в обоих (`src/components/AddWizard.tsx:139-140`; `src/components/PublicAddSheet.tsx:43-44`; также mock `src/services/api.ts:296-297`) | A: `telegram.getUserLocation()` (`src/components/AddWizard.tsx:53`). B: браузерная геолокация `getBrowserLocation` с фолбэком на дефолт (`src/components/PublicAddSheet.tsx:60-71`; внутренности `src/utils/location.ts` — **требует уточнения**) |
| Post-submit | — | A: место в начало списка, таб `map`, маркер выбран, профиль перелогином синхронизирует карму (`src/TelegramApp.tsx:95-111`); карма +10/+5/+10 в mock (`src/services/api.ts:321-335`), алерт «+25 кармы» (`src/components/AddWizard.tsx:155`). B: закрыть лист → `reloadPlaces`, при сбое — оптимистичная вставка gray-заглушки, затем открыть лист места (`src/components/PublicMap.tsx:244-279`) |
| ИИ-автозаполнение | — | Только в A: `api.getAiAutofill`, гейт `profile.aiEnabled` (`src/components/AddWizard.tsx:86-107`, `src/components/AddWizard.tsx:259-273`; `src/services/api.ts:453-492`) |

### 1.7. UI-состояния

| Состояние | Контур A | Контур B |
|---|---|---|
| Загрузка | Единый сплэш «Загрузка GoApsny…» (`src/TelegramApp.tsx:130-141`) | `loadState: loading/ready/error` с экраном ошибки и кнопкой «Повторить» (`src/components/PublicMap.tsx:60-62`, `src/components/PublicMap.tsx:281-298`, retry `src/components/PublicMap.tsx:62`, `src/components/PublicMap.tsx:146`) |
| Лист места | Синхронный: место уже в памяти, лист без состояний загрузки (`src/TelegramApp.tsx:127`, `src/TelegramApp.tsx:298-391`) | Машина состояний `idle/loading/partial/error`: сначала кэш, затем `fetchPlaceById`, деградация в `partial` (`src/components/PublicMap.tsx:63-66`, `src/components/PublicMap.tsx:173-197`) |
| Ошибки | `console.error` + `telegram.alert` (`src/TelegramApp.tsx:67-69`; `src/components/AddWizard.tsx:157-160`) | Типизированные ошибки → детерминированные русские сообщения по `SubmitPlaceErrorKind` (`src/services/submit-place.ts:70-98`, `src/components/PublicAddSheet.tsx:17-32`, `src/components/PublicAddSheet.tsx:133-138`) |
| Тема | Из Telegram + ручной переключатель в header и в профиле (`src/TelegramApp.tsx:38`, `src/TelegramApp.tsx:197-204`; `src/components/Profile.tsx:39-43`, `src/components/Profile.tsx:106-118`) | Только `prefers-color-scheme` при старте, без переключателя (`src/components/PublicMap.tsx:56-58`, эффект `src/components/PublicMap.tsx:87-89`) |
| A11y / фокус | Не управляется (нет focus-trap в контуре) | `trapFocus` в обоих листах, `aria-modal`, возврат фокуса на кнопки, фокус на маркер после закрытия листа (`src/components/EmailOtpSheet.tsx:44-50`, `src/components/PublicAddSheet.tsx:77-83`, `src/components/PublicMap.tsx:153-164`, `src/components/PublicMap.tsx:200-206`) |
| Haptics / нативные кнопки | `telegram.hapticSelection/hapticNotify`, MainButton/BackButton (`src/components/AddWizard.tsx:166-192`; `src/TelegramApp.tsx:230` и др.) | Отсутствуют (нет импортов `utils/telegram` в контуре B) |
| Тосты | Нет; алерты Telegram (`src/components/AddWizard.tsx:155`) | `public-toast` для кабинета/заглушек ссылок (`src/components/PublicMap.tsx:74`, `src/components/PublicMap.tsx:379-395`) |

---

## 2. Что переезжает B → A целиком

1. **`src/services/publicAuth.ts` целиком** — OTP-авторизация, валидация email/кода, кулдаун, `maskEmailDomain`, сессия и подписка (`src/services/publicAuth.ts:1-105`). Зависимость: `src/services/supabase.ts` (`src/services/publicAuth.ts:2` — **требует уточнения**, вне контура).
2. **`src/components/EmailOtpSheet.tsx` целиком** — двухшаговый лист входа email→код с кулдауном и focus-trap (`src/components/EmailOtpSheet.tsx:21-197`); тянет `src/utils/focusTrap.ts` (`src/components/EmailOtpSheet.tsx:11`).
3. **`src/services/submit-place.ts` целиком** — hardened-граница отправки: константы пути фото, классификатор ошибок, `submitPublicPlace` (`src/services/submit-place.ts:27-37`, `src/services/submit-place.ts:101-112`, `src/services/submit-place.ts:141-196`, `src/services/submit-place.ts:206-264`). Контракт RPC зафиксирован в docstring (`src/services/submit-place.ts:7-25`).
4. **`src/components/PublicAddSheet.tsx` целиком** — публичная 4-шаговая форма с summary-шагом и картой ошибок (`src/components/PublicAddSheet.tsx:46-321`).
5. **Гейт «добавление требует входа»** — `beginAddFlow` / `pendingAddAfterAuth` / `handleAuthVerified` (`src/components/PublicMap.tsx:214-242`).
6. **Машина состояний загрузки карты** с retry (`src/components/PublicMap.tsx:60-62`, `src/components/PublicMap.tsx:114-146`, `src/components/PublicMap.tsx:281-298`).
7. **Машина состояний листа места** `idle/loading/partial/error` с кэш-тhen-сеть (`src/components/PublicMap.tsx:173-197`) — заменяет синхронный `selectedPlace` контура A (`src/TelegramApp.tsx:127`).
8. **Расширенная модель фильтров** (категории + статус + текст) (`src/components/PublicMap.tsx:69-73`, `src/components/PublicMap.tsx:148-151`) — вместо только-статусных чипов A (`src/TelegramApp.tsx:224-268`).
9. **Подписка на сессию и sign-out** в UI (`src/components/PublicMap.tsx:91-105`, `src/components/PublicMap.tsx:382-390`).
10. **A11y-паттерны**: focus-trap, `aria-modal`, управление фокусом маркеров (`src/components/PublicMap.tsx:153-164`; `src/components/EmailOtpSheet.tsx:44-50`) и props `useBrowserGeolocation`/`onMarkerButton` для `LeafletMap` (`src/components/PublicMap.tsx:325-326`).

---

## 3. Что дублируется и удаляется после слияния

1. **Двойной загрузчик мест**: mock/localStorage + `api.getPlaces` в A (`src/services/api.ts:111-122`, `src/services/api.ts:220-263`) против `fetchPublishedPlaces` в B (`src/components/PublicMap.tsx:107-112`, `src/components/PublicMap.tsx:128`). После слияния остаётся один загрузчик (B-ветка через `src/services/places.ts`); mock-магазин A удаляется. Внутренности `places.ts` — **требует уточнения**.
2. **Двойной маппинг строки → `Place`**: `getPlaces` live-маппинг (`src/services/api.ts:235-258`) дублирует `toMapPlace` (`src/components/PublicMap.tsx:28-53`) и `mapPlaceRow` (`src/components/PublicMap.tsx:250`). Остаётся один маппер.
3. **Дублирующаяся карточка добавления**: шаг «фото» (uploader + превью) (`src/components/AddWizard.tsx:208-219` vs `src/components/PublicAddSheet.tsx:179-196`) и индикатор прогресса (`src/components/AddWizard.tsx:197-201` vs `src/components/PublicAddSheet.tsx:169-173`) — два почти одинаковых блока разметки; выносится общий или один удаляется.
4. **Дефолтные координаты** `43.0033/41.0237` в трёх местах (`src/components/AddWizard.tsx:139-140`; `src/components/PublicAddSheet.tsx:43-44`; `src/services/api.ts:296-297`) — в одну константу.
5. **Список категорий с эмодзи** `categoriesList`/`categoryEmojis` (`src/services/api.ts:12-32`) дублирует прямое использование `CATEGORIES` (`src/components/PublicAddSheet.tsx:225-230`); эмодзи-маппинг переносится в одно место или удаляется.
6. **Лист деталей места**: инлайн-разметка bottom-sheet в A (`src/TelegramApp.tsx:298-391`) против компонента `PlaceSheet` в B (`src/components/PublicMap.tsx:7`, `src/components/PublicMap.tsx:345-355`). После слияния инлайн-лист A удаляется; внутренности `PlaceSheet` — **требует уточнения**.
7. **Фильтр-чипы статусов** в шапке карты A (`src/TelegramApp.tsx:224-268`) и в `AdminPanel` (`src/components/AdminPanel.tsx:52-75`) против `MapFilters` в B (`src/components/PublicMap.tsx:337-344`) — остаётся одна реализация фильтров.
8. **Двойной источник профиля**: localStorage-профиль A (`src/services/api.ts:124-146`) против Supabase-сессии B (`src/services/publicAuth.ts:78-83`). Mock-профиль удаляется; откуда единый профиль берёт `role/karma` — **требует уточнения**.
9. **Моковые данные**: `defaultMockPlaces` (`src/services/api.ts:35-108`), дев-кнопка «Имитировать фото» (`src/components/AddWizard.tsx:77-84`, `src/components/AddWizard.tsx:222-226`), моковая история и статистика профиля (`src/components/Profile.tsx:84-103`, `src/components/Profile.tsx:120-146`) — удаляются при переходе на live-данные.
10. **Сырой fetch-клиент** `supabaseRequest` и прямые REST-вызовы A (`src/services/api.ts:165-184`, `src/services/api.ts:227-232`, `src/services/api.ts:402-411`) дублируют supabase-js клиент B (`src/services/publicAuth.ts:48`) — удаляются в пользу одного клиента.

---

## 4. Критерии приёмки (действие → ожидаемый результат)

1. **Старт в Telegram**: приложение инициализируется → выполнен `loginTelegram` по `initData`, места загружены, видны табы «Карта/Добавить/Профиль»; таб «Админ» — только для ролей `owner/admin/operator/tester` (`src/TelegramApp.tsx:48-74`, `src/TelegramApp.tsx:425-474`).
2. **Старт публичного контура без сессии**: карта открывается без регистрации и показывает опубликованные места (`src/components/PublicMap.tsx:114-146`; копия «Просмотр карты не требует регистрации» — `src/components/EmailOtpSheet.tsx:116`).
3. **«Добавить» без авторизации**: открывается `EmailOtpSheet`; после успешной верификации кода автоматически открывается форма добавления (`src/components/PublicMap.tsx:214-223`, `src/components/PublicMap.tsx:235-242`; верификация — `src/services/publicAuth.ts:60-76`).
4. **Публичная отправка места**: фото загружено в `place-photos/{uuid}/facade.jpg` (jpeg, без upsert), RPC `submit_public_place` вызван ровно с 6 параметрами; при успехе — список мест перезагружен и открыт лист нового места (`src/services/submit-place.ts:224-263`; `src/components/PublicMap.tsx:244-279`).
5. **Повторная отправка тем же пользователем**: сервер отвечает `already_submitted` → пользователь видит «Вы уже добавили место. Спасибо!», а не сырую ошибку (`src/services/submit-place.ts:165-167`; `src/components/PublicAddSheet.tsx:26`, `src/components/PublicAddSheet.tsx:134-138`).
6. **Отправка без Supabase-конфигурации/сессии**: детерминированные ошибки `not_configured` / `auth_required` с русскими сообщениями, UI не падает (`src/services/submit-place.ts:211-217`; `src/components/PublicAddSheet.tsx:18`, `src/components/PublicAddSheet.tsx:20`; гейт карты `src/components/PublicMap.tsx:118-124`).
7. **Оператор добавляет место визардом**: после «Сохранить» место появляется первым в списке, открывается таб карты с выбранным маркером, профиль пересинхронизирован (`src/components/AddWizard.tsx:132-163`; `src/TelegramApp.tsx:95-111`).
8. **Ошибка загрузки карты**: виден экран ошибки с текстом и кнопкой «Повторить»; нажатие перезапускает загрузку (`src/components/PublicMap.tsx:289-298`, `src/components/PublicMap.tsx:62`, `src/components/PublicMap.tsx:146`).
9. **Фильтр по статусу/категории/тексту**: на карте и в выдаче остаются только места, прошедшие `applyPlaceFilters`; в A-части — только выбранный статус (`src/components/PublicMap.tsx:148-151`; `src/TelegramApp.tsx:128`).

---

## 5. Риски конфликтов логики

1. **Два источника истины для мест**. A держит `places` в state + localStorage и мутирует локально (unshift при создании, фильтр при удалении) (`src/TelegramApp.tsx:35`, `src/TelegramApp.tsx:96`, `src/TelegramApp.tsx:114`; `src/services/api.ts:318-319`); B перезагружает с сервера и лишь при сбое вставляет оптимистичную заглушку (`src/components/PublicMap.tsx:244-279`). При слиянии обновление списка из двух механизмов может рассинхронизировать карту.
2. **Две несовместимые авторизации**. Telegram-логин A (`src/TelegramApp.tsx:57-59`) не создаёт Supabase-сессии, которую требует RPC B (`src/services/submit-place.ts:75-76`). Как операторская роль (`owner/admin/operator/tester`, `src/TelegramApp.tsx:462`) отображается на серверную `public_user` (`src/services/submit-place.ts:79-80`) — **требует уточнения**; без маппинга слитое приложение либо не пустит операторов, либо ослабит RPC-гейт.
3. **`isLiveMode = false` и тихие фолбэки A**. Контур A жёстко в mock (`src/services/api.ts:8`) и при любой live-ошибке молча откатывается на localStorage (`src/services/api.ts:212-216`, `src/services/api.ts:259-262`, `src/services/api.ts:446-449` — включая рекурсивный фолбэк `createPlace` на сам себя, `src/services/api.ts:448`). В едином приложении это маскирует боевые сбои записи под «успех».
4. **Лимит «одно место» против безлимитного визарда**. B ограничивает публичного пользователя одной отправкой (`src/services/submit-place.ts:87-88`); A не имеет лимита и начисляет карму за каждый объект (`src/services/api.ts:321-335`). Одна кнопка «Добавить» на две модели — конфликт ожиданий и текста «+25 кармы» (`src/components/AddWizard.tsx:155`).
5. **Статусная модель gray против G/Y/R**. A не имеет серого статуса и публикует мгновенно (`src/components/AddWizard.tsx:403`; `src/services/api.ts:309`); B создаёт только серые метки под модерацию (`src/components/PublicAddSheet.tsx:131`). Фильтры и легенда A серого не знают (`src/TelegramApp.tsx:39`, `src/TelegramApp.tsx:224-268`) — слитая карта должна уметь отображать gray, иначе публичные места невидимы или неотфильтруемы.
6. **Конфликт тем**. A: тема из Telegram + ручной toggle (`src/TelegramApp.tsx:38`, `src/TelegramApp.tsx:197-204`). B: только `prefers-color-scheme`, без toggle (`src/components/PublicMap.tsx:56-58`). Оба пишут `document.documentElement.className` (`src/TelegramApp.tsx:78`; `src/components/PublicMap.tsx:88`) — в единой оболочке один эффект перезапишет другой.
7. **Два канала геолокации**. `telegram.getUserLocation()` в A (`src/components/AddWizard.tsx:53`) против браузерной геолокации в B (`src/components/PublicAddSheet.tsx:62`; `useBrowserGeolocation` на карте — `src/components/PublicMap.tsx:325`). Поведение в Telegram WebView и в браузере разное; единый источник координат — **требует уточнения**.
8. **Две политики загрузки фото в один бакет**. A live-ветка пишет `place-photos/{id}/facade.{ext}` любым MIME, без `upsert:false` (`src/services/api.ts:346-364`); B требует ровно `{uuid}/facade.jpg`, `image/jpeg`, `upsert:false`, и это же enforced сервером (`src/services/submit-place.ts:28-34`, `src/services/submit-place.ts:229-245`). Storage-политика под B может отклонять uploads операторского пути A.
9. **Админ-действия без бэкенда**. Смена статуса и удаление в `AdminPanel` меняют только локальный state, серверных вызовов в контуре нет (`src/components/AdminPanel.tsx:26-42`; `src/TelegramApp.tsx:113-124`). После слияния с live-данными B эти действия либо теряются при перезагрузке, либо требуют новых серверных мутаций — **требует уточнения**.
10. **Дублирование полей карточки**. A собирает расширенную карточку (ступени/пандус/туалет/комментарий, `src/components/AddWizard.tsx:136-151`), RPC B принимает только 5 полей + фото и остальное зашивает сервер (`src/services/submit-place.ts:13-20`, `src/services/submit-place.ts:247-248`). Слитая форма должна явно решить, какой набор полей и куда идёт — иначе расширенные поля оператора не попадут в RPC-контракт.

---

## Неразрешённые вопросы (требует уточнения)

1. Внутренности `src/services/places.ts` (`fetchPublishedPlaces`, `fetchPlaceById`, `applyPlaceFilters`, `mapPlaceRow`) — точный select, фильтр `moderation_status`, обработка `facadePhotoError` (использование: `src/components/PublicMap.tsx:10-18`, `src/components/PublicMap.tsx:187`).
2. Внутренности `src/services/supabase.ts` (`isSupabaseConfigured`, `getSupabaseClient`) — инициализация клиента, persist-сессии (использование: `src/components/PublicMap.tsx:25`; `src/services/publicAuth.ts:2`).
3. Точки монтирования контуров: `src/main.tsx` vs `src/public-main.tsx`, `index.html` vs `public.html` — какой контур на каком URL живёт сейчас и каким будет единый вход.
4. Внутренности `LeafletMap` (props `useBrowserGeolocation`, `onMarkerButton`, `dragMode`, рендер gray-маркеров) — влияет на критерии 2, 9 и риск 5.
5. Соответствие сигнатуры RPC в docstring (`src/services/submit-place.ts:13-20`) фактической миграции `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql` (не читалась) и контракту `docs/backend-contract-2026-06-01.md` (не читался).
6. Маппинг Telegram-профиля (роли A) на Supabase Auth + серверную роль `public_user` (риск 2).
7. Судьба mock-режима A после слияния: дев-фолбэк или полное удаление (риск 3).
8. Внутренности `PlaceSheet`, `MapHeader`, `MapFooter`, `MapFilters`, `MenuOverlay`, `WelcomeLegend` (импорты `src/components/PublicMap.tsx:3-9`; `src/PublicApp.tsx:3`).

---

## Валидация A2 (Composer 2.5), 2026-07-19

Независимая выборочная проверка 5 утверждений из разных разделов контракта (§1.1, §1.3, §1.5, §2, §4). Исходники открыты по указанным `file:line`; код/тесты/конфиги не менялись.

### 1. §1.1 — роутинг контура A через вкладки-состояние

**Утверждение:** вкладки-состояние `useState<Tab>("map")`, значения `map/add/profile/admin` (`src/TelegramApp.tsx:34`).

**Статус:** confirmed

**Evidence:** `src/TelegramApp.tsx:34` — `const [activeTab, setActiveTab] = useState<Tab>("map");`; тип `Tab` и рендер вкладок `map`/`add`/`profile`/`admin` — `src/TelegramApp.tsx:209-421`, `src/TelegramApp.tsx:425-474`.

### 2. §1.3 — контур A жёстко в mock-режиме

**Утверждение:** жёстко `isLiveMode = false` — все вызовы идут в mock/localStorage даже при наличии env (`src/services/api.ts:7-8`).

**Статус:** confirmed

**Evidence:** `src/services/api.ts:7-8` — комментарий «Keep mock as the working mode…» и `const isLiveMode = false;` (не `import.meta.env`, не вычисление из env).

### 3. §1.5 — видимость таба «Админ»

**Утверждение:** таб «Админ» виден ролям `owner/admin/operator/tester` (`src/TelegramApp.tsx:462-474`).

**Статус:** confirmed

**Evidence:** `src/TelegramApp.tsx:462` — `{profile && ["owner", "admin", "operator", "tester"].includes(profile.role) && (`; кнопка «Админ» с `setActiveTab("admin")` — `src/TelegramApp.tsx:463-473`.

### 4. §2 — гейт «добавление требует входа»

**Утверждение:** `beginAddFlow` / `pendingAddAfterAuth` / `handleAuthVerified` (`src/components/PublicMap.tsx:214-242`).

**Статус:** confirmed

**Evidence:** `src/components/PublicMap.tsx:214-223` — `beginAddFlow`: при отсутствии `authEmail` выставляет `setPendingAddAfterAuth(true)` и открывает auth-лист; `src/components/PublicMap.tsx:235-241` — `handleAuthVerified`: после верификации при `pendingAddAfterAuth` открывает `setAddOpen(true)`.

### 5. §4 — публичная отправка: RPC с 6 параметрами и upload без upsert

**Утверждение:** фото в `place-photos/{uuid}/facade.jpg` (jpeg, без upsert), RPC `submit_public_place` с 6 параметрами (`src/services/submit-place.ts:224-263`).

**Статус:** confirmed

**Evidence:** upload — `src/services/submit-place.ts:229-235` (`facadeStoragePath(placeId)`, `contentType: FACADE_MIME_TYPE` = `image/jpeg`, `upsert: false`); RPC — `src/services/submit-place.ts:249-256` — ровно 6 аргументов: `p_place_id`, `p_name`, `p_category`, `p_lat`, `p_lng`, `p_storage_path`.
