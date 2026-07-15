export const AUDITOR_TELEGRAM_BOT_TOKEN = "AUDITOR_TELEGRAM_BOT_TOKEN";
export const AUDITOR_TELEGRAM_WEBHOOK_SECRET =
  "AUDITOR_TELEGRAM_WEBHOOK_SECRET";

const LEGACY_PRODUCT_TOKEN = "TELEGRAM_BOT_TOKEN";

export function requireAuditorEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function readAuditorBotToken(): string {
  return requireAuditorEnv(AUDITOR_TELEGRAM_BOT_TOKEN);
}

export function readAuditorWebhookSecret(): string {
  return requireAuditorEnv(AUDITOR_TELEGRAM_WEBHOOK_SECRET);
}

/** Auditor bot must never fall back to the product Mini App bot token. */
export function usesLegacyProductToken(): boolean {
  return Boolean(Deno.env.get(LEGACY_PRODUCT_TOKEN));
}
