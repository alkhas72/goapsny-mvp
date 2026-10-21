-- Проверка явных прав (AISP-347). Падает с ошибкой, если права ролей API на таблицы
-- public отличаются от ожидаемых или в public появилась таблица, которой нет в списке.
-- Новая таблица = новая строка в expected и GRANT в её миграции (docs/migration-template.md).
\set ON_ERROR_STOP on

create temp table expected (tbl text, grantee text, priv text);

insert into expected
select t, 'anon', 'SELECT'
from unnest(array['categories','accessibility_statuses','places','photos']) t;

insert into expected
select t, 'authenticated', p
from unnest(array['profiles','categories','accessibility_statuses','places','photos','ai_jobs','karma_events']) t,
     unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;

insert into expected
select t, 'service_role', p
from unnest(array['profiles','categories','accessibility_statuses','places','photos','ai_jobs','karma_events']) t,
     unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

-- Объекты расширений (PostGIS: spatial_ref_sys, geometry_columns, geography_columns)
-- права получают от установки расширения, не от наших миграций; их показываем отдельно.
create temp table ext_objects as
select c.relname::text as tbl
from pg_depend d
join pg_class c on c.oid = d.objid
where d.classid = 'pg_class'::regclass
  and d.deptype = 'e'
  and c.relnamespace = 'public'::regnamespace;

create temp table actual as
select table_name::text as tbl, grantee::text, privilege_type::text as priv
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name not in (select tbl from ext_objects);

\echo 'Объекты расширений в public (вне проверки, права ролей API):'
select table_name as tbl, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in (select tbl from ext_objects)
group by table_name, grantee order by 1, 2;

\echo 'Права на таблицы public (роль, таблица, право):'
select grantee, tbl, string_agg(priv, ', ' order by priv) as privileges
from actual group by grantee, tbl order by grantee, tbl;

\echo 'Недостаёт (ожидалось, но нет):'
select * from expected except select * from actual order by 1, 2, 3;

\echo 'Лишнее (есть, но не ожидалось):'
select * from actual except select * from expected order by 1, 2, 3;

do $$
declare
  missing int;
  extra int;
  unknown text;
begin
  select count(*) into missing from (select * from expected except select * from actual) m;
  select count(*) into extra from (select * from actual except select * from expected) e;
  select string_agg(table_name, ', ') into unknown
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
    and table_name not in (select distinct tbl from expected)
    and table_name not in (select tbl from ext_objects);
  if unknown is not null then
    raise exception 'Таблицы public без записи в check-grants.sql: %', unknown;
  end if;
  if missing > 0 or extra > 0 then
    raise exception 'Права расходятся с ожидаемыми: недостаёт %, лишних %', missing, extra;
  end if;
  raise notice 'Права совпадают с ожидаемыми';
end $$;
