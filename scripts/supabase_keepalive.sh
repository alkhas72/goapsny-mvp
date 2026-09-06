#!/usr/bin/env bash
# supabase_keepalive.sh — лёгкий запрос к REST, чтобы проект Supabase не засыпал
# (проект карты GoApsny замораживался после 7 дней простоя, случай 05.09.2026).
#
# Вход (только через окружение):
#   SUPABASE_URL          https://<ref>.supabase.co   (обязат.)
#   SUPABASE_SERVICE_ROLE_KEY  service_role ключ      (обязат.)
# Необязательно:
#   KEEPALIVE_TABLE       таблица для лёгкого select  (по умолчанию places)
#
# Код выхода != 0 при сбое. В лог не пишутся значения секретов.

set -euo pipefail

TABLE="${KEEPALIVE_TABLE:-places}"
log() { printf '%s keepalive: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; }

[ -n "${SUPABASE_URL:-}" ] || { log "ERROR: не задан SUPABASE_URL"; exit 1; }
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || { log "ERROR: не задан SUPABASE_SERVICE_ROLE_KEY"; exit 1; }
command -v curl >/dev/null 2>&1 || { log "ERROR: curl не найден"; exit 1; }

# лёгкий запрос: одна строка, только count в заголовке, тело не читаем
http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Range-Unit: items" -H "Range: 0-0" \
  "$SUPABASE_URL/rest/v1/$TABLE?select=id")

case "$http_code" in
  2*) log "OK ($http_code), проект активен" ;;
  *)  log "ERROR: REST вернул HTTP $http_code"; exit 1 ;;
esac
