# Партия 1.3 — Инвентаризация публичного контура G1

**Режим:** `superpowers-lite` (только чтение + docs).  
**Рабочий корень:** `/Users/alkhas.abaza/repo/goapsny-mvp--epoch3-integrate`.  
**Scope:** `src/PublicApp.tsx`, `src/components/PublicMap.tsx`, `EmailOtpSheet.tsx`, `PublicAddSheet.tsx`, `src/services/publicAuth.ts`, `src/services/submit-place.ts`, `src/services/places.ts` и непосредственные зависимости публичного контура.  
**Исключения:** код не менялся, `.env` не читался, сеть не использовалась.

---

## 1. Полная цепочка email-входа до сессии

### 1.1. Точка старта в PublicMap
`PublicMap.tsx:75` держит состояние `authOpen`, которое открывает `EmailOtpSheet`.  
`PublicMap.tsx:214-223` — `beginAddFlow`: если `authEmail` нет, ставит флаг `pendingAddAfterAuth = true` и открывает авторизацию.  
`PublicMap.tsx:225-233` — `handleCabinet`: повторно открывает авторизацию для входа через «Кабинет».  
`PublicMap.tsx:235-242` — `handleAuthVerified`: после успеха закрывает `EmailOtpSheet` и, если стоял флаг `pendingAddAfterAuth`, открывает `PublicAddSheet`.

### 1.2. UI-формы: EmailOtpSheet
`src/components/EmailOtpSheet.tsx:21-85` реализует двухшаговый диалог:
- шаг `email` (`EmailOtpSheet.tsx:119-143`) — валидация `isValidEmail` и вызов `requestEmailOtp`;
- шаг `code` (`EmailOtpSheet.tsx:144-186`) — ввод 8-значного кода, валидация `isValidOtpCode` и вызов `verifyEmailOtp`;
- `EmailOtpSheet.tsx:32-38` — кулдаун повторной отправки через `otpResendRemainingMs`.

### 1.3. Сервисный слой: publicAuth.ts
`src/services/publicAuth.ts:40-58` — `requestEmailOtp`:
- нормализует email через `normalizeEmail` (`publicAuth.ts:10-12`);
- вызывает `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` (`publicAuth.ts:49-51`).

`src/services/publicAuth.ts:60-76` — `verifyEmailOtp`:
- вызывает `supabase.auth.verifyOtp({ email, token, type: 'email' })` (`publicAuth.ts:66-70`);
- при успехе возвращает `data.session`.

`src/services/publicAuth.ts:78-83` — `getPublicSession` (`supabase.auth.getSession`).  
`src/services/publicAuth.ts:91-105` — `subscribePublicSession` (`supabase.auth.onAuthStateChange`).  
`src/services/publicAuth.ts:85-89` — `signOutPublicUser`.

### 1.4. Где живёт 8-значный код
Код генерируется и валидируется **внутри Supabase Auth** (managed-сервис), не в коде фронта и не в собственных таблицах проекта.  
- Фронт только задаёт длину: `OTP_CODE_LENGTH = 8` (`publicAuth.ts:5`) и регулярку `^\d{8}$` (`publicAuth.ts:8`).  
- Сам код хранится/управляется в инфраструктуре Supabase (`auth.users`, внутренние OTP-хранилища, audit-логи).  
- Никакого собственного хранения OTP в `public.*` таблицах нет.

### 1.5. Связь с профилем public_user
После `verifyOtp` Supabase Auth создаёт/обновляет запись в `auth.users`.  
Для публичного submit требуется роль `public_user` в `public.profiles` (см. `submit-place.ts:79`, `submit-place.test.ts:86`).  
Однако в имеющихся миграциях **не обнаружен** механизм автоматического создания `public.profiles` ряда с `role = 'public_user'` при email-регистрации:
- в `0001_initial_schema.sql:19` default `role` для нового профиля — `'tester'`;
- нет триггера на `auth.users` и нет Edge Function для email-регистрации;
- `auth-telegram` создаёт профиль с `role = existingProfile?.role ?? "tester"` (`supabase/functions/auth-telegram/index.ts:130`), что не даёт `public_user`.

**Вопрос:** где и как email-пользователь получает `role = 'public_user'` в `public.profiles` — остаётся неясным на уровне исходного кода репозитория.

---

## 2. Добавление места до серой метки

### 2.1. UI-формы: PublicAddSheet
`src/components/PublicAddSheet.tsx:46-142` — 4-шаговый wizard:
1. фото входа (`PublicAddSheet.tsx:175-197`);
2. название + категория (`PublicAddSheet.tsx:200-233`);
3. позиция на карте с перетаскиваемым маркером (`PublicAddSheet.tsx:235-256`);
4. summary + публикация (`PublicAddSheet.tsx:259-293`).

