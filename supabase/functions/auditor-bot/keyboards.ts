import { signCallback } from "./callbacks.ts";
import { ACTIVE_CATEGORY_SLUGS, CATEGORY_LABELS } from "./constants.ts";
import {
  ELEVATOR_VALUES,
  RAMP_TYPES,
  TOILET_ACCESSIBLE,
  YES_NO_UNKNOWN,
} from "./validation.ts";
import type { InlineKeyboard } from "./types.ts";

export function menuKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "Серые метки", callback_data: signCallback("m:gray", nonce) }],
      [{
        text: "Добавить объект",
        callback_data: signCallback("m:add", nonce),
      }],
      [{
        text: "Редактировать объект",
        callback_data: signCallback("m:edit", nonce),
      }],
    ],
  };
}

export function statusKeyboard(nonce: string, prefix = "st"): InlineKeyboard {
  return {
    inline_keyboard: [
      [{
        text: "Доступно",
        callback_data: signCallback(`${prefix}:green`, nonce),
      }],
      [{
        text: "Частично",
        callback_data: signCallback(`${prefix}:yellow`, nonce),
      }],
      [{
        text: "Недоступно",
        callback_data: signCallback(`${prefix}:red`, nonce),
      }],
    ],
  };
}

export function confirmKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "Сохранить", callback_data: signCallback("cf:yes", nonce) }],
      [{ text: "Отмена", callback_data: signCallback("cf:no", nonce) }],
    ],
  };
}

export function skipKeyboard(next: string, nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [[{
      text: "Пропустить",
      callback_data: signCallback(`sk:${next}`, nonce),
    }]],
  };
}

export function categoryKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: ACTIVE_CATEGORY_SLUGS.map((slug) => [{
      text: CATEGORY_LABELS[slug],
      callback_data: signCallback(`cat:${slug}`, nonce),
    }]),
  };
}

export function rampKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: RAMP_TYPES.map((value) => [{
      text: value,
      callback_data: signCallback(`rt:${value}`, nonce),
    }]),
  };
}

export function yesNoUnknownKeyboard(
  prefix: "pk" | "te" | "el",
  nonce: string,
): InlineKeyboard {
  return {
    inline_keyboard: YES_NO_UNKNOWN.map((value) => [{
      text: value,
      callback_data: signCallback(`${prefix}:${value}`, nonce),
    }]),
  };
}

export function toiletAccessibleKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: TOILET_ACCESSIBLE.map((value) => [{
      text: value,
      callback_data: signCallback(`ta:${value}`, nonce),
    }]),
  };
}

export function elevatorKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: ELEVATOR_VALUES.map((value) => [{
      text: value,
      callback_data: signCallback(`el:${value}`, nonce),
    }]),
  };
}

export function factStepKeyboard(
  step: string,
  nonce: string,
): InlineKeyboard | undefined {
  if (step === "ramp_type") return rampKeyboard(nonce);
  if (step === "parking") return yesNoUnknownKeyboard("pk", nonce);
  if (step === "toilet_exists") return yesNoUnknownKeyboard("te", nonce);
  if (step === "toilet_accessible") return toiletAccessibleKeyboard(nonce);
  if (step === "elevator") return elevatorKeyboard(nonce);
  return skipKeyboard(step, nonce);
}
