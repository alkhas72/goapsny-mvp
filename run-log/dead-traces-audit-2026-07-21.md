# Сквозной аудит мёртвых следов — 2026-07-21

**База:** `origin/main` @ `bbf82ad`  
**Ветка:** `feat/dead-traces-cleanup`  
**Исключения (не трогали):** `AddWizard`, `TelegramApp`, `api.ts`, `PublicMap`, `places.ts`

## Build / lint / test на слитом main

| Проверка | Результат |
|----------|-----------|
| `npm run build` | **PASS** (1 warning: chunk >500kB; ineffective dynamic import в `submit-place.ts`) |
| `npm test -- --run` | **168/168 PASS** |
| `npm run lint` | **FAIL** — 7 errors, 2 warnings, все в `AddWizard.tsx` (зона K3) |

## Поиск по `src` (удалённое после merge)

| Искали | В `src` | Вердикт |
|--------|---------|---------|
| `public.html` | нет | Чисто (П-22 снял вход; комментарий только в `vite.config.ts` вне src) |
| `public-main.tsx` | нет | Чисто |
| `mock_jwt_token` | нет | Удалён с mock-слоем в `api.ts` |
| `isLiveMode` | нет | Удалён; live-only в `api.ts` |
| `goapsny_places` / `goapsny_profile` | нет | Удалены |
| локальный owner-профиль | нет | `getInitData()` вне TG → `""`; сессия только через `auth-telegram` |
| localStorage-места | нет | Остались только легитимные ключи: `goapsny_welcome_seen`, `goapsny_gps_primed` |

## Находки: файл → мёртвое → действие

| Файл | Что мёртвое | Действие |
|------|-------------|----------|
| `src/App.css` | Vite scaffold, нигде не импортируется | **Удалить** |
| `src/index.css` | Vite scaffold, нигде не импортируется | **Удалить** |
| `src/assets/vite.svg` | Нет ссылок в коде | **Удалить** |
| `src/assets/react.svg` | Нет ссылок | **Удалить** |
| `src/assets/accessible_icon.svg` | Нет ссылок | **Удалить** |
| `src/utils/telegram.ts` | `WebApp: any`, 3× callback `any` — lint | **Починить** типы |
| `src/components/map/*` | MapLibre-адаптер, **0 импортов** из shell (795 LOC + dep) | **Оставить** — отдельное решение G-EQ; не в scope этой уборки |
| `src/components/AddWizard.tsx` | lint errors (K3) | **Не трогать** — зона K3 |
| `src/services/places.test.ts` | assert `goapsny_map_legend_seen` null | **Оставить** — регрессионный тест старого ключа |
| `src/services/api.ts` | комментарии про mock-слой | **Оставить** — документация DG-3 |

## Вне `src` (информирование, не меняли)

- `scripts/browser-smoke.mjs`, `scripts/e2e-telegram-submit.mjs` — исторические комментарии про `public.html` / `isLiveMode` (поясняют миграцию).
- `docs/epoch3-*` — устаревшие утверждения про dual entry; обновление docs — отдельная задача.
