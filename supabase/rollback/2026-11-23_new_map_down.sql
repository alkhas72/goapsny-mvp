-- Откат изменений базы, пришедших с новой картой (PR #30, 23.11.2026).
--
-- Это НЕ миграция: файл лежит вне supabase/migrations и сам не выполняется.
-- Запускать руками и только по слову Алхаса, когда решено вернуться к базе
-- до 23.11. Перед запуском снять свежую копию (scripts/supabase_backup.sh).
--
-- Что откатывается:
--   20261123120000_mapper_pending_submission.sql — шаг 1, безопасен;
--   20261001100000_places_export_fields.sql      — шаг 2, стирает данные новых полей;
--   20261001110000_backfill_explicit_grants.sql  — отката нет: права повторяют
--     те, что база уже выдавала по умолчанию, ничего нового не открыто;
--   20260919120000 и 20260919223000 (замок moderation_status) и
--   20260720080000 (снятие лимита одной подачи) — шаг 4. Эти три слиты в main
--     раньше, но 23.11 выяснилось, что в боевой базе их не было: их ставят
--     вместе с новой картой, поэтому и откат записан здесь.
--
-- Проверено на локальном PostgreSQL 16: после шага 1 и шага 2 схема places
-- совпадает со схемой до миграций 20261001100000…20261123120000.
-- Шаг 4 на локальной базе не прогонялся.

begin;

-- ---------------------------------------------------------------------------
-- Шаг 1. Путь картографа: функция подачи и чтение собственных фото.
-- Карточки, уже поданные на проверку, остаются строками places со статусом
-- pending: публике они не видны, модератор (admin/owner) решает их судьбу
-- обычным UPDATE. Удалять их этот файл не будет.
-- ---------------------------------------------------------------------------
drop function if exists public.submit_mapper_place(
  uuid, text, text, double precision, double precision, text,
  text, integer, text, text, text, text
);
drop policy if exists place_photos_storage_read_own on storage.objects;

commit;

-- ---------------------------------------------------------------------------
-- Шаг 2 (по отдельному решению). Новые необязательные поля places.
-- Прежний код их не читает и не пишет, поэтому для возврата к прежнему
-- приложению удалять их НЕ нужно. Удаление стирает всё, что в них записано
-- (дата осмотра, адрес, телефон, сайт, внешние идентификаторы).
-- Раскомментировать осознанно.
-- ---------------------------------------------------------------------------
-- begin;
-- alter table public.places
--   drop column if exists entrance_type,
--   drop column if exists kerb_height_cm,
--   drop column if exists address,
--   drop column if exists phone,
--   drop column if exists website,
--   drop column if exists external_ids,
--   drop column if exists inspected_at;
-- commit;

-- ---------------------------------------------------------------------------
-- Шаг 3 (по отдельному решению). Вернуть прежнюю роль профилю, которому
-- 23.11 выдали роль модератора. Прежнее значение записано в снимке
-- rollback_20261123.profiles (см. docs/rollback-2026-11-23.md).
-- ---------------------------------------------------------------------------
-- update public.profiles p
--    set role = s.role
--   from rollback_20261123.profiles s
--  where s.id = p.id and p.role is distinct from s.role;

-- ---------------------------------------------------------------------------
-- Шаг 4 (по отдельному решению). Вернуть базу к состоянию до замка модерации
-- и до снятия лимита одной подачи. Для возврата к прежнему приложению НЕ
-- нужен: прежний код с замком и без лимита работает так же.
--
-- Замок убирать только вместе с шагом 1: без замка автор сам меняет
-- moderation_status своей карточки, и проверка модератором теряет смысл.
--
-- Прежний текст submit_public_place (с проверкой C.3) и определение индекса
-- лежат в снимке: rollback_20261123.definitions, строки kind = 'function' и
-- kind = 'index'. Индекс не создастся, если кто-то уже подал два объекта.
-- ---------------------------------------------------------------------------
-- begin;
-- drop trigger if exists places_lock_moderation_status on public.places;
-- drop function if exists public.tg_places_lock_moderation_status();
-- create unique index places_one_public_submission_per_creator_idx
--   on public.places (created_by)
--   where source = 'public' and created_by is not null;
-- -- затем выполнить текст из
-- --   select definition from rollback_20261123.definitions
-- --    where kind = 'function' and name like 'submit_public_place(%';
-- commit;
