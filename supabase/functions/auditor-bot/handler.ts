import {
  CATEGORY_LABELS,
  GRAY_PAGE_SIZE,
  RAMP_LABELS,
  STATUS_LABELS,
} from "./constants.ts";
import { signCallback } from "./callbacks.ts";
import { GENERIC_DENIAL } from "./auth.ts";
import { staleCallbackMessage, validateCallback } from "./callbacks.ts";
import { deliverGrayFacadePreview } from "./facade_delivery.ts";
import {
  applyEnumCallback,
  applyTextFactStep,
  factPrompt,
  factState,
  isEnumFactStep,
  nextFactStep,
  reviewState,
} from "./facts.ts";
import { ownsCallback } from "./idempotency.ts";
import {
  categoryKeyboard,
  confirmKeyboard,
  factStepKeyboard,
  menuKeyboard,
  skipKeyboard,
  statusKeyboard,
} from "./keyboards.ts";
import {
  editVerifiedObject,
  fetchGrayQueue,
  fetchVerifiedQueue,
  finalizeCreateWithPhoto,
  verifyGraySelection,
} from "./places.ts";
import {
  bindSelectedPlace,
  isSessionExpired,
  newSession,
  resetSession,
  startCreateFlow,
  startEditFlow,
  startVerifyFlow,
  withSession,
} from "./session.ts";
import { emptyAudit, emptyAuditFromPlace } from "./supabase_stores.ts";
import type { PlacesStore, StorageClient } from "./places.ts";
import type { SessionStore } from "./session.ts";
import type {
  BotSession,
  FinalStatus,
  OutgoingMessage,
  Profile,
  TelegramClient,
  TelegramUpdate,
} from "./types.ts";
import {
  isActiveCategory,
  isFinalStatus,
  validateCoordinates,
  validateTrimmedName,
} from "./validation.ts";

export type HandlerDeps = {
  places: PlacesStore;
  sessions: SessionStore;
  storage: StorageClient;
  telegram: TelegramClient;
  now?: () => Date;
};

function formatPlaceLine(
  place: { name: string; category: string; lat: number; lng: number },
): string {
  const category = CATEGORY_LABELS[place.category] ?? place.category;
  return `${place.name} · ${category} · ${place.lat.toFixed(5)}, ${
    place.lng.toFixed(5)
  }`;
}

