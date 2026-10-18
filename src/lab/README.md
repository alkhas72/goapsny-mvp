# AISP-378 — часть Cody, локальный этап

База: `origin/feat/e3-mapper-assistant`, `ae8a3a490fc4f724ac45b00404a169ce10a75d17`.
Рабочая ветка: `lab/interface-candidates-2026-10-cody`. Интеграционная ветка из брифа — `lab/interface-candidates-2026-10`; здесь подготовлена отдельная часть без push.
Режим AGENTS.md: ui-craft-first; визуальный гейт остаётся за Алхасом/Claude. Визуального редизайна production нет.

## Граница с Claude

Cody владеет `src/main.tsx` и `src/lab/{entry,contract,store,LabApp,LabViewport}` плюс соответствующими проверками и scoped CSS. Согласование с Claude через родителя ещё требуется: новый сведённый комментарий не получен.
Claude владеет будущими LabPlaceSheet, словарём, микротекстами, fixtures и компонентными тестами. Эти файлы здесь не создавались.

`LabApp` принимает `PlaceSheet: ComponentType<LabPlaceSheetProps>` и `fixtures: LabPlace[]`. Подключение после передачи Claude: `<LabApp PlaceSheet={LabPlaceSheet} fixtures={labFixtures} />`.
Временная `LabIntegrationSheet` нужна только для проверки цепочки; её следует заменить компонентом Claude. Встроенные два seeds вымышленные, без фото и реальных учреждений; они не заменяют её fixtures.

## Контракт

`contract.ts` переиспользует production типы, не меняя `shared/index.ts` и сервисы. Сохранены snake_case поля: `steps_count` — количество; `step_height_cm`, `door_width_cm` — сантиметры, `number | null`. `ramp_type` — production enum + `unknown` в lab. Наличие парковки `parking` отдельно от её доступности `parking_accessible`.

`LabPlace.status` — проверенное значение. `LabContribution.kind === 'rating'` хранит отдельный `proposedStatus`; применение предложений к проверенному месту отсутствует. Новый объект только gray.
`onSubmit(LabDraft)` синхронно возвращает `LabSaveResult`: успех содержит полный актуальный список и `duplicate`; ошибка — текст. Карточка остаётся открытой при ошибке. Полный payload живёт в отдельном namespace `goapsny.lab.contributions.v1`, envelope `{version:1,items}`; state только `local-only`. Нет отправки, фоновой синхронизации, статуса sent, фото/upload/AI.

Каждая запись сначала перечитывает накопленные данные. Повтор одинакового payload для того же места не создаёт новую строку; другое предложение сохраняется отдельно. Запись подтверждается обратным чтением. Quota, запрет доступа, повреждённый JSON и неизвестная версия видны как ошибки; повреждённые данные не перезаписываются. Старые дни не очищаются. Это локальная симуляция, не надёжная серверная очередь.

## Вход и карта

`main.tsx` сравнивает точное первое значение `lab=1` до импорта live оболочки, SDK и SW. Lab имеет приоритет над mapper и Telegram. Без флага остаётся исходный выбор public/Telegram.
`LabViewport` — самостоятельный MapLibre с inline background style: ни тайлов, ни glyph/sprite URL, ни геолокации. Это явно подписанная координатная область, не полноценная подложка. Реальные bounds пересчитываются по load/moveend. Различаются loading/error/empty-area/empty-filter. При ошибке карты доступен список mock-мест. Пустая область позволяет добавить демонстрационное gray-место в центре.

## Проверки 18.10.2026

- База до правок: 179/179. После: 187/187.
- `npx tsc -b`, `npm run build`, `npx eslint src/lab src/main.tsx`: проходят.
- Полный `npx eslint .`: 7 ошибок, 2 предупреждения в неизменённых `src/components/AddWizard.tsx` и `src/utils/telegram.ts`; оба файла побайтово сверены с HEAD. Production ради этого не правился.
- Локальный браузер: `npm run dev -- --host 127.0.0.1`; затем `LAB_CHROMIUM_PATH=/usr/bin/chromium node scripts/lab-local-smoke.mjs`.
- Chromium, 390×844: lab при mapper-флаге; checked green после red proposal; дедупликация; reload; offline сохранение; filter vs viewport; перемещение клавиатурой; пустая область; новый gray; quota error. Внешних запросов и page errors — 0. Escape/возврат фокуса дополнительно покрыты компонентным тестом.
- Снимки локально: `/tmp/goapsny-evidence/{lab-mobile,lab-marks-reload,lab-empty-area,lab-new-gray}.png`.
- Playwright download блокирован `403 Domain forbidden` для cdn.playwright.dev; использован уже установленный Chromium, без обхода доменного запрета.

## Остаток и откат

Не проверены живой Telegram WebView, реальный screen reader, устройство Алхаса, старая установленная SW/PWA и масштабирование 200%; это отдельная приёмка. Подложка и полноценная карточка — следующий интеграционный этап, не выполненная часть Claude. Проход «убрать» не выполнен, production ничего не удалено.

Ни push, ни deploy, ни публичный preview не выполнялись. Для отмены локального кода достаточно вернуться на базовую ветку после сохранения нужного результата. Удаление ветки не очищает localStorage и чужие preview. Очистка именно lab-данных на тестовом origin: `localStorage.removeItem('goapsny.lab.contributions.v1')`; старые preview нужно отключать отдельно, если они когда-либо будут созданы. В этой итерации их нет.

Итог в согласованный staging общей базы пока не перенесён: родитель должен определить место; новый реестр не создавался.
