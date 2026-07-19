# Epoch 3 — Baseline базы (партия 1.5)

Дата замера: 2026-07-19. Режим: superpowers-lite, только измерение. Код/тесты/конфиги не менялись.

## Окружение

| Компонент | Версия |
|-----------|--------|
| Node | v26.5.0 |
| npm | 11.17.0 |

### Ключевые зависимости (`package.json`)

| Пакет | Версия |
|-------|--------|
| react | ^19.2.6 |
| react-dom | ^19.2.6 |
| @supabase/supabase-js | ^2.99.1 |
| leaflet | ^1.9.4 |
| lucide-react | ^1.17.0 |
| vite | ^8.0.12 |
| vitest | ^4.1.10 |
| typescript | ~6.0.2 |
| @vitejs/plugin-react | ^6.0.1 |

## Сборка

| Параметр | Значение |
|----------|----------|
| Команда | `npm run build` (`tsc -b && vite build`) |
| Результат | **успех** (exit 0) |
| Время (real) | 1,99 s |
| Vite build | 200 ms |

### Размер бандла (`dist/`)

| Артефакт | Размер | gzip |
|----------|--------|------|
| `dist/` (всего) | 720 KB | — |
| `dist/index.html` | 0,68 kB | 0,42 kB |
| `dist/public.html` | 0,79 kB | 0,48 kB |
| `dist/assets/camera-Ch8zzYhF.css` | 38,64 kB | 11,08 kB |
| `dist/assets/main-CnMX2JJz.js` | 45,32 kB | 13,50 kB |
| `dist/assets/public-DDT3Zr1V.js` | 243,83 kB | 65,44 kB |
| `dist/assets/camera-Bj8Si0vk.js` | 352,34 kB | 108,49 kB |

Предупреждение Vite (не блокирует сборку):

```
[INEFFECTIVE_DYNAMIC_IMPORT] src/services/supabase.ts is dynamically imported by src/services/submit-place.ts but also statically imported by src/components/PublicMap.tsx, src/services/places.ts, src/services/publicAuth.ts, src/services/submit-place.ts, dynamic import will not move module into another chunk.
```

## Тесты

| Параметр | Значение |
|----------|----------|
| Команда | `npm test` (`vitest run`) |
| Результат | **провал** (exit 1) |
| Время (real) | 3,72 s |
| Vitest | v4.1.10 |
| Файлов | 12 (11 passed, 1 failed) |
| Тестов | **63 всего / 62 прошло / 1 упало** |

### Упавшие тесты

1. `src/services/submit-place.test.ts` → `submitPublicPlace` → `throws not_configured when Supabase is not configured and no client is injected`

### Полный текст ошибки

```
 FAIL  src/services/submit-place.test.ts > submitPublicPlace > throws not_configured when Supabase is not configured and no client is injected
AssertionError: expected SubmitPlaceError: Failed to upload facade… { …(2) } to match object { kind: 'not_configured' }
(8 matching properties omitted from actual)

- Expected
+ Received

- {
-   "kind": "not_configured",
+ SubmitPlaceError {
+   "kind": "missing_photo",
  }

 ❯ src/services/submit-place.test.ts:120:47
    118| describe('submitPublicPlace', () => {
    119|   it('throws not_configured when Supabase is not configured and no cli…
    120|     await expect(submitPublicPlace(validInput)).rejects.toMatchObject(…
       |                                               ^
    121|   });
    122|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Вердикт

**Условно пригодна как отправная точка:** сборка проходит, тестовый контур в целом зелёный (62/63), один падающий тест в `submit-place` — ожидается `not_configured`, фактически `missing_photo`.
