import type { AuditFields, BotSession } from "./types.ts";
import {
  MAX_ADDRESS,
  MAX_COMMENT,
  MAX_ENTRANCE_NOTES,
  parseOptionalInt,
  validateBoundedText,
  validateElevator,
  validateRampType,
  validateToiletAccessible,
  validateYesNoUnknown,
} from "./validation.ts";

export const FACT_STEPS = [
  "steps_count",
  "step_height_cm",
  "ramp_type",
  "door_width_cm",
  "parking",
  "toilet_exists",
  "toilet_accessible",
  "entrance_notes",
  "comment",
  "address",
  "elevator",
] as const;

export type FactStep = (typeof FACT_STEPS)[number];

export function nextFactStep(current: string): FactStep | null {
  const index = FACT_STEPS.indexOf(current as FactStep);
  if (index < 0 || index === FACT_STEPS.length - 1) return null;
  return FACT_STEPS[index + 1];
}

export function factState(session: BotSession, step: string): string {
  const prefix = session.draft.flow === "create"
    ? "create_facts_"
    : session.draft.flow === "edit"
    ? "edit_facts_"
    : "verify_facts_";
  return `${prefix}${step}`;
}

export function reviewState(session: BotSession): string {
  if (session.draft.flow === "create") return "create_photo";
  if (session.draft.flow === "edit") return "edit_review";
  return "verify_review";
}

export function factPrompt(step: string): string {
  const prompts: Record<string, string> = {
    steps_count: "Сколько ступеней? Число или «-».",
    step_height_cm: "Высота ступени, см? Число или «-».",
    ramp_type: "Выберите тип пандуса:",
    door_width_cm: "Ширина двери, см? Число или «-».",
    parking: "Парковка ИНВ:",
    toilet_exists: "Туалет:",
    toilet_accessible: "Доступный туалет:",
    entrance_notes: "Заметка о входе или «-».",
    comment: "Комментарий или «-».",
    address: "Адрес текстом или «-».",
    elevator: "Лифт:",
  };
  return prompts[step] ?? "Введите значение:";
}

export function applyEnumCallback(
  action: string,
  audit: AuditFields,
  session: BotSession,
): { audit: AuditFields; session: BotSession; ok: true } | { ok: false } {
  if (action.startsWith("rt:")) {
    const value = action.slice(3);
    const parsed = validateRampType(value);
    if (!parsed.ok) return { ok: false };
    audit.ramp_type = parsed.value;
    return { audit, session, ok: true };
  }
  if (action.startsWith("pk:")) {
    const parsed = validateYesNoUnknown(action.slice(3));
    if (!parsed.ok) return { ok: false };
    audit.parking = parsed.value;
    return { audit, session, ok: true };
  }
  if (action.startsWith("te:")) {
    const parsed = validateYesNoUnknown(action.slice(3));
    if (!parsed.ok) return { ok: false };
    audit.toilet_exists = parsed.value;
    return { audit, session, ok: true };
  }
  if (action.startsWith("ta:")) {
    const parsed = validateToiletAccessible(action.slice(3));
    if (!parsed.ok) return { ok: false };
    audit.toilet_accessible = parsed.value;
    return { audit, session, ok: true };
  }
  if (action.startsWith("el:")) {
    const parsed = validateElevator(action.slice(3));
    if (!parsed.ok) return { ok: false };
    return {
      audit,
      session: {
        ...session,
        draft: { ...session.draft, elevator: parsed.value },
      },
      ok: true,
    };
  }
  return { ok: false };
}

export function applyTextFactStep(
  step: string,
  text: string,
  audit: AuditFields,
  session: BotSession,
):
  | { ok: true; audit: AuditFields; session: BotSession; address?: string }
  | { ok: false; reason: string } {
  try {
    if (step === "steps_count") audit.steps_count = parseOptionalInt(text);
    if (step === "step_height_cm") {
      audit.step_height_cm = parseOptionalInt(text);
    }
    if (step === "door_width_cm") audit.door_width_cm = parseOptionalInt(text);
    if (step === "entrance_notes") {
      const parsed = validateBoundedText(text, MAX_ENTRANCE_NOTES);
      if (!parsed.ok) return parsed;
      audit.entrance_notes = parsed.value;
    }
    if (step === "comment") {
      const parsed = validateBoundedText(text, MAX_COMMENT);
      if (!parsed.ok) return parsed;
      audit.comment = parsed.value;
    }
    if (step === "address") {
      const parsed = validateBoundedText(text, MAX_ADDRESS);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        audit,
        session: {
          ...session,
          draft: {
            ...session.draft,
            address: parsed.value ?? undefined,
          },
        },
        address: parsed.value ?? undefined,
      };
    }
    return { ok: true, audit, session };
  } catch {
    return { ok: false, reason: "invalid_number" };
  }
}

export function isEnumFactStep(step: string): boolean {
  return [
    "ramp_type",
    "parking",
    "toilet_exists",
    "toilet_accessible",
    "elevator",
  ].includes(step);
}
