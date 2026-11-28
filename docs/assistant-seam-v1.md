# Договор шва `POST /api/assistant` (v1)

Единый контракт между интерфейсом и сервером помощника для двух приложений: **GoApsny (`map`)** и **Stopgap (`stopgap`)**.
Прежние режимы (`mode: "look" | "toilet" | "guide"`) сохраняются для обратной совместимости до завершения переноса фронтенда.

---

## Авторизация и ограничения

- Заголовок: `Authorization: Bearer <supabase_access_token>` (проверяется через Supabase Auth + `profiles.role != 'banned'` и `profiles.ai_enabled != false`).
- Лимит: 40 запросов за 10 минут на пользователя (`429 too_many_requests`).
- Личные данные заявителя (телефон, почта, имя человека) в запрос **не передаются** и в модель **не уходят**. Данные `form` передаются модели ролью `user` с пометкой «данные», а не `system`.

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
| `app` | `"map" \| "stopgap"` | да | Определяет справочники, допустимые `photoKind` и режим `fill` / `hint`. |
| `event` | `"photo" \| "message"` | да | Два события: пришёл снимок или пришла реплика (текст/диктовка). `event: "field"` не используется. |
| `photoKind` | `"entrance" \| "toilet"` (`map`), `"measure"` (`stopgap`) | нет | По умолчанию `"entrance"` для `map` и `"measure"` для `stopgap`. Несочетаемые пары (`stopgap+toilet`, `map+measure`) дают `422 invalid_photo_kind`. |
| `photo` | `string` | при `event: "photo"` | JPEG base64, до ~3,4 МБ (`413 image_too_large`, `400 bad_image`). |
| `message` | `string` | при `event: "message"` (если нет `history`) | Новая реплика человека (до 2000 знаков). Если переданы и `history`, и `message`, `message` добавляется в конец истории. |
| `form` | `object` | нет | Текущие значения анкеты (только белые поля, без личных данных). |
| `history` | `Array<{ role, text }>` | нет | До 12 последних реплик (`role`: `"user" \| "assistant"`). Битый элемент → `422 invalid_history`. |

---

## Ответ (`200 OK`)

```json
{
  "v": 1,
  "status": "ok",
  "say": "Вижу 1 ступеньку (~12 см) без пандуса. Проверьте и поправьте, если нужно.",
  "proposals": [
    { "field": "steps", "value": 1, "kind": "fill", "source": "photo" },
    { "field": "step_height_cm", "value": 12, "kind": "fill", "source": "photo" },
    { "field": "ramp", "value": "none", "kind": "fill", "source": "photo" }
  ],
  "notes": [],
  "next": null
}
```

### Поля ответа

| Поле | Тип | Смысл |
|---|---|---|
| `v` | `1` | Версия протокола. |
| `status` | `"ok" \| "not_entrance" \| "unclear"` | `ok` — есть валидные предложения; `not_entrance` — только для `event: "photo"`, когда на снимке нет входа (`proposals` строго `[]`, `say` всегда не пустой и просит снять вход целиком); `unclear` — пустые `proposals` или неструктурированный ответ (`say` всегда не пустой). |
| `say` | `string` | Короткая реплика по-русски (1–2 предложения, без разметки). При `not_entrance` и `unclear` сервер гарантирует непустую запасную фразу. |
| `proposals` | `Array<Proposal>` | Проверенные сервером предложения полей: `{ field, value, kind, source }`. |
| `notes` | `string[]` | Нестандартные замечания, не укладывающиеся в поля (например, «справа труба у порога»), до 5 строк. |
| `next` | `string \| null` | Подсказка следующего важного поля (`"hl"`, `"door_width_cm"` и т. д.) или `null`. |

### Инварианты сервера и правила клиента

1. **`fill` vs `hint`:**
   - В `app: "map"` все предложения выходят с `kind: "fill"`.
   - В `app: "stopgap"` числовые замеры (`hl`, `hr`, `freeWidth`, `width`) **принудительно** выходят с `kind: "hint"` (ориентир под полем; в поле число всегда вводит человек).
2. **Запрет угадывания по фото и ограничение полей по `photoKind` (решение Арбитра 28.11):**
   - При `app: "map"`, `event: "photo"`, `photoKind: "entrance"` пропускаются **только физические факты входа**: `steps`, `step_height_cm`, `door_width_cm`, `ramp`. Помощник **не угадывает** `name`, `category`, `subtype` по снимку — место и категорию всегда указывает сам человек (вручную или явно в `event: "message"`).
   - При `app: "map"`, `event: "photo"`, `photoKind: "toilet"` пропускаются **только** `toilet_note`, `toilet_accessible`, `hand_wash`.
3. **Строгая фильтрация справочников и пределов:**
   - `map`: `category` из `CATEGORY_SLUGS`, `subtype` только из `SUBTYPES[category]`, `steps` ∈ `[0, 60]`, `step_height_cm` ∈ `STEP_HEIGHT_RANGE` (отбрасывается при `steps === 0` в ответе или в `form.steps === 0`), `door_width_cm` ∈ `DOOR_WIDTH_RANGE`, `ramp` из `RAMP_TYPES`, `toilet` / `hand_wash` / `accessible_parking` / `elevator` ∈ `["yes", "no"]`, `toilet_accessible` ∈ `["yes", "partial", "no"]`, `toilet_note` ≤ 500 знаков.
   - `stopgap`: `hl`, `hr` ∈ `[10, 600]` мм; `freeWidth`, `width` ∈ `[300, 3000]` мм.
4. **Защита от выдумки и пустых ответов:**
   - При `event: "photo"` и `status: "not_entrance"` `proposals` всегда строго `[]`.
   - Для `event: "message"` статус `not_entrance` не применяется и не стирает `proposals`.
   - При пустых `proposals` статус `ok` принудительно приводится к `unclear`; при `not_entrance` и `unclear` `say` никогда не бывает пустым.
5. **Правило клиента при смене категории:** если в `proposals` пришла новая `category` без `subtype`, клиент сбрасывает прежний `subtype` в анкете.

---

## Ошибки

| Код HTTP | `error` | Когда |
|---|---|---|
| `401` | `auth_required` / `invalid_session` | Нет входа или токен устарел |
| `403` | `profile_not_found` / `banned` / `ai_not_enabled` | Нет доступа к помощнику |
| `400` | `bad_request` / `bad_image` | Битый JSON или невалидный JPEG |
| `413` | `image_too_large` | Фото больше ~3,4 МБ base64 |
| `422` | `invalid_app` / `invalid_event` / `invalid_photo_kind` / `photo_required` / `message_required` / `invalid_history` | Нарушен контракт v1 |
| `429` | `too_many_requests` / `assistant_busy` | Превышен лимит запросов |
| `502` | `assistant_failed` | Модель недоступна после повтора |
| `503` | `not_configured` / `assistant_not_configured` / `assistant_key_rejected` | Нет или отклонён ключ модели/Supabase |
