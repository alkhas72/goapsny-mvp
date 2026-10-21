-- Только для CI (AISP-347). Копируется в supabase/migrations перед `supabase start`
-- и выполняется первой миграцией. Имитирует поведение Supabase после 30.10.2026:
-- новые таблицы и последовательности в public не получают права ролей API
-- по умолчанию. Если приложение после этого работает, явные GRANT в миграциях
-- покрывают всё, что ему нужно.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
