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
TELEGRAM_BOT_TOKEN
OPENAI_API_KEY
OPENAI_VISION_MODEL
OPENAI_ESTIMATED_COST_USD
AI_MONTHLY_BUDGET_USD
EXPORT_JOB_SECRET
```

`auth-telegram` does not hand-sign JWTs. It validates Telegram `initData`, ensures a Supabase Auth user/profile exists through the service-role client, then mints a real Supabase session through `generateLink(type: "magiclink")` plus `verifyOtp` on an anon client.

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

Edge Functions are still local files until deployed. Deploying them requires a Supabase access token or an authenticated Supabase CLI session.

## Edge Functions

`auth-telegram` accepts `{ "initData": "Telegram.WebApp.initData" }` and returns `{ access_token, refresh_token, expires_at, profile }`.

`ai-autofill` requires `Authorization: Bearer <access_token>` and accepts `{ "place_id": "optional-uuid", "photo_path": "place-uuid/facade.jpg" }`. It returns `{ status, draft }` or `{ status: "blocked_budget", draft: null }`.

`export-drive` is a day-4 stub. It returns a JSON export of core tables and requires `x-export-secret` if `EXPORT_JOB_SECRET` is set.

## Client Flow

1. Mini App reads `Telegram.WebApp.initData`.
2. Mini App calls `auth-telegram`.
3. Mini App calls `supabase.auth.setSession({ access_token, refresh_token })`.
4. Mini App inserts into `places` through the authenticated Supabase client.
5. `api.createPlace` sets `created_by` from `auth.uid()` and sends no `main_photo`, no `osm_tags`, and no photo payload in H0.
6. Optional for H1: Mini App uploads a facade photo to `place-photos/{place_id}/facade.jpg`, inserts into `photos`, then calls `ai-autofill`.

## Karma

Server-side triggers award `+10` for a place, `+5` for a photo, and `+10` for a full-card bonus. Direct `karma_events` inserts have no client policy, and direct RPC execution of `public.add_karma(...)` is revoked from `public`, `anon`, and `authenticated`; karma is a trigger-only write path.
