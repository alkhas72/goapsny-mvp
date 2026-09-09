#!/usr/bin/env bash
# Mock-тесты supabase_backup.sh: без живых учётных данных, внешние команды — заглушки.
# Запуск: bash tests/supabase-backup/run-tests.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../../scripts/supabase_backup.sh"
MOCK_BIN="$HERE/mock-bin"
chmod +x "$MOCK_BIN"/* 2>/dev/null || true

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (ожидали [$3], получили [$2])"; fi; }

# пароль специально с URL-кодированием и опасными символами
SECRET='s3cr@tp:ss'
export SUPABASE_DB_URL="postgres://postgres:s3cr%40tp%3Ass@db.mock.supabase.co:5432/postgres"
export SUPABASE_URL="https://mock.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="mock-service-key-123"

run_backup() { # run_backup <dir> [extra env...]
  local dir="$1"; shift
  env PATH="$MOCK_BIN:/usr/bin:/bin:/usr/sbin:/sbin" BACKUP_DIR="$dir" "$@" \
    bash "$SCRIPT" >/dev/null 2>"$dir/stderr.log"
  return $?
}

echo "== 1. счастливый путь =="
T1="$(mktemp -d)"
run_backup "$T1"; check "код выхода 0" "$?" "0"
DB_FILE="$(basename "$(ls "$T1"/db_*.sql.gz 2>/dev/null | head -1)")"
case "$DB_FILE" in
  db_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].sql.gz) ok "формат имени дампа: $DB_FILE";;
  *) bad "формат имени дампа: $DB_FILE";;
esac
DUMP_CONTENT="$(gunzip -c "$T1/$DB_FILE" 2>/dev/null)"
case "$DUMP_CONTENT" in *"mock dump"*) ok "дамп читается и содержит данные";; *) bad "дамп не читается";; esac
[ -f "$T1/$DB_FILE.sha256" ] && ok "sha256 дампа есть" || bad "sha256 дампа нет"
ZIP_FILE="$(ls "$T1"/storage_*.zip 2>/dev/null | head -1)"
[ -n "$ZIP_FILE" ] && ok "архив storage есть" || bad "архива storage нет"
ZIP_NAMES="$(unzip -Z1 "$ZIP_FILE" 2>/dev/null)"
if [ -n "$ZIP_FILE" ]; then case "$ZIP_NAMES" in
  *"place-photos/093caee2-5912-4040-811f-f41366d06c10/facade.jpg"*) ok "storage: вложенный объект скачан по префиксу";;
  *) bad "storage: вложенный объект не найден в архиве";;
esac; fi
[ -f "$ZIP_FILE.sha256" ] && ok "sha256 архива есть" || bad "sha256 архива нет"

echo "== 2. секрет не утекает в журнал =="
if grep -rqF "$SECRET" "$T1" 2>/dev/null; then bad "пароль найден в файлах копии/журнала"; else ok "пароля нет в журнале и файлах"; fi
if grep -qF "mock-service-key-123" "$T1"/backup_*.log 2>/dev/null; then bad "service-ключ найден в журнале"; else ok "service-ключа нет в журнале"; fi

echo "== 3. ротация 14 дней =="
T3="$(mktemp -d)"
OLD="$T3/db_20000101-000000.sql.gz"
echo old > "$OLD"; echo old > "$OLD.sha256"; touch -t 200001010000 "$OLD" "$OLD.sha256"
run_backup "$T3" >/dev/null 2>&1
[ -f "$OLD" ] && bad "старая копия не удалена" || ok "копия старше 14 дней удалена"

echo "== 4. сбой pg_dump => код != 0, файла дампа нет =="
T4="$(mktemp -d)"
MOCK_PG_DUMP_FAIL=1 run_backup "$T4"; rc=$?
[ "$rc" -ne 0 ] && ok "код выхода $rc" || bad "код выхода 0 при сбое pg_dump"
[ -z "$(ls "$T4"/db_*.sql.gz 2>/dev/null)" ] && ok "файл дампа не создан" || bad "файл дампа создан при сбое"

echo "== 5. сбой Storage API => код != 0 =="
T5="$(mktemp -d)"
MOCK_CURL_FAIL=1 run_backup "$T5"; rc=$?
[ "$rc" -ne 0 ] && ok "код выхода $rc" || bad "код выхода 0 при сбое storage"

echo "== 6. без SUPABASE_DB_URL => отказ =="
T6="$(mktemp -d)"
( unset SUPABASE_DB_URL; run_backup "$T6" ) >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "код выхода $rc" || bad "старт без connection string"

echo "== 7. образ не postgres:17 => отказ =="
T7="$(mktemp -d)"
PGDUMP_IMAGE=postgres:16.4 run_backup "$T7"; rc=$?
[ "$rc" -ne 0 ] && ok "код выхода $rc" || bad "принял образ postgres:16.4"

echo "== 8. SKIP_STORAGE=1 — только БД =="
T8="$(mktemp -d)"
SKIP_STORAGE=1 run_backup "$T8"; rc=$?
[ "$rc" -eq 0 ] && ok "код выхода 0" || bad "код выхода $rc"
[ -z "$(ls "$T8"/storage_*.zip 2>/dev/null)" ] && ok "архив storage не создавался" || bad "архив storage создан при SKIP_STORAGE"

rm -rf "$T1" "$T3" "$T4" "$T5" "$T6" "$T7" "$T8"
echo
echo "ИТОГ: $PASS пройдено, $FAIL провалено"
[ "$FAIL" -eq 0 ]
