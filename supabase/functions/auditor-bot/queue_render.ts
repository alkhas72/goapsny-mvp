import { CATEGORY_LABELS, RAMP_LABELS, STATUS_LABELS } from "./constants.ts";
import { signCallback } from "./callbacks.ts";
import { menuKeyboard } from "./keyboards.ts";
import type { fetchGrayQueue, fetchVerifiedQueue } from "./places.ts";
import type { HandlerDeps } from "./handler_deps.ts";
import { chunkTelegramText } from "./validation.ts";

export function formatPlaceLine(
  place: { name: string; category: string; lat: number; lng: number },
): string {
  const category = CATEGORY_LABELS[place.category] ?? place.category;
  return `${place.name} · ${category} · ${place.lat.toFixed(5)}, ${
    place.lng.toFixed(5)
  }`;
}

export function formatAuditSummary(
  status: keyof typeof STATUS_LABELS,
  audit: {
    steps_count: number | null;
    step_height_cm: number | null;
    ramp_type: string;
    door_width_cm: number | null;
    entrance_notes: string | null;
    toilet_exists: string;
    toilet_accessible: string;
    parking: string;
    comment: string | null;
  },
  address?: string,
  elevator?: string,
): string {
  return [
    `Статус: ${STATUS_LABELS[status]}`,
    `Ступени: ${audit.steps_count ?? "—"}`,
    `Высота ступени, см: ${audit.step_height_cm ?? "—"}`,
    `Пандус: ${RAMP_LABELS[audit.ramp_type] ?? audit.ramp_type}`,
    `Ширина двери, см: ${audit.door_width_cm ?? "—"}`,
    `Парковка ИНВ: ${audit.parking}`,
    `Туалет: ${audit.toilet_exists}`,
    `Доступный туалет: ${audit.toilet_accessible}`,
    `Вход: ${audit.entrance_notes ?? "—"}`,
    `Комментарий: ${audit.comment ?? "—"}`,
    `Адрес: ${address ?? "—"}`,
    `Лифт: ${elevator ?? "—"}`,
  ].join("\n");
}

async function sendChunked(
  deps: HandlerDeps,
  chatId: number,
  text: string,
  reply_markup?: Parameters<HandlerDeps["telegram"]["sendMessage"]>[0][
    "reply_markup"
  ],
) {
  const chunks = chunkTelegramText(text);
  for (let index = 0; index < chunks.length; index += 1) {
    await deps.telegram.sendMessage({
      chat_id: chatId,
      text: chunks[index]!,
      reply_markup: index === chunks.length - 1 ? reply_markup : undefined,
    });
  }
}

export async function sendGrayList(
  deps: HandlerDeps,
  chatId: number,
  places: Awaited<ReturnType<typeof fetchGrayQueue>>["places"],
  hasMore: boolean,
  page: number,
  nonce: string,
) {
  if (!places.length) {
    await deps.telegram.sendMessage({
      chat_id: chatId,
      text: "Серых опубликованных меток нет.",
      reply_markup: menuKeyboard(nonce),
    });
    return;
  }
  const lines = places.map((place, index) =>
    `${index + 1}. ${formatPlaceLine(place)}`
  );
  const buttons = places.map((_, index) => [{
    text: `${index + 1}`,
    callback_data: signCallback(`gs:${index}`, nonce),
  }]);
  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) {
    nav.push({
      text: "← Назад",
      callback_data: signCallback(`gp:${page - 1}`, nonce),
    });
  }
  if (hasMore) {
    nav.push({
      text: "Далее →",
      callback_data: signCallback(`gp:${page + 1}`, nonce),
    });
  }
  const keyboard = [...buttons];
  if (nav.length) keyboard.push(nav);
  keyboard.push([{
    text: "Меню",
    callback_data: signCallback("cf:no", nonce),
  }]);
  await sendChunked(
    deps,
    chatId,
    `Серые метки (стр. ${page + 1}):\n${lines.join("\n")}`,
    { inline_keyboard: keyboard },
  );
}

export async function sendEditList(
  deps: HandlerDeps,
  chatId: number,
  places: Awaited<ReturnType<typeof fetchVerifiedQueue>>["places"],
  hasMore: boolean,
  page: number,
  nonce: string,
) {
  if (!places.length) {
    await deps.telegram.sendMessage({
      chat_id: chatId,
      text: "Проверенных объектов нет.",
      reply_markup: menuKeyboard(nonce),
    });
    return;
  }
  const lines = places.map((place, index) =>
    `${index + 1}. ${formatPlaceLine(place)} · ${STATUS_LABELS[place.status]}`
  );
  const buttons = places.map((_, index) => [{
    text: `${index + 1}`,
    callback_data: signCallback(`es:${index}`, nonce),
  }]);
  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) {
    nav.push({
      text: "← Назад",
      callback_data: signCallback(`ep:${page - 1}`, nonce),
    });
  }
  if (hasMore) {
    nav.push({
      text: "Далее →",
      callback_data: signCallback(`ep:${page + 1}`, nonce),
    });
  }
  const keyboard = [...buttons];
  if (nav.length) keyboard.push(nav);
  keyboard.push([{
    text: "Меню",
    callback_data: signCallback("cf:no", nonce),
  }]);
  await sendChunked(
    deps,
    chatId,
    `Проверенные объекты (стр. ${page + 1}):\n${lines.join("\n")}`,
    { inline_keyboard: keyboard },
  );
}
