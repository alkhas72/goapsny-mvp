#!/usr/bin/env bash
# supabase_backup.sh — копия базы Supabase карты GoApsny (PG 17) + storage.
#
# Вход (только через окружение, секреты никогда не попадают в argv/логи/код):
#   SUPABASE_DB_URL            postgres://user:pass@host:5432/postgres (обязат.)
#   SUPABASE_URL               https://<ref>.supabase.co               (обязат., если не SKIP_STORAGE)
#   SUPABASE_SERVICE_ROLE_KEY  service_role ключ для Storage API       (обязат., если не SKIP_STORAGE)
# Настройки (необязательные):
#   BACKUP_DIR    куда складывать копии      (по умолчанию /srv/ais/backups/goapsny)
#   RETENTION_DAYS сколько дней хранить      (по умолчанию 14)
#   SKIP_STORAGE  1 — только дамп БД, без выгрузки storage
#   DUMP_TIMEOUT  таймаут pg_dump, сек       (по умолчанию 1800; нужен timeout/gtimeout, иначе без ограничения)
#   PGDUMP_IMAGE  образ с pg_dump 17          (по умолчанию postgres:17; иначе отказ — мажорная строго 17)
# Требование: docker — pg_dump 17 идёт из одноразового контейнера (пароль через
# смонтированный .pgpass, секреты не в argv/env docker).
#
# Результат в $BACKUP_DIR: db_<дата>.sql.gz, storage_<дата>.zip, *.sha256, backup_<дата>.log
# Код выхода != 0 при любом сбое. Журнал не содержит секретов.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/srv/ais/backups/goapsny}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SKIP_STORAGE="${SKIP_STORAGE:-0}"
DUMP_TIMEOUT="${DUMP_TIMEOUT:-1800}"
TS="$(date +%Y%m%d-%H%M%S)"
DB_OUT="db_${TS}.sql.gz"
STORAGE_OUT="storage_${TS}.zip"
LOG_FILE="backup_${TS}.log"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/goapsny-backup.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"  # абсолютный путь до смены каталога
cd "$WORK"

log() {
  # журнал: на stderr и в файл; сюда никогда не передаём значения секретов
  printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$BACKUP_DIR/$LOG_FILE" >&2
}

fail() { log "ERROR: $*"; exit 1; }

# --- утилиты -------------------------------------------------------------

percent_decode() {  # раскодировать %XX в пароле из URL
  local s="${1//+/ }"
  printf '%b' "${s//%/\\x}"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1";
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1";
  else fail "нет ни sha256sum, ни shasum"; fi
}

# ротация: удалить копии старше RETENTION_DAYS; вызывается в начале,
# чтобы гарантированно срабатывать даже при сбое свежего запуска
rotate() {
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'db_*.sql.gz' -o -name 'db_*.sql.gz.sha256' -o -name 'storage_*.zip' -o -name 'storage_*.zip.sha256' -o -name 'backup_*.log' \) \
    -mtime "+$RETENTION_DAYS" -delete
  log "ротация: удалены копии старше $RETENTION_DAYS дней"
}

# --- разбор SUPABASE_DB_URL ----------------------------------------------

[ -n "${SUPABASE_DB_URL:-}" ] || fail "не задан SUPABASE_DB_URL"

url="$SUPABASE_DB_URL"
case "$url" in postgres://*|postgresql://*) ;; *) fail "SUPABASE_DB_URL должен начинаться с postgres://";; esac
url="${url#*://}"
userinfo="${url%%@*}"; hostpath="${url#*@}"
[ "$userinfo" != "$url" ] || fail "в SUPABASE_DB_URL нет userinfo (@)"
db_user="${userinfo%%:*}"; db_pass_raw="${userinfo#*:}"
[ "$db_pass_raw" != "$userinfo" ] || fail "в SUPABASE_DB_URL нет пароля"
db_pass="$(percent_decode "$db_pass_raw")"
hostport="${hostpath%%/*}"; db_name="${hostpath#*/}"; db_name="${db_name%%\?*}"
db_host="${hostport%%:*}"
db_port="5432"; case "$hostport" in *:*) db_port="${hostport##*:}";; esac
[ -n "$db_host" ] && [ -n "$db_name" ] || fail "не удалось разобрать SUPABASE_DB_URL"

