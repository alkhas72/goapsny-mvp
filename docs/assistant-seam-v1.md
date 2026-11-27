# Договор шва `POST /api/assistant` (v1)

Единый контракт между интерфейсом и сервером помощника для двух приложений: **GoApsny (`map`)** и **Stopgap (`stopgap`)**.
Прежние режимы (`mode: "look" | "toilet" | "guide"`) сохраняются для обратной совместимости до завершения переноса фронтенда.

---

## Авторизация и ограничения

- Заголовок: `Authorization: Bearer <supabase_access_token>` (проверяется через Supabase Auth + `profiles.role != 'banned'` и `profiles.ai_enabled != false`).
- Лимит: 40 запросов за 10 минут на пользователя (`429 too_many_requests`).
- Личные данные заявителя (телефон, почта, имя человека) в запрос **не передаются** и в модель **не уходят**.

---

## Запрос (`v: 1`)

```json
{
  "v": 1,
  "app": "map",
  "event": "photo",
  "photoKind": "entrance",
  "photo": "<jpeg base64, с data:image/jpeg;base64, или без>",
  "message": "две ступеньки, дверь около 90",
  "form": {
    "name": "Аптека",
    "category": "health",
    "steps": 2
  },
  "history": [
    { "role": "user", "text": "две ступеньки" },
    { "role": "assistant", "text": "Записал 2 ступени." }
  ]
}
```

### Поля запроса

| Поле | Тип | Обязательно | Правило |
|---|---|---|---|
| `v` | `1` | да | Включает протокол v1. Без `v: 1` работает прежний `mode`. |
| `app` | `"map" \| "stopgap"` | да | Определяет справочники и режим `fill` / `hint`. |
| `event` | `"photo" \| "message"` | да | Два события: пришёл снимок или пришла реплика (текст/диктовка). `event: "field"` не используется (экономия запросов). |
| `photoKind` | `"entrance" \| "toilet" \| "measure"` | нет | По умолчанию `"entrance"` для `map` и `"measure"` для `stopgap`. |
| `photo` | `string` | при `event: "photo"` | JPEG base64, до ~3,4 МБ (`413 image_too_large`, `400 bad_image`). |
| `message` | `string` | при `event: "message"` (если нет `history`) | Новая реплика человека (до 2000 знаков). Если переданы и `history`, и `message`, `message` добавляется в конец истории. |
| `form` | `object` | нет | Текущие значения анкеты (только белые поля, без личных данных). |
| `history` | `Array<{ role, text }>` | нет | До 12 последних реплик (`role`: `"user" \| "assistant"`). |

---

## Ответ (`200 OK`)

```json
{
  "v": 1,
  "status": "ok",
  "say": "Вижу 1 ступеньку (~12 см) без пандуса. Проверьте и поправьте, если нужно.",
  "proposals": [
    { "field": "category", "value": "health", "kind": "fill", "source": "photo" },
    { "field": "steps", "value": 1, "kind": "fill", "source": "photo" },
    { "field": "step_height_cm", "value": 12, "kind": "fill", "source": "photo" },
    { "field": "ramp", "value": "none", "kind": "fill", "source": "photo" }
  ],
  "notes": [],
  "next": "name"
}
```

### Поля ответа

| Поле | Тип | Смысл |
|---|---|---|
| `v` | `1` | Версия протокола. |
| `status` | `"ok" \| "not_entrance" \| "unclear"` | `ok` — данные распознаны; `not_entrance` — на фото не вход / не нужный объект (`proposals` гарантированно пустой, `say` мягко советует переснять, но отправку UI не блокирует); `unclear` — модель ответила текстом без структуры или ничего не смогла разобрать. |
| `say` | `string` | Короткая реплика по-русски (1–2 предложения, без разметки). |
| `proposals` | `Array<Proposal>` | Проверенные сервером предложения полей: `{ field, value, kind, source }`. |
| `notes` | `string[]` | Нестандартные замечания, не укладывающиеся в поля (например, «справа труба у порога»), до 5 строк. |
| `next` | `string \| null` | Подсказка следующего важного поля (`"name"`, `"steps"`, `"hl"` и т. д.) или `null`. |

### Инварианты сервера (гарантируются кодом, не промптом)

1. **`fill` vs `hint`:**
   - В `app: "map"` все предложения выходят с `kind: "fill"`.
   - В `app: "stopgap"` числовые замеры (`hl`, `hr`, `freeWidth`, `width`) **принудительно** выходят с `kind: "hint"` (ориентир под полем; в поле число всегда вводит человек).
2. **Строгая фильтрация справочников и пределов:**
   - `map`: `category` из `CATEGORY_SLUGS`, `subtype` только из `SUBTYPES[category]`, `steps` ∈ `[0, 60]`, `step_height_cm` ∈ `STEP_HEIGHT_RANGE` (отбрасывается при `steps === 0`), `door_width_cm` ∈ `DOOR_WIDTH_RANGE`, `ramp` из `RAMP_TYPES`, `toilet` / `hand_wash` / `accessible_parking` / `elevator` ∈ `["yes", "no"]`, `toilet_accessible` ∈ `["yes", "partial", "no"]`, `toilet_note` ≤ 500 знаков.
   - `stopgap`: `hl`, `hr` ∈ `[10, 600]` мм; `freeWidth`, `width` ∈ `[300, 3000]` мм.
3. **Защита от выдумки:** при `status: "not_entrance"` сервер принудительно очищает `proposals = []`.
4. **Отказоустойчивость:** если модель вернула обычный текст вместо JSON, сервер возвращает `200` с `status: "unclear"`, текстом в `say` и пустым `proposals`.

---

## Ошибки

| Код HTTP | `error` | Когда |
|---|---|---|
| `401` | `auth_required` / `invalid_session` | Нет входа или токен устарел |
| `403` | `profile_not_found` / `banned` / `ai_not_enabled` | Нет доступа к помощнику |
| `400` | `bad_request` / `bad_image` | Битый JSON или невалидный JPEG |
| `413` | `image_too_large` | Фото больше ~3,4 МБ base64 |
| `422` | `invalid_app` / `invalid_event` / `invalid_photo_kind` / `photo_required` / `message_required` | Нарушен контракт v1 |
| `429` | `too_many_requests` / `assistant_busy` | Превышен лимит запросов |
| `502` | `assistant_failed` | Модель недоступна после повтора |
| `503` | `not_configured` / `assistant_not_configured` / `assistant_key_rejected` | Нет или отклонён ключ модели/Supabase |
