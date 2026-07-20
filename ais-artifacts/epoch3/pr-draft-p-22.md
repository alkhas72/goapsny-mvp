# PR: П-22 — закрыть двойной бандл (один вход index.html)

> Черновик. Открывается только после зелёного гейта Арбитра (проверка на телефоне).

**Ветка:** `feat/epoch3-g2-pwa-c1`
**База:** `main` @ `052296f` (не `48604af` — main ушёл вперёд на PR #8 и #9)
**Commit:** `54d8c3d`
**Партия:** Г2 / П-22 (PWA и телефон)

## Что в PR

Переходный двойной бандл `index.html` + `public.html` закрыт. Теперь одна настоящая точка входа.

### Удалено
- `public.html` (16 строк) — пустая HTML-обёртка.
- `src/public-main.tsx` (14 строк) — дублировал `main.tsx`, минуя детект Telegram и регистрацию SW.

### Изменено
- `vite.config.ts` — снят `rollupOptions.input` со второго входа. Дефолт Vite: один `index.html`.

### Почему безопасно
- `src/main.tsx` уже вызывает `ensureTelegramSdk()`, который грузит SDK Telegram только при `tgWebApp` в URL; иначе не запрашивает.
- `src/App.tsx` детектит окружение через `window.Telegram?.WebApp?.initData`: есть initData → `TelegramApp`, иначе → `PublicApp`. Любая ошибка → catch → `PublicApp`.
- Сервис-воркер регистрируется только вне Telegram WebView (`main.tsx:18`).

## Доказательства

### Один бандл
Build ДО (baseline):
```
dist/public.html                       0.80 kB
dist/index.html                        1.36 kB
dist/assets/public-DY3s7Z_m.js         0.21 kB
dist/assets/main-DQLNHbCV.js          46.04 kB
dist/assets/registerSw-B4pvKZXN.js   598.90 kB
```
Build ПОСЛЕ:
```
dist/index.html                   1.27 kB
dist/assets/index-4lsovVTh.js   644.78 kB
```
`dist/public.html` и `dist/assets/public-*.js` больше не появляются.

### Сайт не зависит от Telegram
- `index.html` — упоминание `telegram.org` только в HTML-комментарии, без тега `<script>`.
- `browser-smoke` блокирует `**://telegram.org/**` через Playwright `context.route(... abort())` и подтверждает 0 запросов: `[PASS] browser: public entry does not depend on telegram.org: запросов нет`.

### Гейты
- `npm run build` — успешно (один `dist/index.html`, один JS-чанк).
- `npm test` — 17 файлов / 157 тестов PASS.
- `npm run browser-smoke` — 26/26 PASS (в т.ч. SW registered, manifest linked, location auto-shown).
- `npm run lint` — те же 9 ошибок + 2 предупреждения, что и в baseline (все `no-explicit-any` / `react-hooks/exhaustive-deps`, не от моих правок).

## Про +2 теста к baseline 20.07
Эталон 20.07 (`48604af`) = 155 тестов. На этой базе worktree (`052296f`) = 157 (+2). Бриф явно постановил брать `052296f`. Я тестов не писал. Attribution:
- `+1` в `src/components/PublicMap.test.tsx` → `leads from cabinet login straight to the add form` (PR #8, `f996a76`).
- `+1` в `tests/contract/t2-roles-rls.contract.test.ts` → `submission limit is dropped by a later migration` (PR #9, `67f04c6`).

Подробности: `ais-artifacts/epoch3/p-22-2026-07-21.md`.

## Не в границах
- `apple-touch-icon` для iOS не подключён — не регрессия (baseline), follow-up вне П-22.
- DG-3 («успех при отказе сервера») и «метка появляется только после перезагрузки» — известные дефекты 20.07, вне скопа этой партии.

## Ссылки
- Бриф: `repo/ais-artifacts/epoch3/brief-g2-pwa-z-2026-07-21.md`
- Evidence: `ais-artifacts/epoch3/p-22-2026-07-21.md`
- Run-log: `run-log/2026-07-21.md`