Ключевые детали:
- `handlePhotoChange` (`PublicAddSheet.tsx:85-91`) создаёт `URL.createObjectURL`;
- `getBrowserLocation` (`PublicAddSheet.tsx:62-70`) запрашивает геолокацию, fallback — `DEFAULT_LAT / DEFAULT_LNG` (`PublicAddSheet.tsx:43-44`);
- `handleSubmit` (`PublicAddSheet.tsx:115-142`) вызывает `submitPublicPlace` и отображает `SubmitPlaceError` через `SUBMIT_ERROR_MESSAGES` (`PublicAddSheet.tsx:17-32`).

### 2.2. Сервисный слой: submit-place.ts
`src/services/submit-place.ts:206-264` — `submitPublicPlace`:
1. генерирует UUID места (`generatePlaceId`, `crypto.randomUUID()`, `submit-place.ts:120-122`);
2. строит путь `{place_id}/facade.jpg` (`facadeStoragePath`, `submit-place.ts:115-117`);
3. загружает фото в бакет `place-photos` (`submit-place.ts:233-235`);
4. вызывает RPC `submit_public_place` (`submit-place.ts:249-256`) с сигнатурой:
   ```
   p_place_id uuid, p_name text, p_category text,
   p_lat double precision, p_lng double precision, p_storage_path text
   ```

Константы:
- `FACADE_STORAGE_BUCKET = 'place-photos'` (`submit-place.ts:28`);
- `FACADE_PHOTO_FILENAME = 'facade.jpg'` (`submit-place.ts:31`);
- `FACADE_MIME_TYPE = 'image/jpeg'` (`submit-place.ts:34`);
- `SUBMIT_PUBLIC_PLACE_RPC = 'submit_public_place'` (`submit-place.ts:37`).

`classifySubmitError` (`submit-place.ts:141-196`) мапит сообщения RPC/SQLSTATE на `SubmitPlaceErrorKind`.

### 2.3. Storage и RLS
Бакет `place-photos` создаётся в `0001_initial_schema.sql:427-433`:
- `public = false`;
- `file_size_limit = 10 MiB`;
- `allowed_mime_types = ['image/jpeg']`.

Storage-политики из `0001_initial_schema.sql:435-449`:
- `place_photos_storage_read_authenticated` — authenticated read;
- `place_photos_storage_insert_collectors` — insert только если `owner = auth.uid()`, `current_user_can_collect()` и имя файла удовлетворяет `^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$`;
- `place_photos_storage_update_owner_or_admin` — update owner/admin;
- `place_photos_storage_delete_admin` — delete admin.

Для публичного контура в `20260714141000_public_read_published.sql:38-49` добавлена anon-политика:
- `place_photos_storage_read_anon_published` — anon может читать объект только если путь присутствует в `public.photos` для `moderation_status = 'published'`.

Таблица `public.photos` (`0001_initial_schema.sql:82-92`):
- `storage_path` unique;
- constraint `photos_storage_path_shape_check` требует тот же regex, что и Storage policy.

### 2.4. RPC submit_public_place — статус в репозитории
В `src/services/submit-place.ts:8` есть ссылка на миграцию:
```
supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql
```

**Факт:** файл `20260715120000_submit_public_place_rls_rpc.sql` в `supabase/migrations/` отсутствует.  
В имеющихся миграциях (`0001_initial_schema.sql`, `20260714140000_lock_karma_rpc.sql`, `20260714141000_public_read_published.sql`, `20260714142000_align_active_categories.sql`) функция `submit_public_place` не определена.  
RLS-политики `0001_initial_schema.sql:374-381` (`places_insert_collectors`) и `0001_initial_schema.sql:400-410` (`photos_insert_collectors`) требуют `current_user_can_collect()` (роли owner/admin/operator/tester), то есть **не разрешают insert для `public_user`**.

Следовательно, на уровне репозитория публичный submit опирается на RPC, который ещё не зафиксирован в миграциях, и существующие RLS не покрывают путь `public_user`.

### 2.5. Чтение мест обратно на карту
После submit `PublicMap.tsx:244-279` (`handlePlaceSubmitted`):
- закрывает `PublicAddSheet`;
- пытается `reloadPlaces()` (`PublicMap.tsx:107-112`);
- при неудаче добавляет optimistic-запись со статусом `gray`;
- открывает карточку нового места (`openPlaceSheet`).

---

## 3. Что не зависит от PublicMap и переезжает как есть

