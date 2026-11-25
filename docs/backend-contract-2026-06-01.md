# GoApsny v1 Backend Contract

Status: draft
Date: 2026-06-01
Working agent: Codex

## Scope

This backend matches the 2026-06-01 tester-tool spec:

- Telegram Mini App auth through `auth-telegram`.
- Supabase tables: `profiles`, `categories`, `accessibility_statuses`, `places`, `photos`, `ai_jobs`, `karma_events`.
- Storage bucket: `place-photos`.
- AI autofill through `ai-autofill`, guarded by a monthly budget.
- Day-4 export stub through `export-drive`.

## Required Secrets

Set these in Supabase Edge Function secrets:

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
TELEGRAM_BOT_TOKEN
OPENAI_API_KEY
OPENAI_VISION_MODEL
OPENAI_ESTIMATED_COST_USD
AI_MONTHLY_BUDGET_USD
EXPORT_JOB_SECRET
```

`SUPABASE_JWT_SECRET` is required because `auth-telegram` creates a Supabase-compatible access token after Telegram `initData` validation.

## Deployment Notes

Database migration was applied on 2026-06-01 through the Supabase pooler host:

```text
aws-1-eu-central-1.pooler.supabase.com
```

The direct host from the dashboard connection string did not resolve from this machine. The working pooler username format is `postgres.<project-ref>`.

Verified database state after migration:

- 7 public tables: `profiles`, `categories`, `accessibility_statuses`, `places`, `photos`, `ai_jobs`, `karma_events`
- 12 Wheelmap categories
- 4 accessibility statuses
- private Storage bucket `place-photos`
- 16 RLS/storage policies

Edge Functions are still local files until deployed. Deploying them requires a Supabase access token or an authenticated Supabase CLI session. Runtime secrets also require the project's JWT secret from Supabase Auth settings; the server-side secret API key is not the same value.

## Edge Functions

`auth-telegram` accepts `{ "initData": "Telegram.WebApp.initData" }` and returns `{ access_token, token_type, expires_at, profile }`.

`ai-autofill` requires `Authorization: Bearer <access_token>` and accepts `{ "place_id": "optional-uuid", "photo_path": "place-uuid/facade.jpg" }`. It returns `{ status, draft }` or `{ status: "blocked_budget", draft: null }`.

`export-drive` is a day-4 stub. It returns a JSON export of core tables and always requires `x-export-secret` to match `EXPORT_JOB_SECRET`. The function is deployed with `verify_jwt: false`, so that secret is its only guard: when the variable is unset or empty the endpoint refuses with 503 instead of serving the export (fail-closed since 2026-09-12, after the Mantis finding of 2026-09-10).

## Client Flow

1. Mini App reads `Telegram.WebApp.initData`.
2. Mini App calls `auth-telegram`.
3. Mini App sends the returned JWT as `Authorization: Bearer <access_token>`.
4. Mini App inserts into `places`.
5. Mini App uploads the facade photo to `place-photos/{place_id}/facade.jpg`.
6. Mini App inserts into `photos`.
7. Optional: Mini App calls `ai-autofill` and applies the returned draft to the editable form.

## Karma

Server-side triggers award `+10` for a place, `+5` for a photo, and `+10` for a full-card bonus.

## Дополнение 2026-11-25: классификатор мест по OpenStreetMap

Согласовано с Алхасом 25.11.2026 (решение на карточке в треде проекта «Свести GoApsny и Stopgap в одно приложение»).

- Групп мест 11: `toilets` выключена (`categories.is_active = false`), `other` выключена с 14.07.2026. Строка «12 Wheelmap categories» выше описывает состояние на 01.06.2026.
- Второй уровень: таблица `public.place_types` (`slug`, `category`, `name_ru`, `osm_key`, `osm_value`). Каждый тип равен тегу OpenStreetMap. Читают все, пишут admin и owner.
- Тип карточки по-прежнему приходит названием в `submit_mapper_place(p_subtype)` и лежит в `places.details.mapper.subtype`. Параметры RPC не менялись.
- `places.osm_tags`: при известном типе идёт тег типа (например, `amenity=pharmacy`) вместо общего тега группы.
- Общественный туалет: тип `amenity=toilets` в группе `government`. Туалет в заведении остаётся полями `toilet_exists`, `toilet_accessible`.
- Фронт: `src/shared/placeTypes.ts`, серверная копия `api/_lib/catalog.js`. Миграция `20261125180000_place_types_osm.sql`, проверка `supabase/tests/place_types_osm.sql`, откат `supabase/rollback/2026-11-25_place_types_down.sql`.
