#!/usr/bin/env bash
# Миграции боевой базы GoApsny одной командой: npm run db:push
#
# Что делает: пробный прогон, показывает список к применению, спрашивает
# «Применить?», применяет, сверяет повторным пробным прогоном.
# Что нужно: Supabase CLI 3.x и вход (supabase login). Пароль базы не нужен:
# CLI подключается через вход в Supabase.
# Применяются миграции из supabase/migrations текущей ветки, поэтому запускать
# из той ветки, чьи миграции согласованы. Применение к боевой базе — только
# по слову Алхаса.
#
# Команды проверены 25.11.2026 на Supabase CLI 3.4.0; сам этот файл целиком
# на боевой базе ещё не запускался.
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-rujxthjaquvwbdnrftua}"
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$1"; }
stop() { printf 'СТОП: %s\n' "$1" >&2; exit 1; }

step "1/5 Supabase CLI"
command -v supabase >/dev/null || stop "Supabase CLI не найден. Установка: brew install supabase/tap/supabase"
supabase --version || stop "CLI не запускается. Обновление: brew upgrade supabase"

step "2/5 Привязка к проекту ${PROJECT_REF}"
supabase link --project-ref "${PROJECT_REF}" || stop "не удалось привязать проект. Проверьте вход: supabase login"

step "3/5 Пробный прогон (базу не меняет)"
dry="$(supabase db push --remote --dry-run --include-all 2>&1)" || { printf '%s\n' "$dry"; stop "пробный прогон завершился ошибкой"; }
printf '%s\n' "$dry"
if printf '%s' "$dry" | grep -q "up to date"; then
  echo "Применять нечего: база совпадает с репозиторием."
  exit 0
fi

step "4/5 Применение"
printf 'Ветка: %s\n' "$(git rev-parse --abbrev-ref HEAD) ($(git rev-parse --short HEAD))"
read -r -p "Применить этот список к боевой базе? [y/N] " answer
[ "$answer" = "y" ] || stop "отменено, база не тронута"
supabase db push --remote --include-all --yes

step "5/5 Сверка: повторный пробный прогон должен быть пустым"
supabase db push --remote --dry-run --include-all