Эти модули являются чистыми UI/сервисными единицами с чёткими props/контрактами и могут быть переиспользованы без изменений при замене карты:

| Модуль | Роль | Ключевые строки |
|--------|------|-----------------|
| `src/services/publicAuth.ts` | Email-OTP: запрос, verify, session, sign-out, подписка | `publicAuth.ts:1-105` |
| `src/services/submit-place.ts` | Submit-граница: UUID, upload, RPC, ошибки | `submit-place.ts:1-264` |
| `src/components/EmailOtpSheet.tsx` | Двухшаговый OTP-диалог | `EmailOtpSheet.tsx:1-197` |
| `src/components/PublicAddSheet.tsx` | 4-шаговый wizard добавления места | `PublicAddSheet.tsx:1-321` |
| `src/components/PlaceSheet.tsx` | Карточка места (sheet) | `PlaceSheet.tsx:1-192` |
| `src/components/MapHeader.tsx` | Шапка с логотипом, меню, поиском | `MapHeader.tsx:1-85` |
| `src/components/MapFooter.tsx` | Футер с кабинетом и disabled-ссылками | `MapFooter.tsx:1-41` |
| `src/components/MenuOverlay.tsx` | Меню + кнопка «Добавить локацию» | `MenuOverlay.tsx:1-80` |
| `src/components/WelcomeLegend.tsx` | Приветственный экран/легенда | `WelcomeLegend.tsx:1-44` |
| `src/utils/focusTrap.ts` | Ловушка фокуса и Escape | `focusTrap.ts:1-38` |
| `src/utils/status.ts` | Цвета/метки статусов | `status.ts:1-12` |
| `src/shared/index.ts` | Константы категорий, статусов, karma | `shared/index.ts:1-187` |
| `src/services/supabase.ts` | Единый Supabase-клиент | `supabase.ts:1-26` |
| `src/utils/location.ts` | Геолокация браузера | `location.ts:1-68` |

### 3.1. PublicApp.tsx
`src/PublicApp.tsx:1-27` — тонкая обёртка:
- хранит `showWelcome` на основе `hasSeenWelcome()`;
- показывает `WelcomeLegend` или `PublicMap`.

Этот файл формально зависит от `PublicMap`, но логика welcome-флага независима и переживает замену карты.

---

## 4. Что связано с PublicMap и требует переписывания

### 4.1. PublicMap.tsx — основной контроллер
`src/components/PublicMap.tsx:55-398` связывает всё вместе:
- загрузка `fetchPublishedPlaces` (`PublicMap.tsx:107-112`, `PublicMap.tsx:114-146`);
- фильтрация `applyPlaceFilters` (`PublicMap.tsx:148-151`);
- выбор места, открытие `PlaceSheet` (`PublicMap.tsx:173-197`);
- управление `MenuOverlay`, `MapFilters`, `EmailOtpSheet`, `PublicAddSheet`;
- optimistic-обновление после submit (`PublicMap.tsx:244-279`);
- конвертация `PublicPlace → Place` (`PublicMap.tsx:28-53` — `toMapPlace`).

При замене картографической библиотеки `PublicMap.tsx` переписывается целиком, но его дочерние модули (`PlaceSheet`, `EmailOtpSheet`, `PublicAddSheet`, `MenuOverlay`, `MapHeader`, `MapFooter`, `MapFilters`) остаются.

### 4.2. LeafletMap.tsx — картографический рендер
`src/components/LeafletMap.tsx:1-333` напрямую зависит от `leaflet`:
- инициализация карты (`LeafletMap.tsx:80-120`);
- темные/светлые тайлы CARTO (`LeafletMap.tsx:123-162`);
- рендер маркеров мест через `L.divIcon` + SVG (`LeafletMap.tsx:17-44`, `LeafletMap.tsx:165-217`);
- перетаскиваемый маркер для добавления места (`LeafletMap.tsx:231-270`);
- кнопка геолокации (`LeafletMap.tsx:272-330`).

Это главный кандидат на замену/переписывание.

### 4.3. MapFilters.tsx
`src/components/MapFilters.tsx` (не был в целевом списке, но используется в `PublicMap.tsx:337-344`) — фильтр по статусу/категории/запросу.  
Его внутренняя логика не зависит от Leaflet, но привязка к `PublicMap` означает, что место монтирования/управления состоянием переедет вместе с `PublicMap`.

### 4.4. Утилиты, жёстко связанные с Leaflet
- `statusColor`/`statusLabel` используются в `LeafletMap` для SVG-маркеров, но сами по себе независимы.
- `getPinHtml` в `LeafletMap.tsx:17-44` — Leaflet-специфичная генерация HTML-иконки.

