export type UpdateClaimResult = "claimed" | "completed" | "processing";

export type IdempotencyStore = {
  claimUpdate(updateId: number): Promise<UpdateClaimResult>;
  completeUpdate(updateId: number): Promise<void>;
  releaseUpdate(updateId: number): Promise<void>;
};

export function ownsCallback(
  sessionTelegramId: number,
  actorTelegramId: number,
): boolean {
  return sessionTelegramId === actorTelegramId;
}