function formatAuditSummary(
  status: FinalStatus,
  audit: ReturnType<typeof emptyAudit>,
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

async function send(
  deps: HandlerDeps,
  chatId: number,
  text: string,
  reply_markup?: OutgoingMessage["reply_markup"],
) {
  await deps.telegram.sendMessage({ chat_id: chatId, text, reply_markup });
}

function requireNonce(session: BotSession): string {
  return session.draft.nonce ?? crypto.randomUUID().slice(0, 8);
}

export async function handleAuthorizedUpdate(
  deps: HandlerDeps,
  profile: Profile,
  update: TelegramUpdate,
  session: BotSession,
): Promise<BotSession> {
  const chatId = update.message?.chat.id ??
    update.callback_query?.message?.chat.id;
  if (!chatId) return session;

  if (isSessionExpired(session.updated_at)) {
    session = resetSession(session);
    await send(
      deps,
      chatId,
      "Сессия истекла. Начните с /start.",
      menuKeyboard(requireNonce(session)),
    );
    return session;
  }

  if (update.callback_query) {
    return handleCallback(deps, profile, update, session, chatId);
  }
  if (update.message) {
    return handleMessage(deps, profile, update, session, chatId);
  }
  return session;
}

async function handleCallback(
  deps: HandlerDeps,
  profile: Profile,
  update: TelegramUpdate,
  session: BotSession,
  chatId: number,
): Promise<BotSession> {
  const callback = update.callback_query!;
  if (!ownsCallback(session.telegram_id, callback.from.id)) {
    await deps.telegram.answerCallbackQuery(
      callback.id,
      "Сессия принадлежит другому пользователю.",
    );
    return session;
  }

  const rawData = callback.data ?? "";
  const validated = validateCallback(session, rawData);
  if (!validated.ok) {
    await deps.telegram.answerCallbackQuery(
      callback.id,
      staleCallbackMessage(validated.reason),
    );
    return session;
  }

  const data = validated.action;
  await deps.telegram.answerCallbackQuery(callback.id);
  const nonce = requireNonce(session);

  if (data === "m:gray") {
    const queue = await fetchGrayQueue(deps.places, 0);
    session = startVerifyFlow(session, queue.places.map((p) => p.id), 0);
    await sendGrayList(
      deps,
      chatId,
      queue.places,
      queue.hasMore,
      0,
      requireNonce(session),
    );
    return session;
  }
  if (data === "m:add") {
    session = startCreateFlow(session, crypto.randomUUID());
    await send(
      deps,
      chatId,
      "Выберите категорию:",
      categoryKeyboard(requireNonce(session)),
    );
    return session;
  }
  if (data === "m:edit") {
    const queue = await fetchVerifiedQueue(deps.places, 0);
    session = startEditFlow(session, queue.places.map((p) => p.id), 0);
    await sendEditList(
      deps,
      chatId,
      queue.places,
      queue.hasMore,
      0,
      requireNonce(session),
    );
    return session;
  }
  if (data.startsWith("gp:")) {
    const page = Number(data.split(":")[1] ?? "0");
    const queue = await fetchGrayQueue(deps.places, page);
    session = startVerifyFlow(session, queue.places.map((p) => p.id), page);
    await sendGrayList(
      deps,
      chatId,
      queue.places,
      queue.hasMore,
      page,
      requireNonce(session),
    );
    return session;
  }
  if (data.startsWith("ep:")) {
    const page = Number(data.split(":")[1] ?? "0");
    const queue = await fetchVerifiedQueue(deps.places, page);
    session = startEditFlow(session, queue.places.map((p) => p.id), page);
    await sendEditList(
      deps,
      chatId,
      queue.places,
      queue.hasMore,
      page,
      requireNonce(session),
    );
    return session;
  }
  if (data.startsWith("gs:")) {
    const index = Number(data.split(":")[1]);
    const placeId = session.draft.grayIds?.[index];
    if (!placeId) {
      await send(
        deps,
        chatId,
        "Объект не найден. Обновите список.",
        menuKeyboard(nonce),
      );
      return resetSession(session);
    }
    const place = await deps.places.getPlace(placeId);
    if (
      !place || place.status !== "gray" ||
      place.moderation_status !== "published"
    ) {
      await send(
        deps,
        chatId,
        "Объект уже проверен или недоступен.",
        menuKeyboard(nonce),
      );
      return resetSession(session);
    }
    session = bindSelectedPlace(session, placeId);
    const facade = await deliverGrayFacadePreview(
      deps.places,
      deps.storage,
      deps.telegram,
      chatId,
      placeId,
      place.name,
    );
    const facadeNote = facade === "missing"
      ? "\n\nФото фасада отсутствует."
      : "\n\nФото фасада отправлено выше.";
    await send(
      deps,
      chatId,
      `Выбрано:\n${
        formatPlaceLine(place)
      }${facadeNote}\n\nВыберите итоговый статус:`,
      statusKeyboard(requireNonce(session)),
    );
    return session;
  }
  if (data.startsWith("es:")) {
    const index = Number(data.split(":")[1]);
    const placeId = session.draft.editIds?.[index];
    if (!placeId) {
      await send(deps, chatId, "Объект не найден.", menuKeyboard(nonce));
      return resetSession(session);
    }
    const place = await deps.places.getPlace(placeId);
    if (
      !place || !isFinalStatus(place.status) ||
      place.moderation_status !== "published"
    ) {
      await send(
        deps,
        chatId,
        "Объект недоступен для редактирования.",
        menuKeyboard(nonce),
      );
      return resetSession(session);
    }
    session = withSession(bindSelectedPlace(session, placeId), {
      state: "edit_status",
      draft: {
        ...session.draft,
        placeId,
        status: place.status as FinalStatus,
        audit: emptyAuditFromPlace(place),
        address: typeof place.details.address === "string"
          ? place.details.address
          : undefined,
        elevator: place.details.elevator as
          | "yes"
          | "no"
          | "unknown"
          | undefined,
        step: "status",
      },
    });
    await send(
      deps,
      chatId,
      `Редактирование:\n${formatPlaceLine(place)}\n\nВыберите статус:`,
      statusKeyboard(requireNonce(session), "est"),
    );
    return session;
  }
  if (data.startsWith("st:") || data.startsWith("est:")) {
    const status = data.split(":")[1];
    if (!isFinalStatus(status)) {
      await send(
        deps,
        chatId,
        "Нельзя выбрать серый статус.",
        statusKeyboard(nonce, data.startsWith("est:") ? "est" : "st"),
      );
      return session;
    }
    session = withSession(session, {
      state: factState(session, "steps_count"),
      draft: {
        ...session.draft,
        status,
        step: "steps_count",
      },
    });
    return promptFactStep(deps, session, chatId, "steps_count");
  }
  if (data.startsWith("cat:")) {
    const category = data.slice(4);
    if (!isActiveCategory(category)) {
      await send(deps, chatId, "Выберите категорию:", categoryKeyboard(nonce));
      return session;
    }
    session = withSession(session, {
      state: "create_name",
      draft: { ...session.draft, category, step: "name" },
    });
    await send(deps, chatId, "Введите название объекта:");
    return session;
  }
  if (data === "cf:yes") {
    return finalizeFlow(deps, profile, session, chatId);
  }
  if (data === "cf:no") {
    session = resetSession(session);
    await send(
      deps,
      chatId,
      "Отменено. Главное меню:",
      menuKeyboard(requireNonce(session)),
    );
    return session;
  }
  if (data.startsWith("sk:")) {
    return advanceSkippedFact(deps, session, chatId, data.slice(3));
  }
  if (
    data.startsWith("rt:") || data.startsWith("pk:") ||
    data.startsWith("te:") ||
    data.startsWith("ta:") || data.startsWith("el:")
  ) {
    return applyEnumFactCallback(deps, session, chatId, data);
  }

  return session;
}

async function handleMessage(
  deps: HandlerDeps,
  profile: Profile,
  update: TelegramUpdate,
  session: BotSession,
  chatId: number,
): Promise<BotSession> {
  const text = update.message?.text?.trim() ?? "";

  if (text === "/start") {
    session = resetSession(session);
    await send(
      deps,
      chatId,
      `Здравствуйте, ${profile.display_name ?? "аудитор"}.\nВыберите действие:`,
      menuKeyboard(requireNonce(session)),
    );
    return session;
  }

  if (session.state === "create_name") {
    const nameResult = validateTrimmedName(text);
    if (!nameResult.ok) {
      await send(deps, chatId, "Название обязательно. Введите ещё раз:");
      return session;
    }
    session = withSession(session, {
      state: "create_location",
      draft: { ...session.draft, name: nameResult.name, step: "location" },
    });
    await send(
      deps,
      chatId,
      "Отправьте геолокацию объекта через вложение → «Геопозиция».",
    );
    return session;
  }

  if (session.state === "create_location" && update.message?.location) {
    const coords = validateCoordinates(
      update.message.location.latitude,
      update.message.location.longitude,
    );
    if (!coords.ok) {
      await send(
        deps,
        chatId,
        "Некорректные координаты. Отправьте геопозицию через Telegram.",
      );
      return session;
    }
    session = withSession(session, {
      state: "create_status",
      draft: {
        ...session.draft,
        lat: coords.lat,
        lng: coords.lng,
        step: "status",
      },
    });
    await send(
      deps,
      chatId,
      "Выберите итоговый статус:",
      statusKeyboard(requireNonce(session)),
    );
    return session;
  }

  if (session.state === "create_photo" && update.message?.photo?.length) {
    const placeId = session.draft.pendingPlaceId;
    if (!placeId) return resetSession(session);
    const largest = update.message.photo[update.message.photo.length - 1];
    const file = await deps.telegram.getFile(largest.file_id);
    const bytes = await deps.telegram.downloadFile(file.file_path);
    return finalizeFlow(deps, profile, session, chatId, bytes);
  }

  if (
    session.state.startsWith("verify_facts_") ||
    session.state.startsWith("edit_facts_") ||
    session.state.startsWith("create_facts_")
  ) {
    return captureFactInput(deps, session, chatId, text);
  }

  await send(
    deps,
    chatId,
    "Используйте /start для главного меню.",
    menuKeyboard(requireNonce(session)),
  );
  return session;
}

async function applyEnumFactCallback(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
  action: string,
): Promise<BotSession> {
  const step = session.draft.step ?? "ramp_type";
  if (!isEnumFactStep(step)) {
    await send(deps, chatId, staleCallbackMessage("wrong_state"));
    return session;
  }
  const audit = { ...emptyAudit(), ...session.draft.audit };
  const applied = applyEnumCallback(action, audit, session);
  if (!applied.ok) {
    await send(deps, chatId, "Некорректное значение. Выберите из списка.");
    return promptFactStep(deps, session, chatId, step);
  }
  return advanceAfterFact(deps, applied.session, chatId, applied.audit, step);
}

async function captureFactInput(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
  text: string,
): Promise<BotSession> {
  const step = session.draft.step ?? "steps_count";
  if (isEnumFactStep(step)) {
    await send(deps, chatId, "Выберите значение кнопкой ниже.");
    return promptFactStep(deps, session, chatId, step);
  }
  const audit = { ...emptyAudit(), ...session.draft.audit };
  const applied = applyTextFactStep(step, text, audit, session);
  if (!applied.ok) {
    await send(
      deps,
      chatId,
      "Некорректное значение. Повторите ввод или нажмите «Пропустить».",
    );
    return session;
  }
  return advanceAfterFact(deps, applied.session, chatId, applied.audit, step);
}

async function advanceSkippedFact(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
  step: string,
): Promise<BotSession> {
  const audit = { ...emptyAudit(), ...session.draft.audit };
  return await advanceAfterFact(deps, session, chatId, audit, step);
}

async function advanceAfterFact(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
  audit: ReturnType<typeof emptyAudit>,
  currentStep: string,
): Promise<BotSession> {
  const next = nextFactStep(currentStep);
  if (!next) {
    session = withSession(session, {
      state: reviewState(session),
      draft: { ...session.draft, audit, step: "review" },
    });
    return await sendReview(deps, session, chatId);
  }
  session = withSession(session, {
    state: factState(session, next),
    draft: { ...session.draft, audit, step: next },
  });
  return await promptFactStep(deps, session, chatId, next);
}

async function promptFactStep(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
  step: string,
): Promise<BotSession> {
  const nonce = requireNonce(session);
  const keyboard = factStepKeyboard(step, nonce) ?? skipKeyboard(step, nonce);
  await send(deps, chatId, factPrompt(step), keyboard);
  return session;
}

async function sendReview(
  deps: HandlerDeps,
  session: BotSession,
  chatId: number,
): Promise<BotSession> {
  const status = session.draft.status!;
  const audit = { ...emptyAudit(), ...session.draft.audit };
  const summary = formatAuditSummary(
    status,
    audit,
    session.draft.address,
    session.draft.elevator,
  );
  const nonce = requireNonce(session);
  if (session.draft.flow === "create") {
    await send(
      deps,
      chatId,
      `Проверьте данные:\n${summary}\n\nТеперь отправьте фото фасада.`,
    );
    return withSession(session, { state: "create_photo" });
  }
  await send(
    deps,
    chatId,
    `Проверьте данные:\n${summary}\n\nСохранить?`,
    confirmKeyboard(nonce),
  );
  return withSession(session, {
    state: session.draft.flow === "edit" ? "edit_review" : "verify_review",
  });
}

async function finalizeFlow(
  deps: HandlerDeps,
  profile: Profile,
  session: BotSession,
  chatId: number,
  photoBytes?: Uint8Array,
): Promise<BotSession> {
  const verifiedAt = (deps.now?.() ?? new Date()).toISOString();
  const audit = { ...emptyAudit(), ...session.draft.audit };

  if (
    session.draft.flow === "verify" && session.draft.placeId &&
    session.draft.status
  ) {
    const result = await verifyGraySelection(
      deps.places,
      session.draft.placeId,
      {
        status: session.draft.status,
        audit,
        address: session.draft.address,
        elevator: session.draft.elevator,
        verifiedAt,
      },
    );
    if (!result.ok) {
      const message = result.reason === "stale"
        ? "Объект уже проверен другим аудитором. Обновите список."
        : "Не удалось сохранить проверку.";
      await send(deps, chatId, message, menuKeyboard(requireNonce(session)));
      return resetSession(session);
    }
    await send(
      deps,
      chatId,
      `Сохранено: ${result.place.name} → ${
        STATUS_LABELS[result.place.status]
      }.`,
      menuKeyboard(requireNonce(session)),
    );
    return resetSession(session);
  }

  if (
    session.draft.flow === "create" && session.draft.pendingPlaceId &&
    session.draft.status
  ) {
    if (!photoBytes) {
      await send(deps, chatId, "Отправьте фото фасада перед сохранением.");
      return session;
    }
    const result = await finalizeCreateWithPhoto(deps.places, deps.storage, {
      placeId: session.draft.pendingPlaceId,
      profile,
      name: session.draft.name ?? "",
      category: session.draft.category ?? "",
      lat: session.draft.lat ?? 0,
      lng: session.draft.lng ?? 0,
      status: session.draft.status,
      audit,
      address: session.draft.address,
      elevator: session.draft.elevator,
      verifiedAt,
      facadeUploaded: true,
      photoBytes,
    });
    if (!result.ok) {
      await send(
        deps,
        chatId,
        `Не удалось создать объект: ${result.reason}. Повторите фото или /start.`,
      );
      return withSession(session, {
        draft: { ...session.draft, facadeUploaded: false },
      });
    }
    await send(
      deps,
      chatId,
      `Объект создан: ${result.place.name}.`,
      menuKeyboard(requireNonce(session)),
    );
    return resetSession(session);
  }

  if (
    session.draft.flow === "edit" && session.draft.placeId &&
    session.draft.status
  ) {
    const result = await editVerifiedObject(
      deps.places,
      session.draft.placeId,
      {
        status: session.draft.status,
        audit,
        address: session.draft.address,
        elevator: session.draft.elevator,
        verifiedAt,
      },
    );
    if (!result.ok) {
      await send(
        deps,
        chatId,
        "Не удалось обновить объект.",
        menuKeyboard(requireNonce(session)),
      );
      return resetSession(session);
    }
    await send(
      deps,
      chatId,
      `Обновлено: ${result.place.name}.`,
      menuKeyboard(requireNonce(session)),
    );
    return resetSession(session);
  }

  await send(
    deps,
    chatId,
    "Нечего сохранять. /start",
    menuKeyboard(requireNonce(session)),
  );
  return resetSession(session);
}

async function sendGrayList(
  deps: HandlerDeps,
  chatId: number,
  places: Awaited<ReturnType<typeof fetchGrayQueue>>["places"],
  hasMore: boolean,
  page: number,
  nonce: string,
) {
  if (!places.length) {
    await send(
      deps,
      chatId,
      "Серых опубликованных меток нет.",
      menuKeyboard(nonce),
    );
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
  await send(
    deps,
    chatId,
    `Серые метки (стр. ${page + 1}):\n${lines.join("\n")}`,
    {
      inline_keyboard: keyboard,
    },
  );
}

async function sendEditList(
  deps: HandlerDeps,
  chatId: number,
  places: Awaited<ReturnType<typeof fetchVerifiedQueue>>["places"],
  hasMore: boolean,
  page: number,
  nonce: string,
) {
  if (!places.length) {
    await send(deps, chatId, "Проверенных объектов нет.", menuKeyboard(nonce));
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
  await send(
    deps,
    chatId,
    `Проверенные объекты (стр. ${page + 1}):\n${lines.join("\n")}`,
    { inline_keyboard: keyboard },
  );
}

export async function handleUnauthorized(
  deps: Pick<HandlerDeps, "telegram">,
  chatId: number,
): Promise<void> {
  await deps.telegram.sendMessage({ chat_id: chatId, text: GENERIC_DENIAL });
}

export function bootstrapSession(
  telegramId: number,
  existing: BotSession | null,
): BotSession {
  return existing ?? newSession(telegramId);
}

export { GRAY_PAGE_SIZE };