---

## 5. Существующие тесты и покрытие

### 5.1. Конфигурация
- `vitest.config.ts:1-11` — jsdom, `src/**/*.test.{ts,tsx}`, setup `src/test/setup.ts`.
- `package.json:10` — скрипт `"test": "vitest run"`.
- Coverage не настроен в `vitest.config.ts`; в `package.json` нет команды `test:coverage`.

### 5.2. Список тестов публичного контура
| Тест | Что покрывает | Ключевые строки |
|------|---------------|-----------------|
| `src/services/publicAuth.test.ts` | Нормализация, валидация email/OTP, кулдаун, `requestEmailOtp`, `verifyEmailOtp`, `signOut`, `maskEmailDomain` | `publicAuth.test.ts:1-135` |
| `src/services/submit-place.test.ts` | Путь фото, генерация UUID, `classifySubmitError`, `submitPublicPlace` с fake Supabase | `submit-place.test.ts:1-179` |
| `src/services/places.test.ts` | `mapPlaceRow`, `applyPlaceFilters`, `hasSeenWelcome`/`markWelcomeSeen` | `places.test.ts:1-97` |
| `src/components/EmailOtpSheet.test.tsx` | UI-шаги OTP, валидация, вызов сервисов | `EmailOtpSheet.test.tsx:1-70` |
| `src/components/PublicAddSheet.test.tsx` | 4-шаговый wizard, вызов `submitPublicPlace`, обработка `SubmitPlaceError` | `PublicAddSheet.test.tsx:1-125` |
| `src/components/PublicMap.test.tsx` | Загрузка мест, фильтры, открытие карточки, фокус-менеджмент, OTP→Add flow, submit reload | `PublicMap.test.tsx:1-336` |
| `src/components/LeafletMap.test.tsx` | Кнопка геолокации, показ/скрытие пользовательского маркера | `LeafletMap.test.tsx:1-105` |
| `src/components/MapFilters.test.tsx` | Применение фильтра по статусу | `MapFilters.test.tsx:1-27` |

### 5.3. Покрытие по областям
- **Email-OTP:** полностью покрыто юнит-тестами (`publicAuth.test.ts`) и UI-тестом (`EmailOtpSheet.test.tsx`).
- **Submit:** полностью покрыто юнит-тестами (`submit-place.test.ts`) и UI-тестом (`PublicAddSheet.test.tsx`).
- **Чтение мест/фильтры:** покрыто `places.test.ts` и `PublicMap.test.tsx`.
- **Карта/маркеры:** только `LeafletMap.test.tsx` (геолокация) и `PublicMap.test.tsx` (интеграционные сценарии с mock-картой).
- **Welcome/WelcomeLegend:** нет dedicated теста; логика `hasSeenWelcome`/`markWelcomeSeen` проверяется в `places.test.ts:88-97`.
- **MapHeader / MapFooter / MenuOverlay / PlaceSheet:** нет dedicated тестов; они участвуют в интеграционных тестах `PublicMap.test.tsx` через accessibility-роли/метки.

### 5.4. Слепые зоны
- Реальный Leaflet-рендер (тайлы, маркеры, drag) мокается в тестах.
- Взаимодействие с настоящим Supabase Auth/Storage/PostgREST не тестируется (используются моки).
- Отсутствие RPC `submit_public_place` в миграциях делает невозможным интеграционное тестирование submit против реальной БД.

---

## 6. Неразрешённые вопросы

1. **Где создаётся профиль `public_user`?**  
   После email-входа через `supabase.auth.signInWithOtp` нужна запись в `public.profiles` с `role = 'public_user'`. В репозитории не найден триггер на `auth.users`, Edge Function или RPC, который бы это делал для email-пользователей.

2. **Где миграция `submit_public_place`?**  
   `submit-place.ts` ссылается на `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql`, но файл отсутствует. Функция не определена ни в одной из существующих миграций.

3. **Как `public_user` проходит RLS Storage?**  
   `place_photos_storage_insert_collectors` (`0001_initial_schema.sql:438-445`) требует `current_user_can_collect()` (owner/admin/operator/tester). Для `public_user` эта политика должна быть изменена/дополнена (либо upload идёт через RPC/Edge Function).

4. **Как `public_user` проходит RLS `places`/`photos`?**  
   `places_insert_collectors` (`0001_initial_schema.sql:374-381`) также требует `current_user_can_collect()` и `status in ('green','yellow','red')`, тогда как публичный submit создаёт `gray`. Это подтверждает, что submit должен идти через RPC `security definer`, но сам RPC отсутствует.

