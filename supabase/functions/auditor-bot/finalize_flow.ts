import { STATUS_LABELS } from "./constants.ts";
import { menuKeyboard } from "./keyboards.ts";
import type { HandlerDeps } from "./handler_deps.ts";
import {
  editVerifiedObject,
  finalizeCreateWithPhoto,
  verifyGraySelection,
} from "./places.ts";
import { emptyAudit } from "./supabase_stores.ts";
import type { BotSession, Profile } from "./types.ts";
import { requireNonce, resetSession, send, withSession } from "./handler_support.ts";

export async function finalizeFlow(
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
