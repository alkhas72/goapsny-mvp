# T3 Report — Telegram auditor bot (SOL re-review)

**Worktree:** `feat/tg-auditors`  
**Executor:** Composer 2.5 (Cursor)  
**Mode:** `superpowers-full`  
**Date:** 2026-07-15  
**Status:** `READY FOR SOL RE-REVIEW`  
**Prior reviews:** `T3-REVIEW-2026-07-14.md`, `T3-REREVIEW-2026-07-14.md` (CHANGES REQUIRED)

## Bot binding

This Edge Function serves **only** `@mapper_abh_bot` (display name `Mapper_GoApsny`). Secrets:

- `AUDITOR_TELEGRAM_BOT_TOKEN`
- `AUDITOR_TELEGRAM_WEBHOOK_SECRET`

No fallback to `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` (`@GoApsnyBot` product bot is untouched).

## SOL re-review finding disposition

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | BLOCKER — product bot token collision | **Fixed.** `env.ts` + `index.ts` read only `AUDITOR_TELEGRAM_*`; `env_test.ts` proves missing dedicated token fails even when product token is set; `index_test.ts` uses auditor webhook secret only. |
| 2 | BLOCKER — idempotency migration ↔ runtime mismatch | **Fixed.** `0002` requires `status`; `supabase_stores.ts` inserts `{ update_id, status: 'processing' }`; `index.ts` claim → `completeUpdate` / `releaseUpdate`; concurrent claim → HTTP 409. Tests: `idempotency_test.ts`. |
| 3 | BLOCKER — atomic RPC broken/unused | **Fixed.** `publishVerifiedPlace` calls `auditor_publish_verified_place` RPC; path check uses `(p_place_id::text \|\| '/facade.jpg')`; `GRANT EXECUTE … TO service_role`. **Deferred:** live Postgres integration test — `supabase db lint --local` not run (no local Supabase). Unit atomic-failure covered in `places_test.ts`. |
| 4 | HIGH — facade photo not shown on gray select | **Fixed.** `facade_delivery.ts` + `sendPhoto` in `telegram_client.ts`; handler calls preview before verdict. Tests: `facade_delivery_test.ts`. |
| 5 | HIGH — stale callbacks globally actionable | **Fixed.** Session `nonce` + `validateCallback` state whitelist. Tests: `callbacks_test.ts`, `handler_test.ts`. |
| 6 | HIGH — unbounded enum/text audit fields | **Fixed.** Inline keyboards (`rt:`, `pk:`, `te:`, `ta:`, `el:`) + `validateBoundedText`. Tests: `validation_test.ts`. |
| 7 | MEDIUM — Telegram delivery failures swallowed | **Fixed.** `TelegramTransportError` on non-2xx; handler/index propagate for retry. Test: `telegram_client_test.ts`. |
| 8 | MEDIUM — category dup + migration version collision | **Fixed.** Removed T1-owned `0003_sprint_category_toilets.sql`; RPC migration is `20260714210000_auditor_publish_verified_place.sql` (unique timestamp, no second `0003`). |
| 9 | PROCESS — uncommitted / incoherent handoff | **Fixed.** Four pushed commit blocks below; this report updated with per-finding disposition and exact SHAs. |

## FIELD-DELTA acceptance (9807c98)

Unchanged: no T1/T2 surface changes; RPC uses `SET search_path = ''` + qualified names + minimum grants; auditor auth explicit on `profiles.role`.

## Architecture

| Module | Role |
| --- | --- |
| `index.ts` | Webhook entry, claim/complete/release idempotency |
| `env.ts` | Auditor-only secret names (`@mapper_abh_bot`) |
| `telegram_client.ts` | Transport with hard failures + `sendPhoto` |
| `idempotency.ts` | Claim/completion contract |
| `callbacks.ts` | Nonce + state binding |
| `keyboards.ts` / `facts.ts` | Enum keyboards + fact steps |
| `facade_delivery.ts` | Gray facade preview |
| `handler.ts` | State machine (orchestration) |
| `places.ts` / `supabase_stores.ts` | Persistence + RPC |

## Migrations

1. `0002_auditor_bot_sessions.sql` — sessions + `auditor_bot_processed_updates(status processing\|completed)`
2. `20260714210000_auditor_publish_verified_place.sql` — atomic publish RPC (SECURITY DEFINER, `search_path = ''`, `service_role` execute)

Removed from T3 scope: `0003_sprint_category_toilets.sql` (T1-owned).

## Verification evidence (2026-07-15)

```bash
deno fmt --check supabase/functions/auditor-bot          # OK (30 files)
deno lint --config supabase/functions/auditor-bot/deno.json supabase/functions/auditor-bot   # OK (29 files)
deno test --config supabase/functions/auditor-bot/deno.json supabase/functions/auditor-bot --allow-env   # 49 passed | 0 failed
deno check --config supabase/functions/auditor-bot/deno.json supabase/functions/auditor-bot/index.ts       # OK
git diff --check                                        # OK
supabase db lint --local                                # NOT RUN — local Supabase unavailable
```

## Commits (`feat/tg-auditors`, pushed)

| Block | SHA | Contents |
| --- | --- | --- |
| 1 — migrations + security schema | `66ea7d5` | `0002`, `20260714210000_*`, `config.toml` |
| 2 — env + idempotency + telegram transport | `cd24e72` | `env.ts`, `idempotency.ts`, `telegram_client.ts`, auth/webhook/session/types, tests |
| 3 — callbacks + facade + enum validation | `6cad6ac` | `callbacks.ts`, `facade_delivery.ts`, `keyboards.ts`, `facts.ts`, `validation.ts`, tests |
| 4 — handler + RPC publish + full suite | `d2e72ff` | `handler.ts`, `index.ts`, `places.ts`, `supabase_stores.ts`, deno config, tests |
| 5 — report | `9604bc1` | `T3-REPORT.md` (initial); SHA doc fix in follow-up commit |

## Live prerequisites (not executed)

1. Apply migrations `0002`, `20260714210000_*` on Supabase project (coordinate order with T1)
2. Set Edge secrets: `AUDITOR_TELEGRAM_BOT_TOKEN`, `AUDITOR_TELEGRAM_WEBHOOK_SECRET`, existing `SUPABASE_*`
3. Deploy `auditor-bot`; register webhook **only** on `@mapper_abh_bot`
4. G2 smoke: gray → verify same ID → anon PWA sees color

## Out of scope (untouched)

Deploy, secret installation, webhook registration, messaging real users, `main` merge, `@GoApsnyBot` webhook.

## Verdict

`READY FOR SOL RE-REVIEW`