# временный .pgpass 0600 вместо пароля в argv
PGPASSFILE="$WORK/.pgpass"
printf '%s:%s:%s:%s:%s\n' "$db_host" "$db_port" "$db_name" "$db_user" "$db_pass" > "$PGPASSFILE"
chmod 600 "$PGPASSFILE"
export PGPASSFILE
unset db_pass db_pass_raw userinfo url hostpath

rotate  # до начала работы: старое уходит даже если свежий запуск упадёт

# --- дамп БД ---------------------------------------------------------------

# pg_dump мажорной 17 — из одноразового контейнера postgres:17: хост остаётся
# без клиента СУБД и без PGDG-репозитория, версия заколочена тегом образа.
# Пароль — через смонтированный .pgpass (0600); контейнер идёт под uid
# вызвавшего, чтобы libpq принял файл (значение никогда не в argv/env docker).
PGDUMP_IMAGE="${PGDUMP_IMAGE:-postgres:17}"
case "$PGDUMP_IMAGE" in
  postgres:17|postgres:17.*) ;;
  *) fail "PGDUMP_IMAGE=$PGDUMP_IMAGE, нужен образ мажорной версии 17" ;;
esac
command -v docker >/dev/null 2>&1 || fail "docker не найден (pg_dump 17 идёт из контейнера $PGDUMP_IMAGE)"

log "старт: дамп БД (схемы public, auth, storage), $PGDUMP_IMAGE"

# хост/порт/пользователь/база — не секреты; пароль приходит только из PGPASSFILE
DUMP_CMD=(docker run --rm -i --user "$(id -u):$(id -g)" --network host \
  -v "$PGPASSFILE:/tmp/.pgpass:ro" -e PGPASSFILE=/tmp/.pgpass \
  "$PGDUMP_IMAGE" pg_dump \
  --host="$db_host" --port="$db_port" --username="$db_user" --dbname="$db_name" \
  --format=plain --no-owner --no-privileges --schema=public --schema=auth --schema=storage)
if command -v timeout >/dev/null 2>&1; then DUMP_CMD=(timeout "$DUMP_TIMEOUT" "${DUMP_CMD[@]}")
elif command -v gtimeout >/dev/null 2>&1; then DUMP_CMD=(gtimeout "$DUMP_TIMEOUT" "${DUMP_CMD[@]}"); fi

if ! "${DUMP_CMD[@]}" 2>>"$BACKUP_DIR/$LOG_FILE" | gzip -1 > "$BACKUP_DIR/$DB_OUT"; then
  rm -f "$BACKUP_DIR/$DB_OUT"
  fail "pg_dump завершился с ошибкой"
fi
[ -s "$BACKUP_DIR/$DB_OUT" ] || fail "дамп пустой"
log "дамп БД готов: $DB_OUT ($(du -h "$BACKUP_DIR/$DB_OUT" | cut -f1))"

# --- выгрузка storage --------------------------------------------------------

