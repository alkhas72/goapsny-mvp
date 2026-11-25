#!/usr/bin/env bash
# Ключи двух помощников GoApsny одной командой: npm run keys:assistant
#
# Что делает: спрашивает ключ DeepSeek и ключ Gemini (ввод не виден), каждый
# проверяет настоящим запросом к сервису и кладёт в переменные проекта Vercel
# goapsny-mvp для превью и для боевого сайта. Значения нигде не печатаются и
# в файлы не пишутся; на экране только длина ключа и итог проверки.
# Что нужно: Node (npx) и вход в Vercel; если входа нет, откроется браузер.
# Ключи кладёт только Арбитр. Запускать на своём Mac, из папки репозитория.
#
# Флаги `vercel env add` проверены 25.11.2026 на Vercel CLI 66.6.0; сам этот
# файл целиком с настоящими ключами ещё не запускался.
set -euo pipefail

PROJECT="${VERCEL_PROJECT:-goapsny-mvp}"
SCOPE="${VERCEL_SCOPE:-alkhas72s-projects}"
DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek-flash}"
GEMINI_LIVE_MODEL="${GEMINI_LIVE_MODEL:-gemini-3.8-live}"
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$1"; }
stop() { printf 'СТОП: %s\n' "$1" >&2; exit 1; }
vc() { npx --yes vercel@latest "$@"; }

BODY="$(mktemp)"
trap 'rm -f "$BODY"; unset DS GM' EXIT

# Ключ уходит в curl через stdin, а не аргументом: в списке процессов его нет.
probe() { # probe <строка заголовка> <адрес> <тело запроса>
  printf 'header = "%s"\n' "$1" |
    curl -sS -o "$BODY" -w '%{http_code}' --max-time 40 --config - \
      -H 'Content-Type: application/json' -d "$3" "$2" || echo "000"
}

ask() { # ask <подсказка> <имя переменной>
  local value=""
  read -rs -p "$1" value
  printf '\n'
  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  [ -n "$value" ] || stop "пустой ввод, ничего не изменено"
  printf -v "$2" '%s' "$value"
}

keep_anyway() { # спросить, сохранять ли ключ, который не прошёл проверку
  local answer=""
  read -r -p "Сохранить этот ключ всё равно? [y/N] " answer
  [ "$answer" = "y" ]
}

put() { # put <имя переменной Vercel> <значение>
  printf '%s' "$2" | vc env add "$1" --environment production,preview --sensitive --force --yes \
    --project "$PROJECT" --scope "$SCOPE" >/dev/null ||
    stop "Vercel не принял $1. Проверьте вход (npx vercel login) и доступ к проекту $PROJECT."
  echo "$1 записан: превью и боевой сайт."
}

step "1/4 Вход в Vercel"
command -v npx >/dev/null || stop "не найден npx. Установите Node: brew install node"
vc whoami >/dev/null 2>&1 || vc login || stop "вход в Vercel не выполнен"
echo "Вход есть: $(vc whoami 2>/dev/null | tail -1)"

step "2/4 Ключ DeepSeek (помощник волонтёров)"
echo "Ключ выдаёт кабинет DeepSeek: platform.deepseek.com, раздел API keys."
ask "Вставьте ключ DeepSeek и нажмите Enter (ввод не виден): " DS
echo "Длина ключа: ${#DS}. Проверяю запросом к модели ${DEEPSEEK_MODEL}…"
code="$(probe "Authorization: Bearer ${DS}" "https://api.deepseek.com/chat/completions" \
  "{\"model\":\"${DEEPSEEK_MODEL}\",\"max_tokens\":8,\"thinking\":{\"type\":\"disabled\"},\"messages\":[{\"role\":\"user\",\"content\":\"Ответь одним словом: да\"}]}")"
if [ "$code" = "200" ]; then
  echo "DeepSeek ответил: ключ рабочий."
  put DEEPSEEK_API_KEY "$DS"
else
  echo "DeepSeek ответил кодом ${code}: $(head -c 300 "$BODY" | tr -d '\n')"
  if keep_anyway; then put DEEPSEEK_API_KEY "$DS"; else echo "Ключ DeepSeek не записан."; fi
fi

step "3/4 Ключ Gemini (помощник координатора, голос и камера)"
echo "Ключ выдаёт Google AI Studio: aistudio.google.com, раздел API keys."
ask "Вставьте ключ Gemini и нажмите Enter (ввод не виден): " GM
echo "Длина ключа: ${#GM}. Проверяю выдачей короткого токена для ${GEMINI_LIVE_MODEL}…"
soon="$(date -u -v+1M '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+1 minute' '+%Y-%m-%dT%H:%M:%SZ')"
later="$(date -u -v+30M '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+30 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
code="$(probe "x-goog-api-key: ${GM}" "https://generativelanguage.googleapis.com/v1beta/auth_tokens" \
  "{\"uses\":1,\"expireTime\":\"${later}\",\"newSessionExpireTime\":\"${soon}\",\"liveConnectConstraints\":{\"model\":\"models/${GEMINI_LIVE_MODEL}\"}}")"
if [ "$code" = "200" ] && grep -q '"name"' "$BODY"; then
  echo "Google выдал короткий токен: ключ рабочий."
  put GEMINI_API_KEY "$GM"
else
  echo "Google ответил кодом ${code}: $(head -c 300 "$BODY" | tr -d '\n')"
  if keep_anyway; then put GEMINI_API_KEY "$GM"; else echo "Ключ Gemini не записан."; fi
fi

step "4/4 Что теперь лежит в проекте ${PROJECT} (только имена)"
vc env ls --project "$PROJECT" --scope "$SCOPE" 2>/dev/null | grep -E 'DEEPSEEK_API_KEY|GEMINI_API_KEY' ||
  echo "Имён не видно: проверьте список в Vercel, Project Settings, Environment Variables."

printf '\nГотово. Ключи начнут работать со следующей сборки ветки. Напишите в тред: «ключи положил».\n'
