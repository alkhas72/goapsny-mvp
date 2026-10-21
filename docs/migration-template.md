# Шаблон миграции с явными GRANT (AISP-347)

Каждая миграция, создающая таблицу или функцию в `public`, сама выдаёт права. Положиться на права по умолчанию нельзя: Supabase перестаёт выдавать их новым таблицам, и чистый `supabase db reset` тогда ломает приложение.

```sql
create table public.<table> ( ... );
alter table public.<table> enable row level security;

-- anon: только публичное чтение, и только если таблица действительно публичная.
-- grant select on public.<table> to anon;

-- authenticated: полный набор, а границы задаёт RLS.
grant select, insert, update, delete on public.<table> to authenticated;

-- service_role: серверные функции и модерация.
grant all on public.<table> to service_role;

-- политики RLS — в той же миграции
create policy "<table>_read" on public.<table> for select to authenticated using ( ... );
```

Правила:
1. `anon` — только `select`, и только по таблицам, которые видны публике без входа. Профили, `ai_jobs`, `karma_events` — никогда.
2. Функции: `revoke execute ... from public, anon`, затем `grant execute` нужной роли. Шаблон — `20260715120000_submit_public_place_rls_rpc.sql`.
3. Права и политики в одной миграции с таблицей. Старые миграции задним числом не правим.
4. Перед PR: `supabase db reset` на чистой базе, затем `npm run e2e:public`.