if [ "$SKIP_STORAGE" != "1" ]; then
  [ -n "${SUPABASE_URL:-}" ] || fail "не задан SUPABASE_URL (или поставь SKIP_STORAGE=1)"
  [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail "не задан SUPABASE_SERVICE_ROLE_KEY (или поставь SKIP_STORAGE=1)"
  command -v curl >/dev/null 2>&1 || fail "curl не найден"
  command -v python3 >/dev/null 2>&1 || fail "python3 не найден (нужен для разбора ответов Storage API)"
  command -v zip >/dev/null 2>&1 || fail "zip не найден"

  # ключи — в конфиге curl 0600, а не в argv (argv виден в ps)
  CURL_CFG="$WORK/curl.cfg"
  printf 'header = "apikey: %s"\n' "$SUPABASE_SERVICE_ROLE_KEY" > "$CURL_CFG"
  printf 'header = "Authorization: Bearer %s"\n' "$SUPABASE_SERVICE_ROLE_KEY" >> "$CURL_CFG"
  chmod 600 "$CURL_CFG"

  mkdir -p "$WORK/storage"

  log "storage: запрашиваю список bucket'ов"
  curl -sfS --max-time 60 --config "$CURL_CFG" "$SUPABASE_URL/storage/v1/bucket" > "$WORK/buckets.json" \
    || fail "Storage API: список bucket'ов недоступен"

  BUCKETS=()
  while IFS= read -r b; do BUCKETS+=("$b"); done < <(
    python3 -c 'import json,sys; print("\n".join(b["id"] for b in json.load(sys.stdin)))' < "$WORK/buckets.json")
  [ "${#BUCKETS[@]}" -gt 0 ] || log "storage: bucket'ов нет, архив будет пустым"

  # URL-кодирование имён — через python3 (пробелы, unicode, спецсимволы)
  url_encode()      { python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }
  url_encode_path() { python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe="/"))' "$1"; }

  OBJECT_COUNT=0
  for bucket in "${BUCKETS[@]}"; do
    # имя bucket'а приходит из API — валидируем перед использованием в путях
    case "$bucket" in
      *..*|/*|*/*) fail "Storage API: подозрительное имя bucket'а (прервано)";;
    esac
    log "storage: bucket $bucket"
    # рекурсивный обход префиксов, страницы по 1000
    walk_prefix() {
      local prefix="$1" offset=0
      while :; do
        local body resp entries
        body=$(python3 -c 'import json,sys; print(json.dumps({"prefix":sys.argv[1],"limit":1000,"offset":int(sys.argv[2])}))' "$prefix" "$offset")
        resp="$WORK/list_$$.json"
        curl -sfS --max-time 60 --config "$CURL_CFG" -H "Content-Type: application/json" \
          -X POST "$SUPABASE_URL/storage/v1/object/list/$(url_encode "$bucket")" -d "$body" > "$resp" \
          || { rm -f "$resp"; fail "Storage API: не удалось получить список $bucket/$prefix"; }
        entries=$(python3 - "$resp" <<'PYEOF'
import json, sys
for o in json.load(open(sys.argv[1])):
    kind = "dir" if o.get("id") is None else "file"
    print(f"{kind}\t{o['name']}")
PYEOF
)
        rm -f "$resp"
        [ -n "$entries" ] || break
        local n=0
        while IFS=$'\t' read -r kind name; do
          n=$((n+1))
          # защита от path traversal: имя не должно содержать .. или начинаться с /
          case "$name" in
            *..*|/*) fail "Storage API: подозрительное имя объекта в $bucket/$prefix (пропущено всё)";;
          esac
          if [ "$kind" = "dir" ]; then
            walk_prefix "${prefix}${name}/"
          else
            local rel="${prefix}${name}"
            local dest="$WORK/storage/$bucket/$rel"
            mkdir -p "$(dirname "$dest")"
            curl -sfS --max-time 120 --config "$CURL_CFG" \
              "$SUPABASE_URL/storage/v1/object/$(url_encode "$bucket")/$(url_encode_path "$rel")" -o "$dest" \
              || fail "Storage API: не удалось скачать $bucket/$rel"
            OBJECT_COUNT=$((OBJECT_COUNT+1))
          fi
        done <<< "$entries"
        [ "$n" -lt 1000 ] && break
        offset=$((offset+1000))
      done
    }
    walk_prefix ""
  done

  log "storage: скачано объектов: $OBJECT_COUNT, собираю архив"
  (cd "$WORK/storage" && zip -qr "$BACKUP_DIR/$STORAGE_OUT" .) || fail "не удалось собрать zip storage"
  log "архив storage готов: $STORAGE_OUT ($(du -h "$BACKUP_DIR/$STORAGE_OUT" | cut -f1))"
else
  log "storage: пропуск (SKIP_STORAGE=1)"
fi

# --- контрольные суммы ------------------------------------------------------

(cd "$BACKUP_DIR" && sha256_file "$DB_OUT" > "$DB_OUT.sha256")
[ "$SKIP_STORAGE" = "1" ] || (cd "$BACKUP_DIR" && sha256_file "$STORAGE_OUT" > "$STORAGE_OUT.sha256")

log "готово: копия $TS завершена успешно"