5. **Один submit на одного пользователя?**  
   `SubmitPlaceErrorKind` содержит `already_submitted` (`submit-place.ts:88`), что предполагает ограничение «одно место на публичного пользователя». Реализация этого ограничения не видна в миграциях.

6. **Конфликт default роли.**  
   `profiles.role` default = `'tester'` (`0001_initial_schema.sql:19`), а `current_user_role()` возвращает `'public_user'` если профиля нет (`0001_initial_schema.sql:300`). Это несовместимо с `submit-place.ts`, который требует именно роль `public_user` в `profiles`.

---

## Валидация C2 (GLM-5.2), 2026-07-19

Независимая проверка 3 конкретных утверждений по исходникам репозитория (read-only, рабочее дерево не менялось, ветка `feat/epoch3-integrate`, HEAD `456a013`).

### Утверждение 1 (RPC `submit_public_place`) — **confirmed**
**Утверждение (строки 107–117, 230–231).** Файл `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql` отсутствует; функция `submit_public_place` не определена ни в одной из существующих миграций; ссылка на эту миграцию — в `src/services/submit-place.ts:8`.

**Evidence:**
- `ls supabase/migrations/` — присутствуют только `0001_initial_schema.sql`, `20260714140000_lock_karma_rpc.sql`, `20260714141000_public_read_published.sql`, `20260714142000_align_active_categories.sql`. Файла `20260715120000_*.sql` нет.
- `grep -rn "submit_public_place" supabase/` — 0 совпадений: ни в миграциях, ни в `functions/`.
- `src/services/submit-place.ts:7-9` действительно ссылается на `supabase/migrations/20260715120000_submit_public_place_rls_rpc.sql`; `submit-place.ts:37` — `export const SUBMIT_PUBLIC_PLACE_RPC = 'submit_public_place';`.

### Утверждение 2 (RLS `places`/`photos`/Storage исключают `public_user`) — **confirmed**
**Утверждение (строки 115, 233–234, 236–237).** RLS-политики `places_insert_collectors`, `photos_insert_collectors` и `place_photos_storage_insert_collectors` требуют `current_user_can_collect()`, что не даёт пути insert для роли `public_user`.

**Evidence:**
- `0001_initial_schema.sql` (~строки 296–303): `public.current_user_can_collect()` ≡ `public.current_user_role() in ('owner','admin','operator','tester')` — `public_user` в списке **отсутствует**.
- `0001_initial_schema.sql` (~375–382) `places_insert_collectors`: `with check (created_by = auth.uid() and current_user_can_collect() and moderation_status = 'published' and status in ('green','yellow','red'))`. Дополнительно блокирует и `gray`-submit.
- `0001_initial_schema.sql` (~402–411) `photos_insert_collectors`: также требует `current_user_can_collect()`.
- `0001_initial_schema.sql` (~441–448) `place_photos_storage_insert_collectors`: требует `current_user_can_collect()` + regex `^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$`.

### Утверждение 3 (роль `public_user` и её отсутствие в схеме) — **confirmed**
**Утверждение (строки 46–49, 227–228, 242–243).** Default `profiles.role = 'tester'` (`0001_initial_schema.sql:19`); в репозитории нет триггера на `auth.users` и нет Edge Function, создающей `public.profiles` с `role='public_user'` при email-регистрации; `auth-telegram/index.ts` ставит `role: existingProfile?.role ?? "tester"`; `current_user_role()` возвращает `'public_user'` только если профиля нет (`0001_initial_schema.sql:300`).

**Evidence:**
- `0001_initial_schema.sql:19` — `role text not null default 'tester'`. ✅ (в файле это ровно строка 19).
- `grep "create trigger" 0001_initial_schema.sql` — все 5 триггеров навешаны на `public.profiles`/`public.places`/`public.photos` (строки 282, 284, 286, 288, 290). Триггера на `auth.users` нет.
- `supabase/functions/auth-telegram/index.ts` — `role: existingProfile?.role ?? "tester"` (фактическая строка 131; документ ссылается на :130 — мелкое смещение, суть верна).
- `0001_initial_schema.sql:300` — `select coalesce((select role from public.profiles where id = (select auth.uid())), 'public_user');` ✅
- По `grep "public_user" supabase/migrations/` строка `public_user` встречается **только** в CHECK-constraint на `profiles.role` (строка 20) и в fallback-е `current_user_role()` (строка 300). Нигде в миграциях она не присваивается новым профайлам.

**Итого по документу `epoch3-inventory-public.md`: 3 confirmed / 0 refuted.**
