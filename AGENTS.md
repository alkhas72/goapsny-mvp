# GoApsny MVP — контекст для агентов

Читается автоматически Codex (этот файл) и Claude Code (через `CLAUDE.md`). Действует в основном клоне и в каждом worktree.

## Что это

GoApsny — карта доступности городской среды (Абхазия), Telegram Mini App. Проект направления IDLAB Ассоциации «Инва-Содействие» (АИС). Стек: React 19 + TypeScript + Vite, Leaflet (карта), Supabase (Postgres + RLS + Edge Functions), деплой Vercel (прод: goapsny-mvp.vercel.app).

## Ключевые документы (читать перед работой с бэком)

- `docs/backend-contract-2026-06-01.md` — контракт фронт↔бэк. **Не менять без явного согласования с Алхасом.**
- `docs/rls-checklist.md` — правила доступа к данным (RLS).

## Правила работы

- Ветки `feat/*` от `origin/main`, изменения в `main` — только через Pull Request. Force-push запрещён.
- Смок-проверка: `npm run smoke` (нужен `.env`, см. ниже).
- Сквозные проверки — только против локального стека (`supabase start`): `npm run e2e:public`, `npm run e2e:telegram`. Для telegram-прогона стеку нужны `TELEGRAM_BOT_TOKEN` и `SUPABASE_JWT_SECRET` в окружении CLI (тестовые значения, см. шапку `scripts/e2e-telegram-submit.mjs`).
- Секреты не коммитить. Боевой `TELEGRAM_BOT_TOKEN` живёт в Supabase Edge-секретах — в `.env` его нет и не должно быть.
- `supabase/migrations/` — только новые миграции, существующие задним числом не править.
- Scope задачи не расширять; сбой или неоднозначность — остановиться и сообщить, не досочинять.

## Worktree-специфика (Supacode)

`.env` не отслеживается git и в новый worktree не попадает. Перед задачами, где нужна база: скопировать из основного клона `~/repo/goapsny-mvp/.env` в корень worktree.

## Внешний Superpowers — дисциплина кода (приоритет над скиллами)

Два «Superpowers» разведены: **внешний Superpowers** (этот репо / Supacode) = дисциплина сборки; **протокол АИС** (`superpowers.*` в Obsidian) = координация вне кода. Этот файл важнее скиллов (так постановляет сам апстрим: «user instructions take precedence over skills»).

**Режимы задачи (availability ≠ obligation). Агент обязан объявить режим в отчёте и почему:**
- `superpowers-full` — новая фича / изменение поведения / auth·RLS·schema / сложный bugfix → полный цикл (brainstorming → plans → TDD → review).
- `superpowers-lite` — мелкий локальный фикс / doc / config / mechanical rename / test-only → по явной классификации в брифе допустимо пропустить brainstorming и строгий TDD.
- `ui-craft-first` — UI-поверхность / визуал / layout / a11y / mobile → ведёт UI Craft (`/ui-craft:shape` → spec → detect); Superpowers TDD только для тестируемой логики, не на цвета/отступы.
- `no-agent-autonomy` — секреты / внешний деплой / деструктивный git·fs → без автономии, спросить Алхаса.

**Дизайн-фаза.** Если бриф говорит «дизайн утверждён (Фаза 1 АИС, спека: <путь>)» — `brainstorming` пропустить, войти с `writing-plans`. Вторую спек-сессию поверх утверждённой не гонять. Спеку не дублировать: опираться на `.ui-craft/spec.md` и `DESIGN.md`; параллельный `docs/superpowers/specs/` не плодить.

**Гейты «выглядит правильно» / «удобно».** Зелёные тесты и code-review Superpowers ≠ готово. Для UI-задач **merge только после визуального гейта**: скриншот (Antigravity) + проверка Алхасом на устройстве. TDD ловит гейты «собирается»/«работает», не пиксели/юзабилити.

**Worktree.** Текущий CWD в Supacode — уже worktree задачи. Не создавать вложенный (если `using-git-worktrees` спросит — сообщить о существующей изоляции). `.env` скопировать перед baseline-тестами (см. раздел Worktree-специфика).

## Брифы задач

Развёрнутые задания приходят файлами-брифами (путь даёт Алхас текстом). Бриф главнее общих соображений; при конфликте брифа с этим файлом — спросить.
